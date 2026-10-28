import asyncio
from dataclasses import replace
import json
from pathlib import Path
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from chickadee.site_access import SiteAccess, HEADER
from chickadee.scanner import ScanConfig, _State, _fetch_route, _fetch_image_bounded, origin
from chickadee.bridge import DesktopBridge

TOKEN = 'fixture-only-' + 'a' * 40


class SiteAccessTests(unittest.TestCase):
    def entry(self, **changes):
        return SiteAccess.create({'origin': 'https://example.test', 'path_prefix': '/boards', 'token': TOKEN, **changes})

    def test_exact_origin_path_method_and_expiry(self):
        auth = self.entry()
        for url in ('https://example.test/boards', 'https://EXAMPLE.test:443/boards/free?p=1'):
            self.assertEqual(auth.headers(url), {HEADER: TOKEN})
        for url in ('http://example.test/boards', 'https://example.test:444/boards',
                    'https://sub.example.test/boards', 'https://example.test.evil/boards',
                    'https://example.test/boardsevil', 'https://example.test/boards/../admin',
                    'https://example.test/boards/%2e%2e/admin', 'https://example.test/boards/%252e%252e/admin',
                    'https://user:password@example.test/boards'):
            self.assertEqual(auth.headers(url), {}, url)
        self.assertEqual(auth.headers('https://example.test/boards', 'POST'), {})
        self.assertEqual(replace(auth, expires_at=time.time()-1).headers('https://example.test/boards'), {})
        self.assertNotIn(TOKEN, repr(auth))
        self.assertNotIn(TOKEN, json.dumps(auth.public()))

    def test_invalid_credentials_never_echo_token(self):
        for change in ({'token': TOKEN+'\r\nInjected: yes'}, {'origin':'http://example.test'},
                       {'origin':'https://example.test/path'}, {'path_prefix':'/boards/../admin'},
                       {'hours':0}, {'hours':True}):
            with self.assertRaises(ValueError) as error: self.entry(**change)
            self.assertNotIn(TOKEN, str(error.exception))

    def test_fetch_rechecks_every_request_and_disables_redirect_following(self):
        async def check():
            auth = self.entry()
            config = ScanConfig('https://example.test/boards', allow_network=True, site_access=auth)
            request = SimpleNamespace(method='GET', all_headers=AsyncMock(return_value={HEADER.lower():'stale', 'accept':'text/html'}))
            route = SimpleNamespace(request=request, fetch=AsyncMock(return_value=object()))
            for url in ('https://example.test/boards', 'https://cdn.example.test/boards', 'https://example.test/public'):
                await _fetch_route(route, config, _State(), lambda _: None, url)
                options = route.fetch.call_args.kwargs
                self.assertEqual(options['max_redirects'], 0)
                self.assertEqual(options['headers'], {'accept':'text/html', **auth.headers(url)})
            route.fetch = AsyncMock(side_effect=RuntimeError('headers: '+TOKEN))
            with self.assertRaises(RuntimeError) as error:
                await _fetch_route(route, config, _State(), lambda _: None, config.entry_url)
            self.assertNotIn(TOKEN, str(error.exception))
        asyncio.run(check())

    def test_image_fetch_uses_the_same_scope(self):
        async def check():
            state = _State()
            state.site_access = self.entry()
            state.image_allow_network = True
            state.image_origins = {origin('https://example.test'), origin('https://cdn.example.test')}
            with patch('chickadee.scanner.fetch_image', return_value=(b'image', 'image/png')) as fetch:
                await _fetch_image_bounded('https://example.test/boards/image.png', state)
                self.assertEqual(fetch.call_args.kwargs['access_headers'], {HEADER:TOKEN})
                await _fetch_image_bounded('https://cdn.example.test/image.png', state)
                self.assertEqual(fetch.call_args.kwargs['access_headers'], {})
        asyncio.run(check())

    def test_bridge_registration_removal_restart_and_no_persistence(self):
        with tempfile.TemporaryDirectory() as folder:
            bridge = DesktopBridge(folder, lambda _: None)
            result = bridge.command('site-access', {'origin':'https://example.test', 'token':TOKEN})
            self.assertEqual(len(result['sites']), 1)
            self.assertNotIn(TOKEN, json.dumps(result))
            self.assertEqual(DesktopBridge(folder, lambda _: None).command('site-access', {}), {'sites':[]})
            for p in Path(folder).rglob('*'):
                if p.is_file(): self.assertNotIn(TOKEN.encode(), p.read_bytes())
            bridge.busy.set()
            with self.assertRaises(ValueError): bridge.command('site-access', {'remove':'https://example.test'})
            bridge.busy.clear()
            self.assertEqual(bridge.command('site-access', {'remove':'https://example.test'}), {'sites':[]})

    def test_expired_or_out_of_scope_registration_blocks_scan_start(self):
        from tests.test_desktop import workflow
        with tempfile.TemporaryDirectory() as folder:
            bridge = DesktopBridge(folder, lambda _: None)
            bridge.site_access['https://example.test'] = self.entry()
            with self.assertRaisesRegex(ValueError, 'outside'):
                bridge.command('start', {'url':'https://example.test/other', 'workflow':workflow()})
            bridge.site_access['https://example.test'] = replace(self.entry(), expires_at=0)
            with self.assertRaisesRegex(ValueError, 'expired'):
                bridge.command('start', {'url':'https://example.test/boards', 'workflow':workflow()})

    def test_bridge_passes_credentials_only_to_matching_site(self):
        from tests.test_desktop import workflow
        with tempfile.TemporaryDirectory() as folder:
            bridge = DesktopBridge(folder, lambda _: None)
            bridge.site_access['https://example.test'] = self.entry()
            with patch('chickadee.bridge.Thread') as worker:
                bridge.command('start', {'url':'https://example.test/boards', 'workflow':workflow()})
                self.assertEqual(worker.call_args.kwargs['args'][0].site_access, self.entry_snapshot(bridge))
                bridge.busy.clear()
                bridge.command('start', {'url':'https://other.test/boards', 'workflow':workflow()})
                self.assertIsNone(worker.call_args.kwargs['args'][0].site_access)

    @staticmethod
    def entry_snapshot(bridge):
        return bridge.site_access['https://example.test']


if __name__ == '__main__': unittest.main()
