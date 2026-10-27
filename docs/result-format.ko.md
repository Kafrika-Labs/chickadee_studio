# 저장 형식과 고정 칼럼

[한국어](result-format.ko.md) | [English](result-format.md)

데스크톱 앱은 기본 `문서/Chickadee/results` 아래 실행별 폴더에 결과 파일을 저장합니다. Python CLI의 기본 경로는 `results`입니다. 실행 완료·일부 결과·중단·실패 여부는 `scan-report.json` 또는 화면에서 확인합니다. 실패한 실행의 빈 CSV를 광고가 없다는 의미로 해석하지 않습니다.

| 파일 | 용도 |
| --- | --- |
| `result.json` | 문자 위장·은닉 4종의 결과 형식. 정규화 전 원문 보존 |
| `result_extra.json` | 추가 광고 문맥 검토 관측값. `ETC`·`extra_finding` 사용. 검토 후보의 불법성을 확정하지 않으므로 `is_violation:false` |
| `scan-report.json` | 상태·오류·수집 범위·계산 CSS·광고 의심 후보·파일 해시 |
| `result.csv` | 필수 탐지와 일반 광고 후보를 고정된 17개 칼럼으로 함께 검토 |

데스크톱 앱은 `events.jsonl`과 `last-preview.jpg`·`last-preview.json`도 보관합니다. 보고서에는 노드 구성과 대기 URL·발견 출처가 추가됩니다. 필수 결과 스키마와 CSV 17개 칼럼은 유지합니다. [앱 출력·기록 안내](desktop.ko.md#guide-7)를 참고하세요.

`review.json`은 검토 상태·메모를 별도로 저장합니다. 필수 탐지의 `is_violation`, 원문, 17칼럼 CSV를 검토 작업으로 바꾸지 않습니다. 보고서에는 `run_id`, `paused_sec`, `active_elapsed_sec`를, 진행 이벤트에는 실행 ID와 순번을 기록합니다.

## CSV 1.0 칼럼 순서

| 칼럼 | 값 |
| --- | --- |
| `schema_version` | CSV 규격 버전 `1.0` |
| `record_kind` | `technique_finding` 또는 `ad_candidate` |
| `id` | 항목 고유 ID |
| `url` | 원문을 관찰한 페이지 URL |
| `category` | 후보의 `GAMBLING`, `ADULT`, `LOAN`, `INVESTMENT`, `COMMERCIAL`. 필수 결과는 빈 값 |
| `technique` | `HOMOGLYPH`, `JAMO`, `TRANSPARENT`, `OFFSCREEN`. 일반 후보는 빈 값 |
| `technique_name` | 한글 유형·후보 분류 |
| `is_violation` | 필수 기법 의심은 `true`, 일반 후보는 미판정 빈 값 |
| `review_required` | 사람이 검토해야 하는 항목은 `true` |
| `evidence_text` | 요소 원문 |
| `location` | 중첩 iframe 경로를 포함한 CSS 선택자 |
| `matched_keywords` | 일치 키워드의 JSON 배열 |
| `style_reasons` | 스타일 또는 광고 문맥 판정 이유의 JSON 배열 |
| `frame_depth` | iframe 중첩 깊이. 최상위는 0 |
| `observed_at` | 실제 관찰 시각(ISO 8601). 이전 결과에 없으면 빈 값 |
| `rules_version` | 규칙 버전 |
| `tool_version` | 프로그램 버전 |

CSV는 UTF-8 BOM, 쉼표 구분, CRLF 줄바꿈입니다. 쉼표·따옴표·여러 줄 원문은 CSV 인용 규칙으로 저장합니다. 배열 칼럼은 셀 안의 JSON 문자열입니다. 코드가 읽을 정의는 [result-csv.columns.json](../schemas/result-csv.columns.json)입니다.

스프레드시트에서 수식으로 실행될 수 있는 셀(`=`, `+`, `-`, `@` 등) 앞에는 작은따옴표를 붙입니다. **이 처리는 CSV에만 적용**하며 `result.json`·보고서 원문은 그대로 유지합니다. 각 파일은 임시 파일 작성 후 교체하며 보고서의 `result_sha256`·`csv_sha256`으로 파일 쌍을 확인할 수 있습니다. 실행별 파일 교체 중 장애가 발생하면 해시를 확인해야 합니다.

## 일반 광고 후보와 필수 기법의 차이

보이는 카지노 가입 광고, 대출 모집, 투자 수익 보장, 구매·추천 유도 문구는 추가 검토 후보로 기록합니다. 위장·은닉 기법이 확인되지 않으면 필수 4종 코드를 만들어 붙이지 않습니다. 일반 광고 후보는 법적 불법성 판정도 아닙니다.

후보 원문은 `scan-report.json`의 `ad_candidates`에 있습니다. 같은 게시글 제목·본문은 가능한 한 article/comment 범위로 묶고, 같은 범위에서 필수 기법을 검출했다면 후보 행을 중복 저장하지 않습니다. 웹사이트 마크업에 따라 범위 구분·문맥 판단에 한계가 있습니다. 실행 시간·페이지 수·상태는 보고서의 실행 메타데이터를 함께 보관하세요.

## 탐색 진단

이미지 인식 결과는 `ocr_images`에 저장합니다. 각 이미지의 `id`, 원본 `image_sha256`, `relative_path`, `width`·`height`, `lines`(문구·0~1 신뢰도·네 꼭짓점 좌표), JPEG 미리보기와 처리 상태를 포함합니다. 좌표는 리사이즈 전 원본 픽셀 기준입니다. `ocr_summary`는 처리·실패 건수를 요약합니다. 이미지 광고 후보는 `source_kind=image_ocr`와 `image_id`로 해당 근거에 연결됩니다. 필수 4종 결과와 17칼럼 CSV 구조는 유지합니다.

`scan-report.json`의 `crawl_summary`는 발견한 유효 URL 수·방문 수·남은 대기 수를, `page_diagnostics`는 각 요청 URL·최종 URL·HTTP 상태·수집 링크 수·새 대기 수·요소 관측 수·소요 시간을 담습니다. `elements_examined`는 동적 스냅샷을 포함한 누적 관측 수이며 고유 DOM 요소 수가 아닙니다. `content_roots_matched=0`이면 지정한 본문 선택자가 일치하지 않은 상태입니다. 이때도 링크 탐색은 계속합니다.

목록 링크에서 발견한 후보는 `related_content_url`로 상세 주소를 보관합니다. 같은 분류의 상세 후보가 발견되면 목록 후보를 합치고 `summary_observations`에 목록 원문·위치를 보존합니다. 내용이 같아도 서로 다른 상세 게시글은 별개로 유지합니다.
