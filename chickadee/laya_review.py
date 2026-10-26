"""Offline Laya review of every collected text, with a persistent CPU worker."""
import asyncio
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
BATCH_SIZE = 12
MAX_SECONDS = 120
MAX_REVIEW_SECONDS = 1800


def configuration():
    """Read only the user's explicit local-model configuration, never credentials."""
    if os.environ.get('CHICKADEE_LAYA_WORKER') and os.environ.get('CHICKADEE_LAYA_MODEL_DIR'):
        # A portable release must not depend on a stale developer Python setting.
        return str(Path(os.environ['CHICKADEE_LAYA_MODEL_DIR']).resolve()), None
    value = {}
    config = os.environ.get('CHICKADEE_LAYA_CONFIG')
    if config:
        path = Path(config)
        if not path.is_absolute():
            raise ValueError('Laya 설정 파일 오류')
        if path.exists():
            if path.stat().st_size > 16_384:
                raise ValueError('Laya 설정 파일 크기 오류')
            value = json.loads(path.read_text(encoding='utf-8'))
            if not isinstance(value, dict) or value.get('format') != 1:
                raise ValueError('Laya 설정 형식 오류')
    folder = os.environ.get('CHICKADEE_LAYA_MODEL_DIR') or value.get('model_dir')
    executable = os.environ.get('CHICKADEE_LAYA_PYTHON') or value.get('python')
    # Source launches and the build pipeline share the prepared offline bundle.
    # Explicit user configuration still wins. The worker verifies every file
    # and the independently evaluated checkpoint before loading any tensors.
    prepared = ROOT / 'artifacts' / 'laya-model'
    if not folder and not getattr(sys, 'frozen', False) and (prepared / 'manifest.json').is_file():
        folder = str(prepared)
    if folder:
        if not isinstance(folder, str): raise ValueError('Laya 모델 경로 오류')
        folder = str(Path(folder).resolve())
    if executable and (not isinstance(executable, str) or not Path(executable).is_absolute() or not Path(executable).is_file()):
        raise ValueError('Laya 실행 환경 오류')
    return folder, executable


def unavailable(reason='model_not_validated'):
    messages = {'model_not_validated': '검증한 Laya 모델을 적용하지 않았습니다.',
        'insufficient_scope': '문맥 검토에 필요한 원문 범위가 부족합니다.',
        'budget_or_cancelled': '검사 제한시간 또는 사용자 중단으로 처리하지 않았습니다.',
        'time_budget': '남은 검사 시간이 없어 검토를 생략했습니다.',
        'insufficient_memory': 'Laya 검토에 필요한 메모리가 부족합니다.',
        'runtime_unavailable': '로컬 Laya 실행 환경을 찾지 못했습니다.',
        'timeout': 'Laya 검토 제한시간을 초과했습니다.'}
    return {'status': 'unavailable', 'model': 'Laya', 'reason': reason,
            'message': messages.get(reason, 'Laya 검토를 완료하지 못했습니다.'), 'paid_requests': 0}


def analysis_reserve(total_seconds):
    """Leave time for a shipped model instead of letting crawling consume its entire budget."""
    try:
        folder, _ = configuration()
        return min(MAX_REVIEW_SECONDS, total_seconds*.4) if folder and (Path(folder)/'manifest.json').is_file() else 0
    except (OSError, ValueError, TypeError):
        return 0


