# Result files and fixed columns

[한국어](result-format.ko.md) | [English](result-format.md)

The desktop app saves each run under `Documents/Chickadee/results`; the Python CLI defaults to `results`. Check the UI or `scan-report.json` for completed, partial, cancelled or failed status. An empty CSV from a failed run does not mean no ads were present.

| File | Purpose |
| --- | --- |
| `result.json` | Four text-obfuscation and hiding techniques; original, unnormalized text |
| `result_extra.json` | Additional advertising-context observations using `ETC` and `extra_finding`; review candidates have `is_violation:false` because illegality is not established |
| `scan-report.json` | Status, errors, coverage, computed CSS, ad candidates and file hashes |
| `result.csv` | Technique findings and advertising candidates in 17 fixed columns |

The app also keeps `events.jsonl`, `last-preview.jpg` and `last-preview.json`. Reports include workflow nodes, queued URLs and discovery origins. `review.json` stores review states and notes separately; review actions do not alter original `is_violation` values, evidence or CSV columns. Reports include `run_id`, `paused_sec` and `active_elapsed_sec`; events include run IDs and sequence numbers.

## CSV 1.0 column order

| Column | Value |
| --- | --- |
| `schema_version` | `1.0` |
| `record_kind` | `technique_finding` or `ad_candidate` |
| `id` | Unique record ID |
| `url` | Page where the text was observed |
| `category` | Candidate category: `GAMBLING`, `ADULT`, `LOAN`, `INVESTMENT`, `COMMERCIAL`; empty for technique findings |
| `technique` | `HOMOGLYPH`, `JAMO`, `TRANSPARENT`, `OFFSCREEN`; empty for ordinary candidates |
| `technique_name` | Korean technique or candidate label |
| `is_violation` | `true` for suspected technique findings; empty (undetermined) for ordinary candidates |
| `review_required` | `true` when human review is needed |
| `evidence_text` | Original element text |
| `location` | CSS selector including nested iframe paths |
| `matched_keywords` | JSON array of matching keywords |
| `style_reasons` | JSON array of style/context reasons |
| `frame_depth` | Iframe depth; 0 at the top level |
| `observed_at` | Observation timestamp, ISO 8601; empty in older results without it |
| `rules_version` | Rules version |
| `tool_version` | App version |

CSV uses UTF-8 with a BOM, commas and CRLF. Commas, quotes and multiline text follow CSV quoting rules; arrays are JSON strings within cells. The machine-readable definition is [result-csv.columns.json](../schemas/result-csv.columns.json).

Potential spreadsheet formulas beginning with `=`, `+`, `-`, `@`, etc. receive a leading apostrophe **only in CSV**. JSON and report evidence remain unchanged. Files are written to temporary files and then replaced. Check `result_sha256` and `csv_sha256` in the report if replacement is interrupted.

## Advertising candidates and text techniques

Visible casino sign-up ads, loan recruitment, guaranteed investment returns and purchase/recommendation prompts can be review candidates. Without evidence of obfuscation or hiding, the app does not assign a technique code. Candidates are not legal determinations.

Candidate text appears in `ad_candidates` in `scan-report.json`. Titles and bodies are grouped into article/comment scopes where possible; a scope with a technique finding does not also produce a duplicate candidate row. Markup limits scope and context accuracy. Preserve run duration, page counts and completion status with results.

## OCR and navigation diagnostics

`ocr_images` stores image IDs, `image_sha256`, `relative_path`, dimensions, `lines` (text, confidence from 0 to 1 and four-corner coordinates), JPEG previews and status. Coordinates use original pixels before resizing. `ocr_summary` counts processing and failures. Image candidates link through `source_kind=image_ocr` and `image_id` without changing the four-technique schema or 17 CSV columns.

`crawl_summary` records discovered valid URLs, visits and remaining queue size. `page_diagnostics` records requested/final URLs, HTTP status, collected links, new queue entries, element observations and duration. `elements_examined` includes dynamic snapshots and is not a unique-element count. `content_roots_matched=0` means the configured body selector did not match; link discovery still continues.

List-page candidates retain detail URLs in `related_content_url`. If a matching category is found on the detail page, the listing candidate is merged and its text/location retained in `summary_observations`. Separate posts remain separate even with identical text.
