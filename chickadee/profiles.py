"""Explicit, bounded site-specific read controls; no arbitrary Python/JS config."""
from dataclasses import dataclass
import json
from pathlib import Path


@dataclass(frozen=True)
class SiteProfile:
    name: str = "기본 공개 페이지 탐색"
    path_prefix: str = "/"
    controls: tuple[str, ...] = ()
    max_actions: int = 5
    scroll_steps: int = 4
    allowed_resource_origins: tuple[str, ...] = ()
    content_selector: str | None = None
    private_addresses: tuple[str, ...] = ()

    @classmethod
    def load(cls, path: Path | None):
        if path is None:
            return cls()
        if Path(path).stat().st_size > 100_000:
            raise ValueError("사이트 설정 파일은 100KB 이하여야 합니다.")
        data = json.loads(Path(path).read_text(encoding="utf-8-sig"))
        allowed = {"name", "path_prefix", "controls", "max_actions", "scroll_steps", "allowed_resource_origins", "content_selector", "private_addresses"}
        if not isinstance(data, dict) or set(data) - allowed:
            raise ValueError("사이트 설정에 알 수 없는 필드가 있습니다.")
        controls = data.get("controls", [])
        if not isinstance(controls, list) or len(controls) > 20 or not all(isinstance(x, str) and 0 < len(x) < 500 for x in controls):
            raise ValueError("controls는 CSS 선택자 문자열 배열(최대 20개)이어야 합니다.")
        origins = data.get("allowed_resource_origins", [])
        private = data.get('private_addresses', [])
        from .network_boundary import AddressPolicy
        AddressPolicy('https://validation.invalid', private)
        from urllib.parse import urlsplit
        if not isinstance(origins, list) or len(origins) > 30:
            raise ValueError("allowed_resource_origins는 최대 30개 origin 배열이어야 합니다.")
        for value in origins:
            if not isinstance(value, str):
                raise ValueError("리소스 origin은 문자열이어야 합니다.")
            parts = urlsplit(value)
            if parts.scheme not in ("http", "https") or not parts.hostname or parts.path not in ("", "/") or parts.query or parts.fragment or parts.username or parts.password:
                raise ValueError("리소스 origin에는 http(s)://호스트:포트 형식만 허용합니다.")
            _ = parts.port
        profile = cls(**{**data, "controls": tuple(controls), "allowed_resource_origins": tuple(origins), 'private_addresses':tuple(private)})
        if not isinstance(profile.name, str) or not isinstance(profile.path_prefix, str) or not profile.path_prefix.startswith("/"):
            raise ValueError("name은 문자열, path_prefix는 /로 시작하는 경로여야 합니다.")
        if profile.content_selector is not None and (not isinstance(profile.content_selector, str) or not 0 < len(profile.content_selector) < 500):
            raise ValueError("content_selector는 500자 미만 CSS 선택자 또는 null이어야 합니다.")
        if type(profile.max_actions) is not int or not 0 <= profile.max_actions <= 30:
            raise ValueError("max_actions는 0~30 정수여야 합니다.")
        if type(profile.scroll_steps) is not int or not 0 <= profile.scroll_steps <= 20:
            raise ValueError("scroll_steps는 0~20 정수여야 합니다.")
        return profile
