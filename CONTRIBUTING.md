# Contributing to Chickadee Studio

[한국어](CONTRIBUTING.ko.md) | [English](CONTRIBUTING.md)

Contributions to bug fixes, detection rules, the UI, documentation and translations are welcome. Start with [Development](docs/project-guide.md#8-development).

## Issues and pull requests

1. Check existing [issues](https://github.com/Kafrika-Labs/chickadee_studio/issues). For larger changes, describe the problem and proposed behavior first.
2. Make a focused change on a branch. Check compatibility with existing user data, settings and result formats.
3. Run relevant checks and describe the reason for the change and validation results in your PR. Include screenshots for UI changes.

Bug reports should include the app version, OS and CPU architecture, reproduction steps, expected behavior and actual behavior. Do not post API keys, login cookies, webhook URLs or personal data in logs and screenshots. Include a small shareable local reproduction page when possible.

## Validation

From the repository root on macOS:

```sh
.venv/bin/python -m unittest discover -s tests -v
npm --prefix desktop test
npm --prefix desktop run build
npm --prefix desktop run smoke
```

On Windows, use `.venv\Scripts\python.exe`. UI smoke checks launch Electron and a local site, so they need a GUI environment. Start with checks relevant to your change and list the checks you ran in the PR.

## Updating documentation screenshots

```sh
npm --prefix desktop run build
node desktop/tests/capture-docs.cjs
```

Capture uses the real Electron app and bundled demo. It creates isolated data in a system temporary `chickadee-docs-*` directory and makes no external AI calls or webhook deliveries.

- `desktop/assets/guide/`: ten screens shared by the README, detailed guides and in-app guide.
- `docs/assets/screenshots/`: additional README screens, including the full flow and HTTP history.
- Default size: 1440 × 900 CSS pixels; notifications: 1440 × 1300; shortcuts: 1440 × 1100. Inspect images for clipping, overlap and unwanted notifications.
- Use actual app screenshots. Do not edit review outcomes or detection counts into them.
- Rebuild after replacing images to update the in-app guide.

Keep Korean documents and their `.en.md` counterparts aligned, including links, commands and screenshots. Add language links when introducing a new guide. Download links should use `/releases/latest`.

## Code and releases

The inspection engine is in `chickadee/`, the Electron main process in `desktop/electron/`, and React UI in `desktop/src/`. Keep external pages separate from the app UI and preserve collection boundaries, request limits and credential protection.

Release versions must match in `desktop/package.json`, `desktop/package-lock.json`, `chickadee/__init__.py` and package output paths. Write `docs/releases/<version>.md` and its English counterpart, then check with `python scripts/release.py version`. Pushing main triggers the release workflow; do not bump versions for documentation-only changes.

Contributions use the repository's [Apache-2.0 license](LICENSE). Check attribution and licenses for added libraries, models and icons.
