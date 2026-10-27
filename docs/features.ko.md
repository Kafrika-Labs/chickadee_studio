# 기능 안내

[한국어](features.ko.md) | [English](features.md)

![서비스 전체 시연](assets/demos/overview.webp)

[README](../README.ko.md) | [설치 및 실행](quickstart-windows.ko.md) | [출력 규격](result-format.ko.md)

## 목차

1. [검사 구성 및 탐색](#1-검사-구성-및-탐색)
2. [문자 위장 및 은닉 탐지](#2-문자-위장-및-은닉-탐지)
3. [이미지 문자 추출](#3-이미지-문자-추출)
4. [로컬 분석 및 AI 검토](#4-로컬-분석-및-ai-검토)
5. [결과 검토 및 출력](#5-결과-검토-및-출력)
6. [운영 설정 및 편의 기능](#6-운영-설정-및-편의-기능)
7. [기능 시연](#7-기능-시연)
8. [전체 그래프 확대](#8-전체-그래프-확대)

## 1. 검사 구성 및 탐색

### 검사 구성

URL과 검사 조건을 설정합니다. 본문은 바로 ML로 전달하고, 이미지는 OCR로 문구를 추출한 뒤 ML로 전달합니다. 이미지가 없으면 OCR을 건너뜁니다.

게시글과 댓글을 모두 검사합니다. 지연 로딩 댓글과 설정에 등록한 댓글 더보기 동작을 지원하며, 사이트의 구조에 따라 별도 탐색 설정이 필요할 수 있습니다.

![검사 구성](assets/demos/01-pipeline.png)

### 탐색 경로

방문한 페이지와 대기 중인 URL을 구분하고, 페이지별 상태를 확인합니다.

![탐색 경로](assets/demos/11-navigation.png)

### 탐색 그래프

페이지 방문과 수집 동작을 관측한 연결로 표시합니다. 노드를 선택해 관련 정보를 확인하고 확대하거나 이동할 수 있습니다.

![탐색 그래프](assets/demos/09-exploration.png)

![탐색 그래프 전체 보기](assets/demos/20-full-graph-overview.png)

위 전체 화면은 100페이지 검사에서 관측한 371개 노드를 표시합니다. START와 END는 화면 안내용입니다. 페이지와 수집 한도에 도달한 일부 결과입니다.

### 진행 기록

페이지 수집, 분석과 차단 내역을 실행 순서에 따라 확인합니다.

![진행 기록](assets/demos/10-events.png)

## 2. 문자 위장 및 은닉 탐지

### 오프라인 데모

검사 실행 옆 펼침 메뉴에서 내장 데모를 실행합니다. 인터넷 없이 문자 위장과 은닉 기법의 처리 흐름을 확인할 수 있습니다.

![로컬 데모의 검사 흐름](assets/demos/21-demo-pipeline.png)

### 네 가지 탐지 기법

닮은꼴 문자, 자모 분해, 투명 문자와 화면 밖 은닉을 탐지합니다. 다음 화면은 로컬 검증 페이지의 결과입니다.

![네 가지 위장 및 은닉 기법](assets/demos/22-four-techniques.png)

### 원문 및 요소 위치

항목을 선택하면 원문, URL, 요소 위치와 탐지 이유를 확인할 수 있습니다.

![원문과 요소 위치](assets/demos/06-evidence.png)

### 촬영 화면 확대

관찰 당시 촬영한 화면을 확대합니다. 숨은 요소를 강제로 표시하지 않으므로, 투명하거나 화면 밖에 있는 글자는 원문과 CSS를 함께 확인합니다.

![촬영 화면 확대](assets/demos/07-evidence-zoom.png)

## 3. 이미지 문자 추출

### 한국어 문구 인식

PaddleOCR가 이미지에서 읽은 문구와 글자 영역을 표시합니다. 다음 화면은 한국어 검증 이미지의 처리 결과입니다.

![한국어 이미지 OCR](assets/demos/23-ocr-boxes.png)

### 줄 단위 확인

인식한 줄을 선택하면 원본 이미지의 해당 위치를 강조합니다. 인식 신뢰도는 문자 추출 모델의 점수입니다.

![OCR 줄 선택](assets/demos/24-ocr-line.png)

### 이미지 처리 통계

처리, 판독 실패, 오류와 생략을 구분합니다. OCR 처리 건수는 이미지 주제 분류나 위법성 판정 건수와 다릅니다.

![OCR 처리 통계](assets/demos/25-ocr-statistics.png)

## 4. 로컬 분석 및 AI 검토

### ML 처리 통계

문자 TF-IDF와 RF의 처리 영역 수와 점수 분포를 확인합니다. RF로 문자 문맥을 분류하고, 설치한 한국어 Laya로 문맥을 추가 분석합니다. 점수는 정확도나 위법 확률이 아닙니다.

한국어 Laya는 로컬 CPU에서 실행합니다. 실제 앱 검사에서 문맥 8개를 분석했으며, 외부 API 호출은 없었습니다. Windows 실행본에는 모델과 CPU 실행 환경이 함께 포함됩니다. [Laya 설정](content-analysis.ko.md)

![모델 처리 통계](assets/demos/02-statistics.png)

### Groq 검토 의견

사용자가 실행하면 수집한 원문과 분석 정보를 조회합니다. 필요한 경우 같은 사이트의 발견된 링크를 제한적으로 추가 확인합니다. 원래 탐지 결과와 사용자의 메모는 유지합니다.

![Groq 검토 의견](assets/demos/03-groq-report.png)

### 누적 사용량

기본 한도는 검사당 6회와 24,000토큰입니다. 한도 도달 시 부분 검토와 미검토 수를 구분해 저장합니다. 다음 예시는 5회 요청과 6,165토큰을 사용했습니다.

![Groq 사용량](assets/demos/04-budget.png)

### API 키 설정

AI 설정에서 사용자의 Groq 키를 입력합니다. 비밀번호 입력으로 표시하며 키는 결과와 보고서에 저장하지 않습니다. 기본 검사, OCR과 ML에는 API 키가 필요하지 않습니다.

![AI 연결 설정](assets/demos/14-settings-groq.png)

## 5. 결과 검토 및 출력

### 페이지 미리보기

검사 브라우저에서 전달한 화면을 확인합니다.

![페이지 미리보기](assets/demos/27-preview.png)

### 미리보기 확대

촬영 화면과 URL을 함께 확인합니다.

![미리보기 확대](assets/demos/28-preview-zoom.png)

### 검토 상태 및 메모

항목별 검토 상태와 메모를 저장합니다. 원래 탐지 결과는 변경하지 않습니다.

![검토 메모 저장](assets/demos/29-review-saved.png)

### 일괄 처리

표시한 항목을 선택해 검토 상태를 함께 적용합니다.

![항목 일괄 선택](assets/demos/30-bulk-selection.png)

### CSV 내보내기

고정 17개 칼럼으로 결과를 내보냅니다. [CSV 예시](assets/demos/sample-results.csv)에서 칼럼과 실제 저장 형태를 확인할 수 있습니다.

![CSV 저장](assets/demos/31-csv-export.png)

### 검사 기록

완료된 검사와 일부 결과를 다시 열어 원문, 이미지와 검토 의견을 확인합니다.

![검사 기록](assets/demos/12-history.png)

### 검토 상태 복원

저장한 검사에서 검토 상태와 메모를 다시 불러옵니다.

![검토 상태 복원](assets/demos/32-review-reload.png)

### 보고서 저장

HTML과 Markdown으로 보고서를 저장합니다. 처리 통계, AI 의견, 원문과 촬영 화면을 함께 보존합니다.

![보고서 저장](assets/demos/05-report-saved.png)

<details>
<summary><strong>HTML 보고서 전체 화면</strong></summary>

![독립 실행형 HTML 보고서](assets/demos/26-standalone-report.png)

</details>

[HTML 보고서 예시](assets/demos/sample-report.html)는 인터넷 없이 열 수 있습니다. 브라우저 인쇄에서 PDF로 저장할 수 있습니다.

## 6. 운영 설정 및 편의 기능

### 실행 환경 및 검사 설정

CPU와 메모리에 맞는 실행 모드, 검사 범위와 저장 위치를 설정합니다.

![실행 환경 및 검사 설정](assets/demos/13-settings-general.png)

### 알림 설정

검사 완료 알림과 채널별 보고서 전송 조건을 설정합니다. 외부 채널은 사용자가 연결해야 동작합니다.

![알림 설정](assets/demos/15-settings-notifications.png)

### 예약 검사

저장한 검사 구성을 일정에 맞춰 실행합니다. 앱이 실행 중일 때 동작합니다.

![예약 검사](assets/demos/16-settings-schedule.png)

### 단축키

화면 이동과 자주 쓰는 명령의 단축키를 설정합니다.

![단축키 설정](assets/demos/17-shortcuts.png)

### 업데이트

새 릴리스와 다운로드 상태를 확인합니다.

![업데이트](assets/demos/18-updates.png)

### 빠른 명령

Ctrl K로 화면 이동, 결과 불러오기와 내보내기 명령을 검색합니다.

![빠른 명령](assets/demos/19-command-palette.png)

## 7. 기능 시연

각 영상은 실제 앱에서 해당 기능을 실행한 구간입니다. 한국어 검증 페이지의 OCR 및 Laya 분석과, 별도로 저장한 웹사이트의 Groq 검토 결과를 구분합니다. 재촬영에는 추가 API 호출이 없습니다.

### 01. 검사 대상 입력

![01. 검사 대상 입력](assets/demos/stage-01-target.webp)

### 02. 게시글 및 댓글 탐색

![02. 게시글 및 댓글 탐색](assets/demos/stage-02-exploration.webp)

### 03. 문자 위장 및 은닉 탐지

![03. 문자 위장 및 은닉 탐지](assets/demos/stage-03-detection.webp)

### 04. 이미지 문자 추출

![04. 이미지 문자 추출](assets/demos/stage-04-ocr.webp)

### 05. ML과 Laya 문맥 분석

![05. ML과 Laya 문맥 분석](assets/demos/stage-05-analysis.webp)

### 06. Groq 추가 검토

![06. Groq 추가 검토](assets/demos/stage-06-groq.webp)

### 07. 결과 검토 및 출력

![07. 결과 검토 및 출력](assets/demos/stage-07-report.webp)

[전체 시연 영상](assets/demos/service.webm) | [GIF 원본](assets/demos/overview.gif)

## 8. 전체 그래프 확대

371개 관측 노드와 안내용 START, END를 겹치는 구간으로 나눠 촬영했습니다. [노드 및 촬영 구간 정보](assets/demos/graph-capture.json)에서 관측 범위를 확인할 수 있습니다.

<details>
<summary><strong>확대 화면 60개</strong></summary>

![탐색 그래프 확대 구간 01](assets/demos/graph-tile-001.png)


![탐색 그래프 확대 구간 02](assets/demos/graph-tile-002.png)


![탐색 그래프 확대 구간 03](assets/demos/graph-tile-003.png)


![탐색 그래프 확대 구간 04](assets/demos/graph-tile-004.png)


![탐색 그래프 확대 구간 05](assets/demos/graph-tile-005.png)


![탐색 그래프 확대 구간 06](assets/demos/graph-tile-006.png)


![탐색 그래프 확대 구간 07](assets/demos/graph-tile-007.png)


![탐색 그래프 확대 구간 08](assets/demos/graph-tile-008.png)


![탐색 그래프 확대 구간 09](assets/demos/graph-tile-009.png)


![탐색 그래프 확대 구간 10](assets/demos/graph-tile-010.png)


![탐색 그래프 확대 구간 11](assets/demos/graph-tile-011.png)


![탐색 그래프 확대 구간 12](assets/demos/graph-tile-012.png)


![탐색 그래프 확대 구간 13](assets/demos/graph-tile-013.png)


![탐색 그래프 확대 구간 14](assets/demos/graph-tile-014.png)


![탐색 그래프 확대 구간 15](assets/demos/graph-tile-015.png)


![탐색 그래프 확대 구간 16](assets/demos/graph-tile-016.png)


![탐색 그래프 확대 구간 17](assets/demos/graph-tile-017.png)


![탐색 그래프 확대 구간 18](assets/demos/graph-tile-018.png)


![탐색 그래프 확대 구간 19](assets/demos/graph-tile-019.png)


![탐색 그래프 확대 구간 20](assets/demos/graph-tile-020.png)


![탐색 그래프 확대 구간 21](assets/demos/graph-tile-021.png)


![탐색 그래프 확대 구간 22](assets/demos/graph-tile-022.png)


![탐색 그래프 확대 구간 23](assets/demos/graph-tile-023.png)


![탐색 그래프 확대 구간 24](assets/demos/graph-tile-024.png)


![탐색 그래프 확대 구간 25](assets/demos/graph-tile-025.png)


![탐색 그래프 확대 구간 26](assets/demos/graph-tile-026.png)


![탐색 그래프 확대 구간 27](assets/demos/graph-tile-027.png)


![탐색 그래프 확대 구간 28](assets/demos/graph-tile-028.png)


![탐색 그래프 확대 구간 29](assets/demos/graph-tile-029.png)


![탐색 그래프 확대 구간 30](assets/demos/graph-tile-030.png)


![탐색 그래프 확대 구간 31](assets/demos/graph-tile-031.png)


![탐색 그래프 확대 구간 32](assets/demos/graph-tile-032.png)


![탐색 그래프 확대 구간 33](assets/demos/graph-tile-033.png)


![탐색 그래프 확대 구간 34](assets/demos/graph-tile-034.png)


![탐색 그래프 확대 구간 35](assets/demos/graph-tile-035.png)


![탐색 그래프 확대 구간 36](assets/demos/graph-tile-036.png)


![탐색 그래프 확대 구간 37](assets/demos/graph-tile-037.png)


![탐색 그래프 확대 구간 38](assets/demos/graph-tile-038.png)


![탐색 그래프 확대 구간 39](assets/demos/graph-tile-039.png)


![탐색 그래프 확대 구간 40](assets/demos/graph-tile-040.png)


![탐색 그래프 확대 구간 41](assets/demos/graph-tile-041.png)


![탐색 그래프 확대 구간 42](assets/demos/graph-tile-042.png)


![탐색 그래프 확대 구간 43](assets/demos/graph-tile-043.png)


![탐색 그래프 확대 구간 44](assets/demos/graph-tile-044.png)


![탐색 그래프 확대 구간 45](assets/demos/graph-tile-045.png)


![탐색 그래프 확대 구간 46](assets/demos/graph-tile-046.png)


![탐색 그래프 확대 구간 47](assets/demos/graph-tile-047.png)


![탐색 그래프 확대 구간 48](assets/demos/graph-tile-048.png)


![탐색 그래프 확대 구간 49](assets/demos/graph-tile-049.png)


![탐색 그래프 확대 구간 50](assets/demos/graph-tile-050.png)


![탐색 그래프 확대 구간 51](assets/demos/graph-tile-051.png)


![탐색 그래프 확대 구간 52](assets/demos/graph-tile-052.png)


![탐색 그래프 확대 구간 53](assets/demos/graph-tile-053.png)


![탐색 그래프 확대 구간 54](assets/demos/graph-tile-054.png)


![탐색 그래프 확대 구간 55](assets/demos/graph-tile-055.png)


![탐색 그래프 확대 구간 56](assets/demos/graph-tile-056.png)


![탐색 그래프 확대 구간 57](assets/demos/graph-tile-057.png)


![탐색 그래프 확대 구간 58](assets/demos/graph-tile-058.png)


![탐색 그래프 확대 구간 59](assets/demos/graph-tile-059.png)


![탐색 그래프 확대 구간 60](assets/demos/graph-tile-060.png)

</details>
