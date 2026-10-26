# Running, building and using the Python edition

[한국어](manual.md) | [English](manual.en.md)

> This manual covers the Python CLI/Tkinter compatibility edition. For the current Windows Electron app, see [Quick start](quickstart-windows.en.md) and [Desktop guide](desktop.en.md).

**Storage:** The executable writes `result.json`, `result_extra.json`, `scan-report.json` and `result.csv` into `results` beside the executable. Source runs default to the repository's `results`. Change this with the UI's output-folder setting or `--output-dir`. Files are replaced when a run ends. General-ad observations remain review candidates in `result_extra.json`, report `ad_candidates` and CSV, not confirmed illegal ads. Electron instead defaults to `Documents/Chickadee/results/<run folder>`. See [17 fixed columns](result-format.en.md).

## Windows executable

1. Copy the entire `dist/ChickadeeBot` folder or extract the distribution into a writable folder, including `_internal`.
2. Run `ChickadeeBot.exe`. No Python, API key or GPU is needed; the browser is included.
3. Choose **로컬 데모 준비** (Prepare local demo), then **탐지 시작** to inspect a simulated site.
4. For an external site, enter its URL and start scanning. No VM or extra option is needed.
5. Select a result for original text, page URL and selector. Use the technique filter to narrow results.
6. Check completion and saving status before using `result.json`. For partial, cancelled or failed runs, inspect omissions/errors in `scan-report.json`.

Defaults: UI 100 pages (CLI 50), 300 seconds for web collection, 15 seconds/page, 500 ms settle time, 1 second between pages and one retry. DOM snapshots are inspected before/after scrolling and read actions. Web collection allows up to 1,800 seconds. ML and Laya receive a separate bounded offline analysis budget of up to 1,800 seconds. Stop preserves collected results and completed analysis. `elapsed_sec` includes preparation, collection, offline analysis and cleanup but excludes output-file writing.

## Run from source

The reference environment is Windows 11 x64 with Python 3.12. In repository-root PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
.\.venv\Scripts\python.exe -m playwright install chromium --only-shell
.\.venv\Scripts\python.exe -m chickadee --demo
```

If `py` is unavailable, use the installed Python 3.12 path. Virtualenv activation is unnecessary. Install the browser once; scans do not use your Chrome profile or tabs.

```powershell
# Start the local demo site, scan, save and stop the demo site.
.\.venv\Scripts\python.exe -m chickadee --demo --cli --output-dir artifacts/demo

# Inspect a website.
.\.venv\Scripts\python.exe -m chickadee --scan 'https://www.korea.kr/' --network --profile profiles/public-site.json --max-pages 3 --timeout 120 --interval 2 --output-dir artifacts/scan
```

Exit codes: completed `0`, partial/cancelled `2`, failed `1`. Packaged executables accept the same arguments but have no console; read result/report files. Invalid input that prevents startup creates no new results.

## Request boundaries and profiles

External URLs are allowed by default. `--network` remains for compatibility; `--local-only` permits loopback only. Requests are limited to the input origin and `allowed_resource_origins`. Media/fonts, WebSockets and methods other than GET/HEAD are blocked. The browser profile is temporary; service workers and downloads are disabled. This is an application request policy, not OS/VM isolation, and cannot prevent every browser vulnerability or script side effect.

Blocked external CSS/scripts/frames can omit content, producing `partial`. Review blocks and allow only needed origins. Certificate errors are not ignored. GETs/buttons may still change site state, so configure only verified read controls.

`profiles/public-site.json` supplies default settings. Adapt selectors in `profiles/read-controls.example.json` before use.

| Setting | Meaning |
| --- | --- |
| `path_prefix` | Navigation path scope; query values are preserved |
| `controls` | Verified CSS selectors for read actions such as more comments/next page; each must match one element |
| `max_actions` | 0–30 read actions; form submission controls are rejected |
| `scroll_steps` | 0–20 scroll checks; continuing changes at the cap are reported |
| `allowed_resource_origins` | Required extra resource origins; empty by default |
| `content_selector` | Analyze only the selected body; nonmatching list pages still supply links. Null means whole body; `profiles/inuri-test.json` covers the supplied test board |

After a configured read action changes DOM/URL, inspection repeats. POST comment APIs are blocked until separately supported. Profiles cannot execute arbitrary JavaScript/Python.

Use `--rules chickadee/rules.json` to replace the dictionary; follow its `version`, `keywords`, `prevention` and `promotion` structure. Keyword variants retain source spans and unnormalized output. Even short keywords need nearby promotional context. Prevention rules exclude prevention/reporting criticism and some legitimate product contexts. The default dictionary handles `ㅋr지노`, `ㅂr카라` and partial Jamo; homoglyph `CΟΜ`/`сом` is supporting evidence only alongside nearby advertising evidence. Textarea edit buffers are excluded. See [Research data](../research/README.en.md).

HTTP 429 from a page or asynchronous response stops retries/new requests and later pages for that origin, regardless of `--retries`. `stopped_origins` records cause URL, raw Retry-After and policy; status becomes partial/failed. Already-started requests may continue. Respect the server's wait/access policy before another run.

**결과 불러오기** (Import results) reads local JSON without visiting the web. It validates schema/duplicates and rejects mismatching report SHA-256. Results without reports can open but lack verified completion status. Files over 20 MB are rejected.

## Interpreting output

PaddleOCR reads Korean text from PNG/JPEG/WebP/GIF and CSS background images on CPU. In suspected ads, select an image finding for the original image, boxes and line confidence; select a line to highlight it. Saved history restores the same evidence. Models are included in Windows packages; source environments prepare pinned models with `python scripts/prepare_ocr_models.py` after installing dependencies.

`ocr_images` stores text, coordinates, confidence and source hashes; `ocr_summary` stores counts. Originals are in `evidence/images/`. OCR candidates use `source_kind=image_ocr` and `image_id`, retaining existing CSV columns.

- `result.json`: four text techniques, UTF-8 without BOM, `meta`/`findings`, including an empty array when no findings exist.
- `scan-report.json`: `completed`, `partial`, `cancelled` or `failed`, visited/remaining pages, errors, limits and paths.
- `evidence_details`: keywords/source spans, CSS/reasons, frame inheritance and read-action history. Reports also retain `rules_version`, `profile`, `retry_count` and `blocked_requests`.
- `contextual_homoglyphs`: contextual COM variants and spans, separate from keyword transformations. CSS evidence records viewport/document coordinates, scrolling and contributing ancestor styles, distinguishing small boxes from small fonts and retaining measured values such as `opacity:0.003`.
- `result_sha256` must match the bytes of `result.json`; interrupted writes can leave mismatched pairs.
- `is_violation:true` denotes a rule-based suspected finding, not a legal determination.
- Frame selectors record absolute `src`; resolve relative DOM attributes to absolute URLs when matching again.

Permission failures/full disks show save errors. Do not mistake previous files for new results. Existing files are not deleted before a run; successful/partial saves replace them.

## Tests and Windows build

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1
```

Output: `dist/ChickadeeBot/ChickadeeBot.exe`. Build on Windows and distribute the entire folder. Initial browser installation/build requires network access. PyInstaller collects installed Playwright browsers; extra browsers can enlarge the package.

```powershell
$taskRun = Start-Process -FilePath '.\dist\ChickadeeBot\ChickadeeBot.exe' -ArgumentList '--demo --cli --output-dir artifacts/frozen-demo' -WindowStyle Hidden -Wait -PassThru
$taskRun.ExitCode
Get-Content artifacts/frozen-demo/scan-report.json
```
