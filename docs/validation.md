# Testing

[한국어](validation.ko.md) | [English](validation.md)

Build and validation results are available in [GitHub Actions](https://github.com/Kafrika-Labs/chickadee_studio/actions) and [releases](https://github.com/Kafrika-Labs/chickadee_studio/releases). Run commands from the repository root.

## Python

On Windows, use the runner that saves per-module logs:

```powershell
./scripts/test-python.ps1
```

Elsewhere:

```sh
.venv/bin/python -m unittest discover -s tests -v
```

## UI and packaged app

```sh
npm --prefix desktop test
npm --prefix desktop run build
npm --prefix desktop run smoke
```

To test a package, set `CHICKADEE_PACKAGED_EXE`. These integration checks launch the actual app and a local test site:

```powershell
$env:CHICKADEE_PACKAGED_EXE = 'C:\Chickadee\Chickadee.exe'
node desktop/tests/smoke.cjs
node desktop/tests/inspection-smoke.cjs
node desktop/tests/ocr-smoke.cjs
node desktop/tests/runtime-smoke.cjs
node desktop/tests/login-smoke.cjs
```

| Area | Coverage |
| --- | --- |
| Text techniques | Homoglyphs, Jamo, transparency, offscreen hiding, original text/selectors and combined techniques |
| Navigation/login | Posts, iframes, dynamic actions, login wait/resume/skip, errors and deadlines |
| OCR/local AI | Korean text, coordinates, confidence, unreadable/skipped/cancelled processing and input-source separation |
| Results/review | JSON schema, UTF-8, CSV columns, history reopening, review states, notes and hashes |
| AI review | Tool permissions, usage/visit limits, invalid responses, errors and cancellation |
| App | Settings, scheduling, notifications, runtime modes, keyboard interaction and restart |

Default regression checks do not call paid AI. Live Groq validation runs only when explicitly invoked using the separate command in [AI review](inspection-agent.md).
