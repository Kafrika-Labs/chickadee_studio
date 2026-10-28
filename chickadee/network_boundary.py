"""Resolve, validate and connect to the SAME numeric address. No TLS interception."""
import asyncio
import http.client
import ipaddress
import socket
import struct
import urllib.request
from urllib.parse import urlsplit


class NetworkDenied(ValueError):
    pass


def address(value):
    try:
        ip = ipaddress.ip_address(value)
        return ip.ipv4_mapped if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped else ip
    except ValueError:
        return None


class AddressPolicy:
    def __init__(self, entry_url, private_addresses=()):
        p = urlsplit(entry_url)
        if p.scheme not in ('http', 'https') or not p.hostname or p.username is not None or p.password is not None:
            raise NetworkDenied('HTTP(S) 주소가 필요합니다.')
        host = p.hostname.lower()
        self.local_host = host
        self.local = None
        ip = address(host)
        if host == 'localhost':
            self.local = ({'127.0.0.1', '::1'}, p.port or (443 if p.scheme == 'https' else 80))
        elif ip and (ip.is_loopback or ip.is_private and not ip.is_reserved) and not (ip.is_link_local or ip.is_unspecified or ip.is_multicast):
            self.local = ({str(ip)}, p.port or (443 if p.scheme == 'https' else 80))
        if not isinstance(private_addresses,(tuple,list)) or len(private_addresses)>16:
            raise NetworkDenied('내부 주소 허용 목록 오류')
        if private_addresses:
            addresses=set()
            for value in private_addresses:
                entry=address(value)
                if not entry or not (entry.is_loopback or entry.is_private and not entry.is_reserved) or entry.is_link_local or entry.is_unspecified or entry.is_multicast:
                    raise NetworkDenied('명시한 내부 주소 형식 오류')
                addresses.add(str(entry))
            self.local=(addresses,p.port or (443 if p.scheme=='https' else 80))

    def resolve(self, host, port):
        if not isinstance(host, str) or '%' in host or any(ord(c) < 33 for c in host):
            raise NetworkDenied('지원하지 않는 호스트 주소입니다.')
        answers = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        if not answers:
            raise NetworkDenied('DNS 응답이 없습니다.')
        # All answers must pass. Never fall back to a different, unchecked resolver.
        for family, _, _, _, target in answers:
            ip = address(target[0])
            allowed_local = self.local and port == self.local[1] and str(ip) in self.local[0] and host == self.local_host
            if family not in (socket.AF_INET, socket.AF_INET6) or ip is None or not (ip.is_global or allowed_local) or ip.is_multicast:
                raise NetworkDenied('내부망·메타데이터 주소 연결 차단')
        return answers

    def connect(self, host, port, timeout=10):
        answers = self.resolve(host, port)
        error = None
        for family, socktype, proto, _, target in answers:
            sock = socket.socket(family, socktype, proto)
            try:
                sock.settimeout(timeout)
                sock.connect(target)
                return sock
            except OSError as exc:
                error = exc
                sock.close()
        raise error or NetworkDenied('연결 실패')

    def opener(self):
        policy = self
        class HTTP(http.client.HTTPConnection):
            def connect(self):
                self.sock = policy.connect(self.host, self.port, self.timeout)
        class HTTPS(http.client.HTTPSConnection):
            def connect(self):
                sock = policy.connect(self.host, self.port, self.timeout)
                try:
                    self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
                except BaseException:
                    sock.close()
                    raise
        class HTTPHandler(urllib.request.HTTPHandler):
            def http_open(self, req):
                return self.do_open(HTTP, req)
        class HTTPSHandler(urllib.request.HTTPSHandler):
            def https_open(self, req):
                return self.do_open(HTTPS, req, context=self._context)
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *_args, **_kwargs):
                return None
        return urllib.request.build_opener(urllib.request.ProxyHandler({}), HTTPHandler(), HTTPSHandler(), NoRedirect())


