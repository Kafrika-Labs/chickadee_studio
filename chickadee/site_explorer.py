"""Bounded same-origin follow-up collection; the model selects opaque link IDs."""
import asyncio
from urllib.parse import parse_qsl, urljoin, urlsplit

from .scanner import ScanConfig, is_loopback, navigation_priority, normalize_url, origin, scan
from .async_runtime import event_loop_runner


def exploration_options(packet, report, entry_url):
    site = origin(entry_url)
    urls = [*packet.get('link_targets', []),
            *(p['url'] for p in report.get('pending_urls', []) if p.get('discovered_from') == packet['url']),
            *(n['url'] for n in report.get('exploration', {}).get('nodes', []) if n.get('kind') == 'page'),
            packet['url']]
    result, seen = [], set()
    for raw in urls:
        try:
            url = normalize_url(urljoin(packet['url'], raw))
            parts = urlsplit(url)
            query = dict(parse_qsl(parts.query))
            # GET endpoints may still have side effects. Do not choose common
            # write/auth/download endpoints or action-style query parameters.
            if origin(url) != site or len(url) > 2000 or navigation_priority(url) >= 40:
                continue
            if any(word in parts.path.casefold() for word in ('delete', 'remove', 'logout', 'download', 'unsubscribe')):
                continue
            if {k.casefold() for k in query} & {'action', 'cmd', 'token', 'session', 'password', 'delete', 'csrf'}:
                continue
            if url in seen:
                continue
            seen.add(url)
            result.append({'id': 'link_' + str(len(result) + 1), 'url': url,
                           'kind': 'revisit' if url == packet['url'] else 'observed_link'})
            if len(result) == 12:
                break
        except (TypeError, ValueError):
            continue
    return result


def collect_page(option, entry_url, timeout, stop, emit, *, ocr_enabled=True, ocr_max_images=50, private_addresses=()):
    if origin(option['url']) != origin(entry_url):
        raise ValueError('사이트 밖 추가 탐색은 허용되지 않습니다.')
    config = ScanConfig(option['url'], max_pages=1, timeout_sec=max(.5, min(20, timeout)),
                        private_addresses=tuple(private_addresses),
                        ocr_enabled=ocr_enabled, ocr_max_images=ocr_max_images,
                        runtime_mode='standard' if ocr_enabled else 'economy',
                        # OCR cold start shares this page budget. A separate
                        # five-second cap could cancel valid image evidence.
                        page_timeout_sec=max(.5, min(20, timeout)), settle_ms=100,
                        allow_network=not is_loopback(entry_url), retries=0, interval_sec=0,
                        follow_links=False, capture_previews=False)
    with event_loop_runner() as runner:
        return runner.run(scan(config, stop=stop, emit=emit))
