"""Validate release metadata and the Windows distribution before publication."""
import argparse
from hashlib import file_digest
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def validate_zip_paths(names):
    # MAX_PATH includes the terminating NUL. Reserve 80 UTF-16 units for a
    # user's destination (including Explorer's default ZIP-named subfolder).
    maximum = 259 - 80
    for name in names:
        units = len(name.encode('utf-16-le')) // 2
        if units > maximum:
            raise ValueError(f"Windows extraction path too long ({units} > {maximum}): {name}")


def verify_vendor_runtime(archive, prefix, expected):
    for name, digest in [('Chickadee.exe', expected['packaged_executable_sha256']),
                         ('resources/app.asar', expected['app_asar_sha256'])]:
        with archive.open(prefix + name) as stream:
            if file_digest(stream, 'sha256').hexdigest() != digest:
                raise ValueError('App differs from the verified Electron runtime: ' + name)


def version():
    package = json.loads((ROOT / "desktop/package.json").read_text(encoding="utf-8"))
    value = package["version"]
    if not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", value):
        raise ValueError(f"Invalid release version: {value}")
    lock = json.loads((ROOT / "desktop/package-lock.json").read_text(encoding="utf-8"))
    if lock["version"] != value or lock["packages"][""]["version"] != value:
        raise ValueError("package-lock version differs from package.json")
    python_version = re.search(
        r'^__version__ = "([^"]+)"',
        (ROOT / "chickadee/__init__.py").read_text(encoding="utf-8"),
        re.MULTILINE,
    )
    if not python_version or python_version[1] != value:
        raise ValueError("Python and desktop versions differ")
    if package["build"]["directories"]["output"] != f"../artifacts/electron-{value}":
        raise ValueError("Electron output path differs from release version")
    engine_resources = [item for item in package["build"]["extraResources"] if item.get("to") == "engine"]
    if len(engine_resources) != 1 or engine_resources[0]["from"] != f"../artifacts/engine-{value}/ChickadeeEngine":
        raise ValueError("Bundled engine path differs from release version")
    notes = ROOT / "docs/releases" / f"{value}.md"
    if not notes.is_file() or not notes.read_text(encoding="utf-8").strip():
        raise ValueError("Release notes are missing or empty")
    return value


def prepare(value):
    repo = os.environ["GH_REPO"]
    tag = f"v{value}"
    refs = json.loads(subprocess.check_output(
        ["gh", "api", f"repos/{repo}/git/matching-refs/tags/{tag}"], text=True
    ))
    releases = json.loads(subprocess.check_output(
        ["gh", "release", "list", "--repo", repo, "--limit", "1000", "--json", "tagName"],
        text=True,
    ))
    exists = any(ref["ref"] == f"refs/tags/{tag}" for ref in refs)
    exists = exists or any(release["tagName"] == tag for release in releases)
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write(f"app_version={value}\nrelease_needed={str(not exists).lower()}\n")
    print(f"{tag}: {'already exists; no replacement will be published' if exists else 'ready to build'}")


