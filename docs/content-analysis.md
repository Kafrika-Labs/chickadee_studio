# Direct image and text analysis

[한국어](content-analysis.ko.md) | [English](content-analysis.md)

`content.analyze` is a local backend tool for analyzing text and images without scanning a website. It uses PaddleOCR, text detection rules, an advertising-context classifier and a visual classifier. It makes no Groq requests.

## Calls

Start a job through the existing stdio JSON-lines backend. At least one of `text` and `image_data_url` is required; both are allowed.

```json
{"id":1,"method":"content-analyze","params":{"text":"caѕino 가입 보너스"}}
```

Poll using the returned `result.analysis_id`, a newly generated 32-character lowercase hexadecimal ID:

```json
{"id":2,"method":"content-analyze","params":{"analysis_id":"ACTUAL_ANALYSIS_ID"}}
```

Add `"cancel":true` to cancel. The equivalent `tool-call` uses `name: "content.analyze"` and `arguments: {...}`. Electron exposes `window.chickadee.analyzeContent({...})`:

```javascript
const job = await window.chickadee.analyzeContent({
  text: '도서관 이용 안내',
  image_data_url: imageDataUrl,
});
// Wait for a completed content_analysis event, or poll by analysis_id.
const state = await window.chickadee.analyzeContent({ analysis_id: job.analysis_id });
```

Text is limited to 4,000 characters and image data URLs to 900,000 characters. Only base64 PNG/JPEG/WebP/GIF data URLs are accepted. The backend does not open file paths or remote image URLs. Existing stdio line-size limits apply.

## Returned data

The start response is `started`. Job states are `running`, `completed`, `partial`, `failed` and `cancelled`. Finished analysis is in `result`.

| Field | Meaning |
| --- | --- |
| `sources[]` | Separate originals/provenance for `provided_text` and `image_ocr` |
| `sources[].unicode_analysis` | Character-obfuscation findings |
| `sources[].ad_candidates` | Context-rule review candidates |
| `sources[].local_ai.text` | Local text-classifier observations |
| `sources[].local_ai.laya` | Installed, independently validated Laya context review; `unavailable` if missing or awaiting validation |
| `sources[].original_unicode_observed` | True for entered text, false for OCR |
| `image.local_ai.visual` | Visual observations for the image itself |
| `image.ocr` | Recognition status, text, coordinates and confidence |
| `sources[].ocr` | Confidence threshold, accepted/rejected lines, average confidence and truncation |
| `runtime_environment` | Applied mode and feature availability |
| `paid_requests` | Always 0 |

Entered text and OCR are not mixed into one advertising context. OCR characters cannot establish the image's original Unicode code points. Visual classification is a review signal, not a confirmed phishing finding.

The total job limit is 150 seconds. OCR failure preserves entered-text results and returns `partial`. Unreadable text returns `recognition_status: "unreadable"` and `partial`, distinguishing no detected text regions from low confidence. Economy mode retains visual classification but returns OCR `skipped` with `reason: "economy"`. Progress events contain only ID, status and stage, not raw images or text.

One background analysis runs at a time. It cannot start alongside a site scan, agent or OCR runtime check; status queries remain responsive. Only the last job is retained in memory, replaced by a new job. Inputs and results are not automatically saved to scan history.

## Shared processing with website scans

Images follow `OCR → ML → Laya`; entered text bypasses OCR. Input arguments, polling, `result.json` and CSV columns remain unchanged. Laya adds `local_ai.laya` evidence without overwriting original text, rule findings or human review. It is independent of Groq and uses no key, API or internet connection.

Laya reviews advertising context regardless of legality, including products, services, bookings and financial recruitment. Positive signals add `AI_CONTEXT` candidates where no category-specific candidate exists. The general-ad criterion differs from the original harmful-promotion criterion: the score is `uncalibrated_general_ad_score`, without the old calibration temperature. Harmful-promotion evaluation metrics do not establish general-ad detection performance.

Every nonempty collected text region and finding is analyzed sequentially without a fixed item cap. Identical text reuses results; the model loads once and processes small batches. Completed/total/unprocessed counts are retained, including completed results on cancellation. Short OCR symbols are not promoted to candidates just because they have a score. Time/memory shortages and OCR errors do not imply normal content. Imported historical results are not automatically reanalyzed.

The findings UI separates **일반 광고** (General ads) and **불법 의심** (Suspected illegal ads), with separate counts. General ads include AI candidates without a known category and do not establish legality. The suspected group includes gambling, adult, drug, account-trading and some high-risk finance contexts. Loans/investments alone are insufficient. Technique filters remain separate.

