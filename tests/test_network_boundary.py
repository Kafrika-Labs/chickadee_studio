import asyncio
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import socket
import threading
import unittest
from unittest.mock import patch
from chickadee.network_boundary import AddressPolicy, NetworkDenied, NetworkProxy


class PolicyTests(unittest.TestCase):
    def test_private_dns_legacy_numeric_metadata_and_mapped_forms(self):
        policy=AddressPolicy('https://example.org')
        for host in ('127.0.0.1','127.1','2130706433','0x7f000001','::1','::ffff:127.0.0.1','169.254.169.254','localhost.'):
            with self.subTest(host=host), self.assertRaises((NetworkDenied,socket.gaierror)):
                policy.resolve(host,80)
        with self.assertRaises(NetworkDenied): AddressPolicy('http://169.254.169.254').resolve('169.254.169.254',80)

    def test_mixed_answers_and_entry_port_scope(self):
        policy=AddressPolicy('http://127.0.0.1:1234')
        policy.resolve('127.0.0.1',1234)
        with self.assertRaises(NetworkDenied): policy.resolve('127.0.0.1',1235)
        with patch('socket.getaddrinfo',return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('8.8.8.8',80)),
            (socket.AF_INET,socket.SOCK_STREAM,6,'',('127.0.0.1',80))]):
            with self.assertRaises(NetworkDenied): AddressPolicy('https://example.org').resolve('public.test',80)
        with patch('socket.getaddrinfo',return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('127.0.0.1',1234))]):
            with self.assertRaises(NetworkDenied): policy.resolve('rebinding.test',1234)

    def test_tcp_connection_uses_the_vetted_numeric_address_without_resolution(self):
        policy=AddressPolicy('https://example.org')
        answers=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('8.8.8.8',443))]
        with patch('socket.getaddrinfo',return_value=answers) as resolver, patch('socket.socket') as factory:
            policy.connect('public.test',443)
            resolver.assert_called_once()
            factory.return_value.connect.assert_called_once_with(('8.8.8.8',443))

    def test_named_intranet_requires_exact_operator_declared_ip_and_port(self):
        with patch('socket.getaddrinfo',return_value=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('10.20.30.40',443))]):
            with self.assertRaises(NetworkDenied): AddressPolicy('https://intranet.example').resolve('intranet.example',443)
            policy=AddressPolicy('https://intranet.example', ['10.20.30.40'])
            policy.resolve('intranet.example',443)
            with self.assertRaises(NetworkDenied): policy.resolve('other.example',443)
            with self.assertRaises(NetworkDenied): policy.resolve('intranet.example',444)
        with self.assertRaises(NetworkDenied): AddressPolicy('https://intranet.example',['169.254.169.254'])


class ProxyTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_browser_route_fetch_cookies_and_blocked_dns_have_no_sink_request(self):
        from playwright.async_api import async_playwright
        hits=[]
        class H(BaseHTTPRequestHandler):
            def log_message(self,*a): pass
            def do_GET(self):
                hits.append(self.path)
                self.send_response(200); self.send_header('Content-Type','text/html')
                self.send_header('Set-Cookie','one=1; Path=/');self.send_header('Set-Cookie','two=2; Path=/')
                self.end_headers();self.wfile.write(b'<p>valid local entry</p>')
        server=ThreadingHTTPServer(('127.0.0.1',0),H)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        url=f'http://127.0.0.1:{server.server_port}'
        proxy=await NetworkProxy(AddressPolicy(url)).start()
        try:
            async with async_playwright() as pw:
                browser=await pw.chromium.launch(channel='msedge' if __import__('os').name=='nt' else None,
                    proxy={'server':proxy.url,'bypass':'<-loopback>'})
                context=await browser.new_context()
                async def guard(route):
                    response=await route.fetch(max_redirects=0,timeout=2000)
                    await route.fulfill(response=response);await response.dispose()
                await context.route('**/*',guard)
                page=await context.new_page();await page.goto(url)
                self.assertIn('valid local entry',await page.inner_text('body'))
                self.assertEqual({c['name'] for c in await context.cookies()}, {'one','two'})
                before=len(hits)
                original=socket.getaddrinfo
                def resolve(host,port,*args,**kw):
                    if host=='rebinding.test':return original('127.0.0.1',port,*args,**kw)
                    return original(host,port,*args,**kw)
                with patch('socket.getaddrinfo',side_effect=resolve):
                    with self.assertRaises(Exception):
                        await context.request.get(f'http://rebinding.test:{server.server_port}/blocked',timeout=2500)
                self.assertEqual(len(hits),before)
                await browser.close()
            opener=AddressPolicy(url).opener()
            text=await asyncio.to_thread(lambda:opener.open(url,timeout=2).read())
            self.assertIn(b'valid local entry',text)
        finally:
            await proxy.close();server.shutdown();server.server_close()
