# Feature guide

[한국어](features.ko.md) | [English](features.md)

![Full service demonstration](assets/demos/overview.webp)

[README](../README.md) | [Installation](quickstart-windows.md) | [Result format](result-format.md)

## Contents

1. [Workflow and navigation](#1-workflow-and-navigation)
2. [Text obfuscation and hiding](#2-text-obfuscation-and-hiding)
3. [Image text extraction](#3-image-text-extraction)
4. [Local analysis and AI review](#4-local-analysis-and-ai-review)
5. [Review and output](#5-review-and-output)
6. [Settings and convenience](#6-settings-and-convenience)
7. [Feature demonstrations](#7-feature-demonstrations)
8. [Full graph details](#8-full-graph-details)

## 1. Workflow and navigation

### Scan workflow

Set the URL and scan conditions. Body text goes directly to ML; images pass through OCR first, and OCR is skipped when no images exist. Posts and comments are both inspected, including lazy-loaded comments and configured read-more actions. Site-specific profiles may be needed.

![Scan workflow](assets/demos/01-pipeline.png)

### Navigation paths

Distinguish visited pages from queued URLs and inspect page status.

![Navigation paths](assets/demos/11-navigation.png)

### Exploration graph

Observed edges connect page visits and collection actions. Select nodes for details, pan and zoom.

![Exploration graph](assets/demos/09-exploration.png)

### Full graph

This 100-page scan shows 371 observed nodes. START and END are visual guides. The run is partial because page and collection limits were reached.

![Full graph](assets/demos/20-full-graph-overview.png)

### Event history

Read collection, analysis and blocked-request events in execution order.

![Event history](assets/demos/10-events.png)

## 2. Text obfuscation and hiding

### Offline demo

Start the bundled demo from the menu beside Run scan to inspect obfuscation/hiding without internet access.

![Offline demo](assets/demos/21-demo-pipeline.png)

### Four techniques

Detect homoglyphs, decomposed Jamo, transparent text and offscreen hiding. This screenshot uses local validation pages.

![Four techniques](assets/demos/22-four-techniques.png)

### Original text and location

Select a finding for source text, URL, element selector and detection reasons.

![Original text and location](assets/demos/06-evidence.png)

### Enlarge captures

Inspect the screenshot from observation time. Hidden elements are not forced visible; compare transparent/offscreen text with original text and CSS.

![Enlarge captures](assets/demos/07-evidence-zoom.png)

## 3. Image text extraction

### Korean recognition

PaddleOCR displays recognized Korean text and its regions. This example uses a Korean validation image.

![Korean recognition](assets/demos/23-ocr-boxes.png)

### Line inspection

Select a recognized line to highlight its position in the original image. Confidence is the recognition model score.

![Line inspection](assets/demos/24-ocr-line.png)

### Image statistics

Processed, unreadable, failed and skipped counts are separate. OCR counts are not visual-topic classifications or legal findings.

![Image statistics](assets/demos/25-ocr-statistics.png)

## 4. Local analysis and AI review

### ML statistics

Inspect processed-region counts and score distributions for text TF-IDF/RF, followed by installed Korean Laya context review. Scores are not accuracy or illegality probabilities. A real app scan processed eight Laya contexts on local CPU without external API calls. Windows includes the model and CPU runtime. See [Laya setup](content-analysis.md).

![ML statistics](assets/demos/02-statistics.png)

### Groq opinions

User-started review reads collected originals and analysis. It can follow bounded discovered links on the same site when needed, preserving original findings and user notes.

![Groq opinions](assets/demos/03-groq-report.png)

### Cumulative usage

The default per-scan budget is 6 requests and 24,000 tokens. Limits preserve partial review and unreviewed counts. This example used 5 requests and 6,165 tokens.

![Cumulative usage](assets/demos/04-budget.png)

### API key settings

Enter your Groq key in AI settings. The input is masked and keys are not saved in results/reports. Core scanning, OCR and ML need no API key.

![API key settings](assets/demos/14-settings-groq.png)

## 5. Review and output

### Page preview

Inspect captures from the scan browser.

![Page preview](assets/demos/27-preview.png)

### Enlarge preview

Read the capture and associated URL together.

![Enlarge preview](assets/demos/28-preview-zoom.png)

### Review states and notes

Save per-item states and notes without changing original findings.

![Review states and notes](assets/demos/29-review-saved.png)

### Bulk review

Select displayed findings and apply a review state together.

![Bulk review](assets/demos/30-bulk-selection.png)

### CSV export

Export the fixed 17-column format. See [sample CSV](assets/demos/sample-results.csv) for columns and serialized values.

![CSV export](assets/demos/31-csv-export.png)

### Scan history

Reopen completed and partial runs with original text, images and opinions.

![Scan history](assets/demos/12-history.png)

### Restore review

Reload saved review states and notes.

![Restore review](assets/demos/32-review-reload.png)

### Save reports

Save HTML and Markdown with processing statistics, AI opinions, originals and captures.

![Save reports](assets/demos/05-report-saved.png)

<details>
<summary><strong>Full HTML report</strong></summary>

![Standalone HTML report](assets/demos/26-standalone-report.png)

</details>

The [sample HTML report](assets/demos/sample-report.html) opens offline and can be printed to PDF from a browser.

## 6. Settings and convenience

### Runtime and scan settings

Choose a mode appropriate for CPU/memory, scan scope and output location.

![Runtime and scan settings](assets/demos/13-settings-general.png)

### Notifications

Configure completion alerts and channel delivery. External channels work only after user setup.

![Notifications](assets/demos/15-settings-notifications.png)

### Scheduled scans

Run saved configurations on a schedule while the app is running.

![Scheduled scans](assets/demos/16-settings-schedule.png)

### Shortcuts

Configure navigation and frequently used commands.

![Shortcuts](assets/demos/17-shortcuts.png)

### Updates

Check new releases and download status.

![Updates](assets/demos/18-updates.png)

### Quick commands

Use Ctrl K to search navigation, import and export commands.

![Quick commands](assets/demos/19-command-palette.png)

## 7. Feature demonstrations

Each recording shows the feature running in the actual app. Korean validation-page OCR/Laya processing is separate from saved website Groq results. Recapturing made no additional API calls.

### 01. Enter a target

![Enter a target](assets/demos/stage-01-target.webp)

### 02. Explore posts and comments

![Explore posts and comments](assets/demos/stage-02-exploration.webp)

### 03. Detect obfuscation and hiding

![Detect obfuscation and hiding](assets/demos/stage-03-detection.webp)

### 04. Extract image text

![Extract image text](assets/demos/stage-04-ocr.webp)

### 05. ML and Laya context analysis

![ML and Laya context analysis](assets/demos/stage-05-analysis.webp)

### 06. Additional Groq review

![Additional Groq review](assets/demos/stage-06-groq.webp)

### 07. Review and export

![Review and export](assets/demos/stage-07-report.webp)

[Full video](assets/demos/service.webm) | [Original GIF](assets/demos/overview.gif)

## 8. Full graph details

Overlapping captures cover 371 observed nodes plus visual START and END markers. See [node/capture metadata](assets/demos/graph-capture.json) for observation coverage.

<details>
<summary><strong>60 enlarged captures</strong></summary>

![Graph detail 01](assets/demos/graph-tile-001.png)

![Graph detail 02](assets/demos/graph-tile-002.png)

![Graph detail 03](assets/demos/graph-tile-003.png)

![Graph detail 04](assets/demos/graph-tile-004.png)

![Graph detail 05](assets/demos/graph-tile-005.png)

![Graph detail 06](assets/demos/graph-tile-006.png)

![Graph detail 07](assets/demos/graph-tile-007.png)

![Graph detail 08](assets/demos/graph-tile-008.png)

![Graph detail 09](assets/demos/graph-tile-009.png)

![Graph detail 10](assets/demos/graph-tile-010.png)

![Graph detail 11](assets/demos/graph-tile-011.png)

![Graph detail 12](assets/demos/graph-tile-012.png)

![Graph detail 13](assets/demos/graph-tile-013.png)

![Graph detail 14](assets/demos/graph-tile-014.png)

![Graph detail 15](assets/demos/graph-tile-015.png)

![Graph detail 16](assets/demos/graph-tile-016.png)

![Graph detail 17](assets/demos/graph-tile-017.png)

![Graph detail 18](assets/demos/graph-tile-018.png)

![Graph detail 19](assets/demos/graph-tile-019.png)

![Graph detail 20](assets/demos/graph-tile-020.png)

![Graph detail 21](assets/demos/graph-tile-021.png)

![Graph detail 22](assets/demos/graph-tile-022.png)

![Graph detail 23](assets/demos/graph-tile-023.png)

![Graph detail 24](assets/demos/graph-tile-024.png)

![Graph detail 25](assets/demos/graph-tile-025.png)

![Graph detail 26](assets/demos/graph-tile-026.png)

![Graph detail 27](assets/demos/graph-tile-027.png)

![Graph detail 28](assets/demos/graph-tile-028.png)

![Graph detail 29](assets/demos/graph-tile-029.png)

![Graph detail 30](assets/demos/graph-tile-030.png)

![Graph detail 31](assets/demos/graph-tile-031.png)

![Graph detail 32](assets/demos/graph-tile-032.png)

![Graph detail 33](assets/demos/graph-tile-033.png)

![Graph detail 34](assets/demos/graph-tile-034.png)

![Graph detail 35](assets/demos/graph-tile-035.png)

![Graph detail 36](assets/demos/graph-tile-036.png)

![Graph detail 37](assets/demos/graph-tile-037.png)

![Graph detail 38](assets/demos/graph-tile-038.png)

![Graph detail 39](assets/demos/graph-tile-039.png)

![Graph detail 40](assets/demos/graph-tile-040.png)

![Graph detail 41](assets/demos/graph-tile-041.png)

![Graph detail 42](assets/demos/graph-tile-042.png)

![Graph detail 43](assets/demos/graph-tile-043.png)

![Graph detail 44](assets/demos/graph-tile-044.png)

![Graph detail 45](assets/demos/graph-tile-045.png)

![Graph detail 46](assets/demos/graph-tile-046.png)

![Graph detail 47](assets/demos/graph-tile-047.png)

![Graph detail 48](assets/demos/graph-tile-048.png)

![Graph detail 49](assets/demos/graph-tile-049.png)

![Graph detail 50](assets/demos/graph-tile-050.png)

![Graph detail 51](assets/demos/graph-tile-051.png)

![Graph detail 52](assets/demos/graph-tile-052.png)

![Graph detail 53](assets/demos/graph-tile-053.png)

![Graph detail 54](assets/demos/graph-tile-054.png)

![Graph detail 55](assets/demos/graph-tile-055.png)

![Graph detail 56](assets/demos/graph-tile-056.png)

![Graph detail 57](assets/demos/graph-tile-057.png)

![Graph detail 58](assets/demos/graph-tile-058.png)

![Graph detail 59](assets/demos/graph-tile-059.png)

![Graph detail 60](assets/demos/graph-tile-060.png)

</details>