Financial topics such as stock recommendations or investment education combined with trial/class benefits and sign-up/application/site-visit prompts produce `INVESTMENT` candidates. Without separate high-risk claims such as guaranteed principal/returns, they appear under general ads. Prevention, warnings, quoted ads and criticism are excluded.

Product-detail images can be reviewed even with cropped brands/prices. Before/after comparisons with efficacy claims, product types with claimed effects or repeated benefits, and seller-selected positive purchase/use reviews can produce `COMMERCIAL` candidates. Disease names alone, general health information and individual reviews do not suffice. These are general-ad candidates, not verified efficacy or illegality.

Promotions with prices/discounts/benefits, purchase screens with prices, immediate/additional coupons, medical/beauty special prices, sleep-benefit sales copy with pack quantities/rewards, and service-provider promotion can be general ads. Account transfer combined with payment/recruitment can indicate suspected account trading.

Separately retained OCR text still goes through text models and Laya when exploration-packet storage is full; graph/packet caps are unchanged. Time, memory and cancellation can leave AI review incomplete while preserving rule candidates.

Model-only OCR candidates need at least 8 trimmed characters and 4 letters/digits. Symbols such as `+` are not promoted even with visual signals. This context-model threshold does not suppress short, explicit discount/transaction rule findings.

High model scores alone do not promote search tags, resource lists or award announcements. Model-only candidates need a commercial subject plus benefit/transaction or product-trial context. Images identified by DOM role as logos/navigation are excluded from candidate generation. Historical display also considers UI roles and repeated shared imagery, without site/image-filename blacklists; original scores are preserved.

Findings use one row per URL, preserving queries that distinguish posts and collecting title/body/comment/OCR and multiple categories in detail evidence. Original records/text remain intact. Page-level review applies to all member records; JSON/CSV stay per-evidence.

New scans capture the visible DOM element and restore scroll afterwards, without changing hidden styles. Evidence links individual locations and capture IDs. Historical viewport captures are labeled page references, not element captures. Text/location evidence survives capture failures or storage limits.

Category-specific OCR context uses the recognized text as evidence. Visual scores alone cannot establish advertising or a gambling/adult/drug topic; they produce separate `IMAGE_REVIEW` entries in **이미지 검토** (Image review), excluded from general/suspected-ad counts. Photo-only signals are deduplicated by image hash, retaining scores in `local_ai.content_visual` and per-page images. Historical display follows the same rule without modifying original files.

## Local Laya setup

Windows releases include the trained Korean model and standalone CPU executable; extract the complete ZIP to use Laya after ML without separate Python/model installation. macOS source runs require compatible Python and CPU libraries and cannot use the Windows executable.

The distribution loads trained FP32 weights once after validating hashes and independent evaluation records. It downloads no models and makes no external API calls at runtime. With less than 3 GB available memory, it records that state and preserves OCR/RF results.

When the model is connected, 40% of the scan deadline is reserved for final analysis. New installations default to 1,800 seconds; existing settings persist. Laya continues through the remaining time, allowing up to 120 seconds per batch response and reusing the process. Cancellation is forwarded promptly; unprocessed items are not marked normal.

For source development, use the [Korean context model pack](https://github.com/Kafrika-Labs/chickadee_studio/releases/tag/laya-ko-v1). Extract `laya-config.zip`, put `best.safetensors` in its root and `model.safetensors` under `base/`.

```powershell
py -3.12 -m venv .venv-laya
.\.venv-laya\Scripts\python.exe -m pip install -r requirements-laya.txt
.\.venv\Scripts\python.exe scripts/activate_laya.py --bundle 'C:\models\laya' --python .\.venv-laya\Scripts\python.exe
```

This registration is for source runs. Windows packages default to `resources/laya-model` and `resources/laya/ChickadeeLaya.exe`. User model/Python paths and `CHICKADEE_LAYA_CONFIG` remain for development compatibility.

Website scans and direct analysis use OCR lines with confidence at least 0.55 and record truncation at 4,000 characters. Site evidence retains image SHA-256 and OCR engine/model/confidence metadata.

Agent exploration also retains originals and OCR observations in `agent.json` and the run's evidence folder. Lookup uses namespaced IDs such as `agent_0_...` to avoid collisions. Reload validates paths, hashes and metadata. Original results, CSV and scan reports are unchanged; existing Groq call/token/visit limits apply.