class NetworkProxy:
    """Loopback SOCKS5 CONNECT only. Every destination uses AddressPolicy.connect."""
    def __init__(self, policy):
        self.policy, self.server = policy, None
        self.tasks = set()
        self.slots = asyncio.Semaphore(32)

    async def start(self):
        for attempt in range(5):
            listener = socket.socket(socket.AF_INET,socket.SOCK_STREAM)
            try:
                listener.bind(('127.0.0.1',0))
                listener.listen(100)
                listener.setblocking(False)
                self.server = await asyncio.start_server(self._handle, sock=listener, limit=65536)
                break
            except OSError as error:
                listener.close()
                if getattr(error,'winerror',None) != 10014 or attempt == 4: raise
                await asyncio.sleep(.1 * 2**attempt)
            except BaseException:
                listener.close()
                raise
        self.url = 'socks5://127.0.0.1:' + str(self.server.sockets[0].getsockname()[1])
        return self

    async def close(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
        tasks = list(self.tasks)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _handle(self, reader, writer):
        task = asyncio.current_task()
        self.tasks.add(task)
        remote = None
        try:
            async with self.slots:
                async with asyncio.timeout(12):
                    version, count = await reader.readexactly(2)
                    methods = await reader.readexactly(count)
                    if version != 5 or 0 not in methods:
                        return
                    writer.write(b'\x05\x00')
                    await writer.drain()
                    version, command, reserved, kind = await reader.readexactly(4)
                    if version != 5 or command != 1 or reserved:
                        return
                    if kind == 3:
                        size = (await reader.readexactly(1))[0]
                        host = (await reader.readexactly(size)).decode('ascii')
                    elif kind in (1, 4):
                        host = socket.inet_ntop(socket.AF_INET if kind == 1 else socket.AF_INET6,
                                               await reader.readexactly(4 if kind == 1 else 16))
                    else:
                        return
                    port = struct.unpack('!H', await reader.readexactly(2))[0]
                    # Use cancellable async connects; no detached thread can leak a socket.
                    answers = await asyncio.to_thread(self.policy.resolve, host, port)
                    last_error = None
                    for family, socktype, proto, _, target in answers:
                        sock = socket.socket(family, socktype, proto)
                        sock.setblocking(False)
                        try:
                            await asyncio.get_running_loop().sock_connect(sock, target)
                            upstream, remote = await asyncio.open_connection(sock=sock)
                            break
                        except OSError as exc:
                            last_error = exc
                            sock.close()
                        except BaseException:
                            sock.close()
                            raise
                    if remote is None:
                        raise last_error or NetworkDenied('연결 실패')
                    writer.write(b'\x05\x00\x00\x01' + b'\x00' * 6)
                    await writer.drain()
                async def pipe(source, destination):
                    while data := await asyncio.wait_for(source.read(65536), 60):
                        destination.write(data)
                        await destination.drain()
                a = asyncio.create_task(pipe(reader, remote))
                b = asyncio.create_task(pipe(upstream, writer))
                try:
                    await asyncio.wait((a, b), return_when=asyncio.FIRST_COMPLETED)
                finally:
                    a.cancel(); b.cancel()
                    await asyncio.gather(a, b, return_exceptions=True)
        except (OSError, ValueError, asyncio.IncompleteReadError, TimeoutError):
            try:
                writer.write(b'\x05\x02\x00\x01' + b'\x00' * 6)
                await writer.drain()
            except OSError:
                pass
        finally:
            for stream in (remote, writer):
                if stream:
                    stream.close()
            self.tasks.discard(task)


class ProxySession:
    """Owned by one desktop login window; never shares credentials or cookies."""
    def __init__(self, entry_url, private_addresses=()):
        from threading import Thread
        from .async_runtime import event_loop_runner
        import concurrent.futures
        ready = concurrent.futures.Future()
        def run():
            try:
                with event_loop_runner() as runner:
                    self.loop = runner.get_loop()
                    async def serve():
                        self.done = asyncio.Event()
                        proxy = await NetworkProxy(AddressPolicy(entry_url, private_addresses)).start()
                        ready.set_result(proxy.url)
                        try:
                            await self.done.wait()
                        finally:
                            await proxy.close()
                    runner.run(serve())
            except BaseException as exc:
                if not ready.done():
                    ready.set_exception(exc)
        self.thread = Thread(target=run, daemon=True)
        self.thread.start()
        self.url = ready.result(timeout=15)

    def close(self):
        if self.thread.is_alive():
            self.loop.call_soon_threadsafe(self.done.set)
            self.thread.join(timeout=3)
