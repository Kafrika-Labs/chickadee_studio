"""Create a separate text-only sharing copy. Private evidence is never modified."""
import re

PIXEL_KEYS = {'screenshots', 'preview_data_url', 'data_url', 'screenshot', 'pixels'}
SECRET_KEYS = {'api_key', 'token', 'authorization', 'cookie', 'set-cookie', 'password', 'cookies'}


def shared_copy(value, secrets=()):
    if isinstance(value, dict):
        return {key: shared_copy(item, secrets) for key, item in value.items()
                if key.lower() not in PIXEL_KEYS | SECRET_KEYS}
    if isinstance(value, list):
        return [shared_copy(item, secrets) for item in value]
    if not isinstance(value, str): return value
    for secret in sorted((s for s in secrets if isinstance(s, str) and s), key=len, reverse=True):
        value = value.replace(secret, '[비공개]')
    value = re.sub(r'data:image/[^\s"<>]+', '[이미지 제외]', value, flags=re.I)
    value = re.sub(r'(?i)([?&](?:token|api[_-]?key|secret|password|session|auth|code|email|phone)=)[^&#\s]*', r'\1[비공개]', value)
    value = re.sub(r'(?i)\b(?:gsk_|sk-)[a-z0-9_-]{16,}\b', '[비공개 키]', value)
    value = re.sub(r'[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}', '[이메일]', value)
    value = re.sub(r'(?<!\d)(?:\+82[- .]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)', '[전화번호]', value)
    value = re.sub(r'(?<!\d)\d{6}[- ]?[1-8]\d{6}(?!\d)', '[주민번호]', value)
    return value
