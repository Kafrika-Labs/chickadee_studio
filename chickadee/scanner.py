import asyncio
import base64
import heapq
from dataclasses import asdict, dataclass, field
from datetime import datetime
import hashlib
import ipaddress
import itertools
import json
import os
import re
from pathlib import Path
import sys
import tempfile
from threading import Event
import time
from urllib.parse import parse_qsl, urljoin, urlsplit, urlunsplit
from urllib.error import HTTPError

from .authentication import AuthenticationRequired, LoginRedirect, is_login_url, requires_login, active_timeout, fetch_favicon
from . import __version__
from .detection import Rules, analyze, classify_elements
from .candidates import classify_candidates, CATEGORY_LABELS
from .image_ocr import (OCRSession, fetch_image, inline_image, recognized_text, unreadable_message,
                        image_metadata, MAX_IMAGE_REQUESTS, MAX_IMAGE_BYTES)
from .local_ai import enrich_report, visual_analysis, prepare_models
from .content_visual import enrich_content_images, model_contract as photo_model_contract
from .laya_review import enrich_laya, MAX_REVIEW_SECONDS
from .exports import CSV_COLUMNS, csv_bytes, atomic_write, extra_result
from .profiles import SiteProfile
from .site_access import SiteAccess, HEADER as SITE_ACCESS_HEADER
from .inspection import InspectionTrace, validate_inspection, validate_screenshots, SCREENSHOT_MAX_COUNT, SCREENSHOT_MAX_BYTES, OCR_MAX_OBSERVATIONS

# Keep the frozen browser close to the engine to fit Windows ZIP path limits.
# Source and older frozen builds keep Playwright's original directory layout.
if getattr(sys, "frozen", False):
    bundled_browsers = Path(sys._MEIPASS) / "browsers"
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(bundled_browsers) if bundled_browsers.is_dir() else "0"
else:
    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "0")


def normalize_url(value: str) -> str:
    value = value.strip()
    parts = urlsplit(value)
    if parts.scheme not in ("http", "https") or not parts.hostname or parts.username or parts.password:
        raise ValueError("http:// 또는 https://로 시작하는 웹사이트 URL을 입력하세요. 인증정보를 URL에 넣지 마세요.")
    _ = parts.port  # Validate malformed ports before launching the browser.
    return urlunsplit((parts.scheme, parts.netloc, parts.path or "/", parts.query, ""))


def origin(url: str) -> tuple:
    parts = urlsplit(url)
    return parts.scheme.lower(), (parts.hostname or "").lower(), parts.port or (443 if parts.scheme == "https" else 80)


def visit_key(url: str) -> tuple:
    parts = urlsplit(url)
    return origin(url), parts.path or "/", tuple(sorted(parse_qsl(parts.query, keep_blank_values=True)))


def navigation_priority(url: str) -> int:
    """Visit content and pagination before global menus, without guessing URLs."""
    parts = urlsplit(url)
    path = parts.path.casefold()
    keys = {k.casefold() for k, value in parse_qsl(parts.query) if value}
    if re.search(r"/(?:login|logout|join|signup|admin|auth)(?:/|\.|$)", path):
        return 40
    if path.startswith('/api/'):
        return 50
    if keys & {'board_idx', 'post_id', 'postid', 'article_id', 'articleid', 'nttid', 'wr_id', 'document_srl'} or re.search(r"(?:^|/)(?:view|read|detail)(?:[./]|$)|/(?:posts|articles)/\d+", path):
        return 0
    if re.search(r"(?:board|bbs|forum|posts|articles)", path):
        return 10
    if keys & {'q', 'query', 'keyword', 'searchword'} or 'search' in path:
        return 30
    return 20


def readonly_navigation(url: str) -> bool:
    parts = urlsplit(url)
    if re.search(r'/(?:write|edit|modify|delete|remove|logout|signout)(?:[./]|$)', parts.path.casefold()):
        return False
    return not any(key.casefold() in {'action', 'act', 'mode', 'cmd'} and
                   value.casefold() in {'write', 'edit', 'modify', 'delete', 'remove', 'insert', 'update', 'logout'}
                   for key, value in parse_qsl(parts.query))


def authentication_navigation(url: str) -> bool:
    """Authentication forms are handoff targets, not discovered content pages."""
    parts = urlsplit(url)
    if re.search(r'/(?:login|logon|signin|sign-in|sso|authorize|join|signup|register)(?:/|\.(?:do|php|asp|aspx|jsp|html?)$|$)', parts.path, re.I):
        return True
    return any(key.casefold() in {'action', 'act', 'mode', 'cmd'} and value.casefold() in
               {'login', 'signin', 'signup', 'register', 'join'} for key, value in parse_qsl(parts.query))


def image_document_key(url):
    """The same verified image may have inline/download presentation switches."""
    parts = urlsplit(url)
    return origin(url), parts.path or '/', tuple(sorted((key, value) for key, value in
        parse_qsl(parts.query, keep_blank_values=True) if key.casefold() not in {'inline', 'download', 'attachment'}))


def is_loopback(url: str) -> bool:
    host = urlsplit(url).hostname
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host or "").is_loopback
    except ValueError:
        return False


def validate_result(result):
    from jsonschema import Draft202012Validator
    schema_path = Path(__file__).resolve().parent.parent / "schemas" / "result.schema.json"
    Draft202012Validator(json.loads(schema_path.read_text(encoding="utf-8"))).validate(result)
    ids, keys = set(), set()
    for finding in result["findings"]:
        key = finding["url"], finding["location"], finding["technique"]
        if finding["id"] in ids or key in keys:
            raise ValueError("결과에 중복 ID 또는 중복 검출이 있습니다.")
        ids.add(finding["id"])
        keys.add(key)


def output_directory() -> Path:
    base = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent.parent
    return base / "results"


@dataclass(frozen=True)
class ScanConfig:
    entry_url: str
    max_pages: int = 50
    timeout_sec: float = 300
    page_timeout_sec: float = 15
    settle_ms: int = 500
    allow_network: bool = False
    rules_path: Path | None = None
    profile_path: Path | None = None
    retries: int = 1
    interval_sec: float = 1.0
    capture_previews: bool = False
    follow_links: bool = True
    ocr_enabled: bool = True
    ocr_techniques: bool = True
    ocr_candidates: bool = True
    detect_techniques: bool = True
    detect_candidates: bool = True
    ocr_max_images: int = 1000
    runtime_mode: str = 'standard'
    interactive_login: bool = False
    site_access: SiteAccess | None = field(default=None, repr=False)

    def __post_init__(self):
        normalize_url(self.entry_url)
        if type(self.ocr_enabled) is not bool or type(self.ocr_max_images) is not int or not 1 <= self.ocr_max_images <= 1000:
            raise ValueError('OCR 실행·이미지 한도 설정 오류')
        if self.runtime_mode not in ('standard', 'economy'): raise ValueError('실행 환경 모드 오류')
        if not self.allow_network and not is_loopback(self.entry_url):
            raise ValueError("로컬 전용 모드입니다. 외부 사이트를 검사하려면 --local-only 옵션 없이 실행하세요.")
        if not 1 <= self.max_pages <= 10000:
            raise ValueError("최대 페이지 수는 1~10000 사이여야 합니다.")
        if not 0 < self.timeout_sec <= 1800 or not 0 < self.page_timeout_sec <= 120:
            raise ValueError("전체 제한시간은 0초 초과~1800초, 페이지 제한은 0초 초과~120초여야 합니다.")
        if not 0 <= self.settle_ms <= 5000:
            raise ValueError("렌더링 대기는 0~5000ms 사이여야 합니다.")
        if type(self.retries) is not int or not 0 <= self.retries <= 3 or not 0 <= self.interval_sec <= 30:
            raise ValueError("재시도는 0~3회, 요청 간격은 0~30초여야 합니다.")
        Rules.load(self.rules_path)
        SiteProfile.load(self.profile_path)
        if not all(type(v) is bool for v in (self.interactive_login, self.ocr_enabled, self.ocr_techniques, self.ocr_candidates, self.capture_previews, self.follow_links, self.detect_techniques, self.detect_candidates)):
            raise ValueError("검사 단계 설정은 true/false여야 합니다.")
        if not (self.detect_techniques or self.detect_candidates):
            raise ValueError("하나 이상의 분석 단계를 연결하세요.")


