# 에이전트 확장 규격 v1

[한국어](agent-extension.ko.md) | [English](agent-extension.md)

로컬 확장을 위한 JSONL 도구 계약입니다. Groq 근거 조사의 호출·사용량 한도는 [검사 분석·AI 검토](inspection-agent.ko.md)를 참고하세요.

화면과 검사 프로그램은 아래 도구로 통신합니다. Groq 근거 조사 어댑터는 등록된 읽기 도구만 사용합니다. 별도 HTTP 수신 포트는 열지 않습니다.

## 연결

개발 시 루트에서 `.venv/Scripts/python.exe -m chickadee.bridge --data-dir <기록 폴더>`를 실행합니다. 배포본은 `resources/engine/ChickadeeEngine.exe --data-dir <기록 폴더>`를 사용합니다. stdin에 JSON 한 줄을 쓰고 stdout의 응답·이벤트를 읽습니다. stderr는 진단용입니다.

```json
{"id":1,"method":"capabilities","params":{}}
```

응답의 `result.protocol_version`은 1입니다. `result.tools`에 도구별 JSON Schema·설명·부수 효과가 들어 있습니다. 어댑터는 이 선언을 읽고 입력을 구성합니다. 코드의 기준 정의는 `chickadee/tools.py`입니다.

| 도구 | 역할 | 효과 |
| --- | --- | --- |
| `content.analyze` | [이미지·텍스트 직접 분석](content-analysis.ko.md), ID로 조회·취소 | 무료 로컬 연산 |
| `scan.start` | URL·연결 구성·한도를 검증한 뒤 검사 시작 | 사이트 읽기 |
| `scan.status` | 현재 실행 ID·상태·단계·순번 | 조회 |
| `scan.pause` / `scan.resume` | 페이지 경계에서 정지·재개 | 실행 제어 |
| `scan.stop` | 중단하고 수집한 결과 저장 | 실행 제어 |
| `scan.findings` | 원문·분석 근거·검토 상태, 최대 500개씩 | 조회 |
| `scan.events` | 순번 이후 이벤트, 최대 500개씩 | 조회 |
| `review.update` | 현재 결과의 검토 상태·메모·작성 주체 기록 | 로컬 파일 저장 |
| `workflow.validate` | 지원하는 노드 연결을 실제 검사 플래그로 검증 | 조회 |

## 호출과 실행 식별

```json
{"id":2,"method":"tool-call","params":{"name":"scan.status","arguments":{}}}
```

응답의 `run_id`를 후속 조회·제어·검토 호출에 넣습니다. 이전 검사 ID로 현재 실행을 제어할 수 없습니다. 알 수 없는 도구, 정의하지 않은 인자와 임의 출력 경로는 도구 계약에서 거부합니다. `scan.start`는 `url`과 `workflow`가 필수이며 구성은 앱의 **구성 내보내기**로 얻을 수 있습니다.

```json
{"id":3,"method":"tool-call","params":{"name":"scan.findings","arguments":{"run_id":"실제 실행 ID","offset":0,"limit":100}}}
```

`id`가 있는 행은 요청 응답입니다. `event`가 있는 행은 관측 이벤트이며 `protocol_version`, `run_id`, `sequence`, `timestamp`, `kind`를 포함합니다. `sequence`는 실행 안에서 증가합니다. 푸시되는 `preview`는 JPEG 데이터이므로 모델 입력에 무조건 전달하지 마세요. `scan.events`는 최근 2,000개 비이미지 이벤트를 제공하며, 빠진 구간이 있으면 `truncated`를 표시합니다. 영구 진행 로그는 최대 100,000개입니다.

일시정지는 현재 페이지의 작업과 정리를 마친 뒤 적용합니다. `pausing`은 요청 상태, `paused`가 실제 정지 상태입니다. 확정 정지 시간은 검사 제한시간에서 제외하고 보고서의 `paused_sec`에 기록합니다. 이미 완료된 페이지·대기 큐를 유지하며, 일시정지 중에도 중단할 수 있습니다.

## 검토와 근거 보존

`review.update`는 `ids`, `status`, `expected_revision`, `run_id`가 필수입니다. 상태는 `unreviewed`, `confirmed`, `dismissed`이며 선택적으로 2,000자까지 `note`를 넣습니다. 한 번에 500개까지 처리합니다. `expected_revision`이 현재 검토 기록과 다르면 저장을 거부합니다. 화면과 에이전트가 같은 결과를 덮어쓰는 일을 방지합니다.

화면에서 작성하면 `actor=human`, 도구 호출은 `actor=agent`로 남깁니다. `review.json`에는 원본 결과 SHA-256, 검토 상태·메모, 변경 순번과 최근 5,000개 상태 변경 기록을 보관합니다. 결과를 다시 읽을 때 SHA-256을 대조합니다. 필수 `result.json`, 원문 근거와 고정 17칼럼 CSV는 검토로 변경하지 않습니다. ‘검토 확인’은 검토자의 확인 상태이며 법적 불법성 확정이 아닙니다.

## 향후 어댑터 경계

LLM 제공자·인증 정보·사용자 목표·비용 한도는 별도 어댑터 계층에 둡니다. Grok 구현도 이 경계를 유지합니다. 자동 사이트 선정·임의 코드 실행·외부 메시지 전송 기능은 없습니다.

페이지 원문·광고·DOM·수집 자료는 신뢰하지 않는 분석 데이터입니다. 그 안의 ‘지시’, URL, 도구 호출 형태 문자열을 실행 명령으로 취급하지 않습니다. 대상 HTML은 Electron 표시 창에 삽입하지 않습니다. Grok 분석은 사용자가 선택한 근거의 제한된 마스킹 문맥·관측값을 외부로 전송하므로 [전송 범위](inspection-agent.ko.md)를 확인하세요.
