# 구현 구조

[한국어](architecture.ko.md) | [English](architecture.md)

Chickadee Studio는 Electron 화면과 Python 검사 엔진으로 구성됩니다. Chromium으로 수집한 DOM·CSS·이미지를 분석하고, 원문과 근거를 JSON·CSV 및 검사 기록에 저장합니다.

![Chickadee Studio 전체 설계](assets/architecture.png)

전체 설계 개요이며 현재 배포본은 이미지에만 OCR을 적용합니다. 본문 텍스트는 바로 규칙과 ML로 전달합니다. Windows 실행본에는 한국어 Laya 모델과 독립 CPU 실행 환경도 포함됩니다. 결과는 실행별 로컬 파일로 저장하고 Groq는 사용자가 검토를 시작할 때 호출합니다.

| 구성 | 위치 | 역할 |
| --- | --- | --- |
| 화면·앱 셸 | `desktop/src`, `desktop/electron` | 검사 구성, 근거 확인, 기록·검토·로그인 창 |
| 브리지·실행 제어 | `chickadee/bridge.py`, `control.py` | JSONL 통신, 시작·중단·일시정지, 실행별 저장 |
| 탐색·수집 | `scanner.py`, `extract.js`, `profiles.py` | 같은 사이트의 페이지·게시글·댓글·iframe 탐색, 원문·CSS·위치 수집 |
| 로그인 | `authentication.py`, `desktop/electron/login.cjs` | 별도 로그인 창과 현재 검사 세션의 쿠키 전달 |
| 필수 탐지 | `detection.py`, `rules.json` | 닮은꼴 문자·자모 분해·투명 텍스트·화면 밖 은닉 |
| 이미지 문자 추출 | `image_ocr.py`, `ocr_worker.py` | 이미지에 한해 PaddleOCR 한국어 CPU 추론 |
| 로컬 AI | `local_ai.py`, `chickadee/data` | 문자 문맥과 이미지 특징의 검토 신호 |
| 로컬 문맥 검토 | `laya_review.py`, `laya_worker.py` | 동봉한 Laya 학습 모델의 CPU 추론, 처리 상태와 오류 보존 |
| 선택 AI 검토 | `agent.py`, `exploration.py` | Groq의 근거 조회와 제한된 같은 사이트 추가 탐색 |
| 결과·검토 | `exports.py`, `reviews.py`, `inspection.py` | 결과 저장, 근거·화면 보존, 검토 상태·메모 |

텍스트는 직접 분석하고, 이미지는 OCR로 추출한 문구와 이미지 자체를 구분해 분석합니다. 근거에는 원문·URL·요소 위치·OCR 좌표를 보존합니다. OCR 문구는 원래 이미지의 유니코드 코드포인트를 입증하는 근거로 사용하지 않습니다.

화면과 엔진은 표준 입출력으로 통신합니다. 수집한 사이트의 HTML을 앱 화면에서 실행하지 않고, 결과 확인에는 저장한 텍스트와 이미지 자료를 사용합니다. 기본 검사는 외부 AI 키나 GPU 없이 실행됩니다. Groq 검토는 사용자가 키를 등록하고 시작할 때 실행하며 기존 탐지 결과와 사람의 검토를 덮어쓰지 않습니다.

- [앱 사용법](desktop.ko.md)
- [출력 형식](result-format.ko.md)
- [AI 검토·사용량](inspection-agent.ko.md)
- [로컬 도구 계약](agent-extension.ko.md)