def verify(value, directory):
    name = f"Chickadee-Studio-{value}-win-x64.zip"
    archive_path = directory / name
    expected = (directory / f"{name}.sha256").read_text(encoding="ascii").strip()
    with archive_path.open("rb") as stream:
        actual = file_digest(stream, "sha256").hexdigest()
    if expected != f"{actual}  {name}":
        raise ValueError("Release SHA256 or checksum filename does not match")
    with zipfile.ZipFile(archive_path) as archive:
        files = set(archive.namelist())
        validate_zip_paths(files)
        prefix = f"Chickadee-{value}/"
        required = [
            "Chickadee.exe", "resources/app.asar",
            "resources/engine/ChickadeeEngine.exe", "README_FIRST.txt",
            "docs/quickstart-windows.md", "licenses/Frontend-Third-Party.txt",
        ]
        if any(prefix + name not in files for name in required):
            raise ValueError("ZIP is missing required app, engine, documentation or licenses")
        if tuple(map(int, value.split('.'))) >= (0, 10, 8):
            runtime = json.loads((ROOT / 'desktop/vendor-runtime.json').read_text(encoding='utf-8'))
            proof = json.loads(archive.read(prefix + 'resources/runtime-provenance.json').decode('utf-8-sig'))
            if (proof['app_version'] != value or proof['electron_version'] != runtime['version'] or
                any(proof[key] != runtime[source] for key, source in [('vendor_sha256', 'executable_sha256'),
                    ('icon_sha256', 'icon_sha256'), ('icon_editor_sha256', 'icon_editor_sha256')])):
                raise ValueError('Runtime provenance differs from the pinned build inputs')
            verify_vendor_runtime(archive, prefix, proof)
        browser_names = ("/headless_shell.exe", "/chrome-headless-shell.exe")
        browser_root = (prefix + 'resources/engine/_internal/browsers/'
                        if tuple(map(int, value.split('.'))) >= (0, 10, 7) else None)
        if not any((name.startswith(browser_root) if browser_root else '/.local-browsers/' in name)
                   and name.endswith(browser_names) for name in files):
            raise ValueError("ZIP is missing bundled Chromium headless shell")
        if tuple(map(int, value.split('.'))) >= (0, 10, 0):
            engine = prefix + 'resources/engine/_internal/'
            if engine + 'paddle/base/libpaddle.pyd' not in files:
                raise ValueError('ZIP is missing Paddle CPU runtime')
            manifest = json.loads((ROOT / 'chickadee/data/ocr-models.json').read_text(encoding='utf-8'))
            for model in manifest['files']:
                name = engine + 'ocr-models/' + model['path']
                if name not in files or archive.getinfo(name).file_size != model['bytes']:
                    raise ValueError('ZIP is missing official OCR model: ' + model['path'])
                with archive.open(name) as stream:
                    if file_digest(stream, 'sha256').hexdigest() != model['sha256']:
                        raise ValueError('ZIP OCR model SHA256 mismatch: ' + model['path'])
        if tuple(map(int, value.split('.'))) >= (0, 10, 1):
            manifest = json.loads((ROOT / 'chickadee/data/ai-models.json').read_text(encoding='utf-8'))
            for model in manifest['files']:
                name = prefix + 'resources/engine/_internal/chickadee/data/ai-models/' + model['path']
                if name not in files or archive.getinfo(name).file_size != model['bytes']:
                    raise ValueError('ZIP is missing local AI model: ' + model['path'])
                with archive.open(name) as stream:
                    if file_digest(stream, 'sha256').hexdigest() != model['sha256']:
                        raise ValueError('ZIP local AI model SHA256 mismatch: ' + model['path'])
        if tuple(map(int, value.split('.'))) >= (0, 10, 12):
            runtime = json.loads((ROOT / 'desktop/vendor-runtime.json').read_text(encoding='utf-8'))
            with archive.open(prefix + 'ChickadeeRuntime.exe') as stream:
                if file_digest(stream, 'sha256').hexdigest() != runtime['executable_sha256']:
                    raise ValueError('Compatibility host differs from the original upstream runtime')
            with archive.open(prefix + 'resources/chickadee.ico') as stream:
                if file_digest(stream, 'sha256').hexdigest() != runtime['icon_sha256']:
                    raise ValueError('Compatibility app icon differs from the pinned Chickadee icon')
            for kind in ('ocr', 'content'):
                folder = ROOT / ('chickadee/data/ai-models/' + kind)
                meta = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
                target = prefix + 'resources/engine/_internal/chickadee/data/ai-models/' + kind + '/'
                if json.loads(archive.read(target + 'manifest.json')) != meta or not meta.get('approved_for_app'):
                    raise ValueError('ZIP approved model metadata differs: ' + kind)
                entries = meta['files'] if kind == 'ocr' else [{'name':'model.pdparams', 'sha256':meta['sha256']}]
                for model in entries:
                    name = target + model['name']
                    if name not in files: raise ValueError('ZIP model file missing: ' + name)
                    with archive.open(name) as stream:
                        if file_digest(stream, 'sha256').hexdigest() != model['sha256']:
                            raise ValueError('ZIP approved model SHA256 mismatch: ' + name)
        if tuple(map(int, value.split('.'))) >= (0, 10, 11):
            laya = prefix + 'resources/laya-model/'
            if prefix+'resources/laya/ChickadeeLaya.exe' not in files:
                raise ValueError('ZIP is missing the standalone Laya CPU runtime')
            meta = json.loads(archive.read(laya+'manifest.json'))
            if meta.get('format') != 2 or meta.get('training') != 'full_encoder' or meta.get('approved') is not True:
                raise ValueError('ZIP Laya model is not approved')
            from prepare_laya_models import HASHES
            if meta['evaluation']['checkpoint_sha256'] != HASHES['best.safetensors']:
                raise ValueError('ZIP Laya checkpoint differs from evaluated model')
            for model in meta['files']:
                name = laya+model['path']
                if name not in files or archive.getinfo(name).file_size != model['bytes']:
                    raise ValueError('ZIP is missing Laya model file')
                with archive.open(name) as stream:
                    if file_digest(stream,'sha256').hexdigest() != model['sha256']:
                        raise ValueError('ZIP Laya model SHA256 mismatch')
        bad = archive.testzip()
        if bad:
            raise ValueError(f"ZIP CRC check failed: {bad}")
    print(f"Verified {archive_path.name}: {actual}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["version", "prepare", "verify"])
    parser.add_argument("--directory", type=Path, default=ROOT / "artifacts")
    args = parser.parse_args()
    release_version = version()
    if args.command == "prepare":
        prepare(release_version)
    elif args.command == "verify":
        verify(release_version, args.directory)
    else:
        print(release_version)
