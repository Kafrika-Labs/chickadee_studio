# 탐색 그래프, AI 근거 조사

[한국어](inspection-agent.ko.md) | [English](inspection-agent.md)

실제 방문 경로와 수집 근거를 확인하고, 선택한 AI 제공자로 광고 문맥을 추가 검토합니다.

## 화면

왼쪽 **검사 분석**의 탐색 그래프와 AI 검토에서 확인합니다. AI 검토에는 ML, Laya, OCR의 처리 건수와 점수 분포를 표시합니다. 미적용 모델은 점수를 생성하지 않습니다.

- **탐색 그래프**: 발견한 페이지, 실제 DOM 수집 상태, 스크롤, 읽기 버튼 뒤의 상태, iframe 수집을 관측된 연결로 표시한다. 노드를 누르면 수집 근거를 확인한다. 검사 구성의 단계 연결 그래프와는 별개다. 새 화면을 연 상태에서 검사하면 실시간으로 갱신한다.
- **AI 검토**: 키와 모델, 사용량 한도를 적용하고 **전체 검토 시작**을 누른다. 광고 의심 근거를 우선 검토하며 한도 도달, 중단 시 미검토 수를 표시한다. 검사 리포트는 스크린샷을 포함한 HTML과 Markdown으로 저장한다. HTML은 브라우저에서 열어 인쇄하거나 PDF로 저장할 수 있다. 자동 호출은 없다. API 키는 앱 세션의 메모리에만 보관하며 기록, 설정 파일, 저장소에 쓰지 않는다. 이미 설정한 세션에서는 키를 다시 입력하지 않고 한도를 낮출 수 있다.

## 수집과 문자 분석

광고로 판정되지 않은 영역도 근거 패킷으로 보존한다. 현재 영역 경계는 기존 `content_scope`의 게시글, 댓글 마크업과 직접 텍스트 요소를 사용한다. 의미 영역을 찾지 못한 경우 `scope_quality=element`로 기록한다. 여러 게시글, 댓글 영역이 중첩된 상위 영역은 `overlapping`으로 표시하고 AI 의견을 보류한다.

패킷에는 원문(최대 4,000자), URL, selector, frame 경로, 관측 시각, snapshot ID, 원문 SHA-256, 관측한 computed style, 숨김 근거, 링크 문자열을 저장한다. 미수집 스타일은 null이다. iframe의 숨김 플래그도 별도로 보존한다. 동일한 근거를 여러 상태에서 재사용하며 최종 관측 순서를 유지하므로 값이 변경됐다가 복구된 경우도 최종 값으로 비교한다.

영역은 실행당 최대 1,000개, 본문 패킷 합계 약 6MB, DOM 상태는 최대 3,000개로 제한하고 초과 시 `truncated`를 남긴다. 그래프 화면은 최대 1,000개 노드만 표시한다. 원문, 스크롤, 페이지 한도는 기존 검사 제한도 함께 적용한다.

Unicode 공식 confusables 데이터의 **18.0.0, 1,351개 제한 매핑**을 로컬에 고정했다. 비ASCII 단일 글자에서 ASCII 글자로의 매핑만 사용하고, 기존 한글, 자모 처리를 유지한다. ASCII끼리의 과도한 치환은 하지 않는다. 원문 위치를 보존하며 광고 문맥 조건과 정상 예외도 유지한다. 보이지 않는 형식 문자 삽입과 혼합 문자 체계는 보조 패턴으로 기록한다. 형식 문자만 있다는 이유로 HOMOGLYPH를 만들지는 않는다. 이는 UTS #39 전체 구현이나 모든 언어의 위장 탐지 완성을 의미하지 않는다.

데이터 출처, 원본 SHA-256, 필터는 `chickadee/data/confusables-ascii.json`, 라이선스는 같은 폴더 `LICENSE-UNICODE.txt`에 있다. 실행 중 Unicode 서버에 접속하지 않는다.

## Groq 실행과 비용

설정 → AI 연결에서 **Groq, OpenAI(GPT), Anthropic(Claude)** 중 하나를 선택하고 해당 서비스의 API 키를 등록합니다. 제공자를 바꿀 때는 새 키가 필요합니다. 같은 제공자의 모델·한도 변경에는 현재 세션 키를 사용할 수 있습니다. 키는 파일에 저장하지 않으며 앱 종료 시 삭제됩니다. ChatGPT·Claude 구독과 API 요금은 별도입니다.

| Provider | Default model | Endpoint |
| --- | --- | --- |
| Groq | `openai/gpt-oss-20b` | `https://api.groq.com/openai/v1/chat/completions` |
| OpenAI | `gpt-4.1-mini` | `https://api.openai.com/v1/chat/completions` |
| Anthropic | `claude-haiku-4-5-20251001` | `https://api.anthropic.com/v1/messages` |

모델 이름은 설정에서 변경할 수 있습니다. 선택한 제공자의 공식 API로만 요청하며 내장 검색·코드 실행 도구는 호출하지 않습니다.

