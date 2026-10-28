# Chickadee Studio user guide

[한국어](desktop.ko.md) | [English](desktop.md)

This guide covers the current desktop app. Start with starting a scan, workflow/OCR and reviewing findings. The app's Korean guide is available under **설정 → 사용 가이드** (Settings → User guide). English explanations below retain key Korean control labels.

## Local development

After preparing the repository's Python environment and installing the desktop dependencies, run:

```powershell
cd C:\Users\castle\Desktop\project\chickadee_studio\desktop
npm run dev
```

On Windows this opens a separate Microsoft Edge development window connected to the real Python scanner. Saving UI source files rebuilds and refreshes the UI; active scans defer refresh until completion. Restart the development window after editing Python backend code. Development preferences and results stay under `artifacts/dev-session`. Existing local model environments are reused without automatically downloading models or registering API keys.

Close the development window or press Ctrl+C to stop. Native file dialogs, OS notifications and separate login windows require the Electron app. This browser preview does not validate Electron installation, signing or native APIs. Its static server binds only to `127.0.0.1`; Python control is not exposed through an HTTP API.

## Contents

1. [Start a scan](#guide-1)
2. [Workflow and OCR](#guide-2)
3. [Speed and runtime](#guide-3)
4. [Progress](#guide-4)
5. [Findings and review](#guide-5)
6. [AI review](#guide-6)
7. [History and export](#guide-7)
8. [Schedules](#guide-8)
9. [Notifications](#guide-9)
10. [App management](#guide-10)

<a id="guide-1"></a>

## 1. Start with a website address

The workflow describes what will run; inspection analysis shows evidence collected during execution.

![Target node and URL panel](../desktop/assets/guide/start.png)

Select **Scan target** in the workflow and enter an `http://` or `https://` URL in the panel on the right, such as `https://example.go.kr`. Open the lower-left gear → Settings → General to check maximum pages, total time and navigation settings. **Back to app** returns to the previous screen.

Choose **Run scan**. Its adjacent menu offers **Scan only this page** and **Demo scan**. The guide also offers **Practice with demo**. If scanning cannot start, check the URL and engine readiness. Some settings cannot change during a run.

<a id="guide-2"></a>

## 2. Fixed workflow and image OCR

![Image OCR node settings](../desktop/assets/guide/ocr.png)

The eight nodes form a fixed pipeline; connections need no manual editing. Target → browser → collection feeds technique detection and advertising classification. Image OCR extracts text for both analyses, followed by deduplication and output. Nodes can be moved without changing the analysis path.

Select the OCR node and enable **이미지 OCR 사용**. PaddleOCR reads Korean text from supported images and CSS backgrounds on the local CPU, without training or API keys. Economy mode skips OCR even when the node is enabled; choose Standard in Settings → General and run **OCR 기능 확인** (Check OCR). Auto selects a mode based on resources.

Failure, unreadable and skipped are distinct from no findings. Check OCR status and evidence. Matching body/OCR findings on the same page, category and text are combined while retaining both sources. Missing models and processing limits can leave images unread.

<a id="guide-3"></a>

## 3. Adjust scanning alongside other work

![General settings](../desktop/assets/guide/general.png)

Maximum pages and the configured deadline bound web collection; reaching them does not establish full-site coverage. Collected text and OCR evidence then receive a separate local analysis budget of up to 30 minutes. Stop remains available during analysis. Navigation waits are Fast 0 seconds, Normal 0.5 seconds and Slow 5 seconds, or 0–30 seconds with the slider. They delay the next page, not current-page processing. Increase the collection deadline when using longer waits.

Auto selects a runtime mode from device resources. Standard uses available OCR and local AI; Economy skips image OCR while preserving technique detection. Check feature status and the OCR check result. Choose the output directory with the folder icon; every run has a separate folder. Disable live browser preview to hide periodic captures. Settings search helps locate speed, OCR and storage controls.

<a id="guide-4"></a>

## 4. Read progress and observed navigation

![Observed exploration graph](../desktop/assets/guide/analysis.png)

Workflow nodes are processing stages. Navigation lists visited and pending URLs. Inspection analysis → Exploration graph shows observed page, state and region relationships from START to END. Select an observation node to inspect text, local AI and available image evidence. If graph limits omit observations, use the omitted counts/limit notices instead of treating displayed nodes as the total workload.

Open preview using the button at the workflow's right edge. Captures are periodic screenshots, not video. The enlarge icon opens a centered modal. **일시정지** pauses after current-page work and cleanup; **검사 재개** resumes. **검사 중단** ends the run and saves collected results. The event history records operations and errors.

<a id="guide-5"></a>

## 5. Review original text and captures

![Findings and evidence panel](../desktop/assets/guide/review.png)

Use the findings filters and text/URL search. **필수 탐지** covers homoglyphs, Jamo, transparent text and offscreen hiding; advertising filters cover context candidates. Review filters can isolate unreviewed items.

Select an item to read original text, reasons, page and technical details. Copy its URL or open it in a browser; opening it visits the real website. Enlarge a screenshot and close with Esc or Close. OCR evidence also shows text coordinates and confidence. Without a stored image, use remaining text/CSS evidence.

Enter notes and choose **검토 확인** (Confirm review) or **제외** (Dismiss). The item menu also saves notes alone or restores unreviewed status. Select several items for bulk review. Detection and AI opinions are evidence for review; human states are saved separately from original findings.

<a id="guide-6"></a>

## 6. Local analysis and optional external review

![AI connection settings](../desktop/assets/guide/ai.png)

Technique rules, local text/visual AI and image OCR need no external key. Processing depends on available models and runtime settings; outputs support review.

For external review, open Settings → AI connection → **Groq API 키 등록**, enter your key and apply settings. Groq is the current provider. Keys stay in session memory and are removed when the app exits. Registration alone neither validates connectivity nor starts review; connectivity is checked on an actual request.

Open a completed scan or history entry, then Inspection analysis → AI review → **전체 검토 시작** (Start full review). This covers collected regions regardless of findings filters. Adjust cumulative call/token limits and inspect usage for the current run. Cancellation or limits preserve completed opinions and remaining counts. Save available report content with **리포트 저장**. Running external review sends selected evidence context to the provider; see [AI review](inspection-agent.md).

<a id="guide-7"></a>

## 7. Keep each result folder together

![Scan history](../desktop/assets/guide/history.png)

Open an entry in **검사 기록** (Scan history). Check completed, partial, cancelled or failed status first; partial means some scope was not collected because of limits or errors. The lower-left import control opens `result.json`. Keep `scan-report.json`, `review.json` and evidence images alongside it to restore details.

**결과 폴더** opens storage. **CSV 저장** exports tabular findings separately from AI reports. Manual review is stored in `review.json`. `result.json` contains technique findings; `scan-report.json` contains candidates, errors, OCR and other detail. Share/preserve the whole run folder to include image evidence. Missing screenshots can indicate capture failure or missing files, not necessarily detection failure; check remaining evidence and events.

<a id="guide-8"></a>

## 8. Schedule a daily 09:00 scan

![Schedule settings](../desktop/assets/guide/schedules.png)

Set the URL, maximum pages, deadline, speed and OCR first. A new schedule saves that workflow; later general changes do not update it. Open Settings → Scheduled scans → **예약 추가**, confirm name/URL, select daily at 09:00 (or once/selected weekdays), then save.

Check time zone, next run and enabled state. The app must be running and the computer awake. Missed occurrences or conflicts with another scan/AI review are skipped without retry. Use the toggle to enable, pencil to edit or trash to delete. Check the last-run message for skip reasons and history for actual results. Scheduling does not register an OS background task or wake the computer.

<a id="guide-9"></a>

## 9. Completion notifications and channel summaries

![Notification settings](../desktop/assets/guide/notifications.png)

Settings → Notifications configures desktop alerts and Slack/Discord independently. Select enabled, sound and suppression while focused, save, then test. If banners do not appear, check OS permission and focus mode.

Enter the channel's webhook URL, enable delivery and save. New webhook storage requires the OS secure store. Completion, cancellation and failure send status and summary counts, without site URLs, original text, images or result files. Use app history for evidence. Scheduled runs follow the same settings; registering webhooks does not start AI review. Do not include real webhook URLs in screenshots or guides.

<a id="guide-10"></a>

## 10. Updates, shortcuts and restart

![Updates](../desktop/assets/guide/updates.png)

Settings → Updates → **업데이트 확인** checks releases. Download is enabled for a supported new asset. After verification, open the file location, close the app and extract the ZIP into a new folder. The current distribution does not replace itself automatically.

Settings → Shortcuts lets you assign commands, inspect conflicts and restore defaults. `Ctrl K` opens quick commands. The lower-left circular arrow restarts the app; it is unavailable during scans. Re-enter your session AI key after restart.

## Login during a scan

A login redirect, HTTP 401 response or visible password field pauses scanning and opens **로그인 필요** (Login required), with a desktop notification where permitted.

1. Choose **로그인** and sign in in the separate window.
2. Return to Chickadee and choose **검사 재개**.
3. The app transfers target-site cookies into the scan browser and retries the original page. It prompts again if login is still required.

Closing the window alone does not resume. **이 페이지 건너뛰기** (Skip this page) records missing authenticated content and continues; stopping saves results. Login wait time does not count toward page/scan deadlines.

The app does not read or save passwords. The login window is an isolated temporary browser session. Cookies live in memory for this scan only, not later or scheduled runs. Cross-domain login redirects are supported, but only target-site cookies are transferred. Popup/localStorage authentication may not work. Unusual login paths without a password field may escape automatic detection; an ordinary login link alone does not trigger it.

## Developer references

[Python manual](manual.md) · [Result format](result-format.md) · [Windows distribution](windows-signing.md) · [Local tool contract](agent-extension.md)

Screenshots use an isolated local demo and current renderer, with no real websites, API keys or webhooks.
