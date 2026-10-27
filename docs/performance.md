# Navigation performance and next steps (2026-10-20)

[한국어](performance.ko.md) | [English](performance.md)

Version 0.4.2 prioritizes boards and detail posts, reducing the delay before findings appear while traversing general menus. This improves time to first result and coverage within limits; it is not a claim of a fixed full-site speedup. This is a historical measurement; current image support is described in [Content analysis](content-analysis.md).

## Supplied mock-site comparison

Target: `http://113.198.66.73:18244/`. Sequential Windows source runs used `--settle-ms 100 --interval 0.15 --timeout 150`. Network/server/local load was uncontrolled. Values are individual runs, not repeated averages/percentiles or GUI-default timings.

| Measurement | FIFO, 100-page cap | Content-first, 100-page cap |
| --- | ---: | ---: |
| First ad candidate | 51.972 s | 3.534 s |
| Detail posts visited | 54 | 60 |
| HTML pages visited | 99 | 100 |
| Run time | 115.062 s | 120.422 s |
| Status | Partial | Partial |

FIFO visited login/search/resource pages first and treated JSON API links as HTML targets. Content-first visited boards/posts first. Both stopped at the page cap, not full-site completion. The initial 16 raw candidates included four duplicate list titles.

After list/detail consolidation, the final run recorded **70 pages, 74.047 seconds, 60 detail posts, first candidate at 3.465 seconds and 12 general-ad candidates**. Four list observations remain in detail candidates' `summary_observations`. Post IDs were 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 and 60. Identical text on different posts remains separate.

The final run was still **`partial` due to the page cap**; general menus remained queued. The four obfuscation/hiding techniques had zero findings, separate from general candidates. No administrator answer API, login or reset was used; 12 candidates is not a certified accuracy/recall result.

Open the [saved results](../examples/test-site-2026-10-20/) for CSV/JSON/report data. Import `result.json` in the UI and keep `scan-report.json` alongside it to restore candidates/navigation.

```powershell
.\.venv\Scripts\python.exe -m chickadee --scan 'http://113.198.66.73:18244/' --max-pages 70 --timeout 150 --settle-ms 100 --interval 0.15 --verbose --output-dir artifacts/verify-root
```

For board-only scope, use `/parents/board/index.do?menu_idx=8&manage_idx=106` with `--profile profiles/inuri-test.json --max-pages 100`. This analyzes `.post-detail` while continuing listing-link discovery.

## Supported scope at the time

- Collect DOM links, `data-url`, `data-href`, `data-link`, and literal `location.href` assignments or `location.assign/replace` URLs. Do not evaluate code strings or guess arbitrary function arguments.
- Preserve post IDs/queries and visit discovered same-origin paths, without guessing endpoints.
- Record links, new queue entries, element observations, body-selector matches and duration in UI events and `page_diagnostics`.
- Treat ordinary ad candidates as rule-based review targets, without invented technique codes or legal determinations.

## Improvement priorities recorded at the time

1. Evaluate precision/recall and benign false positives on a separate labeled dataset split by site/text. Research examples and one mock site do not establish general performance.
2. Improve sentence/comment context beyond keywords, promotional terms, URLs and prevention/news rules; prioritize ambiguous cases for review.
3. Expand verified read profiles/fixtures for arbitrary-JS navigation, unconfigured more/comment controls and closed Shadow DOM omissions.
4. Measure browser/DOM bottlenecks before considering bounded parallel collection. This change still scanned one page at a time.
5. Add a separately validated OCR path. At that time image/media/font requests were blocked and image/canvas text was not detected; later releases added OCR.

The Windows app needs no Docker/VM. `deploy/` and `scripts/scan-isolated.ps1` are optional developer paths.