1. 모델이 등록된 `evidence_read`, `style_read`, `text_analyze`, `local_ai_read` 중 필요한 조회를 선택한다.
2. 앱이 선택한 근거 ID와 도구 인자를 검증하고 **이미 수집된 근거만** 조회한다. 임의 URL, 파일, 명령 실행, 다른 실행의 근거 접근, 기존 탐지, 사람 검토 수정은 허용하지 않는다.
3. 별도 모델 호출에서 JSON 의견을 받는다. JSON Schema와 실제 조회한 근거 ID를 검증한다. 짧거나 잘린 문구, 본문을 읽지 않은 의견은 보류로 처리한다.

도구 조회 단계와 JSON 응답 단계는 별도 요청이다. **0.8.0부터 근거 부족, 보류, 추가 근거 요청이 나오면 같은 사이트 추가 탐색을 이어 실행한다.** 모델은 원래 영역의 링크, 미탐색 큐, 관측 페이지와 원래 페이지 재방문 중 앱이 허용한 링크 ID를 최대 2개 선택한다. 주소 체계, 호스트, 포트가 모두 같은 origin만 허용한다. 로그인, 삭제, 다운로드 등 일반적인 위험 경로와 action/token 종류의 쿼리를 제외한다. 임의 URL과 모델의 JS, 쉘, 폼 입력은 실행하지 않는다. 새로 수집한 링크를 재귀적으로 탐색하지 않는다. 페이지를 읽는 GET 요청도 모든 사이트에서 부작용이 없다고 보장할 수는 없다.

추가 탐색은 별도 임시 Chromium 컨텍스트에서 기본 스크롤, DOM/CSS 수집만 수행한다. 사이트별 추가 리소스 허용이나 사용자 프로필의 클릭 동작을 상속하지 않는다. 모델에는 페이지당 최대 2개 영역, 영역당 600자와 수집 상태를 보내며 스크린샷은 전송하지 않는다. 다른 게시물의 광고를 원래 게시물의 근거로 섞지 않도록 지시하고 원래 근거 ID와 실제 추가 근거 ID를 검증한다. 같은 사이트라고 같은 게시물임이 보장되는 것은 아니며, 모델 의견은 사람이 확인해야 한다.

한 번의 기본 분석은 모델 요청 **2회**, 근거 조회 최대 **4개**다. 추가 탐색 시 계획, 재판정 **2회**를 더해 최대 **4회**이며 기본 누적 한도를 올리지 않는다. 출력 요청당 최대 **1,024토큰**, 전체 **30초**, 단일 HTTP 대기 최대 **10초**, 추가 페이지 수집은 OCR 시작 시간을 포함해 페이지당 최대 **20초**(전체 남은 시간 안, 재판정용 3초 확보)다. 추가 방문은 분석당 최대 2개, 검사당 누적 최대 6개다. 취소는 요청 전후에 확인하므로 이미 전송된 요청의 비용을 취소하지는 못한다. 실패, 429, 형식 오류 때 자동 재시도나 제공자 전환은 없다. 추가 확인이 끝나지 않으면 근거 부족 상태와 기록을 보존한다.

기본 누적 한도는 **검사 실행당 6회 / 24,000토큰**이다. 토큰은 요청 전에 UTF-8 크기로 보수적으로 예약하고, 정상 응답의 제공자 사용량으로 정산한다. 응답 실패, 사용량 누락은 예약을 유지한다. 호출 여유가 2회 미만이면 새 분석을 시작하지 않는다. 사용량과 설정 한도는 `agent.json`에 요청 전에 저장하며 같은 기록을 다시 열어도 이어진다. 이미 저장한 실행 한도는 낮출 수 있지만 높이지 않는다. 새 검사는 별도 한도를 사용한다.

