# 기능 범위와 결과 계약

[한국어](requirements.ko.md) | [English](requirements.md)

Chickadee Studio의 기본 입력, 실행 환경과 결과 형식을 정리합니다. 구현은 [아키텍처](architecture.ko.md), 필드와 CSV 칼럼은 [출력 규격](result-format.ko.md)을 참고하세요.

| 구분 | 동작 |
| --- | --- |
| 입력 | 진입 웹사이트 URL 1개 |
| 탐색 | 같은 사이트의 하위 페이지, 게시글, 댓글과 iframe |
| 문자 위장·은닉 | `HOMOGLYPH`, `JAMO`, `TRANSPARENT`, `OFFSCREEN` |
| 이미지 | 이미지의 한국어 문구를 OCR로 추출하고 원문 텍스트와 구분해 분석 |
| 검토 | 원문·요소 위치·이미지 근거와 사용자 검토 상태·메모 |
| 배포 환경 | Windows x64 데스크톱 앱, GPU 없이 로컬 CPU 분석 |
| 선택 AI | 사용자 키로 실행하는 Groq 추가 검토 |
| 결과 | 실행별 로컬 파일, JSON·CSV·HTML·Markdown |

## JSON 계약

`result.json`은 UTF-8(BOM 없음)이며 최상위 키는 `meta`, `findings`입니다. `meta`의 필수 필드는 `topic`, `entry_url`, `started_at`, `finished_at`, `elapsed_sec`이고 `tool_version`은 선택입니다. `topic`은 호환성을 위해 `TOPIC`을 사용합니다. 시각은 ISO 8601, 소요시간은 초 단위 숫자입니다.

모든 페이지의 결과를 하나의 `findings` 배열에 담고 0건이면 `[]`를 저장합니다. 항목에는 `id`, `url`, `is_violation`, `location`, `evidence_text`, `technique`가 필요합니다. ID는 파일 안에서 고유하며, `technique`는 위 4종 중 한 문자열입니다. 원문은 정규화 전 상태로 보존합니다. 검출 단위는 `(url, location, technique)`이므로 같은 요소에서 두 기법을 발견하면 별도 항목을 만듭니다.

`location`은 한 요소를 가리키는 CSS 선택자입니다. iframe 내부는 `iframe[src="절대주소"] >>> 내부 선택자`로 기록하며 중첩 경로도 보존합니다. `url`에는 상위 페이지 주소를 기록합니다. 게시글을 구분하는 쿼리 값은 유지합니다.

추가 광고 문맥은 `result_extra.json`에 `technique: "ETC"`, `extra_finding`과 함께 기록합니다. 검토 후보의 `is_violation:false`는 불법성을 확정하지 않았다는 뜻입니다. [JSON Schema](../schemas/result.schema.json)는 문자 위장·은닉 4종 결과를 다룹니다.

## 저장과 검증

앱의 기본 경로는 `문서/Chickadee/results/<실행별 폴더>/`이며 CLI는 `results`입니다. 실제 경로는 앱의 **결과 폴더**에서 확인합니다. 완료·일부 결과·중단·실패 상태와 수집하지 못한 범위는 `scan-report.json`을 함께 확인하세요. 탐지와 AI 의견은 법적 판단을 대신하지 않습니다.

[검증 안내](validation.ko.md) · [기여 안내](../CONTRIBUTING.ko.md)