class LayaSession:
    def __init__(self, timeout_seconds=MAX_SECONDS):
        self.process = None
        self.stderr_task = None
        self.timeout_seconds = min(MAX_SECONDS, max(0, timeout_seconds))

    async def analyze(self, texts):
        if not texts or len(texts) > BATCH_SIZE or any(not isinstance(t, str) or not 0 < len(t) <= 4000 for t in texts):
            raise ValueError('Laya 입력 크기 오류')
        if not self.timeout_seconds:
            return [unavailable('time_budget') for _ in texts]
        try:
            folder, executable = configuration()
        except (OSError, ValueError, TypeError):
            return [unavailable('runtime_unavailable') for _ in texts]
        if not folder:
            return [unavailable() for _ in texts]
        from .runtime import memory_info, GIB
        available = memory_info()['available_bytes']
        # The bundled worker assigns CPU checkpoint tensors without a second
        # FP32 copy. Measured frozen-worker peak: 896 MiB on 4,000-char inputs.
        # Require 1.75 GiB free and retain the live 0.5 GiB safety reserve below.
        if self.process is None and available is not None and available < 1.75 * GIB:
            return [unavailable('insufficient_memory') for _ in texts]
        bundled_worker = os.environ.get('CHICKADEE_LAYA_WORKER')
        if bundled_worker:
            if not Path(bundled_worker).is_absolute() or not Path(bundled_worker).is_file():
                return [unavailable('runtime_unavailable') for _ in texts]
            args = [bundled_worker, '--persistent']
        elif executable:
            if not Path(executable).is_absolute() or not Path(executable).is_file():
                return [unavailable('runtime_unavailable') for _ in texts]
            # The external Python cannot import modules embedded in a frozen engine.
            args = [executable, str(Path(__file__).with_name('laya_worker.py')), '--persistent']
        else:
            args = [sys.executable, '--laya-worker', '--persistent'] if getattr(sys, 'frozen', False) else [sys.executable, '-m', 'chickadee.laya_worker', '--persistent']
        env = {**os.environ, 'PYTHONIOENCODING': 'utf-8', 'HF_HUB_OFFLINE': '1',
               'TRANSFORMERS_OFFLINE': '1', 'TOKENIZERS_PARALLELISM': 'false', 'USE_TF': '0',
               'CHICKADEE_LAYA_MODEL_DIR': folder}
        reply = None
        try:
            if self.process is None:
                self.process = await asyncio.create_subprocess_exec(*args, stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, limit=100_000,
                    cwd=str(ROOT), env=env,
                    **({'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}))
                async def drain():
                    while await self.process.stderr.read(4096): pass
                self.stderr_task = asyncio.create_task(drain())
            self.process.stdin.write((json.dumps({'texts': texts}, ensure_ascii=True)+'\n').encode())
            await self.process.stdin.drain()
            reply = asyncio.create_task(self.process.stdout.readline())
            deadline = time.monotonic() + self.timeout_seconds
            while not reply.done():
                free = memory_info()['available_bytes']
                if free is not None and free < .5 * GIB:
                    return [unavailable('insufficient_memory') for _ in texts]
                if time.monotonic() >= deadline:
                    raise asyncio.TimeoutError()
                await asyncio.wait({reply}, timeout=.25)
            line = await reply
            results = json.loads(line)['results']
            from .inspection import validate_local_ai
            if len(results) != len(texts): raise ValueError('Laya 결과 개수 오류')
            for item in results: validate_local_ai({'laya': item})
            if any(item['status'] != 'completed' for item in results): await self.close()
            return results
        except asyncio.TimeoutError:
            await self.close()
            return [unavailable('timeout') for _ in texts]
        except (OSError, ValueError, KeyError, TypeError):
            await self.close()
            return [unavailable('inference_failed') for _ in texts]
        finally:
            if reply is not None and not reply.done():
                reply.cancel()
                await asyncio.gather(reply, return_exceptions=True)

    async def close(self):
        if self.process:
            if self.process.returncode is None: self.process.kill()
            await self.process.wait()
            if self.stderr_task: await self.stderr_task
            self.process = None


async def review_sources(sources, *, stop=None, emit=lambda _: None, timeout_seconds=MAX_REVIEW_SECONDS):
    """Review every nonempty source; batch size bounds memory, never coverage."""
    emit({'kind': 'phase', 'stage': 'laya', 'action': 'prepare', 'message': 'Laya 적용 상태를 확인합니다.'})
    selected, seen = [], set()
    for source in sources:
        text = source.get('text', '')
        key = text
        if text.strip() and key not in seen:
            selected.append(source); seen.add(key)
    session = LayaSession(timeout_seconds)
    results = []
    deadline = time.monotonic() + max(0, timeout_seconds)
    failure_reason = 'budget_or_cancelled'
    async def work():
        nonlocal failure_reason
        for start in range(0, len(selected), BATCH_SIZE):
            if stop and stop.is_set(): break
            remaining = max(0, deadline-time.monotonic())
            if not remaining:
                failure_reason = 'time_budget'
                break
            session.timeout_seconds = min(MAX_SECONDS, remaining)
            batch = selected[start:start+BATCH_SIZE]
            values = await session.analyze([s['text'][:4000] for s in batch])
            if len(values) != len(batch): raise ValueError('Laya 결과 개수 오류')
            results.extend(values)
            emit({'kind':'phase', 'stage':'laya', 'action':'progress',
                  'processed':len(results), 'total':len(selected),
                  'message':f'Laya 문맥 분석 {len(results)}/{len(selected)}'})
            if any(value['status'] != 'completed' for value in values):
                failure_reason = next(value.get('reason','inference_failed') for value in values if value['status'] != 'completed')
                break
    task = asyncio.create_task(work())
    try:
        while not task.done():
            if stop and stop.is_set():
                task.cancel()
                break
            await asyncio.wait({task}, timeout=.1)
        if not task.cancelled(): await task
    except asyncio.CancelledError:
        if not (stop and stop.is_set()): raise
    except Exception:
        failure_reason = 'inference_failed'
    finally:
        if not task.done(): task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await session.close()
    by_text = {s['text']: r for s, r in zip(selected, results)}
    for source in sources:
        text=source.get('text','')
        source.setdefault('local_ai', {})['laya'] = by_text.get(text, unavailable(failure_reason if text.strip() else 'insufficient_scope'))
    completed = sum(r['status'] == 'completed' for r in results)
    eligible = [s for s in sources if s.get('text','').strip()]
    omitted = sum(s['local_ai']['laya']['status'] != 'completed' for s in eligible)
    summary = {'status': 'completed' if not omitted else 'partial' if completed else 'unavailable',
               'analyzed': completed, 'unique_selected': len(selected), 'item_limit': None,
               'batch_size': BATCH_SIZE, 'source_items':len(sources), 'eligible_items':len(eligible),
               'covered':len(eligible)-omitted, 'skipped_empty':len(sources)-len(eligible),
               'omitted': omitted, 'paid_requests': 0}
    if not completed and omitted:
        summary['reason'] = results[0].get('reason', 'inference_failed') if results else failure_reason
    emit({'kind': 'phase', 'stage': 'laya', 'action': 'complete' if completed else 'skipped',
          'message': f'Laya {completed}개 문맥 검토' if completed else 'Laya 미적용 · 기존 탐지 결과 유지'})
    return summary


async def enrich_laya(report, *, stop=None, emit=lambda _: None, timeout_seconds=MAX_REVIEW_SECONDS, candidates=True):
    from .local_ai import analysis_packets
    packets = analysis_packets(report)
    evidence = [*report.get('ad_candidates', []), *report.get('evidence_details', {}).values()]
    # Include output rows even when the collection snapshot did not retain a packet.
    key=lambda row:(row.get('url'),row.get('scope_location',row.get('location')))
    by_location={key(p):p for p in packets}
    selected=list(packets)
    for row in evidence:
        if key(row) not in by_location:
            source={'url':row.get('url'),'location':key(row)[1],
                    'text':row.get('evidence_text',''),'local_ai':row.setdefault('local_ai',{})}
            selected.append(source);by_location[key(row)]=source
    summary = await review_sources(selected, stop=stop, emit=emit, timeout_seconds=timeout_seconds)
    images = {i['id']: i for i in report.get('ocr_images', [])}
    for packet in packets:
        if packet.get('image_id') in images: images[packet['image_id']].setdefault('local_ai', {}).update(packet['local_ai'])
    for row in [*report.get('ad_candidates', []), *report.get('evidence_details', {}).values()]:
        match = by_location.get(key(row))
        if match: row.setdefault('local_ai', {}).update(match['local_ai'])
    report.setdefault('local_ai', {})['laya'] = summary
    if candidates:
        from .local_ai import add_model_candidates
        add_model_candidates(report, 'laya')
    return summary
