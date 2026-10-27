"""Real browser follow-up, redirect traps and screenshot integrity; no paid calls."""
import asyncio
import base64
from copy import deepcopy
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
from threading import Event, Thread
import unittest
from unittest.mock import patch

from chickadee.agent import EvidenceAgent
from chickadee.bridge import DesktopBridge
from chickadee.inspection import validate_screenshots
from chickadee.scanner import ScanConfig, ScanOutcome, scan
from chickadee.site_explorer import collect_page, exploration_options
from tests.test_desktop import workflow
from tests.test_inspection_agent import packet, grok_stub


class FollowupStub:
    def __init__(self, *, bad_link=False):
        self.payloads = []
        self.bad_link = bad_link

    def __call__(self, payload, key, timeout):
        self.payloads.append(deepcopy(payload))
        if payload.get('tools', [{}])[0].get('function', {}).get('name') == 'site_explore':
            ids = payload['tools'][0]['function']['parameters']['properties']['link_ids']['items']['enum']
            args = {'link_ids': ['invented_link' if self.bad_link else ids[0]]}
            message = {'role': 'assistant', 'tool_calls': [{'id': 'visit1', 'type': 'function',
                'function': {'name': 'site_explore', 'arguments': json.dumps(args)}}]}
            return {'choices': [{'finish_reason': 'tool_calls', 'message': message}], 'usage': {'total_tokens': 200}}
        values = [json.loads(m['content']) for m in payload['messages'] if m['role'] == 'tool']
        if values and 'observations' in values[0]:
            source = json.loads(payload['messages'][1]['content'])['source_evidence_id']
            result = {'assessment': 'ad_suspected', 'evidence_ids': [source, values[0]['observations'][0]['evidence_id']],
                      'summary': '같은 게시물의 상세 문맥에서 가입 유도를 추가 확인했습니다.',
                      'missing_evidence': [], 'recommended_next_action': 'human_review'}
            return {'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(result)}}], 'usage': {'total_tokens': 200}}
        response = grok_stub(payload, key, timeout)
        if not payload.get('tools'):
            result = json.loads(response['choices'][0]['message']['content'])
            result.update(assessment='uncertain', missing_evidence=['같은 게시물의 상세 문맥'], recommended_next_action='collect_more_evidence')
            response['choices'][0]['message']['content'] = json.dumps(result)
        return response


class FollowupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.outside_requests, cls.local_requests = [], []
        class Sink(BaseHTTPRequestHandler):
            def log_message(self, *_): pass
            def do_GET(self):
                cls.outside_requests.append(self.path); self.send_response(200); self.end_headers()
            do_POST = do_GET
        cls.sink = ThreadingHTTPServer(('127.0.0.1', 0), Sink)
        cls.outside = f'http://127.0.0.1:{cls.sink.server_port}/outside'
        class Site(BaseHTTPRequestHandler):
            def log_message(self, *_): pass
            def do_GET(self):
                cls.local_requests.append(self.path)
                if self.path in ('/promotion.png', '/benign.png'):
                    pixels = (Path(__file__).parent/'fixtures/ocr'/self.path[1:]).read_bytes()
                    self.send_response(200); self.send_header('Content-Type', 'image/png'); self.end_headers(); self.wfile.write(pixels); return
                if self.path in ('/redirect', '/chain'):
                    self.send_response(302); self.send_header('Location', '/redirect' if self.path == '/chain' else cls.outside); self.end_headers(); return
                if self.path == '/same':
                    self.send_response(302); self.send_header('Location', '/detail'); self.end_headers(); return
                body = {
                    '/': f'<article id="post">caѕino 가입 보너스 지급 <a href="/detail">상세</a><a href="{cls.outside}">외부</a></article>',
                    '/detail': '<article id="post">같은 게시물 상세: caѕino 가입하고 충전 보너스를 받으세요.</article><script>fetch("/write",{method:"POST"})</script>',
                    '/image-case': '<article id="post">caѕino 가입 보너스 지급 <a href="/image-detail">상세</a><img src="/benign.png"></article>',
                    '/image-detail': '<article id="post"><img src="/promotion.png"></article>',
                    '/js': f'<article>공공 게시판 안내</article><script>location.href={json.dumps(cls.outside)}</script>',
                    '/meta': f'<meta http-equiv="refresh" content="0;url={cls.outside}"><p>안내</p>',
                }.get(self.path, '<p>안내</p>')
                self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.end_headers(); self.wfile.write(body.encode('utf-8'))
            def do_POST(self):
                cls.local_requests.append('POST ' + self.path); self.send_response(200); self.end_headers()
        cls.site = ThreadingHTTPServer(('127.0.0.1', 0), Site)
        cls.url = f'http://127.0.0.1:{cls.site.server_port}/'
        cls.threads = [Thread(target=s.serve_forever, daemon=True) for s in (cls.site, cls.sink)]
        for t in cls.threads: t.start()

    @classmethod
    def tearDownClass(cls):
        for server in (cls.site, cls.sink): server.shutdown(); server.server_close()
        for t in cls.threads: t.join(2)

    def test_real_bridge_followup_screenshot_reload_and_immutable_scan(self):
        with tempfile.TemporaryDirectory() as folder:
            bridge = DesktopBridge(folder, lambda _: None)
            bridge.command('start', {'url': self.url, 'workflow': workflow(), 'max_pages': 1, 'settle_ms': 0, 'interval_sec': 0, 'preview': False})
            bridge.worker.join(20); self.assertFalse(bridge.running)
            source = next(p for p in bridge.outcome.report['evidence_packets'] if '가입 보너스' in p['text'])
            path = Path(bridge.output_path)
            original = {p.name: p.read_bytes() for p in (path, path.with_name('scan-report.json'), path.with_name('result.csv'))}
            validate_screenshots(bridge.outcome.report['screenshots'])
            self.assertTrue(bridge.outcome.report['screenshots'])
            finding = bridge.outcome.result['findings'][0]
            detail = bridge.outcome.report['evidence_details'][finding['id']]
            self.assertIn(detail['screenshot_id'], bridge.outcome.report['screenshots'])
            image = bridge.outcome.report['screenshots'][detail['screenshot_id']]
            pixels = base64.b64decode(image['data_url'].split(',')[1])
            self.assertEqual(hashlib.sha256(pixels).hexdigest(), image['sha256'])
            self.assertEqual((path.parent / image['relative_path']).read_bytes(), pixels)
            stub = FollowupStub()
            with patch('chickadee.agent.groq_request', side_effect=stub):
                bridge.command('agent-configure', {'api_key': 'test_key_not_real'})
                bridge.command('agent-run', {'run_id': bridge.run_id, 'evidence_id': source['id']})
                bridge.agent_worker.join(25)
            self.assertFalse(bridge.agent_worker.is_alive())
            status = bridge.command('agent-status', {})
            self.assertEqual(status['ledger']['calls'], 4)
            self.assertEqual(status['ledger']['site_visits'], 1)
            self.assertEqual(status['assessments'][0]['exploration_status'], 'completed', status)
            self.assertEqual(status['assessments'][0]['assessment'], 'ad_suspected')
            self.assertEqual(status['explorations'][0]['url'], self.url + 'detail')
            self.assertTrue(status['explorations'][0]['screenshots'])
            self.assertTrue(any(r['method'] == 'POST' for r in status['explorations'][0]['blocked_requests']))
            self.assertFalse(self.outside_requests)
            self.assertNotIn('POST /write', self.local_requests)
            for name, raw in original.items(): self.assertEqual(path.with_name(name).read_bytes(), raw)
            bridge.command('load', {'path': str(path)})
            insight = bridge.command('inspection', {'run_id': bridge.run_id})
            self.assertTrue(any(n['id'].startswith('agent_') for n in insight['graph']['nodes']))
            self.assertTrue(any(e['label'] == 'AI 추가 확인' for e in insight['graph']['edges']))
            self.assertEqual(insight['agent']['ledger']['calls'], 4)
            self.assertNotIn('test_key_not_real', path.with_name('agent.json').read_text(encoding='utf-8'))
            ScanOutcome.load(path)
            data = json.loads(path.with_name('agent.json').read_text(encoding='utf-8'))
            data['ledger'] = 'broken'
            path.with_name('agent.json').write_text(json.dumps(data), encoding='utf-8')
            bridge.command('load', {'path': str(path)})
            locked = bridge.command('agent-status', {})
            self.assertEqual(locked['ledger']['call_limit'], 1)

    def test_followup_ocr_image_provenance_reload_and_collision(self):
        with tempfile.TemporaryDirectory() as folder:
            bridge = DesktopBridge(folder, lambda _: None)
            bridge.command('runtime-configure', {'mode': 'standard'})
            bridge.command('start', {'url': self.url+'image-case', 'workflow': workflow(), 'max_pages': 1,
                                    'settle_ms': 0, 'interval_sec': 0, 'preview': False})
            bridge.worker.join(45); self.assertFalse(bridge.running)
            source = next(p for p in bridge.outcome.report['evidence_packets'] if '가입 보너스' in p['text'])
            original_image = next(i for i in bridge.outcome.report['ocr_images'] if i['status'] == 'completed')
            path = Path(bridge.output_path)
            original = {p.name: p.read_bytes() for p in (path, path.with_name('scan-report.json'), path.with_name('result.csv'))}
            stub = FollowupStub()
            with patch('chickadee.agent.groq_request', side_effect=stub):
                bridge.command('agent-configure', {'api_key': 'test_key_not_real'})
                bridge.command('agent-run', {'run_id': bridge.run_id, 'evidence_id': source['id']})
                bridge.agent_worker.join(40)
            self.assertFalse(bridge.agent_worker.is_alive())
            status = bridge.command('agent-status', {})
            self.assertEqual(status['assessments'][0]['exploration_status'], 'completed', status)
            visit = status['explorations'][0]
            image = next(i for i in visit['ocr_images'] if i['status'] == 'completed')
            self.assertIn('카지노', image['text'])
            self.assertGreaterEqual(image['mean_confidence'], .55)
            asset = path.parent/image['relative_path']
            self.assertEqual(hashlib.sha256(asset.read_bytes()).hexdigest(), image['image_sha256'])
            observations = [json.loads(m['content'])['observations'] for payload in stub.payloads
                            for m in payload['messages'] if m['role'] == 'tool' and '"observations"' in m['content']][0]
            self.assertEqual(observations[0]['source_kind'], 'image_ocr')
            self.assertEqual(observations[0]['ocr']['image_sha256'], image['image_sha256'])
            bridge.command('load', {'path': str(path)})
            insight = bridge.command('inspection', {'run_id': bridge.run_id})
            supplemental = next(p for p in insight['packets'] if p.get('supplemental') and p.get('image_id'))
            self.assertEqual(supplemental['image_id'], 'agent_0_'+image['id'])
            by_id = {i['id']: i for i in insight['ocr_images']}
            self.assertEqual(by_id[supplemental['image_id']]['image_sha256'], image['image_sha256'])
            self.assertEqual(by_id[original_image['id']]['image_sha256'], original_image['image_sha256'])
            self.assertNotEqual(image['image_sha256'], original_image['image_sha256'])
            for name, raw in original.items(): self.assertEqual(path.with_name(name).read_bytes(), raw)
            asset.write_bytes(b'corrupt')
            bridge.command('load', {'path': str(path)})
            self.assertEqual(bridge.command('agent-status', {})['ledger']['call_limit'], 1)
            asset.unlink()
            bridge.command('load', {'path': str(path)})
            self.assertEqual(bridge.command('agent-status', {})['ledger']['call_limit'], 1)

    def test_http_redirect_chain_javascript_and_meta_never_reach_other_origin(self):
        for path in ('redirect', 'chain', 'js', 'meta'):
            with self.subTest(path=path):
                outcome = collect_page({'url': self.url + path}, self.url, 8, Event(), lambda _: None)
                self.assertTrue(outcome.report['blocked_requests'], outcome.report)
                self.assertFalse(self.outside_requests)
        same = collect_page({'url': self.url + 'same'}, self.url, 8, Event(), lambda _: None)
        self.assertTrue(any('충전 보너스' in p['text'] for p in same.report['evidence_packets']))

    def test_opaque_choice_validation_budget_and_no_recursive_permission(self):
        value = packet(); value['url'] = self.url
        value['link_targets'] = [self.outside, 'javascript:alert(1)', '/delete', '/login', '/detail?action=delete', '/detail', '/detail']
        options = exploration_options(value, {}, self.url)
        self.assertEqual([o['url'] for o in options], [self.url + 'detail', self.url])
        visited = []
        result = EvidenceAgent({'api_key': 'test_key_not_real'}, transport=FollowupStub(bad_link=True)).investigate_with_exploration(value, options, lambda *args: visited.append(args))
        self.assertEqual(result['exploration_status'], 'incomplete')
        self.assertEqual(visited, [])
        agent = EvidenceAgent({'api_key': 'test_key_not_real', 'call_limit': 2}, transport=FollowupStub())
        result = agent.investigate_with_exploration(value, options, lambda *args: visited.append(args))
        self.assertEqual(result['exploration_status'], 'budget_exhausted')
        self.assertEqual(agent.ledger['calls'], 2)
        self.assertEqual(visited, [])
        with self.assertRaisesRegex(ValueError, '사이트 밖'): collect_page({'url': self.outside}, self.url, 1, Event(), lambda _: None)

    def test_screenshot_corruption_and_remote_payload_rejected(self):
        for data in ({'s': {'data_url': 'https://example.invalid/pixel'}},
                     {'s': {'data_url': 'data:image/jpeg;base64,!!!!'}},
                     {'s': {'data_url': 'data:image/jpeg;base64,/9j/AA==', 'sha256': 'wrong'}}):
            with self.subTest(data=data), self.assertRaises(ValueError): validate_screenshots(data)


if __name__ == '__main__': unittest.main()
