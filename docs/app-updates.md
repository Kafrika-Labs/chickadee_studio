# App updates and navigation speed

[한국어](app-updates.ko.md) | [English](app-updates.md)

Open Settings → Updates to check the current version and GitHub releases. The current public channel includes prereleases, which are labeled in the UI. Drafts are excluded and numeric versions are compared.

The package is a Windows x64 ZIP. Download is available only when both a ZIP matching the current OS/architecture and a SHA256 file exist. The app verifies byte length and SHA256 before offering to open the file location. Incomplete downloads are deleted; the installed app is unchanged. A release without macOS assets cannot be downloaded on macOS.

Automatic replacement and restart installation are not supported. Close the app, extract the new ZIP to a separate folder and run it. Installer-based updates would require separate packages, platform signing and update distribution.

Settings → General → Navigation speed controls waiting before the next page: fast 0 seconds, normal 0.5 seconds, slow 5 seconds, or 0–30 seconds using the slider. It does not throttle current-page processing or CPU usage. Waiting counts toward the scan deadline, so increase the deadline for slower scans. The value persists and is copied into new schedules; existing schedules retain their saved configuration.

Implementation references: [GitHub Releases API](https://docs.github.com/en/rest/releases/releases), [Electron shell API](https://www.electronjs.org/docs/latest/api/shell/).
