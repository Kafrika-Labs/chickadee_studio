# Feature scope and result contract

[한국어](requirements.ko.md) | [English](requirements.md)

This document describes the app's inputs, runtime and output contract. See [Architecture](architecture.md) and [Result format](result-format.md).

| Area | Behavior |
| --- | --- |
| Input | One starting website URL |
| Navigation | Same-site pages, posts, comments and iframes |
| Text techniques | `HOMOGLYPH`, `JAMO`, `TRANSPARENT`, `OFFSCREEN` |
| Images | Korean OCR, analyzed separately from original page text |
| Review | Original text, element locations, images, review states and notes |
| Distribution | Windows x64 desktop app with local CPU analysis; no GPU required |
| Optional AI | Groq review using a user-provided key |
| Output | Per-run local JSON, CSV, HTML and Markdown files |

## JSON contract

`result.json` uses UTF-8 without a BOM and has top-level `meta` and `findings` keys. Required metadata: `topic`, `entry_url`, `started_at`, `finished_at`, `elapsed_sec`. `tool_version` is optional. `topic` remains `TOPIC` for compatibility. Timestamps use ISO 8601; elapsed time is a number of seconds.

All pages share one `findings` array, including `[]` when empty. Each finding requires `id`, `url`, `is_violation`, `location`, `evidence_text` and `technique`. IDs must be unique within the file; `technique` is one of the four strings above. Preserve original text before normalization. Findings are unique by `(url, location, technique)`, so two techniques on one element produce separate records.

`location` is a CSS selector identifying one element. Frame paths use `iframe[src="absolute URL"] >>> inner selector`, repeated for nested frames. `url` identifies the parent page. Preserve query values that distinguish posts.

Additional advertising context goes in `result_extra.json` with `technique: "ETC"` and `extra_finding`. For review candidates, `is_violation:false` means illegality has not been established. The [JSON Schema](../schemas/result.schema.json) covers the four text techniques.

## Storage and validation

The app defaults to `Documents/Chickadee/results/<run folder>/`; the CLI defaults to `results`. Open **결과 폴더** (Results folder) to find the actual path. Read `scan-report.json` for completion status, partial results, cancellation, failures and missing coverage. Detection and AI opinions do not replace legal judgment.

[Validation](validation.md) · [Contributing](../CONTRIBUTING.md)
