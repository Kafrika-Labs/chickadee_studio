# 프로젝트 상세 안내

[한국어](project-guide.ko.md) | [English](project-guide.md)

[프로젝트 소개](../README.ko.md) | [전체 문서](README.ko.md)

## 목차

1. [빠른 시작](#1-빠른-시작)
2. [서비스 단계](#2-서비스-단계)
3. [운영 설정](#3-운영-설정)
4. [출력 파일](#4-출력-파일)
5. [데이터 구성](#5-데이터-구성)
6. [학습 및 평가](#6-학습-및-평가)
7. [구현 구조](#7-구현-구조)
8. [개발 환경](#8-개발-환경)
9. [문서 및 기여](#9-문서-및-기여)
10. [라이선스](#10-라이선스)

## 1. 빠른 시작

1. [최신 릴리스](https://github.com/Kafrika-Labs/chickadee_studio/releases/latest)의 Windows x64 ZIP을 내려받습니다.
2. 전체 압축을 해제하고 **Chickadee.exe**를 실행합니다. 동봉된 `resources` 폴더를 함께 유지합니다.
3. **검사 대상**에 URL을 입력하고 **검사 실행**을 누릅니다.
4. 결과에서 원문과 촬영 화면을 확인하고, JSON과 보고서를 저장합니다.

실행본에는 Python 검사 엔진, Chromium, 한국어 OCR·RF·Laya 학습 모델과 CPU 실행 환경이 모두 포함됩니다. 별도 모델 설치나 GPU 없이 OCR → ML → Laya로 분석합니다. Groq는 사용자가 API 키를 등록하고 검토를 시작할 때 사용합니다. 배포 ZIP은 Windows x64 전용입니다.

Windows 앱 제어 정책으로 `Chickadee.exe`가 차단되면 같은 폴더의 `ChickadeeRuntime.exe`를 실행하세요. 공식 Electron 원본 파일로 같은 앱과 모델을 실행합니다. 보안 설정을 변경하지 않으며 앱 창의 치카비 아이콘은 유지됩니다. 이전 버전이 열려 있으면 먼저 종료하세요.

<details>
<summary><strong>오프라인 데모</strong></summary>

검사 실행 옆 펼침 메뉴에서 **데모 검사**를 선택합니다. 인터넷 없이 위장 및 은닉 기법의 탐지 과정을 확인할 수 있습니다.

![내장 데모의 검사 흐름](assets/demos/21-demo-pipeline.png)

</details>

## 2. 서비스 단계

| 단계 | 기능 | 확인 내용 |
| ---: | --- | --- |
| 1 | 검사 대상 입력 | URL, 페이지 수와 검사 시간 |
| 2 | 게시글 및 댓글 탐색 | 하위 페이지, 지연 로딩 댓글, iframe과 방문 경로 |
| 3 | 문자 위장 및 은닉 탐지 | 닮은꼴 문자, 자모 분해, 투명 문자와 화면 밖 은닉 |
| 4 | 이미지 문자 추출 | 이미지가 있을 때만 OCR 실행, 문구와 글자 위치 확인 |
| 5 | ML과 Laya 문맥 분석 | 본문과 OCR 문구의 광고 문맥 점수 |
| 6 | Groq 추가 검토 | 원문 조회와 같은 사이트의 추가 확인, 검토 의견 |
| 7 | 결과 검토 및 출력 | 원문, 스크린샷, 메모와 JSON 및 보고서 |

### 01. 검사 대상 입력

URL 하나를 입력하고 페이지 수, 검사 시간과 저장 위치를 설정합니다. 실행 환경에 맞는 처리 모드를 선택하고, 검사 중에는 일시정지, 재개와 중단을 사용할 수 있습니다.

![1단계 검사 대상 URL 입력](assets/demos/stage-01-target.webp)

<details>
<summary><strong>검사 구성 전체 화면</strong></summary>

![검사 구성](assets/demos/01-pipeline.png)

</details>

### 02. 게시글 및 댓글 탐색

같은 사이트의 하위 페이지, 게시글, 댓글과 iframe을 탐색합니다. 지연 로딩 댓글과 설정에 등록한 **댓글 더보기**도 처리합니다. 사이트마다 댓글 구조가 달라 탐색 설정이 필요한 경우가 있습니다. 로그인이 필요하면 별도 창에서 인증합니다. **로그인 완료 후 로그인 창을 닫고 앱에서 검사 재개를 누릅니다.**

시험 사이트: `http://113.198.66.73:18244/`

| 시험 계정 | 값 |
| --- | --- |
| 아이디 | `tester` |
| 비밀번호 | `Test1234!` |

위 계정은 시험 사이트의 공개 테스트 계정입니다. 프로그램 실행이나 Groq 설정에 사용하는 계정은 아닙니다.

1. **로그인 창**에서 위 계정으로 로그인
2. 로그인 완료 후 **로그인 창 닫기**
3. 앱으로 돌아와 **검사 재개** 선택

![시험 사이트 로그인 후 검사 재개](assets/screenshots/login-resume.png)

![2단계 탐색 그래프 확대와 이동](assets/demos/stage-02-exploration.webp)

<details>
<summary><strong>방문 경로와 진행 기록</strong></summary>

방문한 페이지와 대기 URL을 구분합니다.

![페이지별 탐색 경로](assets/demos/11-navigation.png)

수집 상태를 그래프로 확인합니다.

![탐색 그래프 상세](assets/demos/09-exploration.png)

100페이지 검사에서 관측한 371개 노드의 전체 경로입니다. START와 END는 화면 안내용 표시입니다.

![탐색 그래프 전체 보기](assets/demos/20-full-graph-overview.png)

페이지 수집과 분석 과정을 순서대로 확인합니다.

![진행 기록](assets/demos/10-events.png)

</details>

### 03. 문자 위장 및 은닉 탐지

원문, DOM, 계산된 CSS와 좌표를 함께 분석해 광고 문구가 변형되거나 숨겨진 방식을 확인합니다.

| 유형 | 결과 코드 | 분석 항목 |
| --- | --- | --- |
| 닮은꼴 문자 | `HOMOGLYPH` | 키릴 문자, 전각 문자와 유사 문자를 섞은 표기 |
| 자모 분해 | `JAMO` | 분리된 한글 자모와 태그 사이로 나뉜 문구 |
| 투명 문자 | `TRANSPARENT` | 글자색, 요소와 상위 요소의 투명도, 배경색 |
| 화면 밖 은닉 | `OFFSCREEN` | 음수 좌표, 극소 글자, 잘린 영역과 숨겨진 요소 |

![3단계 위장 및 은닉 기법별 탐지 내역](assets/demos/stage-03-detection.webp)

<details>
<summary><strong>기법별 결과와 원문</strong></summary>

한국어 게시글과 댓글을 포함한 로컬 검증 페이지의 결과입니다.

![네 가지 탐지 기법](assets/demos/22-four-techniques.png)

원문, URL과 요소 위치를 확인합니다.

![원문과 요소 위치](assets/demos/06-evidence.png)

관찰 시점의 촬영 화면을 확대합니다. 투명하거나 화면 밖에 있는 글자는 원문과 CSS도 함께 확인합니다.

![촬영 화면 확대](assets/demos/07-evidence-zoom.png)

</details>

### 04. 이미지 문자 추출

**이미지가 있을 때만 PaddleOCR를 실행**합니다. 추출한 문구, 인식 신뢰도와 글자 좌표를 원본 이미지에 연결하고, 줄을 선택하면 해당 영역을 강조합니다. 이미지가 없으면 본문을 다음 분석 단계로 바로 전달합니다.

OCR은 이미지에서 문자를 읽는 단계입니다. 처리 이미지 수와 문자 추출 상태를 표시하며, 추출 문구를 탐지 근거로 사용한 항목에만 **OCR 배지**를 붙입니다. 탐지 내역은 최신순이 기본이며 오래된순으로 바꿀 수 있습니다.

![한국어 이미지 검증: OCR 배지와 문자 위치, 최신순 정렬](assets/screenshots/ocr-source-badge.png)

![4단계 한국어 문구와 글자 위치 확인](assets/demos/stage-04-ocr.webp)

<details>
<summary><strong>한국어 인식 결과와 처리 통계</strong></summary>

한국어 검증 이미지에서 읽은 문구와 글자 영역입니다.

![한국어 이미지 OCR](assets/demos/23-ocr-boxes.png)

줄을 선택하면 해당 위치가 강조됩니다.

![OCR 줄 선택](assets/demos/24-ocr-line.png)

문자 인식, 판독 실패, 오류와 생략을 구분합니다.

![OCR 처리 통계](assets/demos/25-ocr-statistics.png)

</details>

웹페이지 검사 외에 이미지와 텍스트를 직접 분석하는 로컬 백엔드 도구 `content.analyze`도 제공합니다. [직접 분석 형식](content-analysis.ko.md)

### 05. ML과 Laya 문맥 분석

본문과 OCR 문구를 **RF → Laya** 순서로 분석합니다. RF는 문자 특징으로 광고 문맥을 분류합니다. 한국어 자료로 학습한 Laya는 수집 문구 전체를 순차 분석합니다. 웹 수집과 로컬 분석의 제한시간을 분리해 수집 종료 후에도 최대 30분 동안 분석을 이어갑니다. 두 모델은 PC의 CPU에서 실행하며 API 비용이 발생하지 않습니다. 모델 점수는 검토 우선순위에 사용하고 원문과 유형별 탐지 근거를 함께 제공합니다.

![5단계 ML과 Laya 분석 내역 및 점수 분포](assets/demos/stage-05-analysis.webp)

<details>
<summary><strong>처리 건수와 점수 분포</strong></summary>

아래 화면은 한국어 시험 페이지에서 저장한 처리 건수와 모델 점수입니다. 표시된 건수는 해당 실행의 결과이며 처리 개수의 상한이 아닙니다.

![ML과 Laya 및 OCR 처리 통계](assets/demos/02-statistics.png)

</details>

수집된 모든 텍스트 항목을 순차 분석합니다. 같은 문구는 분석 결과를 재사용합니다. 모델은 한 번만 불러오고 완료 수와 전체 수를 표시합니다. **검사당 12개 제한은 없습니다.** 사용자 중단이나 검사 제한시간으로 미처리된 항목은 별도로 기록합니다. 원래 탐지 결과와 사용자의 검토 상태는 유지합니다. [동봉 모델과 개발 환경](content-analysis.ko.md#로컬-laya-연결)

사진 분류 모델은 성인물과 도박 및 마약 관련 시각적 특징을 분석합니다. 사진 점수만 있는 항목은 **이미지 검토**로 구분합니다. 이미지에서 읽은 문구로 광고 문맥을 확인한 항목과 분리해서 표시합니다.

### 06. Groq 추가 검토

사용자가 검토를 시작하면 Groq가 저장된 원문과 분석 정보를 조회합니다. 필요한 내용이 부족하면 같은 사이트에서 이미 발견한 링크를 제한적으로 추가 확인하고, 검토 의견과 미확인 항목을 정리합니다.

![6단계 저장된 원문에 대한 Groq 검토 의견](assets/demos/stage-06-groq.webp)

다음 화면은 별도의 웹사이트 검사에서 저장한 Groq 검토 의견입니다. 5회 요청과 6,165토큰을 사용했으며, 검토 2개와 미검토 3개를 구분했습니다. 시연 재촬영에는 추가 API 호출이 없습니다.

<details>
<summary><strong>검토 의견, API 키와 사용량</strong></summary>

원문을 조회한 뒤 작성한 검토 의견입니다.

![Groq 검토 의견](assets/demos/03-groq-report.png)

사용자가 **설정 → AI 연결 → API 키 등록**에서 본인의 Groq 키를 입력합니다. 입력값은 화면에 가려집니다. 등록한 키는 현재 실행 세션의 메모리에서만 사용하며 앱이 파일에 저장하지 않습니다. 결과 파일과 보고서에도 포함하지 않습니다. Groq 요청은 HTTPS로 전송합니다.

이 방식은 키의 **암호화 저장이 아닌 미저장 방식**입니다. 외부 `.env` 파일을 선택해서 사용할 수도 있습니다. `.env` 자체는 평문 파일이며 앱이 암호화하지 않습니다.

외부 설정 파일은 아래 형식으로 작성합니다. 실제 키가 들어간 `.env`는 공개 저장소와 소스코드 ZIP에 포함하지 않습니다.

```dotenv
GROQ_API_KEY=YOUR_GROQ_API_KEY
```

```powershell
.\ChickadeeRuntime.exe --groq-env-file 'C:\Chickadee\.env'
```

외부 파일 대신 직접 등록하려면 `.env`를 메모장으로 열고 `GROQ_API_KEY=` 뒤의 값만 복사한 뒤 **앱 대시보드의 설정 → AI 연결 → API 키 등록**에 직접 입력합니다. **파일을 실행본 옆에 두기만 해서는 자동 적용되지 않습니다.** 위 명령으로 사용할 외부 키 파일을 명시적으로 선택할 수 있습니다. 키를 등록하는 것만으로 API 요청이 발생하지 않습니다.

![Groq 키 설정](assets/demos/14-settings-groq.png)

기본 모델은 `openai/gpt-oss-20b`이며 검사당 누적 6회와 24,000토큰을 제한합니다.

![Groq 누적 사용량](assets/demos/04-budget.png)

</details>

### 07. 결과 검토 및 출력

탐지 내역에서 원문과 촬영 화면을 확인하고 검토 상태와 메모를 저장합니다. JSON과 CSV로 결과를 내보내고, 화면 이미지가 포함된 HTML 보고서를 생성합니다. 저장한 기록은 사이트를 다시 방문하지 않고 열 수 있습니다.

![7단계 보고서 저장과 탐지 항목 확인](assets/demos/stage-07-report.webp)

<details>
<summary><strong>미리보기와 검토 상태 관리</strong></summary>

검사 중인 페이지의 촬영 화면을 확인합니다.

![페이지 미리보기](assets/demos/27-preview.png)

촬영 화면과 URL을 확대합니다.

![미리보기 확대](assets/demos/28-preview-zoom.png)

항목별 상태와 메모를 저장합니다.

![검토 메모 저장](assets/demos/29-review-saved.png)

선택한 항목을 일괄 처리합니다.

![검토 항목 선택](assets/demos/30-bulk-selection.png)

이전 검사 결과를 다시 엽니다.

![검사 기록](assets/demos/12-history.png)

저장한 상태와 메모를 복원합니다.

![검토 상태 복원](assets/demos/32-review-reload.png)

</details>

## 3. 운영 설정

실행 환경, 저장 위치, 알림과 예약 검사를 설정합니다. 예약은 앱이 실행 중일 때 동작하며, 외부 알림 채널은 사용자가 연결합니다. 단축키와 빠른 명령으로 반복 작업을 줄일 수 있습니다.

<details>
<summary><strong>실행 환경과 검사 설정</strong></summary>

![실행 환경과 검사 범위](assets/demos/13-settings-general.png)

</details>

<details>
<summary><strong>알림과 예약 검사</strong></summary>

![알림 설정](assets/demos/15-settings-notifications.png)

![예약 검사 설정](assets/demos/16-settings-schedule.png)

</details>

<details>
<summary><strong>단축키와 업데이트</strong></summary>

![단축키 설정](assets/demos/17-shortcuts.png)

![업데이트 확인](assets/demos/18-updates.png)

Ctrl K에서 화면 이동과 결과 관련 명령을 검색합니다.

![빠른 명령](assets/demos/19-command-palette.png)

</details>

## 4. 출력 파일

기본 저장 위치는 `문서/Chickadee/results/<실행별 폴더>/`입니다. 저장 위치를 바꾸면 해당 경로 아래에 실행별 폴더를 생성합니다. 앱의 **결과 폴더**에서 실제 위치를 확인할 수 있습니다.

| 파일 | 저장 내용 |
| --- | --- |
| `result.json` | 문자 위장과 은닉 4종의 탐지 결과. `meta`와 `findings` 구조 |
| `result_extra.json` | 추가 광고 문맥. `ETC`와 `extra_finding`으로 유형 구분 |
| `result.csv` | 위장 및 은닉 탐지와 추가 광고 문맥을 고정 17개 칼럼으로 출력 |
| `scan-report.json` | 실행 상태, 수집 범위, 오류, DOM과 CSS, OCR과 로컬 분석 |
| `review.json` | 사용자 검토 상태와 메모 |
| `agent.json` | Groq 검토 의견, 추가 탐색 내역과 누적 사용량 |
| `events.jsonl` | 검사 진행 이벤트 |
| `review-report.html` | 스크린샷을 포함한 독립 실행형 보고서 |
| `review-report.md` | 보고서의 Markdown 원본 |
| `evidence/` | 관찰 당시 촬영한 화면 이미지 |

JSON은 UTF-8, BOM 없이 저장합니다. `result.json`은 모든 페이지의 탐지 항목을 `findings` 배열 하나에 담으며, 0건일 때도 빈 배열을 생성합니다. 검출 단위는 `(url, location, technique)`이고 원문은 정규화 전 상태로 보존합니다. 같은 요소에서 두 기법을 발견하면 별도 항목으로 기록합니다.

<details>
<summary><strong>result.json 예시</strong></summary>

```json
{
  "meta": {
    "topic": "TOPIC",
    "entry_url": "https://example.org/board",
    "started_at": "2026-10-23T10:00:00+09:00",
    "finished_at": "2026-10-23T10:00:12.500+09:00",
    "elapsed_sec": 12.5
  },
  "findings": [
    {
      "id": "f_00001",
      "url": "https://example.org/board/view?id=1",
      "is_violation": true,
      "location": "article.post > p:nth-of-type(1)",
      "evidence_text": "ｃａｓｉｎｏ 가입 보너스 지급",
      "technique": "HOMOGLYPH"
    }
  ]
}
```

iframe의 위치는 `iframe[src="절대주소"] >>> 내부 선택자`로 기록합니다. `is_violation`은 탐지 결과 형식의 필드이며, 일반 광고 문맥이나 AI 의견만으로 법적 위반을 확정하지 않습니다.

</details>

HTML 보고서는 인터넷 없이 열 수 있으며 브라우저 인쇄에서 PDF로 저장할 수 있습니다. 일부 결과나 중단된 실행에서는 완료 여부와 미검토 수를 함께 확인합니다.

<details>
<summary><strong>보고서 저장 및 CSV 내보내기</strong></summary>

HTML과 Markdown으로 보고서를 보존합니다.

![검사 보고서 저장](assets/demos/05-report-saved.png)

표 형식으로 활용할 결과는 고정 17개 칼럼의 CSV로 내보냅니다.

![결과 CSV 내보내기](assets/demos/31-csv-export.png)

</details>

<details>
<summary><strong>보고서 전체 화면</strong></summary>

![HTML 보고서 전체 화면](assets/demos/26-standalone-report.png)

</details>

[결과 규격 및 CSV 칼럼](result-format.ko.md) | [JSON Schema](../schemas/result.schema.json)

## 5. 데이터 구성

### 5.1 공개 자료

한국어 광고 문맥, 이미지 문자 인식과 이미지 주제 분류를 구분해 자료를 정리했습니다. 공개 자료의 기존 라벨과 실제 광고의 의미를 확인한 뒤 용도에 맞게 사용했습니다.

| 자료 | 용도 | 구분 |
| --- | --- | --- |
| [한국어 YouTube 봇 댓글](https://huggingface.co/datasets/MisileLab/youtube-bot-comments-v2) | 성인 및 도박 홍보성 댓글과 정상 댓글의 문맥 분류 | MIT. 아래 문자 모델 비교에 활용 |
| [한국어 스미싱 메시지](https://huggingface.co/datasets/jmjmjm3/kor-smishing-message) | 사기와 광고 문구 후보 수집 및 중복 정리 | CC BY-NC-SA 4.0. 아래 비교 평가에는 미포함 |
| [Ko-ToxicWebQ](https://github.com/kimjeyoung/Ko-ToxicWebQ) | 한국어 유해 주제와 변형 표현 참고 | 실제 광고 정답과 구분 |
| [Adult content dataset](https://figshare.com/articles/dataset/Adult_content_dataset/13456484) | 선정적 이미지의 주제 분류 실험 | MIT. 문자 인식 및 위법 광고 라벨과 구분 |
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | 공식 한국어 사전 학습 모델과 문자 추출 | 앱의 한국어 OCR에 활용 |
| 관계 기관 공개 사례 | 광고 캡처와 광고 인용문, 정상 보도 문맥 정리 | 광고 영역과 기사 본문을 구분 |

### 5.2 내용 유형 14종

아래 유형을 사례 수집과 검토 기준으로 사용합니다. 문자 위장과 은닉은 4종 기법으로, 광고 내용은 규칙과 ML 및 Laya의 문맥 분석으로 확인합니다. 아래 14종은 수집 자료의 분류 기준이며, 유형별 성능은 확보한 평가 자료의 범위에 맞춰 구분합니다.

| 번호 | 내용 유형 | 정리한 자료와 문맥 |
| ---: | --- | --- |
| 1 | 선정적 또는 음란 광고 | 한국어 홍보 댓글과 이미지 주제 사례 |
| 2 | 도박 광고 | 가입, 보상과 연락을 유도하는 홍보 댓글 |
| 3 | 마약 광고 | 공개 단속 사례의 판매 및 연락 유도 문구 |
| 4 | 불법 금융 광고 | 대출과 투자 권유, 공개 금융 광고 사례 |
| 5 | 사기 광고 | 스미싱 후보와 사칭 및 거래 유도 문구 |
| 6 | 불법 의료 광고 | 관계 기관의 의료 광고 공개 사례 |
| 7 | 불법 의약품 광고 | 의약품 판매 유도와 공개 단속 사례 |
| 8 | 불법 유흥 광고 | 공개 자료의 예약, 가격 및 연락 유도 문구 |
| 9 | 청소년 유해 광고 | 청소년 대상 대리입금 등 공개 사례 |
| 10 | 불법 구인 및 구직 광고 | 취업 사기와 모집 유도 문구 |
| 11 | 개인정보 불법 거래 광고 | 개인정보 DB 거래 광고 캡처 |
| 12 | 불법 상품 거래 광고 | 위조 상품과 위조 신분증 판매 인용문 |
| 13 | 허위 및 과장 광고 | 공정거래위원회와 식약처의 공개 사례 |
| 14 | 불법 디지털 광고 | 디지털 공격 의뢰와 저작권 침해 서비스 사례 |

### 5.3 자료 정리 및 분할

1. **출처 보존**: 원본 URL, 파일 해시, 수집 경로와 기존 라벨의 의미 기록.
2. **입력 구분**: 실제 광고, 보도 속 광고 인용, 정상 보도와 합성 문구 분리.
3. **중복 정리**: 원문 정규화 중복과 유사 문구 확인, 같은 문서와 캠페인 단위 관리.
4. **평가 분리**: 학습, 검증, 보정과 테스트 분할을 고정하고 원문과 분할 해시 보존.
5. **독립 자료 보존**: 새로 확보한 독립 평가 자료를 학습과 임계값 조정에서 제외.
6. **모델 적용 판단**: 비교 결과와 실제 입력에서의 동작을 확인한 뒤 배포 여부 결정.

스미싱 추가 자료는 18,270행에서 정규화 중복 4,058행을 정리하고, 라벨 충돌과 짧은 문구 등의 41개 그룹을 격리했습니다. 남은 14,171개는 수집 후보이며, 스미싱 라벨을 14종 광고 정답으로 바꾸지 않았습니다. 한 문서에서 잘라낸 이미지 영역도 각각의 독립 광고로 세지 않습니다.

원본 학습 자료와 실험 체크포인트는 저장소에 포함하지 않습니다. 앱 실행에 필요한 배포 모델과 고지는 패키지에 포함하며, 각 공개 자료의 이용 조건을 따릅니다.

## 6. 학습 및 평가

### 6.1 한국어 문맥 분류

실제 문구 440건과 합성 문구 49건을 사용해 모델을 비교했습니다. 아래 수치는 정상 댓글과 홍보성 봇 댓글로 구성한 **고정 평가셋 118건**의 결과입니다. 한국어 홍보 댓글을 대상으로 한 지표로, 14종 전체의 판별 성능과 구분합니다.

BERT와 Laya는 본체까지 미세조정했습니다. 두 모델 모두 11에포크에서 조기 종료했으며, 검증 결과에 따라 6에포크 가중치를 선택했습니다. 서비스의 주요 분석 기능은 OCR, RF 기반 ML과 Laya로 구성하고, BERT는 성능 평가의 대조 모델로 사용합니다.

| 모델 | 정확도 | Macro F1 | 홍보 문맥 재현율 | 정상 문맥 오탐률 |
| --- | ---: | ---: | ---: | ---: |
| RF | 86.44% | 0.8619 | 72.88% | 0.00% |
| RF 데이터 보강 | 87.29% | 0.8708 | 74.58% | 0.00% |
| BERT 본체 미세조정 | 88.98% | 0.8892 | 81.36% | 3.39% |
| Laya 본체 미세조정 | 95.76% | 0.9576 | 93.22% | 1.69% |

![한국어 광고 문맥 분류 모델 비교](assets/evaluation/model-comparison.png)

추가로 확보한 5개 출처의 한국어 자료 12건에서도 같은 학습 가중치를 검증했습니다. Laya는 광고 7건 중 4건을 탐지했고 정상 자료 5건에서는 오탐이 없었습니다. 원문만으로 판단하기 어려운 6건은 출처 문맥이 필요한 사례로 구분했습니다. 이 수치는 홍보 문맥 분류 평가의 결과입니다. 현재 앱의 일반 광고 검토 점수와 14종 전체의 분류 정확도로 해석하지 않습니다.

### 6.2 OCR 문자 추출

실제 한국어 이미지 8장의 고정 문자 영역 20곳에서 기존 모델과 한국어 추가 학습 모델을 같은 전처리로 비교했습니다. 정답 문구 287자는 원본 이미지에서 직접 읽어 작성했으며 학습에서 제외했습니다. 후보 선택에는 별도의 합성 검증 자료 2,000건만 사용했습니다.

| 모델 | 문자 오류 | 문자 오류율 CER |
| --- | ---: | ---: |
| 기존 한국어 OCR | 30 / 287자 | 10.45% |
| 한국어 추가 학습 OCR | 10 / 287자 | 3.48% |

![OCR 문자 오류율 비교](assets/evaluation/ocr-comparison.png)

**현재 실행본에는 한국어 추가 학습 OCR 인식 모델을 적용합니다.** 문자 영역 검출기는 공식 모델을 사용합니다. 위 수치는 소규모 문자 영역 점검 결과이며 전체 한국어 OCR 정확도나 글자 영역 검출률을 뜻하지 않습니다. 전체 이미지 4장에서는 문구 추출 경로를 추가 확인했습니다. 앱에서 글자 좌표와 OCR 배지 및 기록 복원을 검증했습니다. 같은 이미지의 분석은 재사용하고 발견 위치를 함께 보존합니다.

### 6.3 배포 모델 및 실행 검증

| 구성 | 현재 배포 상태 |
| --- | --- |
| 한국어 PaddleOCR | 공식 문자 영역 검출기 + 검증한 한국어 추가 학습 인식 모델 동봉 |
| 사진 분류 | 성인물과 도박 및 마약 관련 시각적 특징 분석. 사진 단독 결과는 이미지 검토로 분리 |
| 로컬 ML | 기존 RF 모델 유지 |
| Laya | 학습 모델과 CPU 실행 파일 동봉. 고정 개수 제한 없이 전체 수집 문구 분석 |
| BERT | 학습 평가의 대조 모델 |
| Groq | 사용자 설정 후 선택 실행 |

[Windows 패키지 검증](https://github.com/Kafrika-Labs/chickadee_studio/actions/workflows/release.yml)에서 ZIP 압축 해제, 앱 실행, 한국어 OCR, 이미지 없는 처리 경로, 로그인 재개와 AI 키 등록을 확인했습니다. 배포 파일의 체크섬과 포함 모델을 검증하고, Windows에서 디버그 옵션 없이 실행되는 것도 확인했습니다. 보고서 저장과 다시 열기, 검토 상태 복원과 CSV 내보내기를 검증했습니다. 한국어 게시글과 지연 로딩 댓글을 포함한 앱 검사에서는 4종 기법, 이미지 OCR 1개와 Laya 문맥 8개를 처리했고, 외부 API 호출은 없었습니다.

[평가 수치 및 분할 해시](assets/evaluation/metrics.json) | [테스트 안내](validation.ko.md)

## 7. 구현 구조

![Chickadee Studio 전체 설계](assets/architecture.png)

웹페이지에서 본문과 이미지를 나누어 수집합니다. 본문은 바로 규칙과 ML로 분석하고, 이미지는 OCR로 글자를 읽은 뒤 분석합니다. Laya는 동봉한 CPU 실행 환경에서 문맥을 추가 검토하고, Groq는 사용자가 요청한 항목을 확인합니다. 결과는 실행별 로컬 파일로 저장합니다.

| 구성 | 구현 |
| --- | --- |
| 데스크톱 앱 | Electron, React와 React Flow |
| 웹페이지 수집 | Chromium과 Playwright |
| 위장 및 은닉 분석 | Unicode, DOM, 계산된 CSS와 좌표 |
| 이미지 문자 인식 | 한국어 PaddleOCR |
| 문자 문맥 분류 | TF-IDF와 Random Forest |
| 로컬 문맥 분석 | 한국어 Laya와 PyTorch CPU 추론 |
| 선택 AI 검토 | Groq의 자료 조회와 같은 사이트 추가 확인 |
| 결과 저장 | JSON, CSV, HTML, Markdown과 화면 이미지 |

[모듈별 구현](architecture.ko.md) | [AI 설정 및 사용량](inspection-agent.ko.md)

## 8. 개발 환경

개발 기준은 **Python 3.12와 Node.js 24**입니다. Windows 실행본 사용자는 개발 환경을 설치할 필요가 없습니다.

```sh
git clone https://github.com/Kafrika-Labs/chickadee_studio.git
cd chickadee_studio
```

<details>
<summary><strong>Windows PowerShell</strong></summary>

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe scripts/prepare_ocr_models.py
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
.\.venv\Scripts\python.exe -m playwright install chromium --only-shell
cd desktop
npm ci
npm run build
npm start
```

패키징은 저장소 루트에서 `./scripts/build-desktop.ps1`로 실행합니다. 출력 경로는 `artifacts/electron-<버전>/win-unpacked/`입니다.

</details>

<details>
<summary><strong>macOS</strong></summary>

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python scripts/prepare_ocr_models.py
PLAYWRIGHT_BROWSERS_PATH=0 .venv/bin/python -m playwright install chromium --only-shell
cd desktop
npm ci
npm run build
npm start
```

Electron과 Python 가상환경의 CPU 아키텍처를 맞춰 사용합니다.

</details>

화면과 앱 셸은 `desktop/`, 검사 엔진은 `chickadee/`, 출력 규격은 `schemas/`에 있습니다. 평가 도표는 `scripts/render_evaluation_charts.py`로 공개 수치에서 다시 생성할 수 있습니다.

## 9. 문서 및 기여

[전체 문서 목록](README.ko.md) · [English documentation](README.md)

| 문서 | 내용 |
| --- | --- |
| [사용설명서](quickstart-windows.ko.md) | 설치, 실행과 결과 위치 |
| [기능 안내](features.ko.md) | 화면별 기능, GIF와 녹화 파일 |
| [앱 사용법](desktop.ko.md) | 검사, 기록과 설정 |
| [구현 구조](architecture.ko.md) | 화면, 엔진과 분석 모듈 |
| [출력 규격](result-format.ko.md) | JSON 필드와 CSV 칼럼 |
| [AI 설정](inspection-agent.ko.md) | Groq 설정, 추가 탐색과 사용량 |
| [테스트 안내](validation.ko.md) | 자동 테스트와 패키지 검증 |
| [기여 안내](../CONTRIBUTING.ko.md) | 이슈 제보, 개발과 PR 절차 |

버그 제보와 기능 제안은 [GitHub Issues](https://github.com/Kafrika-Labs/chickadee_studio/issues)에서 받습니다. 재현 가능한 예제와 실행 환경을 함께 남겨 주세요. API 키와 로그인 정보가 포함된 자료는 게시하지 않습니다.

## 10. 라이선스

소스코드는 [Apache License 2.0](../LICENSE)으로 공개합니다. 외부 라이브러리, 글꼴과 모델의 출처 및 라이선스는 [외부 구성요소 안내](third-party-notices.ko.md)에서 확인할 수 있습니다.