이는 앱 내 호출, 토큰 제어이며 계정 전체의 달러 한도는 아니다. 모델별 가격, 다른 앱에서 쓰는 같은 키와 새 검사들의 합산 비용까지 제한하려면 [Groq 콘솔](https://console.groq.com/settings/limits)도 설정한다.

Groq에는 선택한 영역의 초기 발췌와 요청한 도구 결과만 전송한다. 본문 조회는 최대 1,600자다. URL, 이메일, 전화번호, 키 모양 문자열을 마스킹하며 쿠키, 인증 헤더, HTML 원본, 전체 화면 이미지를 보내지 않는다. 자유 서술 개인정보까지 모두 제거하는 기능은 아니다. 페이지의 지시문은 데이터로 취급하며 도구 권한도 별도로 제한한다. [Groq 데이터 정책](https://console.groq.com/docs/your-data)을 참고한다.

## 저장과 로컬 API

필수 `result.json`과 17칼럼 CSV의 기존 구조를 유지한다. `review-report.html`과 `review-report.md`에는 검사 개요, 처리 통계, 근거 ID와 원문 위치, Groq 검토 의견과 사용량을 저장한다. 검토가 중단돼도 완료된 의견과 미검토 수를 보존한다. `scan-report.json`에 `exploration`, `evidence_packets`, `screenshots`가 추가된다. `agent.json`은 근거 조사 의견, 사용량, 최근 실행 동작, `explorations`(추가 페이지, 문맥, 화면, 차단 내역)를 보관한다. 추가 탐색은 원래 검사 보고서를 덮어쓰지 않는다. sidecar는 원본 결과 SHA-256에 연결한다. 사용량 기록이 손상된 경우 비용 한도를 초기화하지 않고 해당 기록의 유료 요청을 잠근다. AI 의견은 사람의 `review.json`을 덮어쓰지 않는다.

### 탐지 근거 화면

필수 탐지, 광고 후보가 처음 나온 DOM 상태의 viewport를 JPEG로 촬영한다. 상태당 1장을 공유하며, 최대 64장, 장당 200KB, 총 8MB를 저장한다. 요소를 강제로 표시하거나 화면을 옮기지 않는다. 투명, 화면 밖 요소의 문구가 이미지에 보이지 않을 수 있으므로 원문, 계산된 CSS와 함께 검토한다. DOM 수집과 이미지 촬영은 순차 작업이라 그 사이 동적 페이지가 바뀔 수 있다. 촬영 시각, 상태 ID, URL, 해시가 함께 기록되며 해시는 파일 무결성 확인용이다.

근거 패널의 **스크린샷**에서 확대하고 기록을 다시 열어 확인한다. 결과 폴더 `evidence/<SHA-256>.jpg`에 원본 JPEG도 저장한다. 추가 탐색 화면은 `agent-<SHA-256>.jpg`다. 화면이 없는 이전 기록, 촬영 실패, 저장 한도에서는 원문, CSS 근거를 표시한다. 이미지 파일은 로컬 저장만 하며 AI 제공자로 전송하지 않는다. 촬영은 [Playwright screenshot API](https://playwright.dev/python/docs/screenshots)를 사용한다.

![앱의 탐지 내역과 근거 패널](../desktop/assets/guide/review.png)

기존 stdio bridge에 다음 명령을 추가했다. 별도 HTTP 포트는 열지 않는다.

| 명령 | 인자 | 반환, 효과 |
| --- | --- | --- |
| `inspection` | `run_id` | 그래프, 영역, 에이전트 상태 |
| `agent-configure` | 최초 `api_key` 필수, `model`, `token_limit`, `call_limit` | 사용자가 입력한 세션 키만 사용. 이후 한도 변경 시 기존 세션 키 유지. 앱 종료 시 삭제 |
| `agent-run` | `run_id`, `evidence_id` | 백그라운드 근거 조사 시작 |
| `agent-status` | 없음 | 설정 여부, 실행 상태, 누적 사용량, 의견 |
| `agent-stop` | 없음 | 에이전트 취소 요청 |

Windows 앱은 `Chickadee.exe --groq-env-file 'C:\설정\.env'`로 명시적으로 선택한 파일의 `GROQ_API_KEY`만 읽어 같은 세션 설정을 할 수 있습니다. 파일을 실행하거나 다른 변수를 확장하지 않습니다. 키를 읽는 것만으로 API를 호출하지 않으며 기존 한도를 유지합니다. 기본 모델은 Groq의 `openai/gpt-oss-20b`입니다. 상세 실행 방법과 출력 경로는 [빠른 실행](quickstart-windows.ko.md) 첫 장에 있습니다.

`inspection.read`, `agent.status`는 기존 로컬 tool-call 계약에도 등록했다. 비용 발생 명령과 인증 설정은 근거 조사 모델에 노출하지 않는다. `agent_connected`는 세션 설정 여부이며 `agent_available=true`, `providers=["groq", "openai", "anthropic"]`로 구현 가용성을 표시한다.

## 검증과 재실행

로컬 fixture로 두 차례 실제 Chromium 검사, 링크, 문구, opacity 변경과 기록 재불러오기, 원본 결과 불변을 시험한다. 에이전트는 결정론적 응답으로 잘못된 도구, 다른 근거 ID, 환각 ID, 예산, 취소를 검증한다. 화면 시험은 로컬 렌더러와 실제 Python bridge를 연결한다. 네이티브 Electron 패키지 실행 검증과는 별개다.

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd desktop
npm run build
npm test
$env:PLAYWRIGHT_BROWSERS_PATH = '..\.venv\Lib\site-packages\playwright\driver\package\.local-browsers'
node tests/inspection-smoke.cjs
```

유료 실서버 검증은 자동 테스트에 포함하지 않는다. 필요할 때만 다음 명령을 직접 실행한다. 합성 문구만 사용하고 출력 파일에 사용량을 보존해 재실행 시 기존 한도를 이어 적용한다.

```powershell
.\.venv\Scripts\python.exe scripts/verify_groq_agent.py --output artifacts/groq-live-check.json
# 또는 --env-file <사용자가 지정한 dotenv 경로>. GROQ_API_KEY만 읽고 실행, 복사하지 않는다.
```

기존 0.7.0, 0.8.0의 실서버 검증은 **Groq**에서 수행한 과거 결과다. `examples/groq-agent-smoke-2026-10-21.json`과 `examples/groq-exploration-smoke-2026-10-21.json`은 변경하지 않는다. 0.10.1에서는 실제 Groq 모델 목록을 확인하고 현재 기본 모델의 근거 조회, JSON 판정을 다시 검증했다.
