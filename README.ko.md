[![Release](https://img.shields.io/github/v/release/Kafrika-Labs/chickadee_studio?style=flat)](https://github.com/Kafrika-Labs/chickadee_studio/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/Kafrika-Labs/chickadee_studio/release.yml?branch=main&label=build&style=flat)](https://github.com/Kafrika-Labs/chickadee_studio/actions/workflows/release.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.ko.md)

<img src="desktop/assets/app-mark.png" width="96" alt="Chickadee Studio 로고" />

# Chickadee Studio

[![한국어](https://img.shields.io/badge/language-한국어-blue.svg)](README.ko.md)
[![English](https://img.shields.io/badge/language-English-orange.svg)](README.md)

## 웹사이트의 광고 문맥과 문자 위장·은닉을 분석하는 오픈소스 도구

Chickadee Studio는 공공 웹사이트의 게시글, 댓글과 이미지에서 광고 의심 문구를 찾아 검토하는 데스크톱 앱입니다. 원문과 촬영 화면, 문자 위치를 함께 보여주어 탐지 근거를 확인할 수 있습니다.

- **검사 대상**: 웹페이지 본문, 게시글, 댓글, iframe과 이미지 속 문구
- **문자 위장·은닉 탐지**: 닮은꼴 문자, 한글 자모 분해, 투명 문자와 화면 밖 은닉
- **이미지 문자 추출**: PaddleOCR로 한국어 문구와 글자 위치 확인
- **문맥 분석**: RF와 Laya 모델을 로컬 CPU에서 실행하고, 필요할 때 Groq 추가 검토
- **결과 검토**: 원문·스크린샷 확인, 검토 상태와 메모 저장, JSON·CSV·보고서 출력

모델 점수는 검토 우선순위를 정하는 데 사용합니다. 원문과 탐지 근거를 함께 확인하세요.

## 한눈에 보기

[![웹사이트 검사, OCR과 문맥 분석 시연](docs/assets/demos/overview.webp)](docs/assets/demos/service.webm)

[전체 시연 영상](docs/assets/demos/service.webm) · [기능별 화면](docs/features.ko.md)

## 다운로드

- [Windows x64 최신 릴리즈](https://github.com/Kafrika-Labs/chickadee_studio/releases/latest)
- [릴리즈 노트](docs/README.ko.md#릴리스-노트)

실행본에는 Python 검사 엔진, Chromium, OCR·RF·Laya 모델과 CPU 실행 환경이 포함됩니다. 별도 Python 설치나 GPU 없이 사용할 수 있습니다. Groq는 사용자가 API 키를 등록하고 검토를 시작할 때 사용합니다.

## 빠른 시작

1. 최신 릴리즈에서 Windows ZIP을 내려받고 **전체 압축을 해제**합니다.
2. `resources` 폴더를 그대로 두고 **Chickadee.exe**를 실행합니다.
3. **검사 대상**에 URL을 입력하고 **검사 실행**을 누릅니다.
4. 탐지 내역에서 원문과 화면을 확인하고 검토 결과를 저장합니다.

앱 제어 정책으로 실행이 차단되면 같은 폴더의 `ChickadeeRuntime.exe`를 사용하세요. 공식 Electron 원본 실행 파일로 같은 앱을 실행합니다. 인터넷 없이 둘러보려면 검사 실행 옆 메뉴에서 **데모 검사**를 선택합니다.

[설치 및 실행 안내](docs/quickstart-windows.ko.md) · [앱 사용 가이드](docs/desktop.ko.md)

## 문서

- [문서 홈](docs/README.ko.md)
- [기능 안내와 시연](docs/features.ko.md)
- [프로젝트 상세 안내 — 처리 단계, 데이터와 모델 평가](docs/project-guide.ko.md)
- [Groq 설정과 추가 검토](docs/inspection-agent.ko.md)
- [예약 검사](docs/scheduled-inspections.ko.md) · [알림 설정](docs/notifications.ko.md)
- [결과 파일 규격](docs/result-format.ko.md)
- [테스트 및 배포 검증](docs/validation.ko.md)

## 구성 요소

| 구성 | 역할 | 구현 |
| --- | --- | --- |
| 데스크톱 앱 | 검사 구성, 진행 상황과 결과 검토 | Electron, React, React Flow |
| 수집 엔진 | 페이지·댓글·이미지 수집과 방문 경로 기록 | Python, Playwright, Chromium |
| 위장·은닉 분석 | 문자 변형과 화면에 숨겨진 요소 확인 | Unicode, DOM, CSS와 좌표 |
| OCR | 이미지 속 한국어 문구와 위치 추출 | PaddleOCR |
| 로컬 문맥 분석 | 본문과 OCR 문구의 광고 문맥 분류 | TF-IDF, Random Forest, Laya |
| 선택 AI 검토 | 수집 자료 조회와 같은 사이트 추가 확인 | Groq |

[구현 구조](docs/architecture.ko.md) · [이미지·텍스트 직접 분석](docs/content-analysis.ko.md)

## 개발 및 기여

버그 수정, 탐지 규칙, 화면 개선, 문서와 번역 기여를 환영합니다.

- [개발 환경 설치](docs/project-guide.ko.md#8-개발-환경) — Python 3.12, Node.js 24
- [기여 안내](CONTRIBUTING.ko.md) — 개발 절차와 검증 방법
- [버그 제보 및 기능 제안](https://github.com/Kafrika-Labs/chickadee_studio/issues)
- [연구 자료](research/README.ko.md)

## 라이선스

[Apache License 2.0](LICENSE). 외부 라이브러리, 글꼴과 모델의 출처·이용 조건은 [외부 구성요소 안내](docs/third-party-notices.ko.md)를 참고하세요.
