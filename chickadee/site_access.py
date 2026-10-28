"""Session-only credentials for operator-authorized website inspections."""
from dataclasses import dataclass, field
import re
import time
from urllib.parse import urlsplit, unquote

HEADER = 'X-Chickadee-Token'


def site_origin(url):
    if not isinstance(url, str) or re.search(r'[\s\x00-\x1f\x7f]', url):
        raise ValueError('Invalid site URL.')
    p = urlsplit(url)
    if p.scheme != 'https' or not p.hostname or p.username is not None or p.password is not None:
        raise ValueError('Use an HTTPS site without credentials.')
    host = p.hostname.encode('idna').decode('ascii').lower()
    if ':' in host: host = '[' + host + ']'
    return f'https://{host}' + (f':{p.port}' if p.port and p.port != 443 else '')


@dataclass(frozen=True)
class SiteAccess:
    origin: str
    path_prefix: str
    token: str = field(repr=False)
    expires_at: float

    @classmethod
    def create(cls, value):
        if not isinstance(value, dict) or set(value) - {'origin', 'path_prefix', 'token', 'hours'}:
            raise ValueError('Invalid site access settings.')
        url = value.get('origin', '')
        if not isinstance(url, str) or len(url) > 2048: raise ValueError('Invalid site origin.')
        p = urlsplit(url)
        origin = site_origin(url)
        if p.path not in ('', '/') or p.query or p.fragment:
            raise ValueError('Enter only the HTTPS origin; use the path field separately.')
        path = value.get('path_prefix', '/')
        if not isinstance(path, str) or not re.fullmatch(r'/[A-Za-z0-9/_\-.]*', path) or len(path) > 500 or any(x in {'.','..'} for x in path.split('/')) or '//' in path:
            raise ValueError('Use an absolute path without query strings, escapes or dot segments.')
        token = value.get('token', '')
        if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_-]{32,256}', token):
            raise ValueError('Use a 32–256 character random token containing letters, digits, hyphens or underscores.')
        hours = value.get('hours', 1)
        if type(hours) is not int or not 1 <= hours <= 24:
            raise ValueError('Credential lifetime must be 1–24 hours.')
        return cls(origin, path.rstrip('/') or '/', token, time.time() + hours * 3600)

    def headers(self, url, method='GET'):
        if time.time() >= self.expires_at or method not in ('GET', 'HEAD'): return {}
        try:
            if site_origin(url) != self.origin: return {}
            path = unquote(urlsplit(url).path or '/')
            if '%' in path or '\\' in path or '//' in path or any(x in {'.','..'} for x in path.split('/')): return {}
            if self.path_prefix != '/' and path != self.path_prefix and not path.startswith(self.path_prefix + '/'): return {}
        except (ValueError, UnicodeError):
            return {}
        return {HEADER: self.token}

    def public(self):
        return {'origin': self.origin, 'path_prefix': self.path_prefix,
                'expires_at': self.expires_at, 'active': time.time() < self.expires_at}

    def redact(self, message):
        return str(message).replace(self.token, '[REDACTED]')
