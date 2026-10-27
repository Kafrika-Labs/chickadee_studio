# Detection regression data

[한국어](README.ko.md) | [English](README.md)

Data for reproducing text obfuscation/hiding and advertising-context analysis, including original snippets, source URLs, benign controls and per-case observation status.

| Dataset | Contents |
| --- | --- |
| [Text/hiding examples](ad-evidence/2026-10-19/README.md) | 43 cases: 38 direct observations and 5 secondary reports |
| [Expanded examples](ad-evidence/2026-10-19-v4/README.md) | 78 cases: 50 suspected ads, 23 benign and 5 secondary reports |
| [Context classification](ml-review/2026-10-21/README.md) | Labels/reference predictions for 73 direct observations |

Expanded examples include earlier data; do not sum folder counts. `import-manifest.json` records data-file SHA-256; `sources.en.md` lists sources. Keep direct DOM observations separate from secondary reporting. These classification figures do not represent independent app performance.

```powershell
.\.venv\Scripts\python.exe scripts/validate_research.py
.\.venv\Scripts\python.exe -m unittest tests.test_research tests.test_ml_review
```
