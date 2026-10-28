"""Stable image failure codes, separate from recognition outcomes."""
from collections import Counter

IMAGE_REASONS = {
    'origin_denied': '이미지 출처 제한', 'network_denied': '내부망 연결 차단',
    'auth_required': '이미지 접근 권한', 'rate_limited': '사이트 요청 제한',
    'unsupported_format': '지원하지 않는 형식', 'size_limit': '이미지 크기 제한',
    'network_timeout': '이미지 수집 시간 초과', 'network_error': '이미지 연결 오류',
    'decode_error': '이미지 해석 오류', 'ocr_timeout': '문자 인식 시간 초과',
    'model_unavailable': 'OCR 모델 준비 오류', 'recognition_error': '문자 인식 오류',
    'no_text': '문자 영역 없음', 'low_confidence': '문자 신뢰도 부족',
}


def image_failure(error, stage):
    from .network_boundary import NetworkDenied
    text = str(error).lower()
    status = getattr(error, 'code', None)
    if isinstance(error, NetworkDenied): return 'network_denied'
    if 'origin' in text: return 'origin_denied'
    if status in (401, 403): return 'auth_required'
    if status == 429: return 'rate_limited'
    if any(word in text for word in ('시간', 'timeout', 'timed out')):
        return 'ocr_timeout' if stage == 'recognize' else 'network_timeout'
    if '크기' in text or 'too large' in text: return 'size_limit'
    if any(word in text for word in ('형식', 'png/jpeg', '지원하지')): return 'unsupported_format'
    if stage == 'fetch': return 'network_error'
    if stage == 'decode': return 'decode_error'
    if any(word in text for word in ('모델', 'model', 'install', 'module')): return 'model_unavailable'
    return 'recognition_error'


def image_reasons(images):
    counts = Counter(image.get('reason_code') for image in images if image.get('reason_code'))
    return [{'code': code, 'label': IMAGE_REASONS.get(code, code), 'count': count}
            for code, count in sorted(counts.items())]
