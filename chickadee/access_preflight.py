"""Compare a protected GET with/without the scoped token; never bypass login."""
import time
import urllib.request
from urllib.error import HTTPError
from .network_boundary import AddressPolicy


def probe(access, url, marker):
    if not isinstance(url, str) or len(url) > 2048 or not access.headers(url):
        raise ValueError('등록된 인증 범위 안의 URL이 필요합니다.')
    if not isinstance(marker, str) or not 2 <= len(marker.strip()) <= 200:
        raise ValueError('보호된 페이지에만 표시되는 확인 문구를 입력하세요.')
    marker = marker.strip()
    opener = AddressPolicy(access.origin).opener()
    def read(headers):
        request = urllib.request.Request(url, headers={'User-Agent': 'Chickadee-Access-Check', **headers})
        try:
            with opener.open(request, timeout=5) as response:
                text = response.read(262145)
                if len(text) > 262144: return 200, False, True
                text = text.decode(response.headers.get_content_charset() or 'utf-8', errors='replace')
                login = 'type="password"' in text.lower() or "type='password'" in text.lower()
                return response.status, marker in text and not login, False
        except HTTPError as exc:
            return exc.code, False, False
    anonymous = read({})
    if anonymous[0] == 429:
        return {'status': 'rate_limited', 'anonymous_status': 429, 'verified': False}
    time.sleep(1)
    headers = access.headers(url)
    if not headers: return {'status': 'expired', 'verified': False}
    authenticated = read(headers)
    status = ('rate_limited' if authenticated[0] == 429 else
              'blocked' if authenticated[0] in (401, 403) else
              'public' if anonymous[1] else
              'verified' if 200 <= authenticated[0] < 300 and authenticated[1] else 'unconfirmed')
    return {'status': status, 'verified': status == 'verified',
            'anonymous_status': anonymous[0], 'authenticated_status': authenticated[0],
            'checked_at': time.time(), 'expires_at': access.expires_at}


def server_rule(access):
    """No token returned. Operator must substitute it in their own WAF console."""
    from urllib.parse import urlsplit
    if urlsplit(access.origin).port not in (None,443):
        raise ValueError('다른 HTTPS 포트는 운영자의 WAF에서 포트 조건을 직접 설정하세요.')
    host = urlsplit(access.origin).hostname
    path = access.path_prefix
    import json
    scope = 'true' if path == '/' else f'(http.request.uri.path eq {json.dumps(path)} or starts_with(http.request.uri.path, {json.dumps(path + "/")}))'
    return (f'(http.host eq {json.dumps(host)} and {scope} and '
            f'http.request.method in {{"GET" "HEAD"}} and '
            f'http.request.timestamp.sec lt {int(access.expires_at)} and '
            'any(http.request.headers["x-chickadee-token"][*] eq "REPLACE_WITH_YOUR_TOKEN"))')
