"""Reproductions of failures found on real public user-authored boards."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import unittest
from unittest.mock import AsyncMock, patch
from playwright.async_api import async_playwright
from chickadee.async_runtime import event_loop_runner
from chickadee.scanner import ScanConfig, _FRAME_PROBE, scan


class PublicBoardRegressions(unittest.TestCase):
    def test_blank_navigation_and_permission_alert_cannot_be_successful_scans(self):
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_): pass
            def do_GET(self):
                pages = {
                    '/blank': '<script>location.replace("about:blank")</script>',
                    '/denied': '<script>alert("권한이 없습니다.");history.go(-1)</script><article>접근할 수 없는 본문</article>',
                    '/empty': '<html><body></body></html>',
                    '/scripts-only': '<body><script>console.log("no visible content")</script><style>body{color:black}</style></body>',
                    '/normal': '<article>공개 게시글 본문입니다.</article>',
                    '/background': '<div style="width:100px;height:80px;background-image:url(data:image/png;base64,aA==)"></div>',
                }
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.end_headers(); self.wfile.write(pages.get(self.path, '').encode())
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = Thread(target=server.serve_forever, daemon=True); thread.start()
        try:
            with patch('chickadee.scanner.prepare_models'), \
                 patch('chickadee.scanner.photo_model_contract', return_value=None), \
                 patch('chickadee.scanner.enrich_report', side_effect=lambda report, **kw: report.update(local_ai={})), \
                 patch('chickadee.scanner.enrich_content_images', new_callable=AsyncMock), \
                 patch('chickadee.scanner.enrich_laya', new_callable=AsyncMock):
                with event_loop_runner() as runner:
                    for path, expected in [('/blank', '빈 화면'), ('/denied', '접근 제한'), ('/empty', '빈 문서'), ('/scripts-only', '빈 문서')]:
                        with self.subTest(path=path):
                            result = runner.run(scan(ScanConfig(f'http://127.0.0.1:{server.server_port}{path}',
                                max_pages=1, follow_links=False, ocr_enabled=False, capture_previews=False,
                                settle_ms=100, interval_sec=0, page_timeout_sec=10)))
                            self.assertEqual(result.report['status'], 'failed')
                            self.assertEqual(result.report['pages_scanned'], [])
                            self.assertIn(expected, json.dumps(result.report['errors'], ensure_ascii=False))
                    result = runner.run(scan(ScanConfig(f'http://127.0.0.1:{server.server_port}/normal',
                        max_pages=1, follow_links=False, ocr_enabled=False, capture_previews=False,
                        settle_ms=0, interval_sec=0)))
                    self.assertEqual(result.report['status'], 'completed')
                    self.assertTrue(result.report['evidence_packets'])
                    result = runner.run(scan(ScanConfig(f'http://127.0.0.1:{server.server_port}/background',
                        max_pages=1, follow_links=False, ocr_enabled=False, capture_previews=False,
                        settle_ms=0, interval_sec=0)))
                    self.assertEqual(result.report['status'], 'completed', 'CSS image-only pages are not empty documents')
        finally:
            server.shutdown(); server.server_close(); thread.join()

    def test_cms_body_images_precede_share_icons_and_special_tag_selectors_replay(self):
        async def check():
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True, chromium_sandbox=True)
                try:
                    page = await browser.new_page()
                    await page.route('**/*', lambda route: route.abort())
                    await page.set_content('''<meta charset="utf-8">
                        <ul class="shareWrap"><li><a style="display:block;width:80px;height:80px;background-image:url(https://example.invalid/share.png)">공유</a></li></ul>
                        <c:if class="1:odd"><c:when>특수 태그의 게시글 본문</c:when><iframe srcdoc="본문"></iframe></c:if>
                        <div class="ViewBoxContent"><img src="https://example.invalid/post.png" style="opacity:0"></div>
                        <div class="viewCont"><img src="https://example.invalid/post2.png"></div>
                        <div class="comment-contents">일반 이용자가 작성한 댓글입니다.</div>''')
                    data = await page.evaluate(Path('chickadee/extract.js').read_text('utf-8'), {})
                    special = [e for e in data['elements'] if e['direct_text'] == '특수 태그의 게시글 본문']
                    self.assertTrue(special)
                    self.assertEqual(await page.locator(special[0]['location']).count(), 1)
                    frame = await page.locator('iframe').evaluate(_FRAME_PROBE)
                    self.assertEqual(await page.locator(frame['selector']).count(), 1)
                    self.assertEqual([x['source_url'] for x in data['images'][:2]],
                        ['https://example.invalid/post.png', 'https://example.invalid/post2.png'])
                    self.assertTrue(all(x['image_role'] == 'content' for x in data['images'][:2]))
                    icon = next(x for x in data['images'] if x['source_url'].endswith('share.png'))
                    self.assertTrue(icon['interface_image'])
                    self.assertEqual(icon['image_role'], 'interface')
                    self.assertTrue(any(e['source_role'] == 'comment' and '일반 이용자' in e['text'] for e in data['elements']))
                finally: await browser.close()
        with event_loop_runner() as runner: runner.run(check())
