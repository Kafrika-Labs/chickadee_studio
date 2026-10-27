# Architecture

[한국어](architecture.ko.md) | [English](architecture.md)

Chickadee Studio combines an Electron UI with a Python inspection engine. It analyzes DOM, CSS and images collected by Chromium and stores original text and evidence in JSON, CSV and scan history.

![Chickadee Studio architecture](assets/architecture.png)

This is the overall design. The current release applies OCR only to images; page text goes directly to rules and ML. The Windows package includes a Korean Laya model and standalone CPU runtime. Results are local per-run files. Groq is called when the user starts review.

| Component | Location | Role |
| --- | --- | --- |
| UI and app shell | `desktop/src`, `desktop/electron` | Workflow, evidence, history, review and login window |
| Bridge and control | `chickadee/bridge.py`, `control.py` | JSONL communication, start/stop/pause and per-run storage |
| Navigation and collection | `scanner.py`, `extract.js`, `profiles.py` | Same-site pages, posts, comments, iframes, original text, CSS and locations |
| Authentication | `authentication.py`, `desktop/electron/login.cjs` | Separate login window and current-scan cookies |
| Text techniques | `detection.py`, `rules.json` | Homoglyphs, decomposed Jamo, transparent text and offscreen hiding |
| Image OCR | `image_ocr.py`, `ocr_worker.py` | Korean PaddleOCR CPU inference on images |
| Local AI | `local_ai.py`, `chickadee/data` | Text-context and visual review signals |
| Local context review | `laya_review.py`, `laya_worker.py` | Trained Laya CPU inference, status and errors |
| Optional AI review | `agent.py`, `exploration.py` | Groq evidence lookup and bounded same-site exploration |
| Results and review | `exports.py`, `reviews.py`, `inspection.py` | Outputs, evidence, screenshots, review states and notes |

Original text, URLs, element locations and OCR coordinates are preserved. OCR text is separate from visual image analysis and does not prove the original Unicode code points used in an image.

The UI and engine communicate over standard input/output. Collected site HTML is not executed in the app UI; evidence views use saved text and images. Core scanning requires neither an external AI key nor a GPU. User-initiated Groq review does not overwrite detection results or human review.

[Desktop guide](desktop.md) · [Result format](result-format.md) · [AI review and usage](inspection-agent.md) · [Local tool contract](agent-extension.md)
