"""JSON-lines desktop protocol over private child-process stdio; no HTTP server."""
import argparse
import asyncio
import base64
from copy import deepcopy
from datetime import datetime
import json
import hashlib
from pathlib import Path
import sys
from threading import Event, Lock, Thread
import uuid
from collections import deque

from . import __version__
from .demo import DemoSite
from .exports import atomic_write
from .scanner import ScanConfig, ScanOutcome, scan
from .workflow import compile_workflow
from .control import ScanControl
from .reviews import ReviewStore
from .tools import capabilities, resolve_tool
from .inspection import validate_inspection, validate_screenshots
from .agent import EvidenceAgent, settings as agent_settings
from .site_explorer import exploration_options, collect_page
from .runtime import environment, probe_png, MODES
from .async_runtime import event_loop_runner
from .reporting import review_report
from .image_ocr import OCRSession
from .content_analysis import inputs as content_inputs, analyze_content


class DesktopBridge:
    def __init__(self, data_dir, send):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.send = send
        self.worker = None
        self.busy = Event()
        self.stop = Event()
        self.outcome = None
        self.output_path = None
        self.control = ScanControl()
        self.run_id = None
        self.sequence = 0
        self.recent_events = deque(maxlen=2000)
        self.live_records = {}
        self.reviews = None
        self.phase = None
        self.stopping = False
        self.last_status = 'idle'
        self._event_lock = Lock()
        self.history_path = self.data_dir/'history.json'
        self.live_graph = {'nodes': {}, 'edges': {}}
        self.agent_config = None
        self.agent_worker = None
        self.agent_stop = Event()
        self.agent_data = {'ledger': {}, 'assessments': [], 'events': []}
        self.runtime_path = self.data_dir / 'runtime-settings.json'
        try:
            self.runtime_mode = json.loads(self.runtime_path.read_text(encoding='utf-8'))['mode']
            if self.runtime_mode not in MODES: raise ValueError('runtime mode')
        except (OSError, ValueError, KeyError, TypeError): self.runtime_mode = 'standard'
        self.runtime_worker = None
        self.runtime_stop = Event()
        self.ocr_check = {'status': 'not_run'}
        self.run_environment = None
        self.startup_environment = environment(self.runtime_mode)
        self.content_worker = None
        self.content_stop = Event()
        self.content_data = None
        try:
            self.history = json.loads(self.history_path.read_text(encoding='utf-8'))[:30]
        except (OSError, ValueError, TypeError):
            self.history = []

    @property
    def running(self):
        return self.busy.is_set()

    def emit(self, event):
        with self._event_lock:
            self.sequence += 1
            value = {**event, 'timestamp': datetime.now().astimezone().isoformat(),
                     'run_id': self.run_id, 'sequence': self.sequence, 'protocol_version': 1}
            if event['kind'] != 'preview':
                self.recent_events.append({k: v for k, v in value.items() if k != 'screenshot'})
            if event['kind'] == 'phase':
                self.phase = event['stage']
        self.send({'event': value})
        return value

    def command(self, method, params):
        if not isinstance(params, dict):
            raise ValueError('명령 인자가 올바르지 않습니다.')
        if method == 'login-session':
            return self.control.login.session(params.get('request_id'))
        if method == 'login-complete':
            self.control.login.complete(params.get('request_id'), params.get('cookies'), params.get('skip', False))
            return {'accepted': True}
        if method == 'content-analyze':
            if 'analysis_id' in params:
                if set(params) - {'analysis_id', 'cancel'} or type(params.get('cancel', False)) is not bool:
                    raise ValueError('분석 조회 인자 오류')
                if not self.content_data or params['analysis_id'] != self.content_data['analysis_id']:
                    raise ValueError('현재 직접 분석 ID와 일치하지 않습니다.')
                if params.get('cancel') and self.content_worker and self.content_worker.is_alive(): self.content_stop.set()
                return deepcopy(self.content_data)
            text, pixels = content_inputs(params)
            if self.running or any(worker and worker.is_alive() for worker in (self.agent_worker, self.runtime_worker, self.content_worker)):
                raise ValueError('진행 중인 검사·분석을 마친 후 입력하세요.')
            runtime = environment(self.runtime_mode)
            self.content_stop.clear()
            self.content_data = {'analysis_id': uuid.uuid4().hex, 'status': 'running'}
            self.content_worker = Thread(target=self._analyze_content, args=(text, pixels, runtime), daemon=True)
            self.content_worker.start()
            return {'analysis_id': self.content_data['analysis_id'], 'status': 'started'}
        if method == 'runtime-info':
            if params: raise ValueError('환경 조회에는 추가 인자를 사용하지 않습니다.')
            return {**environment(self.runtime_mode), 'ocr_check': dict(self.ocr_check)}
        if method == 'runtime-configure':
            if set(params) != {'mode'} or params['mode'] not in MODES: raise ValueError('실행 환경 설정 오류')
            if self.running: raise ValueError('현재 검사 완료 후 실행 환경을 변경하세요.')
            atomic_write(self.runtime_path, (json.dumps({'mode': params['mode']})+'\n').encode('utf-8'))
            self.runtime_mode = params['mode']
            return self.command('runtime-info', {})
        if method == 'runtime-test':
            if params: raise ValueError('기능 확인에는 추가 인자를 사용하지 않습니다.')
            if self.running: raise ValueError('검사 완료 후 기능 확인을 실행하세요.')
            if self.content_worker and self.content_worker.is_alive(): raise ValueError('직접 분석 완료 후 기능 확인을 실행하세요.')
            if self.runtime_worker and self.runtime_worker.is_alive(): return {'started': False, 'status': 'running'}
            self.runtime_stop.clear(); self.ocr_check = {'status': 'running'}
            self.runtime_worker = Thread(target=self._check_ocr_runtime, daemon=True)
            self.runtime_worker.start()
            return {'started': True}
        if method == 'capabilities':
            return {**capabilities(), 'agent_available': True, 'agent_connected': self.agent_config is not None,
                    'providers': ['groq', 'openai', 'anthropic']}
        if method in ('inspection', 'agent-configure', 'agent-run', 'agent-stop', 'agent-status'):
            return self._inspection_command(method, params)
        if method == 'tool-call':
            arguments = params.get('arguments', {})
            target = resolve_tool(params.get('name'), arguments)
            if 'run_id' in arguments and arguments['run_id'] != self.run_id:
                raise ValueError('현재 검사 실행 ID와 일치하지 않습니다.')
            return self.command(target, {**arguments, **({'actor': 'agent'} if target == 'review' else {})})
        if method == 'validate-workflow':
            return compile_workflow(params.get('workflow'))
        if method == 'state':
            state = ('stopping' if self.stopping else 'paused' if self.control.paused.is_set() else
                     'pausing' if self.control.requested.is_set() else 'running') if self.running else self.last_status
            return {'version': __version__, 'running': self.running, 'history': self.history,
                    'run_id': self.run_id, 'status': state, 'phase': self.phase, 'sequence': self.sequence,
                    'paused_sec': round(self.control.paused_seconds, 3), 'authentication': self.control.login.state(), 'protocol_version': 1}
        if method in ('pause', 'resume'):
            if not self.running or self.stopping:
                raise ValueError('진행 중인 검사가 없습니다.')
            if method == 'pause':
                self.control.pause()
            else:
                self.control.resume()
            return {'status': 'pausing' if method == 'pause' else 'running', 'run_id': self.run_id}
        if method == 'stop':
            self.agent_stop.set()
            self.stopping = self.running
            self.stop.set()
            return {'stopping': self.running}
        if method in ('findings', 'events'):
            offset, limit = params.get('offset', 0), params.get('limit', 100)
            after = params.get('after_sequence', 0)
            if type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 500 or type(after) is not int or after < 0:
                raise ValueError('조회 범위가 올바르지 않습니다.')
            if method == 'events':
                with self._event_lock:
                    available = list(self.recent_events)
                rows = [event for event in available if event['sequence'] > after][:limit]
                return {'run_id': self.run_id, 'items': rows, 'next_sequence': rows[-1]['sequence'] if rows else after,
                        'truncated': bool(available and after < available[0]['sequence'] - 1)}
            records = [*self.outcome.result['findings'], *self.outcome.report.get('ad_candidates', [])] if self.outcome else list(self.live_records.values())
            details = self.outcome.report.get('evidence_details', {}) if self.outcome else {}
            items = [{**record, 'detail': details.get(record['id'], record.get('_detail', {})),
                      'review': self.reviews.data['items'].get(record['id']) if self.reviews else None} for record in records[offset:offset+limit]]
            return {'run_id': self.run_id, 'items': items, 'total': len(records), 'next_offset': offset + len(items)}
        if method == 'review':
            if self.running or self.reviews is None:
                raise ValueError('검사가 끝난 뒤 검토 상태를 저장하세요.')
            value = self.reviews.update(params.get('ids'), params.get('status'), params.get('note'),
                                        params.get('expected_revision'), params.get('actor', 'human'))
            self.emit({'kind': 'review_updated', 'ids': params['ids'], 'status': params['status'], 'revision': value['revision']})
            return value
        if method == 'start':
            if self.content_worker and self.content_worker.is_alive(): raise ValueError('직접 분석 완료 후 검사를 시작하세요.')
            if self.runtime_worker and self.runtime_worker.is_alive():
                raise ValueError('OCR 기능 확인 완료 후 검사를 시작하세요.')
            if self.running or self.agent_worker and self.agent_worker.is_alive():
                raise ValueError('이미 검사 중입니다.')
            flags = compile_workflow(params.get('workflow'))
            profile = params.get('profile', 'default')
            if profile not in ('default', 'test', 'public'):
                raise ValueError('지원하지 않는 사이트 설정입니다.')
            # Frozen resources are collected beside chickadee/ under _internal.
            root = Path(__file__).resolve().parent.parent
            profile_path = root/'profiles'/('inuri-test.json' if profile == 'test' else 'public-site.json') if profile != 'default' else None
            self.run_environment = environment(self.runtime_mode)
            config = ScanConfig(params.get('url', ''), interactive_login=True, max_pages=params.get('max_pages', 100),
                                timeout_sec=params.get('timeout_sec', 300), settle_ms=params.get('settle_ms', 350),
                                page_timeout_sec=params.get('page_timeout_sec', 45),
                                interval_sec=params.get('interval_sec', .5), allow_network=True,
                                profile_path=profile_path, capture_previews=params.get('preview', True),
                                ocr_enabled=flags.pop('ocr_enabled') and self.run_environment['features']['ocr_enabled'],
                                ocr_max_images=self.run_environment['ocr_max_images'],
                                runtime_mode=self.run_environment['effective_mode'], **flags)
            output_root = Path(params['output_root']) if params.get('output_root') else self.data_dir/'scans'
            folder = output_root/(datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6])
            self.stop = Event()
            self.outcome = None
            self.output_path = None
            self.reviews = None
            self.control = ScanControl()
            self.stopping = False
            self.run_id = folder.name
            self.sequence = 0
            self.recent_events.clear()
            self.live_records.clear()
            self.live_graph = {'nodes': {}, 'edges': {}}
            self.agent_data = {'ledger': {}, 'assessments': [], 'events': []}
            self.phase = None
            self.last_status = 'running'
            self.busy = Event()
            self.busy.set()
            self.worker = Thread(target=self._run, args=(config, folder, bool(params.get('demo')), params['workflow']), daemon=True)
            self.worker.start()
            return {'started': True, 'folder': str(folder), 'run_id': self.run_id}
        if method == 'load':
            if self.running or self.agent_worker and self.agent_worker.is_alive():
                raise ValueError('검사를 중단한 다음 결과를 불러오세요.')
            loaded = ScanOutcome.load(Path(params['path']))
            loaded_path = str(Path(params['path']).resolve())
            loaded_reviews = ReviewStore(loaded_path, loaded)
            folder = Path(params['path']).parent
            events = []
            log = folder/'events.jsonl'
            if log.exists() and log.stat().st_size <= 30_000_000:
                try:
                    events = [json.loads(line) for line in log.read_text(encoding='utf-8').splitlines() if line][-2000:]
                    events = [event for event in events if isinstance(event, dict) and isinstance(event.get('kind'), str)
                              and type(event.get('sequence', 1)) is int and event.get('sequence', 1) > 0]
                except (ValueError, OSError):
                    events = []
            preview = None
            image = folder/'last-preview.jpg'
            if image.exists() and image.stat().st_size < 1_000_000:
                try:
                    metadata = json.loads((folder/'last-preview.json').read_text(encoding='utf-8'))
                except (OSError, ValueError):
                    metadata = {}
                preview = {'url': metadata.get('url', ''), 'title': metadata.get('title', ''),
                           'timestamp': metadata.get('timestamp'),
                           'data_url': 'data:image/jpeg;base64,' + base64.b64encode(image.read_bytes()).decode('ascii')}
            self.outcome, self.output_path, self.reviews = loaded, loaded_path, loaded_reviews
            self.agent_data = self._sidecar('agent.json', {'ledger': {}, 'assessments': [], 'events': []})
            self.last_status = loaded.report['status']
            self.run_id = loaded.report.get('run_id') or Path(loaded_path).parent.name
            self.phase = None
            self.control = ScanControl()
            with self._event_lock:
                self.recent_events.clear()
                self.recent_events.extend({**event, 'sequence': event.get('sequence', index+1), 'run_id': self.run_id}
                                          for index, event in enumerate(events))
                self.sequence = max((event['sequence'] for event in self.recent_events), default=0)
            return {'result': self.outcome.result, 'report': self.outcome.report, 'path': self.output_path,
                    'events': events, 'preview': preview, 'reviews': self.reviews.data, 'run_id': self.run_id}
        if method == 'export':
            if self.outcome is None or self.running:
                raise ValueError('완료된 결과가 없습니다.')
            self.outcome.save_csv(Path(params['path']))
            return {'path': params['path']}
        raise ValueError('지원하지 않는 명령입니다.')

    def _sidecar(self, name, default):
        invalid_agent = {'ledger': {'calls': 12, 'charged_tokens': 60000, 'usage_tokens': 0,
                                   'call_limit': 1, 'token_limit': 1000},
                         'assessments': [], 'explorations': [],
                         'events': [{'kind': 'agent_failed', 'message': '사용량 기록 손상: 이 기록의 유료 요청을 차단했습니다.'}]}
        try:
            path = Path(self.output_path).with_name(name)
            if path.stat().st_size > 12_000_000:
                return invalid_agent if name == 'agent.json' else default
            data = json.loads(path.read_text(encoding='utf-8'))
            if data.get('result_sha256') != self.outcome.report.get('result_sha256'):
                return invalid_agent if name == 'agent.json' else default
            if name == 'agent.json':
                ledger = data.get('ledger')
                if not isinstance(ledger, dict) or any(type(ledger.get(k)) is not int or ledger[k] < 0 for k in ('calls', 'charged_tokens', 'usage_tokens')):
                    return invalid_agent
                if type(ledger.get('site_visits', 0)) is not int or not 0 <= ledger.get('site_visits', 0) <= 6:
                    return invalid_agent
                if any(not isinstance(data.get(k, []), list) or len(data.get(k, [])) > cap for k, cap in [('assessments', 100), ('events', 200), ('explorations', 6)]):
                    return invalid_agent
                for visit in data.get('explorations', []):
                    if not isinstance(visit.get('source_evidence_id'), str) or not isinstance(visit.get('url'), str) or not isinstance(visit.get('blocked_requests'), list):
                        return invalid_agent
                    validate_inspection({'evidence_packets': visit['packets'], 'exploration': visit['graph'],
                                         'ocr_images': visit.get('ocr_images', [])})
                    validate_screenshots(visit.get('screenshots', {}))
                    for image in visit.get('ocr_images', []):
                        if image['status'] != 'completed': continue
                        folder = Path(self.output_path).parent.resolve()
                        asset = (folder / image['relative_path']).resolve()
                        if not asset.is_relative_to(folder) or not asset.is_file() or asset.stat().st_size > 2_000_000: return invalid_agent
                        with asset.open('rb') as stream:
                            if hashlib.file_digest(stream, 'sha256').hexdigest() != image['image_sha256']: return invalid_agent
            return data
        except FileNotFoundError:
            return default
        except (OSError, ValueError, TypeError, AttributeError, KeyError):
            return invalid_agent if name == 'agent.json' else default

    def _save_agent(self):
        for visit in self.agent_data.get('explorations', []):
            for image in visit.get('screenshots', {}).values():
                relative = 'evidence/agent-' + image['sha256'] + '.jpg'
                target = Path(self.output_path).parent / relative
                if not target.exists():
                    atomic_write(target, base64.b64decode(image['data_url'].split(',', 1)[1]))
                image['relative_path'] = relative
        data = {**self.agent_data, 'result_sha256': self.outcome.report['result_sha256']}
        atomic_write(Path(self.output_path).with_name('agent.json'), json.dumps(data, ensure_ascii=False).encode('utf-8'))
        if self.agent_data.get('report', {}).get('status') != 'running':
            self._save_review_report()

    def _save_review_report(self):
        contents = review_report(self.outcome.result, self.outcome.report, self.agent_data)
        for extension, key in [('md', 'markdown'), ('html', 'html')]:
            atomic_write(Path(self.output_path).with_name('review-report.' + extension), contents[key].encode('utf-8'))

    def _inspection_command(self, method, params):
        if method == 'agent-configure':
            if self.agent_worker and self.agent_worker.is_alive():
                raise ValueError('에이전트 종료 후 설정을 변경하세요.')
            previous = self.agent_config or {}
            provider = params.get('provider', previous.get('provider', 'groq'))
            same_provider = provider == previous.get('provider', 'groq')
            self.agent_config = agent_settings({**params, 'provider': provider,
                'api_key': params.get('api_key') or (previous.get('api_key', '') if same_provider else '')})
            return {'configured': True, 'provider': (self.agent_config or {}).get('provider', 'groq'), **{k: v for k, v in self.agent_config.items() if k != 'api_key'}}
        if method == 'agent-status':
            return {'provider': (self.agent_config or {}).get('provider', 'groq'), 'configured': self.agent_config is not None,
                    'model': (self.agent_config or {}).get('model'),
                    'running': bool(self.agent_worker and self.agent_worker.is_alive()),
                    'ledger': self.agent_data.get('ledger', {}), 'assessments': self.agent_data.get('assessments', []),
                    'report': self.agent_data.get('report'),
                    'events': self.agent_data.get('events', [])[-40:],
                    'explorations': self.agent_data.get('explorations', [])}
        if method == 'agent-stop':
            self.agent_stop.set()
            return {'stopping': True}
        if params.get('run_id') != self.run_id:
            raise ValueError('현재 검사 실행 ID와 일치하지 않습니다.')
        if method == 'inspection':
            report = self.outcome.report if self.outcome else {}
            graph = report.get('exploration') or {'version': 1, 'nodes': list(self.live_graph['nodes'].values()),
                                                   'edges': list(self.live_graph['edges'].values())}
            # Follow-up observations stay in agent.json, with independent graph
            # identities. The original scan/result remains immutable.
            nodes, edges = list(graph['nodes']), list(graph['edges'])
            screenshots = dict(report.get('screenshots', {}))
            ocr_images = list(report.get('ocr_images', []))
            packets = {p['id']: p for p in report.get('evidence_packets', [])}
            for index, visit in enumerate(self.agent_data.get('explorations', [])):
                prefix = 'agent_' + str(index) + '_'
                for node in visit['graph']['nodes']:
                    captured = next((p.get('snapshot_id') or node['id'] for p in visit['packets'] if p['id'] in node.get('packet_ids', [])), node['id'])
                    nodes.append({**node, 'id': prefix + node['id'], 'screenshot_id': prefix + captured,
                                  'label': '추가 탐색 · ' + node['label']})
                for edge in visit['graph']['edges']:
                    edges.append({**edge, 'id': prefix + edge['id'], 'source': prefix + edge['source'], 'target': prefix + edge['target']})
                source = next((n for n in graph['nodes'] if visit['source_evidence_id'] in n.get('packet_ids', [])), None)
                target = next((n for n in visit['graph']['nodes'] if n['kind'] == 'page'), None)
                if source and target:
                    edges.append({'id': prefix + 'followup', 'source': source['id'], 'target': prefix + target['id'], 'label': 'AI 추가 확인'})
                packets.update((p['id'], {**p, 'supplemental': True, 'snapshot_id': prefix + (p.get('snapshot_id') or ''),
                                         'image_id': prefix+p['image_id'] if p.get('image_id') else None}) for p in visit['packets'] if p['id'] not in packets)
                ocr_images.extend({**image, 'id': prefix+image['id']} for image in visit.get('ocr_images', []))
                screenshots.update((prefix + key, image) for key, image in visit.get('screenshots', {}).items())
            return {'run_id': self.run_id, 'graph': {**graph, 'nodes': nodes, 'edges': edges}, 'packets': list(packets.values()),
                    'screenshots': screenshots, 'ocr_images': ocr_images, 'local_ai': report.get('local_ai'),
                    'ocr_summary': report.get('ocr_summary'),
                    'agent': self._inspection_command('agent-status', {}),
                    'review_report': review_report(self.outcome.result, report, self.agent_data) if self.outcome else None}
        if self.running or self.outcome is None:
            raise ValueError('검사 완료 후 실행하세요.')
        if method == 'agent-run':
            if self.content_worker and self.content_worker.is_alive(): raise ValueError('직접 분석 완료 후 AI 검토를 시작하세요.')
            if self.agent_worker and self.agent_worker.is_alive():
                raise ValueError('에이전트가 실행 중입니다.')
            if params.get('scope') == 'all':
                packets = self.outcome.report.get('evidence_packets', [])
                if not packets:
                    raise ValueError('검토할 수집 영역이 없습니다.')
                from .detection import analyze_element
                packets = sorted(packets, key=lambda p: (
                    not analyze_element(p).get('is_advertisement'),
                    not any(s.get('review_priority') == 'high' for s in p.get('local_ai', {}).values()),
                    bool(p.get('truncated')), len(p.get('text', '')) < 10))
                config = self.agent_config or agent_settings({})
                self.agent_stop = Event()
                self.agent_data['report'] = {'total': len(packets), 'completed': 0, 'status': 'running', 'assessments': []}
                self.agent_worker = Thread(target=self._run_agent_report, args=(config, packets), daemon=True)
                self.agent_worker.start()
                return {'started': True, 'provider': (self.agent_config or {}).get('provider', 'groq'), 'scope': 'all'}
            packet = next((p for p in self.outcome.report.get('evidence_packets', []) if p['id'] == params.get('evidence_id')), None)
            if packet is None:
                raise ValueError('검토할 내용을 찾지 못했습니다. 검사 기록을 다시 열어 주세요.')
            config = self.agent_config or agent_settings({})
            self.agent_stop = Event()
            self.agent_worker = Thread(target=self._run_agent, args=(config, packet), daemon=True)
            self.agent_worker.start()
            return {'started': True, 'provider': (self.agent_config or {}).get('provider', 'groq'), 'evidence_id': packet['id']}
        raise ValueError('지원하지 않는 검사 확장 명령입니다.')

    def _analyze_content(self, text, pixels, runtime):
        analysis_id = self.content_data['analysis_id']
        def progress(stage):
            self.emit({'kind': 'content_analysis', 'analysis_id': analysis_id, 'status': 'running', 'stage': stage})
        try:
            with event_loop_runner() as runner:
                runner.get_loop()
                result = runner.run(analyze_content(text, pixels, runtime, self.content_stop, progress))
            self.content_data = {'analysis_id': analysis_id, 'status': result['status'], 'result': result}
        except asyncio.CancelledError:
            self.content_data = {'analysis_id': analysis_id, 'status': 'cancelled'}
        except Exception:
            self.content_data = {'analysis_id': analysis_id, 'status': 'failed', 'message': '직접 분석 처리 실패. 입력 형식·모델 상태를 확인하세요.'}
        self.emit({'kind': 'content_analysis', 'analysis_id': analysis_id, 'status': self.content_data['status']})

    def _check_ocr_runtime(self):
        async def probe():
            worker = OCRSession(); task = asyncio.create_task(worker.recognize(probe_png()))
            try:
                while not task.done():
                    if self.runtime_stop.is_set(): raise asyncio.CancelledError()
                    await asyncio.wait({task}, timeout=.1)
                result = await task
                if result.get('status') != 'completed': raise ValueError(result.get('message', 'OCR 구동 확인 실패'))
                return {'status': 'completed', 'model': result['model'], 'device': 'cpu', 'network_requests': 0}
            finally:
                if not task.done(): task.cancel(); await asyncio.gather(task, return_exceptions=True)
                await worker.close()
        try:
            with event_loop_runner() as runner:
                runner.get_loop(); self.ocr_check = runner.run(probe())
        except asyncio.CancelledError: self.ocr_check = {'status': 'cancelled'}
        except Exception as error: self.ocr_check = {'status': 'failed', 'message': str(error)[:300]}

    def _run_agent_report(self, config, packets):
        report = self.agent_data['report']
        self.emit({'kind': 'agent_started', 'scope': 'all', 'provider': (self.agent_config or {}).get('provider', 'groq')})
        try:
            for packet in packets:
                if self.agent_stop.is_set():
                    report['status'] = 'stopped'
                    break
                assessment = self._run_agent(config, packet, batch=True)
                if assessment is None:
                    report['status'] = 'partial'
                    events = self.agent_data.get('events', [])
                    report['stop_reason'] = next((e['message'] for e in reversed(events) if e.get('kind') == 'agent_failed'), '검토 중단 또는 사용 한도 도달')
                    break
                report['assessments'].append(assessment)
                report['completed'] += 1
                self._save_agent()
            else:
                report['status'] = 'completed'
        finally:
            self._save_agent()
            self.emit({'kind': 'agent_done', 'scope': 'all'})

    def _run_agent(self, config, packet, batch=False):
        def persist(ledger):
            self.agent_data['ledger'] = ledger
            self._save_agent()
        def observe(event):
            self.agent_data['events'] = [*self.agent_data.get('events', [])[-199:], event]
            self.emit(event)
        try:
            if not batch:
                observe({'kind': 'agent_started', 'evidence_id': packet['id'], 'provider': (self.agent_config or {}).get('provider', 'groq')})
            agent = EvidenceAgent(config, self.agent_data.get('ledger'), stop=self.agent_stop, emit=observe, persist=persist)
            persist(agent.ledger)
            entry = self.outcome.result['meta']['entry_url']
            # Only source scan packets are accepted by agent-run. Supplemental
            # pages cannot recursively grow an unbounded exploration tree.
            options = exploration_options(packet, self.outcome.report, entry)
            def explore(option, timeout):
                def progress(event):
                    if event['kind'] in ('phase', 'request_blocked', 'warning'):
                        observe({'kind': 'agent_step', 'action': 'browser_' + event['kind'],
                                 **{k: v for k, v in event.items() if k in ('url', 'message', 'reason', 'target_url')}})
                ocr = self.outcome.report.get('ocr_summary', {})
                outcome = collect_page(option, entry, timeout, self.agent_stop, progress,
                    ocr_enabled=ocr.get('enabled', True), ocr_max_images=ocr.get('max_images', 50))
                packets = outcome.report.get('evidence_packets', [])[:12]
                image_ids = {p.get('image_id') for p in packets}
                images, image_bytes, preview_bytes, omitted = [], 0, 0, 0
                for original in outcome.report.get('ocr_images', []):
                    if original['id'] not in image_ids: continue
                    image = deepcopy(original)
                    preview = len(image.get('preview_data_url', ''))
                    if preview_bytes + preview > 300000:
                        image.pop('preview_data_url', None); preview = 0
                    size = len(json.dumps(image, ensure_ascii=False).encode('utf-8'))
                    if image_bytes + size > 900000:
                        omitted += 1; continue
                    if image.get('status') == 'completed':
                        data = outcome.image_assets[image['relative_path']]
                        atomic_write(Path(self.output_path).parent/image['relative_path'], data)
                    images.append(image); image_bytes += size; preview_bytes += preview
                ids = {p['id'] for p in packets}
                graph = outcome.report['exploration']
                graph = {**graph, 'nodes': [{**n, 'packet_ids': [p for p in n.get('packet_ids', []) if p in ids]} for n in graph['nodes'][:100]]}
                node_ids = {n['id'] for n in graph['nodes']}
                graph['edges'] = [e for e in graph['edges'] if e['source'] in node_ids and e['target'] in node_ids]
                visit = {'url': option['url'], 'source_evidence_id': packet['id'], 'status': outcome.report['status'],
                         'packets': packets, 'graph': graph, 'blocked_requests': outcome.report['blocked_requests'],
                         'ocr_images': images, 'ocr_images_omitted': omitted, 'ocr_summary': outcome.report.get('ocr_summary'),
                         'screenshots': dict(list(outcome.report.get('screenshots', {}).items())[:2])}
                self.agent_data.setdefault('explorations', []).append(visit)
                self._save_agent()
                return visit
            assessment = agent.investigate_with_exploration(packet, options, explore)
            self.agent_data['assessments'] = [*self.agent_data.get('assessments', [])[-99:], assessment]
            self._save_agent()
            if not batch:
                self.emit({'kind': 'agent_done', 'assessment': assessment})
            return assessment
        except Exception as error:
            observe({'kind': 'agent_failed', 'message': str(error)[:300]})
            self._save_agent()

    def _run(self, config, folder, demo, workflow):
        site = None
        busy = self.busy
        events = []
        try:
            folder.mkdir(parents=True, exist_ok=True)
            if demo:
                from dataclasses import replace
                site = DemoSite().start()
                config = replace(config, entry_url=site.url, profile_path=None)
            def observe(event):
                if event['kind'] == 'exploration':
                    self.live_graph['nodes'][event['node']['id']] = event['node']
                    if event.get('edge'):
                        self.live_graph['edges'][event['edge']['id']] = event['edge']
                if event['kind'] == 'preview':
                    atomic_write(folder/'last-preview.jpg', base64.b64decode(event['data_url'].split(',', 1)[1]))
                    atomic_write(folder/'last-preview.json', json.dumps({'url': event['url'], 'title': event.get('title', ''),
                        'timestamp': datetime.now().astimezone().isoformat()}, ensure_ascii=False).encode('utf-8'))
                if event['kind'] in ('finding', 'candidate'):
                    record = event.get('finding') or event['candidate']
                    self.live_records[record['id']] = {**record, '_detail': event.get('detail')}
                value = self.emit(event)
                # Persist a complete process timeline without huge image payloads.
                if event['kind'] != 'preview' and len(events) < 100000:
                    saved = {k: v for k, v in value.items() if k != 'screenshot'}
                    events.append(saved)
                    with (folder/'events.jsonl').open('ab') as log:
                        log.write((json.dumps(saved,ensure_ascii=False)+'\n').encode('utf-8'))
            observe({'kind': 'started', 'url': config.entry_url, 'folder': str(folder)})
            # Initialize the event loop before constructing the coroutine so an
            # OS startup failure does not leak an unawaited scan coroutine.
            with event_loop_runner() as runner:
                runner.get_loop()
                self.outcome = runner.run(scan(config, self.stop, observe, self.control))
            observe({'kind': 'phase', 'stage': 'report', 'action': 'save', 'message': 'JSON·CSV·탐색 보고서와 실행 기록을 저장합니다.'})
            self.outcome.report['workflow'] = workflow
            self.outcome.report['runtime_environment'] = self.run_environment
            self.outcome.report['run_id'] = self.run_id
            self.outcome.report['desktop_options'] = {'demo': demo, 'preview': config.capture_previews}
            path = self.outcome.save(folder)
            self.output_path = str(path)
            self._save_review_report()
            self.reviews = ReviewStore(path, self.outcome)
            entry = {'id': folder.name, 'url': config.entry_url, 'status': self.outcome.report['status'],
                     'findings': len(self.outcome.result['findings']), 'candidates': self.outcome.report['candidate_count'],
                     'pages': len(self.outcome.report['pages_scanned']), 'path': str(path),
                     'finished_at': self.outcome.result['meta']['finished_at']}
            self.history = [entry, *self.history][:30]
            atomic_write(self.history_path, json.dumps(self.history, ensure_ascii=False, indent=2).encode('utf-8'))
            if site:
                site.close()
                site = None
            # Release busy state before notifying clients, so an immediate next
            # command can review or start another run without a cleanup race.
            events.append({'kind': 'done', 'report': {'status': self.outcome.report['status']},
                           'path': str(path), 'timestamp': datetime.now().astimezone().isoformat(),
                           'run_id': self.run_id, 'sequence': self.sequence + 1, 'protocol_version': 1})
            atomic_write(folder/'events.jsonl', ''.join(json.dumps(e, ensure_ascii=False)+'\n' for e in events).encode('utf-8'))
            busy.clear()
            self.stopping = False
            self.last_status = self.outcome.report['status']
            self.emit({'kind': 'done', 'result': self.outcome.result, 'report': self.outcome.report,
                       'path': str(path), 'history': self.history, 'reviews': self.reviews.data})
        except Exception as exc:
            busy.clear()
            self.last_status = 'failed'
            failure = self.emit({'kind': 'error', 'message': str(exc)})
            # Keep diagnostics even if validation, report writing or engine work failed.
            # No locals, credentials or image payloads are written to the traceback.
            import traceback
            try:
                folder.mkdir(parents=True, exist_ok=True)
                atomic_write(folder/'failure.json', json.dumps({'status':'failed',
                    'error_type':type(exc).__name__, 'message':str(exc),
                    'timestamp':datetime.now().astimezone().isoformat()},ensure_ascii=False).encode('utf-8'))
                atomic_write(folder/'failure.log', traceback.format_exc().encode('utf-8'))
                atomic_write(folder/'events.jsonl', ''.join(json.dumps(e,ensure_ascii=False)+'\n'
                    for e in [*events, failure]).encode('utf-8'))
            except OSError:
                pass  # The original failure remains visible when the disk is unwritable.
        finally:
            if site:
                site.close()
            busy.clear()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', type=Path, required=True)
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
    sys.stdin.reconfigure(encoding='utf-8')
    lock = Lock()
    def send(message):
        with lock:
            print(json.dumps(message, ensure_ascii=False, allow_nan=False), flush=True)
    bridge = DesktopBridge(args.data_dir, send)
    for line in sys.stdin:
        request = {}
        try:
            if len(line) > 1_000_000:
                raise ValueError('명령이 너무 큽니다.')
            request = json.loads(line)
            if not isinstance(request, dict):
                raise ValueError('잘못된 요청입니다.')
            result = bridge.command(request.get('method'), request.get('params', {}))
            send({'id': request.get('id'), 'result': result})
        except Exception as exc:
            send({'id': request.get('id') if isinstance(request, dict) else None, 'error': str(exc)})
    bridge.stop.set()
    bridge.agent_stop.set()
    bridge.runtime_stop.set()
    bridge.content_stop.set()
    if bridge.content_worker:
        bridge.content_worker.join(timeout=3)
    if bridge.runtime_worker:
        bridge.runtime_worker.join(timeout=3)
    if bridge.agent_worker:
        bridge.agent_worker.join(timeout=11)
    if bridge.worker:
        bridge.worker.join(timeout=8)


if __name__ == '__main__':
    main()
