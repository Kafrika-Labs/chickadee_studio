# PyInstaller desktop worker. The scanner only launches Chromium headless shell.
from pathlib import Path
from PyInstaller.utils.hooks import collect_all

root = Path(SPECPATH).parent
paddle_datas, paddle_binaries, paddle_hidden = collect_all('paddle')
a = Analysis(
    [str(root / 'run_bridge.py')], pathex=[str(root)], binaries=paddle_binaries,
    datas=[(str(root / 'chickadee/extract.js'), 'chickadee'),
           (str(root / 'chickadee/laya_worker.py'), 'chickadee'),
           (str(root / 'chickadee/rules.json'), 'chickadee'),
           (str(root / 'chickadee/data'), 'chickadee/data'),
           (str(root / 'schemas/result.schema.json'), 'schemas'),
           (str(root / 'chickadee/demo_site'), 'chickadee/demo_site'),
           (str(root / 'profiles'), 'profiles'),
           (str(root / 'artifacts/ocr-models'), 'ocr-models')] + paddle_datas,
    hiddenimports=paddle_hidden, hookspath=[], hooksconfig={}, runtime_hooks=[],
    # The dedicated Laya worker ships Torch; keeping it out of the Paddle engine
    # prevents duplicate gigabytes and incompatible Windows DLLs in one process.
    excludes=['tkinter', 'torch', 'laya', 'transformers'], noarchive=False, optimize=0,
)
# Do not ship the second, unused headed browser. Keep headless shell, ffmpeg,
# and WinDLL diagnostics. This filters build data; installed browsers stay intact.
def required_browser(entry):
    return '.local-browsers/chromium-' not in entry[0].replace(chr(92), '/')
def compact_browser(entry):
    name = entry[0].replace(chr(92), '/')
    prefix = 'playwright/driver/package/.local-browsers/'
    if name.startswith(prefix):
        return ('browsers/' + name[len(prefix):], *entry[1:])
    return entry

# Preserve every headless-browser file, including accessibility resources.
# scanner.py points Playwright to this shorter frozen-only directory.
a.datas = [compact_browser(entry) for entry in a.datas if required_browser(entry)]
a.binaries = [compact_browser(entry) for entry in a.binaries if required_browser(entry)]
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='ChickadeeEngine',
          debug=False, bootloader_ignore_signals=False, strip=False, upx=False,
          console=True, disable_windowed_traceback=False)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='ChickadeeEngine')
