"""Bounded image fetching and asynchronous offline PaddleOCR worker protocol."""
import asyncio
import base64
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import hashlib
import io

MAX_UNIQUE_IMAGES = 1000
MAX_IMAGE_REQUESTS = 2000
MAX_IMAGE_BYTES = 100_000_000


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs): return None


def fetch_image(url, limit=2_000_000, cookie_header="", access_headers=None):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    headers = {'User-Agent': 'Chickadee-Image-Collector'}
    if cookie_header: headers['Cookie'] = cookie_header
    if access_headers: headers.update(access_headers)
    request = urllib.request.Request(url, headers=headers)
    with opener.open(request, timeout=5) as response:
        mime = response.headers.get_content_type()
        if mime not in ('image/png', 'image/jpeg', 'image/webp', 'image/gif'):
            raise ValueError('PNG/JPEG/WebP/GIF 이미지만 수집합니다.')
        if int(response.headers.get('Content-Length', '0')) > limit:
            raise ValueError('이미지 파일 크기 초과')
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('이미지 파일 크기 초과')
    return data, mime


def inline_image(url):
    import re
    match = re.fullmatch(r'data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\s]+)', url)
    if not match or len(url) > 2_800_000:
        raise ValueError('지원하지 않는 내장 이미지')
    data = base64.b64decode(match[2])
    if len(data) > 2_000_000:
        raise ValueError('내장 이미지 크기 초과')
    return data, 'image/' + match[1]


def recognized_text(result, limit=4000):
    """One confidence/truncation policy for scanned and directly submitted images."""
    lines = result.get('lines', [])
    accepted = [line for line in lines if type(line.get('confidence')) in (int, float)
                and math.isfinite(line['confidence']) and .55 <= line['confidence'] <= 1]
    full = '\n'.join(line['text'] for line in accepted)
    return {'text': full[:limit], 'text_truncated': len(full) > limit or bool(result.get('truncated')),
            'confidence_threshold': .55, 'accepted_lines': len(accepted), 'rejected_lines': len(lines)-len(accepted),
            'mean_confidence': round(sum(line['confidence'] for line in accepted)/len(accepted), 4) if accepted else None}


def unreadable_message(result):
    if not result.get('lines'):
        return '문자 영역을 찾지 못했습니다. 글자가 없거나 인식하지 못한 이미지입니다.'
    return f"인식한 문구 {len(result['lines'])}개의 신뢰도가 사용 기준 55%에 미달했습니다."


def image_metadata(data):
    """Retain photo evidence even if text recognition fails or is disabled."""
    from PIL import Image
    Image.MAX_IMAGE_PIXELS=8_000_000
    with Image.open(io.BytesIO(data)) as image:
        w,h=image.size;kind=image.format
        if min(w,h)<8 or w*h>8_000_000 or kind not in ('PNG','JPEG','WEBP','GIF'):
            raise ValueError('지원하지 않는 이미지 형식·해상도')
    digest=hashlib.sha256(data).hexdigest()
    extension={'PNG':'png','JPEG':'jpg','WEBP':'webp','GIF':'gif'}[kind]
    return {'width':w,'height':h,'image_format':kind,'image_sha256':digest,
            'relative_path':'evidence/images/'+digest+'.'+extension}


class OCRSession:
    def __init__(self):
        self.process = None
        self.stderr_task = None
        self._elapsed = 0.
        self._since = None

    @property
    def elapsed_seconds(self):
        return self._elapsed + (time.monotonic() - self._since if self._since is not None else 0.)

    async def recognize(self, data):
        self._since = time.monotonic()
        try:
            return await self._recognize(data)
        finally:
            self._elapsed += time.monotonic() - self._since
            self._since = None

    async def _recognize(self, data):
        first = self.process is None
        if first:
            args = [sys.executable, '--ocr-worker'] if getattr(sys, 'frozen', False) else [sys.executable, '-m', 'chickadee.ocr_worker']
            self.process = await asyncio.create_subprocess_exec(*args, stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, limit=600_000,
                cwd=str(Path(__file__).resolve().parents[1]), env={**os.environ, 'PYTHONIOENCODING': 'utf-8'},
                **({'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}))
            async def drain():
                while await self.process.stderr.read(4096): pass
            self.stderr_task = asyncio.create_task(drain())
        try:
            self.process.stdin.write((json.dumps({'image': base64.b64encode(data).decode('ascii')}) + '\n').encode())
            await self.process.stdin.drain()
            line = await asyncio.wait_for(self.process.stdout.readline(), timeout=60)
            if not line:
                raise ValueError('PaddleOCR 작업 프로세스가 종료되었습니다.')
            return json.loads(line)
        except asyncio.TimeoutError:
            await self.close()
            raise ValueError('PaddleOCR 처리 시간 초과') from None
        except asyncio.CancelledError:
            # A late reply belongs to the cancelled image. Discard that process
            # before accepting another image so evidence can never be swapped.
            await self.close()
            raise
        except (OSError, ValueError):
            await self.close()
            raise

    async def close(self):
        if self.process:
            if self.process.returncode is None:
                self.process.kill()
            await self.process.wait()
            if self.stderr_task:
                await self.stderr_task
            self.process = None
