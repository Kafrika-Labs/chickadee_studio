# Windows quick start

[한국어](quickstart-windows.ko.md) | [English](quickstart-windows.md)

1. Download the Windows x64 ZIP from the [latest release](https://github.com/Kafrika-Labs/chickadee_studio/releases/latest) and extract the entire archive.
2. Run `Chickadee.exe`. If Windows app control blocks it, use `ChickadeeRuntime.exe` in the same folder. This official unmodified runtime runs the same app and models without changing security settings. Keep `resources` and all accompanying files. Close any previous instance first.
3. Enter a URL and choose **Run scan**. The adjacent menu offers **Demo scan** for a local example.
4. Results are saved under `Documents/Chickadee/results`, in a separate folder per run. Open **결과 폴더** (Results folder) to see the actual location.

**Site login:** When prompted, sign in in the separate login window, then choose **검사 재개** (Resume scan) in the app.

**Output paths:** `Documents/Chickadee/results/<run folder>/result.json` holds the four text techniques. `result_extra.json` holds additional advertising-context observations. `result.csv` and `scan-report.json` are in the same folder. A custom output directory also uses per-run folders. For additional observations, `is_violation:false` means illegality has not been established; it does not certify a legitimate advertisement.

No separate Python, Docker, VM or GPU installation is required. The package includes Korean OCR, local ML, the trained Laya model and a standalone CPU runtime.

Select an image-based finding in **광고 의심** (Suspected ads) to inspect the original image, text coordinates and recognition confidence. OCR runs locally at no additional service cost. Text goes directly to ML; images go through OCR first. With no images, the OCR node shows **이미지 없음** (No images). Laya follows ML. See [Local Laya setup](content-analysis.md#local-laya-setup).

## Optional Groq review

Core scanning needs no API key. The optional provider is Groq, the default model is `openai/gpt-oss-20b`, and the variable name is `GROQ_API_KEY`. Register a key in AI settings or explicitly select an external file:

```dotenv
GROQ_API_KEY=YOUR_GROQ_API_KEY
```

```powershell
.\Chickadee.exe --groq-env-file 'C:\Chickadee\.env'
```

Edit the file and restart to replace the key without rebuilding. The app does not search arbitrary environment variables or other projects for keys. Reading the file makes no API request; the default limit remains 6 calls and 24,000 tokens per scan.

Keys entered in settings are masked and kept only in session memory. They are not saved in app files, results or reports. Requests use HTTPS. This is non-persistent key handling, not encrypted key storage; the app does not encrypt external `.env` files either.

## First use

The first-run guide covers starting scans, OCR, speed, review, AI, history, scheduling, notifications and updates. **Practice with demo** starts the bundled example. Close it with **닫기** or Esc and reopen it through **설정 → 사용 가이드** (Settings → User guide). Once dismissed, it does not automatically reopen. Viewing the guide does not start a scan.

The workflow follows a fixed order; enable image OCR in its node settings. Inspect page captures, navigation paths, HTTP responses and evidence in the app. Use **일시정지**, **검사 재개** and **검사 중단** to pause, resume and stop. Review findings individually or in bulk and save notes. `Ctrl K` opens quick commands. Scan settings and the output directory persist.

This package is the Windows x64 Electron app. `ChickadeeBot.exe` and its older options belong to the Python/Tkinter compatibility edition.

[Desktop guide](desktop.md) · [Result format](result-format.md) · [Python compatibility manual](manual.md)
