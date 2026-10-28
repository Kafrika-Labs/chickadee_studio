"""Per-run, memory-only authentication handoff. Credentials never enter events."""
import asyncio
import time
import uuid
import re
from threading import Lock
from urllib.parse import urlsplit


class AuthenticationRequired(RuntimeError):
    pass


def is_login_url(url):
    """Recognize authentication destinations, never ordinary links on a page."""
    parts = urlsplit(url)
    return parts.scheme in ('http', 'https') and not parts.username and bool(re.search(
        r'(?:^|[/_.-])(?:login|logon|signin|sign-in|sso|authorize)(?:$|[/_.-])', parts.path, re.I))


class LoginRedirect(AuthenticationRequired):
    def __init__(self, url):
        super().__init__('로그인 필요로 미수집')
        self.url = url


class LoginCoordinator:
    def __init__(self):
        self.lock = Lock()
        self.pending = None
        self.cookies = []
        self.result = None
        self.since = None
        self.total = 0.0

    @property
    def paused_seconds(self):
        with self.lock:
            return self.total + (time.monotonic() - self.since if self.since is not None else 0)

    def state(self):
        with self.lock:
            return dict(self.pending) if self.pending else None

    def session(self, request_id):
        with self.lock:
            self._check(request_id)
            return {**self.pending, 'cookies': list(self.cookies)}

    def _check(self, request_id):
        if not self.pending or self.pending['request_id'] != request_id or self.result is not None:
            raise ValueError('현재 로그인 요청이 아닙니다.')

    def complete(self, request_id, cookies=None, skip=False):
        with self.lock:
            self._check(request_id)
            if skip:
                self.result = {'skip': True}
                return
            host = urlsplit(self.pending['requested_url']).hostname
            if not isinstance(cookies, list) or len(cookies) > 300:
                raise ValueError('로그인 세션 형식이 올바르지 않습니다.')
            clean = []
            for cookie in cookies:
                if not isinstance(cookie, dict): raise ValueError('로그인 쿠키 형식 오류')
                domain = cookie.get('domain', '').lstrip('.').lower()
                if not domain or not (host == domain or host.endswith('.' + domain)):
                    raise ValueError('검사 사이트의 쿠키만 사용할 수 있습니다.')
                if not all(isinstance(cookie.get(k), str) for k in ('name', 'value', 'path')):
                    raise ValueError('로그인 쿠키 형식 오류')
                if len(cookie['name']) + len(cookie['value']) > 16384: raise ValueError('로그인 쿠키 크기 초과')
                clean.append({k: v for k, v in cookie.items() if k in ('name', 'value', 'domain', 'path', 'expires', 'httpOnly', 'secure', 'sameSite')})
            self.result = {'cookies': clean}

    async def wait(self, url, requested_url, cookies, emit, identity=None):
        with self.lock:
            self.pending = {'request_id': uuid.uuid4().hex, 'url': url, 'requested_url': requested_url, **(identity or {})}
            self.cookies = cookies
            self.result = None
            self.since = time.monotonic()
            request_id = self.pending['request_id']
        emit({'kind': 'login_required', **self.state(), 'message': '로그인이 필요합니다. 로그인 후 검사를 이어갈 수 있습니다.'})
        try:
            while True:
                with self.lock:
                    result = self.result
                if result is not None: return result
                await asyncio.sleep(.05)
        finally:
            with self.lock:
                self.total += time.monotonic() - self.since
                self.since = None
                self.pending = None
                self.cookies = []
                self.result = None
            emit({'kind': 'login_finished', 'request_id': request_id, 'message': '로그인 대기를 종료했습니다.'})


async def requires_login(page, response):
    if response and response.status == 401:
        return True
    # A visible password field is a signal; a "login" navigation link alone isn't.
    for frame in page.frames:
        try:
            if await frame.locator('input[type="password"]:visible').count(): return True
        except Exception:
            continue
    return False


async def active_timeout(awaitable, seconds, login, excluded_seconds=None):
    """Keep navigation timeouts separate from bounded local OCR and login waits."""
    task = asyncio.create_task(awaitable)
    started, paused = time.monotonic(), login.paused_seconds if login else 0
    excluded = excluded_seconds() if excluded_seconds else 0
    try:
        while not task.done():
            elapsed = time.monotonic() - started - ((login.paused_seconds - paused) if login else 0)
            if excluded_seconds:
                elapsed -= max(0, excluded_seconds() - excluded)
            if elapsed >= seconds: raise asyncio.TimeoutError()
            await asyncio.wait({task}, timeout=.05)
        return await task
    finally:
        if not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


def fetch_favicon(url, address_policy=None):
    """Read a small raster icon without redirects or third-party favicon services."""
    import base64
    import io
    import urllib.request
    from PIL import Image
    from .image_ocr import NoRedirect
    from .network_boundary import AddressPolicy
    opener = (address_policy or AddressPolicy(url)).opener()
    with opener.open(urllib.request.Request(url, headers={'User-Agent': 'Chickadee'}), timeout=1) as response:
        data = response.read(131073)
    if len(data) > 131072:
        raise ValueError('Icon too large')
    with Image.open(io.BytesIO(data)) as source:
        if source.width * source.height > 1000000:
            raise ValueError('Icon dimensions too large')
        source.thumbnail((32, 32))
        output = io.BytesIO()
        source.convert('RGBA').save(output, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(output.getvalue()).decode('ascii')
