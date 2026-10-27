# Contributing to Chickadee Studio

[한국어](CONTRIBUTING.ko.md) | [English](CONTRIBUTING.md)

버그 수정, 탐지 규칙, UI, 문서와 번역 개선을 환영합니다. 개발 환경 설치는 [개발 안내](docs/project-guide.ko.md#8-개발-환경)를 참고하세요.

## 이슈와 PR

1. 기존 [이슈](https://github.com/Kafrika-Labs/chickadee_studio/issues)를 확인합니다. 큰 변경은 먼저 문제와 제안하는 동작을 설명해 주세요.
2. 브랜치에서 한 가지 목적의 변경을 만듭니다. 기존 사용자 데이터·설정·결과 형식과의 호환성을 확인합니다.
3. 관련 검증을 실행하고, PR에 변경 이유·검증 결과·UI 변경 시 화면을 첨부합니다.

오류 제보에는 앱 버전, OS·CPU 아키텍처, 재현 단계, 기대 결과와 실제 결과를 포함해 주세요. API 키·로그인 쿠키·웹훅 주소·개인정보가 포함된 로그와 스크린샷은 게시하지 마세요. 가능하면 공개 가능한 작은 로컬 재현 페이지를 첨부해 주세요.

## 검증

macOS에서 저장소 루트 기준:

```sh
.venv/bin/python -m unittest discover -s tests -v
npm --prefix desktop test
npm --prefix desktop run build
npm --prefix desktop run smoke
```

Windows에서는 Python 경로를 `.venv\Scripts\python.exe`로 바꿉니다. UI 동작 검증은 실제 Electron과 로컬 사이트를 실행하므로 GUI 실행 환경이 필요합니다. 변경과 관련된 검증부터 실행하고, 어떤 테스트를 실행했는지 PR에 적어 주세요.

## 문서 화면 갱신

```sh
npm --prefix desktop run build
node desktop/tests/capture-docs.cjs
```

실제 Electron 앱과 내장 데모를 사용합니다. 개인 사용자 설정 대신 시스템 임시 폴더의 `chickadee-docs-*`에 별도 데이터를 만들고 외부 AI 호출·웹훅 알림을 전송하지 않습니다.

- `desktop/assets/guide/`: README·상세 문서·앱 사용 가이드가 공유하는 10개 화면
- `docs/assets/screenshots/`: 전체 흐름, HTTP 기록 등 README의 추가 화면
- 출력 크기: 기본 1440 × 900 CSS 픽셀, 알림 설정은 1440 × 1300, 단축키는 1440 × 1100 픽셀. 생성 후 직접 열어 잘림·겹침·불필요한 알림이 없는지 확인하세요.
- 이미지는 실제 화면 그대로 사용합니다. 검토 결과나 탐지 건수를 편집해 만들지 마세요.
- 이미지 교체 후 다시 빌드하면 앱 내부 가이드에도 반영됩니다.

한국어 문서를 수정할 때는 해당 `.en.md` 문서의 내용·링크·명령·이미지도 맞춰 주세요. 새 안내 문서에는 영어 버전과 언어 전환 링크를 함께 추가합니다. 다운로드 링크는 `/releases/latest`를 사용해 오래된 버전으로 고정되지 않도록 합니다.

## 코드와 배포

검사 엔진은 `chickadee/`, Electron 메인 프로세스는 `desktop/electron/`, React UI는 `desktop/src/`에 있습니다. 외부 페이지는 앱 UI와 분리하고, 수집 범위·요청 한도·인증 정보 보호를 유지해 주세요.

릴리스 버전은 `desktop/package.json`, `desktop/package-lock.json`, `chickadee/__init__.py`와 패키지 출력 경로가 일치해야 합니다. `docs/releases/<버전>.md`를 작성하고 `python scripts/release.py version`으로 확인합니다. main 푸시는 릴리스 워크플로를 실행하므로 문서 수정만으로 버전을 올리지 마세요.

기여한 코드는 저장소의 [Apache-2.0 라이선스](LICENSE)를 따릅니다. 추가한 라이브러리·모델·아이콘의 출처와 라이선스를 함께 확인해 주세요.
