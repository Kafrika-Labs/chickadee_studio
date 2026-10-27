[![Release](https://img.shields.io/github/v/release/Kafrika-Labs/chickadee_studio?style=flat)](https://github.com/Kafrika-Labs/chickadee_studio/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/Kafrika-Labs/chickadee_studio/release.yml?branch=main&label=build&style=flat)](https://github.com/Kafrika-Labs/chickadee_studio/actions/workflows/release.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

<img src="desktop/assets/app-mark.png" width="96" alt="Chickadee Studio logo" />

# Chickadee Studio

[![한국어](https://img.shields.io/badge/language-한국어-blue.svg)](README.ko.md)
[![English](https://img.shields.io/badge/language-English-orange.svg)](README.md)

## Open-source analysis of advertising context, disguised text and hidden content

Chickadee Studio is a desktop app for reviewing suspected advertising in posts, comments and images on public-sector websites. It brings source text, screenshots and text locations together so reviewers can inspect the evidence behind each finding.

- **Scan targets**: page text, posts, comments, iframes and text inside images
- **Obfuscation and concealment**: look-alike characters, decomposed Korean letters, transparent text and off-screen content
- **Image text extraction**: Korean text and bounding boxes with PaddleOCR
- **Context analysis**: RF and Laya models on the local CPU, with optional AI Model(GPT, Claude, Groq) review
- **Review and export**: source text, screenshots, review states, notes, JSON, CSV and reports

Model scores help prioritize review. Check the original text and detection evidence together.

## At a glance

[![Website scanning, OCR and context analysis demo](docs/assets/demos/overview.webp)](docs/assets/demos/service.webm)

[Full demo video](docs/assets/demos/service.webm) · [Feature screenshots](docs/features.md)

## Download

- [Latest Windows x64 release](https://github.com/Kafrika-Labs/chickadee_studio/releases/latest)
- [Release notes](docs/README.md#release-notes)

The download bundles the Python scan engine, Chromium, OCR/RF/Laya models and CPU runtime. No separate Python installation or GPU is required. AI Model runs when the user supplies an API key and starts a review.

## Quick start

1. Download the Windows ZIP from the latest release and **extract the entire archive**.
2. Keep the `resources` folder in place and run **Chickadee.exe**.
3. Enter a URL in **Scan target** and select **Run scan** to start scanning.
4. Review the source text and screenshots, then save your review results.

If application control blocks the executable, use `ChickadeeRuntime.exe` in the same folder. It runs the same app through the original Electron executable. To explore without internet access, select **Demo scan** from the menu beside the scan button. The app interface is in Korean.

[Installation and launch guide](docs/quickstart-windows.md) · [Desktop user guide](docs/desktop.md)

## Documentation

- [Documentation home](docs/README.md)
- [Features and demos](docs/features.md)
- [Project guide — processing stages, datasets and model evaluation](docs/project-guide.md)
- [AI Model setup and review](docs/inspection-agent.md)
- [Scheduled scans](docs/scheduled-inspections.md) · [Notifications](docs/notifications.md)
- [Result file format](docs/result-format.md)
- [Testing and package validation](docs/validation.md)

## Components

| Component | Role | Implementation |
| --- | --- | --- |
| Desktop app | Scan configuration, progress and review | Electron, React, React Flow |
| Collection engine | Pages, comments, images and navigation paths | Python, Playwright, Chromium |
| Obfuscation analysis | Altered characters and visually hidden elements | Unicode, DOM, CSS and coordinates |
| OCR | Korean text and locations inside images | PaddleOCR |
| Local context analysis | Advertising context in page and OCR text | TF-IDF, Random Forest, Laya |
| Optional AI review | Collected evidence and further checks on the same site | GPT, Claude, Groq |

[Architecture](docs/architecture.md) · [Direct image/text analysis](docs/content-analysis.md)

## Development and contributions

Contributions to bug fixes, detection rules, the interface, documentation and translations are welcome.

- [Development setup](docs/project-guide.md#8-development) — Python 3.12, Node.js 24
- [Contributing guide](CONTRIBUTING.md) — workflow and validation
- [Bug reports and feature requests](https://github.com/Kafrika-Labs/chickadee_studio/issues)
- [Research data](research/README.md)

## License

[Apache License 2.0](LICENSE). See [third-party notices](docs/third-party-notices.md) for the sources and terms of bundled libraries, fonts and models.
