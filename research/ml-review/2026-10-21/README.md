# Advertising-context classification regression

[한국어](README.ko.md) | [English](README.md)

Labels and reference predictions cover 73 direct observations: 50 suspected ads and 23 benign controls. Five secondary reports are excluded from classification totals.

| File | Contents |
| --- | --- |
| `originals/metrics.json` | Reference-classifier metrics and input hashes |
| `originals/predictions.jsonl` | Per-case labels and reference predictions |
| `originals/bundled_inputs/` | Original inputs matching predictions |
| `import-manifest.json` | SHA-256 for original JSON/JSONL files |

Validate matching IDs, text and labels, then recalculate the confusion matrix. This compares static text snippets, not rendered DOM/CSS detection or live-site performance.

```powershell
.\.venv\Scripts\python.exe scripts/compare_ml_review.py
.\.venv\Scripts\python.exe -m unittest tests.test_ml_review
```