@dataclass
class ScanOutcome:
    result: dict
    report: dict
    image_assets: dict = field(default_factory=dict, repr=False)

    def save(self, folder: Path) -> Path:
        validate_result(self.result)
        folder = Path(folder).resolve()
        folder.mkdir(parents=True, exist_ok=True)
        for name, data in self.image_assets.items():
            atomic_write(folder / name, data)
        validate_screenshots(self.report.get('screenshots', {}))
        for image in self.report.get('screenshots', {}).values():
            relative = 'evidence/' + image['sha256'] + '.jpg'
            atomic_write(folder / relative, base64.b64decode(image['data_url'].split(',', 1)[1]))
            image['relative_path'] = relative
        payload = (json.dumps(self.result, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
        csv_payload = csv_bytes(self.result, self.report)
        report = {**self.report, "result_sha256": hashlib.sha256(payload).hexdigest(), "output_path": str(folder / "result.json"),
                  "csv_sha256": hashlib.sha256(csv_payload).hexdigest(), "csv_columns": list(CSV_COLUMNS), "csv_schema_version": "1.0"}
        # Each file replaces atomically. A matching SHA-256 in the sidecar lets
        # consumers detect an interrupted write between the two replacements.
        extra_payload = (json.dumps(extra_result(self.result, self.report), ensure_ascii=False,
                                   indent=2, allow_nan=False) + '\n').encode('utf-8')
        for name, content in (("result.json", payload), ("result.csv", csv_payload),
                              ("result_extra.json", extra_payload),
                              ("scan-report.json", (json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8"))):
            atomic_write(folder / name, content)
        self.report.update(report)
        return folder / "result.json"

    def save_csv(self, path):
        validate_result(self.result)
        atomic_write(path, csv_bytes(self.result, self.report))
        return Path(path)

    @classmethod
    def load(cls, path: Path):
        path = Path(path)
        if path.stat().st_size > 20_000_000:
            raise ValueError("결과 파일은 20MB 이하여야 합니다.")
        payload = path.read_bytes()
        result = json.loads(payload.decode("utf-8-sig"))
        validate_result(result)
        report_path = path.with_name("scan-report.json")
        report = {"status": "imported", "pages_scanned": [], "errors": [], "evidence_details": {}}
        if report_path.exists():
            if report_path.stat().st_size > 20_000_000:
                raise ValueError("실행 보고서는 20MB 이하여야 합니다.")
            report = json.loads(report_path.read_text(encoding="utf-8"))
            if not isinstance(report, dict) or report.get("result_sha256") != hashlib.sha256(payload).hexdigest():
                raise ValueError("결과와 보고서의 해시가 일치하지 않습니다. 같은 실행의 파일 쌍을 가져오세요.")
            if report.get("status") not in ("completed", "partial", "failed", "cancelled") or not isinstance(report.get("pages_scanned"), list) or not isinstance(report.get("errors"), list) or not isinstance(report.get("evidence_details", {}), dict):
                raise ValueError("실행 보고서 형식이 올바르지 않습니다.")
            candidates = report.get("ad_candidates", [])
            ids = {f["id"] for f in result["findings"]}
            if not isinstance(candidates, list) or len(candidates) > 20000:
                raise ValueError("광고 후보 목록 형식이 올바르지 않습니다.")
            for candidate in candidates:
                if not isinstance(candidate, dict) or not all(isinstance(candidate.get(k), str) and candidate[k] for k in ("id", "url", "location", "evidence_text", "category")):
                    raise ValueError("광고 후보 필수 필드가 올바르지 않습니다.")
                normalize_url(candidate["url"])
                if candidate["id"] in ids or candidate["category"] not in CATEGORY_LABELS:
                    raise ValueError("광고 후보 ID 또는 분류가 올바르지 않습니다.")
                ids.add(candidate["id"])
                for key in ("matched_keywords", "reasons"):
                    if not isinstance(candidate.get(key, []), list) or not all(isinstance(s, str) for s in candidate.get(key, [])):
                        raise ValueError("광고 후보 근거는 문자열 배열이어야 합니다.")
        validate_inspection(report)
        return cls(result, report)


@dataclass
class _State:
    findings: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    pages: list = field(default_factory=list)
    seen_findings: set = field(default_factory=set)
    remaining: int = 0
    evidence_details: dict = field(default_factory=dict)
    actions: list = field(default_factory=list)
    blocked_requests: list = field(default_factory=list)
    retry_count: int = 0
    states_scanned: int = 0
    stopped_origins: dict = field(default_factory=dict)
    ad_candidates: list = field(default_factory=list)
    candidate_keys: dict = field(default_factory=dict)
    finding_scopes: set = field(default_factory=set)
    page_diagnostics: list = field(default_factory=list)
    discovered_urls: int = 1
    pending_urls: dict = field(default_factory=dict)
    trace: InspectionTrace = field(default_factory=InspectionTrace)
    screenshots: dict = field(default_factory=dict)
    screenshot_bytes: int = 0
    pending_redirects: dict = field(default_factory=dict)
    ocr: OCRSession = field(default_factory=OCRSession)
    image_context: object = None
    site_access: SiteAccess | None = field(default=None, repr=False)
    image_cache: dict = field(default_factory=dict)
    image_resource_keys: set = field(default_factory=set)
    image_requests: int = 0
    image_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    image_bytes: int = 0
    ocr_images: list = field(default_factory=list)
    ocr_seen: set = field(default_factory=set)
    ocr_references: dict = field(default_factory=dict)
    ocr_reused: int = 0
    ocr_cache: dict = field(default_factory=dict)
    image_assets: dict = field(default_factory=dict)
    ocr_previews_bytes: int = 0
    ocr_disabled: bool = False
    photo_enabled: bool = False
    ocr_enabled: bool = True
    ocr_max_images: int = 1000
    ocr_skipped: int = 0
    ocr_limit_reported: bool = False
    image_limit_reported: bool = False
    merged_observations: int = 0

    image_origins: set = field(default_factory=set)
    image_allow_network: bool = False


async def scan(config: ScanConfig, stop: Event | None = None, emit=None, control=None) -> ScanOutcome:
    stop = stop or Event()
    emit = emit or (lambda event: None)
    started = datetime.now().astimezone()
    clock = time.monotonic()
    state = _State(ocr_enabled=config.ocr_enabled, ocr_max_images=config.ocr_max_images)
    rules = Rules.load(config.rules_path)
    profile = SiteProfile.load(config.profile_path)
    status = "completed"
    emit({"kind": "status", "message": "브라우저를 준비하고 있습니다."})
    worker = asyncio.create_task(_crawl(config, state, emit, rules, profile, control))
    try:
        while not worker.done():
            if stop.is_set():
                status = "cancelled"
                worker.cancel()
                break
            if time.monotonic() - clock - (control.paused_seconds if control else 0) >= config.timeout_sec:
                status = "partial"
                state.errors.append({"url": config.entry_url, "message": "탐색 제한시간에 도달했습니다. 수집한 자료의 로컬 분석은 계속합니다."})
                worker.cancel()
                break
            await asyncio.wait({worker}, timeout=0.1)
        try:
            await worker
        except asyncio.CancelledError:
            if status == "completed":
                raise
        except Exception as exc:
            status = "partial" if state.pages else "failed"
            state.errors.append({"url": config.entry_url, "message": str(exc)})
    finally:
        if not worker.done():
            worker.cancel()
            await asyncio.gather(worker, return_exceptions=True)
        await state.ocr.close()
    for url, target in state.pending_redirects.items():
        state.errors.append({'url': url, 'message': '동적 HTTP 이동은 자동 추적하지 않았습니다: ' + target})
    if status == "completed" and (state.errors or state.remaining):
        status = "partial" if state.pages else "failed"
    finished = datetime.now().astimezone()
    result = {
        "meta": {"topic": "TOPIC", "entry_url": config.entry_url,
                 "started_at": started.isoformat(), "finished_at": finished.isoformat(),
                 "elapsed_sec": round(time.monotonic() - clock, 3), "tool_version": __version__},
        "findings": state.findings,
    }
    report = {"status": status, "pages_scanned": state.pages, "pages_remaining": state.remaining,
              "exploration": state.trace.export(), "evidence_packets": list(state.trace.packets.values()),
              "screenshots": state.screenshots,
              "ocr_images": [{k: v for k, v in image.items() if not k.startswith("_")} for image in state.ocr_images],
              "ocr_summary": _ocr_summary(state, config),
              "deduplication": {"merged_observations": state.merged_observations, "policy": "same_page_type_text_cross_source"},

              "page_diagnostics": state.page_diagnostics,
              "pending_urls": list(state.pending_urls.values()),
              "crawl_summary": {"discovered_urls": state.discovered_urls, "pages_scanned": len(state.pages),
                                "queue_remaining": state.remaining, "scheduling": "content-first"},
              "errors": state.errors, "finding_count": len(state.findings),
              "states_scanned": state.states_scanned, "retry_count": state.retry_count,
              "evidence_details": state.evidence_details, "actions": state.actions,
              "ad_candidates": _final_candidates(state),
              "blocked_requests": state.blocked_requests,
              "stopped_origins": {v["origin"]: v for v in state.stopped_origins.values()},
              "rules_version": rules.version, "profile": asdict(profile),
              "execution_mode": "network-explicit" if config.allow_network else "loopback-only",
              "limits": {"max_pages": config.max_pages, "timeout_sec": config.timeout_sec,
                         "page_timeout_sec": config.page_timeout_sec, "settle_ms": config.settle_ms,
                         "retries": config.retries, "interval_sec": config.interval_sec,
                         "timeout_scope": "collection", "analysis_timeout_sec": MAX_REVIEW_SECONDS},
              "enabled_stages": {"follow_links": config.follow_links, "techniques": config.detect_techniques,
                                 "candidates": config.detect_candidates, "ocr": config.ocr_enabled,
                                 "ocr_techniques": config.ocr_techniques, "ocr_candidates": config.ocr_candidates, "live_preview": config.capture_previews}}
    # Collection limits must never silently cut off already collected evidence.
    # Offline analysis has its own bounded budget and still honors user Stop.
    analysis_started = time.monotonic()
    remaining_analysis = lambda: max(0, MAX_REVIEW_SECONDS - (time.monotonic() - analysis_started))
    emit({'kind': 'phase', 'stage': 'candidates', 'action': 'local_ai',
          'analysis_timeout_sec': MAX_REVIEW_SECONDS,
          'message': '탐색과 별도의 로컬 분석 시간으로 수집한 본문과 OCR 문구를 처리합니다.'})
    await asyncio.to_thread(enrich_report, report, candidates=config.detect_candidates)
    emit({'kind':'phase','stage':'candidates','action':'photo_model','message':'이미지 내용을 ML로 분류합니다.'})
    await enrich_content_images(report, state.image_assets, candidates=config.detect_candidates,
        timeout_seconds=min(45, remaining_analysis()),stop=stop)
    laya = await enrich_laya(report, stop=stop, emit=emit,
        timeout_seconds=remaining_analysis(),
        candidates=config.detect_candidates)
    report['analysis_elapsed_sec'] = round(time.monotonic() - analysis_started, 3)
    if stop.is_set():
        report['status'] = 'cancelled'
    elif isinstance(laya, dict) and laya.get('omitted') and report['status'] == 'completed' and (
            laya.get('status') == 'partial' or laya.get('reason') in ('time_budget', 'timeout')):
        report['status'] = 'partial'
        report['errors'].append({'stage': 'laya', 'message': f"Laya 문맥 {laya['omitted']}개 미처리: 분석 제한시간 또는 실행 환경을 확인하세요."})
    emit({'kind': 'phase', 'stage': 'dedup', 'action': 'merge',
          'message': f'동일 문구의 본문·OCR 근거 {state.merged_observations}건을 합쳤습니다.'})
    result['meta'].update(finished_at=datetime.now().astimezone().isoformat(),
                          elapsed_sec=round(time.monotonic()-clock, 3))

    report["candidate_count"] = len(report["ad_candidates"])
    emit({'kind': 'local_ai', **report['local_ai']})
    report['paused_sec'] = round(control.paused_seconds if control else 0, 3)
    report['active_elapsed_sec'] = round(time.monotonic() - clock - report['paused_sec'], 3)
    report["csv_schema_version"] = "1.0"
    return ScanOutcome(result, report, state.image_assets)


def _ocr_element(image, record):
    return {**image, 'node_id': 'ocr:' + record['id'], 'parent_id': None,
            'text': record['text'], 'direct_text': record['text'], 'text_breaks': [],
            'source_kind': 'image_ocr', 'image_id': record['id'],
            'ocr': {'engine': record['engine'], 'model': record['model'], 'image_sha256': record['image_sha256'],
                    **{k: record[k] for k in ('text_truncated', 'confidence_threshold', 'accepted_lines', 'rejected_lines', 'mean_confidence')}}}


def _observation(hit, location, screenshot_id=None):
    return {'source_kind': hit.get('source_kind', 'dom_text'), 'image_id': hit.get('image_id'),
            'source_role': hit.get('source_role'),
            'location': location, 'text': hit['text'], 'screenshot_id': screenshot_id,
            'computed_style': hit.get('computed_style', {}),
            'transparent': hit.get('transparent', False), 'offscreen': hit.get('offscreen', False)}


def _cross_source_match(records, incoming, details=None):
    # Exact text apart from whitespace only: do not merge different ads or
    # normalize away homoglyph evidence. Keep every source location for review.
    key = (incoming['url'], incoming.get('technique') or incoming.get('category'),
           ' '.join(incoming['evidence_text'].split()))
    incoming_kind = incoming.get('source_kind', 'dom_text')
    for record in records:
        other = (record['url'], record.get('technique') or record.get('category'),
                 ' '.join(record['evidence_text'].split()))
        evidence = details.get(record['id'], {}) if details is not None else record
        if other == key and any(item['source_kind'] != incoming_kind for item in evidence.get('evidence_sources', [])):
            return record
    return None


def _ocr_summary(state, config):
    unreadable = sum(i.get('recognition_status') == 'unreadable' for i in state.ocr_images)
    failed = sum(i['status'] == 'failed' for i in state.ocr_images)
    return {'engine': 'PaddleOCR', 'images': len(state.ocr_images), 'unique_images': len(state.ocr_cache),
            'enabled': config.ocr_enabled, 'max_images': config.ocr_max_images, 'runtime_mode': config.runtime_mode,
            'completed': sum(i['status'] == 'completed' and i.get('recognition_status')!='skipped' for i in state.ocr_images),
            'failed': failed, 'unreadable': unreadable, 'skipped': state.ocr_skipped, 'reused': state.ocr_reused,
            'status': 'disabled' if not config.ocr_enabled else 'partial' if failed or unreadable or state.ocr_skipped
                      else 'completed' if state.ocr_images else 'no_images'}


def _final_candidates(state):
    candidates = [dict(c) for c in state.ad_candidates if (c['url'], c['scope_location']) not in state.finding_scopes]
    detail_hits = {}
    for candidate in candidates:
        if not candidate.get('related_content_url'):
            detail_hits.setdefault((candidate['url'], candidate['category']), candidate)
    result = []
    for candidate in candidates:
        detail = detail_hits.get((candidate.get('related_content_url'), candidate['category']))
        if detail is None:
            result.append(candidate)
        else:
            detail.setdefault('summary_observations', []).append({k: candidate[k] for k in ('url', 'location', 'evidence_text')})
    return result


async def _crawl(config: ScanConfig, state: _State, emit, rules: Rules, profile: SiteProfile, control=None):
    from playwright.async_api import async_playwright
    try: state.photo_enabled=bool(await asyncio.to_thread(photo_model_contract))
    except Exception: state.photo_enabled=False

    emit({'kind': 'phase', 'stage': 'collector', 'action': 'model_load', 'message': '로컬 AI 모델을 준비합니다.'})
    try:
        await asyncio.to_thread(prepare_models)
    except Exception:
        emit({'kind': 'warning', 'message': '로컬 AI 모델 준비 실패: 원문·규칙 검사는 계속합니다.'})

    script = Path(__file__).with_name("extract.js").read_text(encoding="utf-8")
    # Cancelling Playwright's __aenter__ can orphan its transport task. Finish
    # startup under a shield, then explicitly stop it before propagating cancel.
    starter = asyncio.create_task(async_playwright().start())
    try:
        pw = await asyncio.shield(starter)
    except asyncio.CancelledError:
        pw = await starter
        await pw.stop()
        raise
    browser = None
    try:
        try:
            browser = await pw.chromium.launch(headless=True, chromium_sandbox=True)
        except Exception as exc:
            raise RuntimeError("Chromium을 시작하지 못했습니다. 소스 실행 시 python -m playwright install chromium을 PLAYWRIGHT_BROWSERS_PATH=0 설정 후 실행하세요. " + str(exc)) from exc
        try:
            context = await browser.new_context(viewport={"width": 1366, "height": 900},
                                                accept_downloads=False, service_workers="block")
            allowed = {origin(config.entry_url), *(origin(url) for url in profile.allowed_resource_origins)}
            state.image_context = context
            state.site_access = config.site_access
            state.image_origins = allowed
            state.image_allow_network = config.allow_network
            login_targets = {}
            async def guard(route):
                request = route.request
                reason = None
                main_document = request.resource_type == 'document' and request.frame == request.frame.page.main_frame
                if main_document and is_login_url(request.url) and (config.allow_network or is_loopback(request.url)):
                    login_targets[request.frame.page] = request.url
                    await route.fulfill(status=200, content_type='text/html', body='<html></html>')
                    return
                essential = request.resource_type in ("document", "stylesheet", "script")
                if request.method not in ("GET", "HEAD"):
                    reason = "GET/HEAD 외 요청 차단"
                    essential = False
                elif request.resource_type in ("media", "font"):
                    await route.abort()
                    return
                else:
                    try:
                        target = normalize_url(request.url)
                        if not config.allow_network and not is_loopback(target):
                            reason = "로컬 전용 모드: 외부 자원 차단"
                        elif origin(target) in state.stopped_origins:
                            reason = "HTTP 429 수신으로 해당 origin 추가 요청 중단"
                        elif request.resource_type == 'document' and origin(target) != origin(config.entry_url):
                            reason = "사이트 밖 문서 이동·리다이렉션 차단"
                        elif origin(target) not in allowed:
                            reason = "허용되지 않은 origin 차단"
                    except ValueError:
                        reason = "HTTP(S) 외 자원 차단"
                if reason:
                    entry = {"url": request.url, "method": request.method, "type": request.resource_type, "reason": reason}
                    emit({"kind": "request_blocked", **entry})
                    if len(state.blocked_requests) < 200:
                        state.blocked_requests.append(entry)
                    if essential and not any(e["url"] == request.url for e in state.errors):
                        state.errors.append({"url": request.url, "message": reason + ": 콘텐츠가 누락될 수 있습니다."})
                    await route.abort()
                else:
                    if request.resource_type == 'image':
                        try:
                            data, mime = await _fetch_image_bounded(request.url, state)
                            await route.fulfill(status=200, body=data, content_type=mime)
                        except Exception as error:
                            emit({'kind': 'image_skipped', 'url': request.url[:2000], 'message': str(error)[:160]})
                            await route.abort()
                        return
                    # Inspect each redirect response before Chromium can follow it.
                    # route.continue_ alone may follow an HTTP redirect without a
                    # second routing callback, bypassing an origin-only guard.
                    try:
                        response = await _fetch_route(route, config, state, emit, request.url)
                    except Exception as error:
                        message = str(error).split('\n', 1)[0][:300] or type(error).__name__
                        emit({'kind': 'request_failed', 'url': request.url, 'message': message})
                        if essential:
                            state.errors.append({'url': request.url, 'message': message})
                        try:
                            await route.abort()
                        except Exception:
                            pass  # The page may already have closed after cancellation.
                        return
                    destination = response.headers.get('location')
                    if response.status in (301, 302, 303, 307, 308) and destination:
                        target = urljoin(request.url, destination)
                        if main_document and is_login_url(target) and (config.allow_network or is_loopback(target)):
                            login_targets[request.frame.page] = target
                            await response.dispose()
                            await route.fulfill(status=200, content_type='text/html', body='<html></html>')
                            return
                        try:
                            permitted = (origin(target) == origin(config.entry_url) if request.resource_type == 'document'
                                         else origin(target) in allowed)
                            normalize_url(target)
                        except ValueError:
                            permitted = False
                        if permitted and request.resource_type == 'document' and request.frame == request.frame.page.main_frame:
                            # Never fulfill a redirect for Chromium to auto-follow:
                            # subsequent hops may bypass routing. _navigate follows
                            # each validated hop as a NEW navigation instead.
                            state.pending_redirects[request.url] = target
                            emit({'kind': 'navigation_redirect', 'url': request.url, 'target_url': target,
                                  'http_status': response.status})
                            await response.dispose()
                            await route.fulfill(status=200, content_type='text/html', body='<html></html>')
                            return
                        else:
                            entry = {'url': request.url, 'target_url': target, 'type': request.resource_type,
                                     'method': request.method, 'http_status': response.status,
                                     'reason': '사이트 밖 리다이렉션 응답 차단' if not permitted else '리소스·iframe HTTP 리다이렉션 제한'}
                            if len(state.blocked_requests) < 200:
                                state.blocked_requests.append(entry)
                            emit({'kind': 'request_blocked', **entry})
                            state.errors.append({'url': request.url, 'message': entry['reason']})
                            await response.dispose()
                            await route.abort()
                            return
                    await route.fulfill(response=response)
                    await response.dispose()
            await context.route("**/*", guard)
            def observe_response(response):
                if response.status != 429:
                    return
                source = origin(response.url)
                if source not in state.stopped_origins:
                    parts = urlsplit(response.url)
                    state.stopped_origins[source] = {"origin": urlunsplit((parts.scheme, parts.netloc, "", "", "")),
                        "status": 429, "url": response.url,
                        "retry_after": response.headers.get("retry-after"), "policy": "stop-origin"}
                    state.errors.append({"url": response.url, "message": "HTTP 429: 같은 origin의 새 요청과 재시도를 중단했습니다."})
                    emit({"kind": "warning", "message": "HTTP 429: 해당 사이트 요청을 중단합니다."})
            context.on("response", observe_response)
            context.on("response", lambda response: emit({"kind": "http_response", "url": response.url,
                "http_status": response.status, "method": response.request.method, "resource_type": response.request.resource_type}))
            async def block_socket(socket):
                await socket.close(reason="Chickadee: WebSocket connections are disabled")
            await context.route_web_socket("**/*", block_socket)
            sequence = itertools.count()
            entry = normalize_url(config.entry_url)
            queue = [(0, next(sequence), entry)]
            queued = {visit_key(entry)}
            parents = {visit_key(entry): None}
            state.pending_urls[visit_key(entry)] = {'url': entry, 'discovered_from': None, 'priority': 0}
            state.remaining = 1
            visited = set()
            site = origin(entry)
            attempts = 0
            while queue and attempts < config.max_pages:
                if attempts:
                    await asyncio.sleep(config.interval_sec)
                if control:
                    await control.checkpoint(emit)
                if site in state.stopped_origins:
                    break
                _, _, url = heapq.heappop(queue)
                state.remaining = len(queue)
                key = visit_key(url)
                state.pending_urls.pop(key, None)
                if key in visited:
                    continue
                if image_document_key(url) in state.image_resource_keys:
                    visited.add(key)
                    state.trace.page(url, 'skipped', emit, parents.get(key))
                    emit({'kind': 'phase', 'stage': 'collector', 'action': 'image_resource', 'url': url,
                          'message': '이미지 수집 경로에서 처리한 첨부파일입니다. 문서 방문을 생략합니다.'})
                    continue
                visited.add(key)
                attempts += 1
                state.remaining = len(queue) + 1
                emit({"kind": "status", "message": f"{attempts}/{config.max_pages} 페이지 점검 중: {url}"})
                emit({"kind": "progress", "pages_scanned": len(state.pages), "attempts": attempts,
                      "queue_remaining": len(queue), "max_pages": config.max_pages})
                emit({"kind": "phase", "stage": "browser", "action": "navigate", "url": url,
                      "message": "페이지로 이동하고 HTML 응답을 확인합니다."})
                state.trace.page(url, 'inspecting', emit, parents.get(key))
                page = await context.new_page()
                page_started = time.monotonic()
                diagnostic = {"url": url, "priority": navigation_priority(url), "status": "inspecting",
                              "links_discovered": 0, "links_queued": 0, "elements_examined": 0,
                              "discovered_from": parents.get(key)}
                state.page_diagnostics.append(diagnostic)
                findings_before, candidates_before = len(state.findings), len(state.ad_candidates)
                access_denials = []
                async def dismiss_dialog(dialog):
                    message = re.sub(r'\s+', ' ', dialog.message).strip()[:200]
                    if re.search(r'권한이 없|접근.{0,8}(?:금지|불가|제한)|access denied|permission denied', message, re.I):
                        access_denials.append(message)
                    await dialog.dismiss()
                page.on("dialog", dismiss_dialog)
                page.on("popup", lambda popup: popup.close())
                try:
                    identity = {}
                    icon_url = urljoin(url, '/favicon.ico')
                    async def check_login(response=None):
                        nonlocal icon_url
                        if access_denials:
                            raise RuntimeError('접근 제한으로 미수집: ' + access_denials[0])
                        redirect = state.pending_redirects.pop(page.url, None)
                        if redirect:
                            response = await _navigate(page, redirect, config, state, emit)
                            await page.wait_for_timeout(config.settle_ms)
                        target = login_targets.pop(page, None)
                        if target or await requires_login(page, response):
                            raise LoginRedirect(target or page.url)
                        if origin(page.url) == origin(url):
                            metadata = await page.evaluate("""() => ({title: document.title,
                                icon: document.querySelector('link[rel~="icon"]')?.href})""")
                            if metadata['title']:
                                identity['title'] = metadata['title'][:200]
                            if metadata['icon'] and origin(metadata['icon']) == origin(url):
                                icon_url = metadata['icon']

                    async def inspect_once():
                        nonlocal site
                        try:
                            response = await _navigate(page, url, config, state, emit)
                        except Exception:
                            if access_denials:
                                raise RuntimeError('접근 제한으로 미수집: ' + access_denials[0]) from None
                            raise
                        await page.wait_for_timeout(config.settle_ms)
                        await check_login(response)
                        diagnostic["final_url"] = page.url
                        diagnostic["http_status"] = response.status if response else None
                        diagnostic["title"] = await page.title()
                        emit({"kind": "phase", "stage": "browser", "action": "response", "url": page.url,
                              "http_status": diagnostic["http_status"], "message": "응답 수신 · 렌더링 준비", "title": diagnostic['title']})
                        if response and response.status >= 400:
                            raise RuntimeError(f"HTTP {response.status}")
                        if response and "html" not in response.headers.get("content-type", "text/html"):
                            raise RuntimeError("HTML 문서가 아니어서 점검하지 않았습니다.")
                        if origin(page.url) != origin(config.entry_url):
                            raise RuntimeError("검사 대상 문서를 열지 못했습니다. 빈 화면 또는 다른 사이트로 이동했습니다.")
                        document = await page.evaluate("""() => {
                            const body = document.body;
                            const walker = body && document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
                            let text = false, node;
                            while (walker && (node = walker.nextNode())) {
                                if (node.textContent.trim() && !node.parentElement.closest('script,style,noscript,template')) {
                                    text = true; break;
                                }
                            }
                            const media = body?.querySelectorAll('img,svg,canvas,video,iframe,object,embed').length || 0;
                            const backgrounds = body && !text && !media && [body, ...body.querySelectorAll('*')]
                                .slice(0, 5000).some(el => getComputedStyle(el).backgroundImage !== 'none');
                            return {hasBody: !!body, text, media: media || Number(backgrounds)};
                        }""")
                        if not document['hasBody'] or not (document['text'] or document['media']):
                            raise RuntimeError("본문과 이미지가 없는 빈 문서입니다. 정상 검사로 처리하지 않습니다.")
                        if attempts == 1:
                            site = origin(page.url)
                        elif origin(page.url) != site:
                            raise RuntimeError("다른 사이트로 이동되어 점검하지 않았습니다.")
                        final_key = visit_key(page.url)
                        if final_key in visited and final_key != key:
                            return []
                        visited.add(final_key)
                        return await _inspect_dynamic(page, config, profile, rules, site, script, state, emit, check_login)

                    async def inspect():
                        login_attempts = 0
                        while True:
                            try:
                                return await inspect_once()
                            except Exception as error:
                                # Navigation may destroy an execution context before the next snapshot.
                                if not isinstance(error, LoginRedirect):
                                    try:
                                        await check_login()
                                    except LoginRedirect as redirect:
                                        error = redirect
                                if not isinstance(error, LoginRedirect):
                                    raise
                                if not config.interactive_login or not control:
                                    raise AuthenticationRequired('로그인 필요로 미수집') from None
                                if login_attempts >= 2:
                                    raise AuthenticationRequired('로그인 상태를 확인하지 못했습니다. 반복 요청을 중단하고 미수집으로 기록합니다.') from None
                                try:
                                    if config.allow_network or is_loopback(icon_url):
                                        identity['favicon'] = await asyncio.to_thread(fetch_favicon, icon_url)
                                except Exception:
                                    pass
                                decision = await control.login.wait(error.url, url, await context.cookies(), emit, identity)
                                if decision.get('skip'):
                                    raise AuthenticationRequired('사용자가 로그인 페이지를 건너뛰었습니다. 인증 필요로 미수집') from None
                                await context.add_cookies(decision['cookies'])
                                login_attempts += 1
                                state.image_cache.clear()
                                visited.discard(visit_key(page.url))
                    links = await active_timeout(inspect(), config.page_timeout_sec, control.login if control else None,
                                                 excluded_seconds=lambda: state.ocr.elapsed_seconds)
                    diagnostic["links_discovered"] = len(links)
                    diagnostic["status"] = "scanned"
                    if page.url not in state.pages:
                        state.pages.append(page.url)
                    for link in links if config.follow_links else []:
                        try:
                            candidate = normalize_url(link)
                            candidate_key = visit_key(candidate)
                        except ValueError:
                            continue
                        if origin(candidate) == site and urlsplit(candidate).path.startswith(profile.path_prefix) and candidate_key not in queued and candidate_key not in visited:
                            if not readonly_navigation(candidate) or authentication_navigation(candidate) or image_document_key(candidate) in state.image_resource_keys:
                                continue
                            if Path(urlsplit(candidate).path).suffix.lower() in {".pdf", ".zip", ".exe", ".hwp", ".hwpx", ".docx", ".xlsx", ".png", ".jpg", ".mp4"}:
                                continue
                            if len(queued) >= 20000:
                                raise RuntimeError("탐색 URL 안전 한도 20000개에 도달했습니다.")
                            heapq.heappush(queue, (navigation_priority(candidate), next(sequence), candidate))
                            queued.add(candidate_key)
                            parents[candidate_key] = page.url
                            diagnostic["links_queued"] += 1
                            state.discovered_urls = len(queued)
                            discovery = {'url': candidate, 'discovered_from': page.url, 'priority': navigation_priority(candidate)}
                            state.pending_urls[candidate_key] = discovery
                            emit({'kind': 'url_discovered', **discovery})
                            state.trace.page(candidate, 'pending', emit, page.url)
                except Exception as exc:
                    diagnostic["status"] = "authentication_required" if isinstance(exc, AuthenticationRequired) else "error"
                    diagnostic["error"] = str(exc) or "페이지 제한시간 초과"
                    state.errors.append({"url": url, "message": str(exc) or "페이지 제한시간을 초과했습니다."})
                    emit({"kind": "warning", "message": f"점검 누락: {url} - {exc or '페이지 제한시간 초과'}"})
                finally:
                    diagnostic["elapsed_sec"] = round(time.monotonic() - page_started, 3)
                    state.trace.page(url, diagnostic['status'], emit)
                    diagnostic["findings_added"] = len(state.findings) - findings_before
                    diagnostic["candidates_added"] = len(state.ad_candidates) - candidates_before
                    emit({"kind": "page_complete", "page": diagnostic, "pages_scanned": len(state.pages),
                          "queue_remaining": len(queue), "discovered_urls": state.discovered_urls})
                    login_targets.pop(page, None)
                    await page.close()
                state.remaining = len(queue)
            if queue and site not in state.stopped_origins:
                state.errors.append({"url": config.entry_url, "message": "최대 페이지 수에 도달했습니다. 일부 결과입니다."})
        finally:
            await browser.close()
    finally:
        await pw.stop()


async def _fetch_route(route, config, state, emit, url):
    for attempt in range(min(1, config.retries) + 1):
        try:
            options = {}
            if config.site_access:
                headers = {k: v for k, v in (await route.request.all_headers()).items()
                           if k.lower() != SITE_ACCESS_HEADER.lower()}
                headers.update(config.site_access.headers(url, route.request.method))
                options['headers'] = headers
            return await route.fetch(max_redirects=0, timeout=int(config.page_timeout_sec * 1000), **options)
        except Exception as error:
            if attempt or not config.retries or not any(token in str(error) for token in
                    ('EFAULT', 'ENOBUFS', 'ECONNRESET', 'ERR_CONNECTION_RESET')):
                if config.site_access:
                    raise RuntimeError(config.site_access.redact(error)) from None
                raise
            state.retry_count += 1
            emit({'kind': 'status', 'url': url, 'message': '일시 연결 오류 · 같은 읽기 요청을 한 번 재시도합니다.'})
            await asyncio.sleep(.25)


async def _navigate(page, url, config, state, emit):
    for attempt in range(config.retries + 1):
        if origin(url) in state.stopped_origins:
            raise RuntimeError("HTTP 429 수신으로 해당 origin 재시도를 중단했습니다.")
        try:
            current, redirects = url, set()
            for hop in range(7):
                try:
                    response = await page.goto(current, wait_until="domcontentloaded", timeout=int(config.page_timeout_sec * 1000))
                except Exception:
                    if current not in state.pending_redirects:
                        raise
                target = state.pending_redirects.pop(current, None)
                if target is None:
                    break
                if target in redirects or hop == 6 or origin(target) != origin(config.entry_url):
                    raise RuntimeError('리다이렉션 반복·횟수·사이트 범위 제한') from None
                redirects.add(current)
                current = target
            # Rate limiting ends collection for the origin; never retry 429.
            retryable = response and response.status >= 500
            if not retryable or attempt == config.retries:
                return response
            try:
                delay = min(5, max(0.5, float(response.headers.get("retry-after", "1"))))
            except ValueError:
                delay = 1
        except Exception:
            if attempt == config.retries or origin(url) in state.stopped_origins or any(r["url"] == url for r in state.blocked_requests):
                raise
            delay = min(5, 1 + attempt)
        state.retry_count += 1
        emit({"kind": "status", "message": f"일시 오류 재시도 {attempt + 1}/{config.retries}: {url}"})
        await asyncio.sleep(delay)


_FINGERPRINT = """() => {
    const html = document.body?.innerHTML || '';
    let hash = 2166136261;
    const limit = 4000000;
    for (let i=0; i<Math.min(html.length, limit); i++) hash = Math.imul(hash ^ html.charCodeAt(i), 16777619);
    return {signature: JSON.stringify([location.href, html.length, hash >>> 0,
      scrollX, scrollY, innerWidth, innerHeight]), truncated: html.length > limit};
}"""


async def _inspect_dynamic(page, config, profile, rules, site, script, state, emit, check_login=None):
    links, seen = [], set()
    async def snapshot(action='초기 수집'):
        if check_login:
            await check_login()
        if site in state.stopped_origins:
            raise RuntimeError("HTTP 429 수신으로 해당 origin 수집을 중단했습니다.")
        if origin(page.url) != site:
            raise RuntimeError("설정된 동작이 다른 사이트로 이동하여 점검을 중단했습니다.")
        fingerprint = await page.evaluate(_FINGERPRINT)
        if fingerprint['truncated'] and not any('DOM 상태 비교 한도' in e['message'] for e in state.errors):
            state.errors.append({"url": page.url, "message": "DOM 상태 비교 한도(4MB) 초과: 일부 변경을 놓칠 수 있습니다."})
        if fingerprint['signature'] not in seen:
            seen.add(fingerprint['signature'])
            state.states_scanned += 1
            state.trace.snapshot(page.url, fingerprint['signature'], action, emit)
            emit({"kind": "phase", "stage": "collector", "action": "extract", "url": page.url,
                  "message": "DOM·본문·계산된 CSS·링크를 수집합니다."})
            links.extend(await _inspect_frame(page.main_frame, "", {}, page.url, script, state, emit, rules,
                                              profile.content_selector, config.detect_techniques, config.detect_candidates, config.ocr_enabled, config.ocr_techniques, config.ocr_candidates))
            # Reserve the remaining bounded screenshot budget for actual hits.
            if config.detect_candidates and page.url not in state.pages and len(state.screenshots) < 4:
                await _evidence_screenshot(page, state, emit)

            if config.capture_previews:
                try:
                    pixels = await page.screenshot(type='jpeg', quality=45, timeout=1500)
                    emit({"kind": "preview", "url": page.url, "title": await page.title(),
                          "data_url": 'data:image/jpeg;base64,' + base64.b64encode(pixels).decode('ascii')})
                except Exception:
                    emit({"kind": "preview_unavailable", "url": page.url, "message": "화면 미리보기를 생성하지 못했습니다. 본문 검사는 계속합니다."})
            if page.url not in state.pages:
                state.pages.append(page.url)
        return fingerprint
    await page.wait_for_timeout(config.settle_ms)
    await page.evaluate("document.querySelectorAll('details').forEach(el => el.open = true)")
    await page.wait_for_timeout(config.settle_ms)
    previous = await snapshot()
    quiet = 0
    for step in range(profile.scroll_steps):
        emit({"kind": "phase", "stage": "collector", "action": "scroll", "url": page.url,
              "message": f"스크롤 {step + 1}: 지연 로딩과 숨은 콘텐츠 변경을 확인합니다."})
        await page.evaluate("window.scrollTo(0, document.body?.scrollHeight || 0)")
        await page.wait_for_timeout(config.settle_ms)
        current = await snapshot(f'스크롤 {step + 1}')
        quiet = quiet + 1 if current == previous else 0
        if quiet >= 2:
            break
        if step == profile.scroll_steps - 1 and current != previous:
            state.errors.append({"url": page.url, "message": "스크롤 수집 한도에서 콘텐츠가 계속 변경되었습니다. 일부 결과입니다."})
        previous = current
    await page.evaluate("window.scrollTo(0, 0)")
    for action_index in range(profile.max_actions if profile.controls else 0):
        chosen = None
        for selector in profile.controls:
            control = page.locator(selector)
            count = await control.count()
            if count > 1:
                raise ValueError(f"읽기용 선택자가 여러 요소와 일치합니다: {selector}")
            if count == 1 and await control.is_visible() and await control.is_enabled():
                chosen = selector, control
                break
        if chosen is None:
            break
        selector, control = chosen
        allowed = await control.evaluate("""el => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'button') return el.type === 'button' || !el.closest('form');
            if (tag === 'summary') return true;
            if (tag === 'a') return !el.getAttribute('href') || /^(#|javascript:)/i.test(el.getAttribute('href'));
            return el.getAttribute('role') === 'button' && !el.closest('form');
        }""")
        if not allowed:
            raise ValueError(f"폼 제출 또는 일반 링크는 읽기용 클릭 대상이 아닙니다: {selector}")
        before = await page.evaluate(_FINGERPRINT)
        state.actions.append({"url": page.url, "selector": selector, "index": action_index + 1})
        emit({"kind": "phase", "stage": "collector", "action": "read_control", "url": page.url,
              "selector": selector, "message": "설정된 읽기 버튼을 실행합니다."})
        await control.click(timeout=min(3000, int(config.page_timeout_sec * 1000)), no_wait_after=True)
        await page.wait_for_timeout(config.settle_ms)
        after = await snapshot('읽기 버튼: ' + selector)
        if after == before:
            state.errors.append({"url": page.url, "message": f"설정한 읽기 동작의 콘텐츠 변경을 확인하지 못했습니다: {selector}"})
            break
        if action_index == profile.max_actions - 1:
            if any([await page.locator(s).count() == 1 and await page.locator(s).is_visible() and await page.locator(s).is_enabled() for s in profile.controls]):
                state.errors.append({"url": page.url, "message": "읽기 동작 한도에 도달했습니다. 일부 결과일 수 있습니다."})
    if check_login:
        await check_login()
    return list(dict.fromkeys(links))


async def _inspect_frame(frame, prefix, inherited, page_url, script, state, emit, rules=None, content_selector=None,
                         detect_techniques=True, detect_candidates=True, ocr_enabled=True, ocr_techniques=True, ocr_candidates=True):
    data = await frame.evaluate(script, {"contentSelector": content_selector})
    state.trace.capture(data['elements'], page_url, prefix, emit, inherited)
    ocr_elements = []
    if (ocr_enabled and ((detect_techniques and ocr_techniques) or (detect_candidates and ocr_candidates))) or (state.photo_enabled and detect_candidates):
        ocr_elements = await _inspect_images(frame, data.get('images', []), prefix, page_url, state, emit, rules)
        state.trace.capture(ocr_elements, page_url, prefix, emit, inherited)
        if data.get('images_truncated'):
            state.ocr_skipped += 1
            state.errors.append({'url': page_url, 'message': '이미지 수집 한도 도달: 일부 이미지를 처리하지 못했습니다.'})
    elif not ocr_enabled:
        _record_skipped_images(data.get('images', []), prefix, page_url, state)
    if state.page_diagnostics:
        diagnostic = state.page_diagnostics[-1]
        diagnostic["elements_examined"] += len(data["elements"])
        if content_selector:
            diagnostic["content_selector"] = content_selector
            diagnostic["content_roots_matched"] = data.get("content_roots_matched", 0)
    if data["truncated"] or data["links_truncated"]:
        state.errors.append({"url": page_url, "message": "요소·텍스트·링크 수집 한도 초과: 일부 콘텐츠가 누락되었습니다."})
    links = data["links"]
    if detect_techniques:
        emit({"kind": "phase", "stage": "techniques", "action": "analyze", "url": page_url,
              "message": f"{len(data['elements'])}개 요소의 문자 위장·자모·투명·화면 밖 은닉을 검사합니다.", "frame_depth": prefix.count(' >>> ')})
    hits = classify_elements(data["elements"] + (ocr_elements if ocr_techniques else []), inherited, rules) if detect_techniques else []
    candidates = classify_candidates(data["elements"] + (ocr_elements if ocr_candidates else []), rules) if detect_candidates else []
    async def capture(hit):
        target = None if hit.get('transparent') or hit.get('offscreen') else frame.locator(hit['location']).first
        return await _evidence_screenshot(frame.page, state, emit, target=target, location=prefix + hit['location'], frame=frame)
    for hit in hits:
        location = prefix + hit["location"]
        scope = prefix + (hit.get("content_scope") or hit["location"])
        state.finding_scopes.add((page_url, scope))
        key = page_url, location, hit["technique"]
        if key in state.seen_findings:
            continue
        screenshot_id = await capture(hit)
        state.seen_findings.add(key)
        finding = {"id": f"f_{len(state.findings) + 1:05d}", "url": page_url, "is_violation": True,
                   "location": location, "evidence_text": hit["text"], "technique": hit["technique"]}
        source = _observation(hit, location, screenshot_id)
        previous = _cross_source_match(state.findings, {**finding, 'source_kind': hit.get('source_kind', 'dom_text')}, state.evidence_details)
        if previous:
            state.evidence_details[previous['id']]['evidence_sources'].append(source)
            state.merged_observations += 1
            emit({'kind': 'finding', 'finding': previous, 'detail': state.evidence_details[previous['id']]})
            continue
        state.findings.append(finding)
        state.evidence_details[finding["id"]] = {"analysis": hit["analysis"],
            "url": page_url, "location": location,
            "source_kind": hit.get("source_kind", "dom_text"), "image_id": hit.get("image_id"),
            "evidence_sources": [source],

            "style_reasons": hit.get("reasons", []), "computed_style": hit.get("computed_style", {}),
            "frame_flags": inherited, "action_sequence": list(state.actions),
            "scope_location": scope, "observed_at": datetime.now().astimezone().isoformat(),
            "screenshot_id": screenshot_id,
            "screenshot_region": await _screen_region(frame, hit['location']) if screenshot_id else None}
        emit({"kind": "finding", "finding": finding, "detail": state.evidence_details[finding['id']]})
    if detect_candidates:
        emit({"kind": "phase", "stage": "candidates", "action": "analyze", "url": page_url,
              "message": "광고 주제·권유 문맥·정상 대조 문맥을 분석합니다."})
    for hit in candidates:
        scope = prefix + (hit.get("content_scope") or hit["location"])
        key = page_url, scope, hit["category"]
        if (page_url, scope) in state.finding_scopes:
            continue
        existing = next((row for row in state.ad_candidates if row['id'] == state.candidate_keys.get(key)), None)
        source_hits = hit.get('evidence_hits', [hit])
        if existing:
            source_hits = [item for item in source_hits if not any(
                source.get('location') == prefix + item['location'] and source.get('text') == item['text'] and
                source.get('source_kind') == item.get('source_kind', 'dom_text')
                for source in existing.get('evidence_sources', []))]
            if not source_hits:
                continue
        screenshot_id = await capture(hit)
        candidate = {"id": f"c_{len(state.ad_candidates) + 1:05d}", "url": page_url,
                     "location": prefix + hit["location"], "scope_location": scope,
                     "evidence_text": hit["text"], "category": hit["category"], "review_required": True,
                     "matched_keywords": hit["matched_keywords"], "reasons": hit["reasons"],
                     "observed_at": datetime.now().astimezone().isoformat(), "analysis": hit.get("analysis", {}),
                     "screenshot_id": screenshot_id,
                     "screenshot_region": await _screen_region(frame, hit['location']) if screenshot_id else None}
        candidate.update(source_kind=hit.get('source_kind', 'dom_text'), image_id=hit.get('image_id'),
                         source_role=hit.get('source_role'),
                         evidence_sources=[_observation(item, prefix + item['location'],
                             screenshot_id if item['location'] == hit['location'] else await capture(item))
                             for item in source_hits])
        previous = existing or _cross_source_match(state.ad_candidates, candidate)
        if previous:
            previous['evidence_sources'].extend(candidate['evidence_sources'])
            previous['matched_keywords'] = list(dict.fromkeys([*previous.get('matched_keywords', []), *candidate['matched_keywords']]))
            previous['reasons'] = list(dict.fromkeys([*previous.get('reasons', []), *candidate['reasons']]))
            state.candidate_keys[key] = previous['id']
            state.merged_observations += 1
            emit({'kind': 'candidate', 'candidate': previous})
            continue
        if hit.get('related_content_url'):
            candidate['related_content_url'] = hit['related_content_url']
        state.candidate_keys[key] = candidate["id"]
        state.ad_candidates.append(candidate)
        emit({"kind": "candidate", "candidate": candidate})
    for child in frame.child_frames:
        try:
            element = await child.frame_element()
            if content_selector and not await element.evaluate("(el, selector) => !!el.closest(selector)", content_selector):
                continue
            # Frame DOM elements appear in extract.js whenever they own fallback
            # text. Use a dedicated selector/style probe even for empty frames.
            probe = await element.evaluate(_FRAME_PROBE)
            flags = {key: inherited.get(key, False) or probe[key] for key in ("transparent", "offscreen")}
            frame_selector = probe["selector"]
            if probe["src"] is not None:
                frame_selector += "[src=" + json.dumps(probe["src"], ensure_ascii=False) + "]"
            await child.wait_for_load_state("domcontentloaded", timeout=1500)
            links.extend(await _inspect_frame(child, prefix + frame_selector + " >>> ", flags, page_url, script, state, emit, rules,
                                              None, detect_techniques, detect_candidates, ocr_enabled, ocr_techniques, ocr_candidates))
        except Exception as exc:
            state.errors.append({"url": page_url, "message": f"iframe 점검 실패 ({child.url}): {exc}"})
    return links


async def _screen_region(frame, selector):
    try:
        # bounding_box uses top-level viewport coordinates even inside an iframe.
        return await frame.locator(selector).first.bounding_box(timeout=300)
    except Exception:
        return None


class ImageBudgetExceeded(ValueError):
    pass


async def _fetch_image_bounded(url, state):
    url = normalize_url(url)
    if origin(url) not in state.image_origins or not state.image_allow_network and not is_loopback(url):
        raise ValueError('허용되지 않은 이미지 origin')
    async with state.image_lock:
        if origin(url) in state.stopped_origins:
            raise ValueError('HTTP 429 수신으로 이미지 요청 중단')
        if url in state.image_cache:
            return state.image_cache[url]
        if state.image_requests >= min(MAX_IMAGE_REQUESTS, max(50, state.ocr_max_images * 4)) or state.image_bytes >= MAX_IMAGE_BYTES:
            raise ImageBudgetExceeded('이미지 수집 한도 도달')
        state.image_requests += 1
        try:
            cookies = await state.image_context.cookies([url]) if state.image_context else []
            cookie_header = '; '.join(c['name'] + '=' + c['value'] for c in cookies)
            extra = {'access_headers': state.site_access.headers(url)} if state.site_access else {}
            data, mime = await asyncio.to_thread(fetch_image, url, min(2_000_000, MAX_IMAGE_BYTES - state.image_bytes), cookie_header, **extra)
        except HTTPError as error:
            if error.code == 429:
                parts = urlsplit(url)
                state.stopped_origins[origin(url)] = {'origin': urlunsplit((parts.scheme, parts.netloc, '', '', '')),
                    'status': 429, 'url': url, 'retry_after': error.headers.get('Retry-After'), 'policy': 'stop-origin'}
                state.errors.append({'url': url, 'message': 'HTTP 429: 이미지 요청과 같은 origin의 추가 요청 중단'})
            raise
        state.image_bytes += len(data)
        state.image_cache[url] = data, mime
        return data, mime


def _record_skipped_images(images, prefix, page_url, state):
    for image in images:
        key = page_url, prefix + image['location'], hashlib.sha256(image['source_url'].encode()).hexdigest()
        if key not in state.ocr_seen:
            state.ocr_seen.add(key)
            state.ocr_skipped += 1


async def _inspect_images(frame, images, prefix, page_url, state, emit, rules):
    elements = []
    if not state.ocr_enabled and not state.photo_enabled:
        _record_skipped_images(images, prefix, page_url, state)
        return elements
    images = sorted(images, key=lambda image: (image.get('image_role') != 'content', image.get('image_role') == 'interface'))
    for index, image in enumerate(images):
        if len(state.ocr_images) >= OCR_MAX_OBSERVATIONS or (state.ocr_disabled and not state.photo_enabled):
            state.ocr_skipped += len(images) - index

            if not state.ocr_disabled:
                state.errors.append({'url': page_url, 'message': 'OCR 이미지 관측 영역 기록 한도 도달'})
            break
        location = prefix + image['location']
        source = image['source_url']
        source_key = page_url, location, hashlib.sha256(source.encode()).hexdigest()
        if source_key in state.ocr_seen:
            # Reuse recognized text on later DOM observations as well.
            previous = state.ocr_references.get(source_key) or next((item for item in state.ocr_images if item.get('_source_key') == source_key), None)
            if previous and previous.get('text'):
                elements.append(_ocr_element(image, previous))
            continue
        state.ocr_seen.add(source_key)
        record = {'id': 'im_' + str(len(state.ocr_images) + 1), 'url': page_url, 'location': location,
                  'source_url': '(inline)' if source.startswith('data:') else source[:2000],
                  'source_type': image['source_type'], 'image_role': image.get('image_role', 'unspecified'),
                  'status': 'failed', 'lines': [], '_source_key': source_key,
                  'occurrences': [{'url': page_url, 'location': location, 'source_type': image['source_type'],
                                   'source_url': '(inline)' if source.startswith('data:') else source[:2000]}]}
        record['source_role'] = image.get('source_role')
        record['interface_image'] = image.get('interface_image', False)
        state.ocr_images.append(record)
        try:
            data, mime = inline_image(source) if source.startswith('data:') else await _fetch_image_bounded(source, state)
            metadata = image_metadata(data)
            digest = metadata['image_sha256']
            if not source.startswith('data:'):
                state.image_resource_keys.add(image_document_key(source))
            previous = next((item for item in state.ocr_images[:-1] if item.get('image_sha256') == digest and
                (item.get('image_role') != 'interface' or record['image_role'] == 'interface')), None)
            if previous:
                # Repeated site branding shares immutable image evidence. Each
                # page still gets its own DOM/CSS observation and classifications.
                state.ocr_images.pop()
                state.ocr_references[source_key] = previous
                previous.setdefault('occurrences', []).extend(record['occurrences'])
                state.ocr_reused += 1
                if previous.get('text'):
                    elements.append(_ocr_element(image, previous))
                continue
            if digest not in state.ocr_cache and len(state.ocr_cache) >= state.ocr_max_images:
                state.ocr_images.pop()
                state.ocr_skipped += 1
                if not state.ocr_limit_reported:
                    state.errors.append({'url': page_url, 'message': f'OCR 서로 다른 이미지 {state.ocr_max_images}개 처리 한도 도달'})
                    state.ocr_limit_reported = True
                continue
            # Image bytes belong to the photo model as well. OCR success must
            # never be the condition for retaining the image for classification.
            record.update(metadata)
            state.image_assets[metadata['relative_path']]=data
            if not state.ocr_enabled or state.ocr_disabled:
                record.update(status='completed',recognition_status='skipped',message='문자 인식 생략 · 이미지 분류 대상')
                state.ocr_cache.setdefault(digest,{'status':'completed','lines':[]})
                state.ocr_skipped+=1
                continue
            emit({'kind': 'phase', 'stage': 'ocr', 'action': 'image_ocr', 'url': page_url,
                  'message': 'PaddleOCR로 이미지 속 글자를 읽습니다.', 'location': location})
            if digest not in state.ocr_cache:
                state.ocr_cache[digest] = await state.ocr.recognize(data)
            result = state.ocr_cache[digest]
            if result['status'] != 'completed':
                state.ocr_disabled = result.get('fatal', False)
                raise ValueError(result.get('message', 'OCR 실행 실패'))
            record.update(result, image_sha256=digest)
            preview_bytes = len(record['preview_data_url'])
            if state.ocr_previews_bytes + preview_bytes > 3_000_000:
                record.pop('preview_data_url', None)
            else:
                state.ocr_previews_bytes += preview_bytes
            extension = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp', 'GIF': 'gif'}[result['image_format']]
            relative = 'evidence/images/' + digest + '.' + extension
            record['relative_path'] = relative
            state.image_assets[relative] = data
            observation = recognized_text(result)
            record.update(observation)
            text = observation['text']
            record['recognition_status'] = 'readable' if text else 'unreadable'
            if not text:
                message = unreadable_message(result)
                record['message'] = message
                state.errors.append({'url': page_url, 'message': '이미지 OCR: ' + message})
                emit({'kind': 'warning', 'stage': 'ocr',
                      'message': f'{message} 대상 이미지: {location}', 'url': page_url,
                      'image_id': record['id'], 'location': location,
                      'source_url': record['source_url']})
            else:
                elements.append(_ocr_element(image, record))
            emit({'kind': 'image_ocr', 'image_id': record['id'], 'status': 'completed',
                  'line_count': len(record['lines']), 'accepted_lines': observation['accepted_lines'],
                  'recognition_status': record['recognition_status'], 'url': page_url,
                  'location': location, 'source_url': record['source_url']})
        except ImageBudgetExceeded as error:
            state.ocr_images.pop()
            state.ocr_skipped += 1
            if not state.image_limit_reported:
                state.image_limit_reported = True
                state.errors.append({'url': page_url, 'message': str(error)})
                emit({'kind': 'warning', 'stage': 'ocr', 'url': page_url, 'message': str(error) + ': 나머지 이미지는 생략으로 기록합니다.'})
        except Exception as error:
            record.update(status='failed', message=str(error)[:300])
            state.errors.append({'url': page_url, 'message': '이미지 OCR: ' + str(error)[:160]})
            emit({'kind': 'image_ocr', 'image_id': record['id'], 'status': 'failed', 'message': str(error)[:160]})
            emit({'kind': 'warning', 'stage': 'ocr', 'url': page_url, 'message': '이미지 OCR 처리 실패: ' + str(error)[:160]})
    return elements


async def _evidence_screenshot(page, state, emit, *, target=None, location=None, frame=None):
    key = state.trace.active
    if key and target is not None:
        key += '_' + hashlib.sha256((location or '').encode()).hexdigest()[:12]
    if key in state.screenshots:
        return key
    if not key or len(state.screenshots) >= SCREENSHOT_MAX_COUNT or state.screenshot_bytes >= SCREENSHOT_MAX_BYTES:
        return None
    try:
        # Visible text gets a capture of the exact element. Never unhide or
        # restyle concealed evidence; retain the viewport for those observations.
        scrolls = []
        if target is not None:
            contexts = [page]
            context = frame
            while context is not None:
                contexts.append(context)
                context = context.parent_frame
            for context in contexts:
                scrolls.append((context, await context.evaluate('() => ({x: scrollX, y: scrollY})')))
        try:
            pixels = await (target.screenshot(type='jpeg', quality=55, timeout=1200) if target is not None
                            else page.screenshot(type='jpeg', quality=55, timeout=1200))
        finally:
            for context, position in reversed(scrolls):
                await context.evaluate("p => scrollTo({left:p.x, top:p.y, behavior:'instant'})", position)
        if len(pixels) > 200_000 or state.screenshot_bytes + len(pixels) > SCREENSHOT_MAX_BYTES:
            return None
        state.screenshots[key] = {
            'data_url': 'data:image/jpeg;base64,' + base64.b64encode(pixels).decode('ascii'),
            'sha256': hashlib.sha256(pixels).hexdigest(), 'url': page.url,
            'viewport': page.viewport_size, 'snapshot_id': key,
            'observed_at': datetime.now().astimezone().isoformat(),
            'capture': 'target_element' if target is not None else 'original_viewport', 'location': location,
        }
        state.screenshot_bytes += len(pixels)
        try:
            analysis = await asyncio.to_thread(visual_analysis, pixels)
            state.screenshots[key]['local_ai'] = {'visual': analysis}
            emit({'kind': 'local_ai_visual', 'url': page.url, 'screenshot_id': key, 'analysis': analysis})
        except Exception:
            # A model failure never discards the original screenshot or findings.
            state.screenshots[key]['local_ai'] = {'visual': {'status': 'unavailable', 'message': '화면 모델 분석 실패'}}
        emit({'kind': 'evidence_screenshot', 'screenshot_id': key, 'sha256': state.screenshots[key]['sha256'], 'screenshot': state.screenshots[key]})

        return key
    except Exception:
        emit({'kind': 'warning', 'message': '근거 화면 촬영 실패: 원문·CSS 근거는 보존합니다.'})
        return None


_FRAME_PROBE = """el => {
    const parts = [];
    for (let node = el; node; node = node.parentElement) {
        const tag = CSS.escape(node.tagName.toLowerCase());
        const siblings = node.parentElement ? [...node.parentElement.children].filter(n => n.tagName === node.tagName) : [node];
        parts.unshift(tag + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')');
        if (document.querySelectorAll(parts.join(' > ')).length === 1) break;
    }
    let opacity = 1, hidden = false, clipped = false, fixed = false;
    for (let node = el; node; node = node.parentElement) {
        const s = getComputedStyle(node);
        opacity *= Number(s.opacity);
        hidden ||= s.display === 'none';
        fixed ||= s.position === 'fixed';
        const box = node.getBoundingClientRect();
        clipped ||= (['hidden', 'clip'].includes(s.overflowX) && box.width <= 1) ||
            (['hidden', 'clip'].includes(s.overflowY) && box.height <= 1);
    }
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return {selector: parts.join(' > '), src: el.hasAttribute('src') ? el.src : null, transparent: opacity <= 0.01,
        offscreen: hidden || clipped || ['hidden', 'collapse'].includes(s.visibility) ||
        ((r.width > 0 || r.height > 0) && (r.right + (fixed ? 0 : scrollX) <= 0 ||
            r.bottom + (fixed ? 0 : scrollY) <= 0 ||
            (['absolute','fixed'].includes(s.position) && r.left + (fixed ? 0 : scrollX) > innerWidth + 2000) ||
            (fixed && r.top > innerHeight + 2000)))};
}"""
