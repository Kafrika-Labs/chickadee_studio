# Windows distribution

[한국어](windows-signing.ko.md) | [English](windows-signing.md)

The Windows x64 ZIP applies the Chickadee character icon to `Chickadee.exe`. Only the icon of the official Electron executable is replaced; original runtime file properties such as version and publisher are retained. App branding and design remain unchanged.

SHA-256 hashes of the official runtime ZIP, original executable, icon and editing tool are pinned in `desktop/vendor-runtime.json`. Each build reconstructs and verifies packaging against the original PE and actual ASAR header. App archive and final executable hashes are recorded in `resources/runtime-provenance.json` and checked during ZIP validation. ASAR integrity resources inserted by packaging tools are preserved.

The default package is unsigned. It does not install certificates, change Windows security settings or disable protection. Execution depends on the environment's policy and file reputation.

[Quick start](quickstart-windows.md) · [Latest release](https://github.com/Kafrika-Labs/chickadee_studio/releases/latest)
