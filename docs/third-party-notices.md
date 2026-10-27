# Third-party components and distribution notes

[한국어](third-party-notices.ko.md) | [English](third-party-notices.md)

The project uses [Apache-2.0](../LICENSE). External components and models retain their own licenses.

| Component | Purpose | Official source |
| --- | --- | --- |
| Python / Tcl·Tk | Runtime and Tkinter UI | https://www.python.org/psf/license/ / https://www.tcl-lang.org/software/tcltk/license.html |
| Playwright | Browser automation | https://github.com/microsoft/playwright-python/blob/main/LICENSE |
| Chromium Headless Shell | Rendering engine | https://www.chromium.org/chromium-projects/ |
| PyInstaller | Windows packaging | https://pyinstaller.org/en/stable/license.html |
| jsonschema | Output/import validation | https://github.com/python-jsonschema/jsonschema |
| PaddleOCR / PaddlePaddle | PP-OCRv5 mobile detection, Korean recognition and local CPU inference | https://github.com/PaddlePaddle/PaddleOCR / https://github.com/PaddlePaddle/Paddle |
| OpenCV / NumPy / Pillow / pyclipper / PyYAML | OCR preprocessing, coordinates, image processing and model configuration | Distribution: licenses/OCR-Third-Party.txt |
| Electron | Windows app shell | https://github.com/electron/electron/blob/main/LICENSE |
| React | UI | https://github.com/facebook/react/blob/main/LICENSE |
| React Flow | Nodes, ports and connections | https://github.com/xyflow/xyflow/blob/main/LICENSE |
| Lucide | Function icons | https://github.com/lucide-icons/lucide/blob/main/LICENSE |
| Pretendard | Bundled font, SIL Open Font License | https://github.com/orioncactus/pretendard/blob/main/LICENSE |
| Simple Icons | Documentation stack icons, CC0-1.0 | https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md |
| Laya Multilingual | Base model for Korean context analysis, Apache-2.0 | https://huggingface.co/convaiinnovations/laya-multilingual |
| PyTorch / Transformers / safetensors | Local Laya runtime (optional source installation) | https://pytorch.org/ / https://github.com/huggingface/transformers / https://github.com/huggingface/safetensors |
| Unicode confusables | Restricted confusable mapping, Unicode License V3 | https://www.unicode.org/reports/tr39/ |

Unicode data is pinned with version, source SHA-256 and filters in `chickadee/data/confusables-ascii.json`. Preserve `chickadee/data/LICENSE-UNICODE.txt` and include this directory in the engine package.

Official PaddleOCR models are [PP-OCRv5 mobile detection](https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_det) and [Korean recognition](https://huggingface.co/PaddlePaddle/korean_PP-OCRv5_mobile_rec). Apache-2.0 model revisions and file SHA-256 hashes are pinned in `chickadee/data/ocr-models.json`. A custom adapter connects DB detection and CTC recognition preprocessing/postprocessing with PaddlePaddle CPU inference, without PaddleX automatic downloads. Original licenses and notices are in `desktop/licenses/OCR-Third-Party.txt`.

Retain notices for Playwright's bundled Node.js, browsers and dependencies. Keep Electron `resources`, Chromium license files and the engine `_internal` folder. Pretendard's license is in `desktop/licenses/Pretendard-OFL.txt`. This list does not replace a complete dependency/license review before distribution. Trained models also have notices in `chickadee/data/ai-models/`; the source-code license does not override their conditions.

The original logo is `desktop/assets/logo-original.png`; the bird-and-magnifier app icon is `desktop/assets/app-mark.png`. ICO is a Windows-format conversion of that icon.

Implementation references: [Playwright installation](https://playwright.dev/python/docs/library), [Frame API](https://playwright.dev/python/docs/api/class-frame), [PyInstaller integration](https://playwright.dev/python/docs/library#pyinstaller).

Isolation follows [Playwright Docker guidance](https://playwright.dev/python/docs/docker). `deploy/seccomp_profile.json` derives from microsoft/playwright v1.64.0 under Apache-2.0. Original SHA-256: `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`. A `chroot` allowance was added so Chromium's user-namespace sandbox works with all container capabilities removed. The container uses a non-admin user without privileged mode, host IPC, Docker socket or host-folder mounts. Preserve original material and changes in the package's `deploy` directory and this document.
