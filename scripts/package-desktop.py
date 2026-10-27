"""Package the already built Windows app, documentation and license notices."""
from hashlib import sha256
import json
from pathlib import Path
import shutil
import zipfile
from release import validate_zip_paths

ROOT = Path(__file__).resolve().parent.parent
if __import__('os').name == 'nt' and not str(ROOT).startswith('\\\\?\\'):
    ROOT = Path('\\\\?\\' + str(ROOT))
DESKTOP = ROOT / 'desktop'
VERSION = json.loads((DESKTOP / 'package.json').read_text(encoding='utf-8'))['version']
APP = ROOT / 'artifacts' / f'electron-{VERSION}' / 'win-unpacked'


def frontend_licenses():
    modules = DESKTOP / 'node_modules'
    pending = ['react', 'react-dom', '@xyflow/react', 'lucide-react', 'use-sync-external-store']
    visited, notices = set(), []
    while pending:
        name = pending.pop()
        if name in visited:
            continue
        visited.add(name)
        folder = modules / name
        package = json.loads((folder / 'package.json').read_text(encoding='utf-8'))
        files = [p for p in folder.iterdir() if p.is_file() and p.name.upper().startswith(('LICENSE', 'COPYING', 'NOTICE'))]
        if not files:
            raise RuntimeError(f'License text missing: {name}')
        notices.append(f"\n{'=' * 72}\n{name} {package['version']} ({package.get('license', '')})\n" +
                       '\n'.join(p.read_text(encoding='utf-8', errors='replace') for p in sorted(files)))
        pending.extend(package.get('dependencies', {}))
    target = DESKTOP / 'licenses' / 'Frontend-Third-Party.txt'
    target.write_text('Bundled frontend dependencies and their license notices.\n' + '\n'.join(notices), encoding='utf-8')
    return len(visited)


def main(app_directory=None):
    APP = Path(app_directory).resolve() if app_directory else ROOT / 'artifacts' / f'electron-{VERSION}' / 'win-unpacked'
    required = [APP / 'Chickadee.exe', APP / 'resources/engine/ChickadeeEngine.exe',
                APP / 'resources/laya/ChickadeeLaya.exe', APP / 'resources/laya-model/manifest.json']
    if not all(p.is_file() for p in required):
        raise RuntimeError('Build scripts/build-desktop.ps1 first.')
    runtime = json.loads((DESKTOP / 'vendor-runtime.json').read_text(encoding='utf-8'))
    upstream = DESKTOP / 'node_modules/electron/dist/electron.exe'
    if not upstream.is_file(): upstream = ROOT / 'artifacts/vendor-runtime' / runtime['version'] / 'electron.exe'
    if not upstream.is_file() or sha256(upstream.read_bytes()).hexdigest() != runtime['executable_sha256']:
        raise RuntimeError('Verified upstream runtime is required for compatibility startup.')
    # Preserve the upstream bytes/reputation. Do not edit icons, resources or fuses.
    compatibility = APP / 'ChickadeeRuntime.exe'
    if not compatibility.is_file() or sha256(compatibility.read_bytes()).hexdigest() != runtime['executable_sha256']:
        shutil.copy2(upstream, compatibility)
    shutil.copy2(DESKTOP / 'assets/app.ico', APP / 'resources/chickadee.ico')
    count = frontend_licenses()
    shutil.copytree(DESKTOP / 'licenses', APP / 'licenses', dirs_exist_ok=True)
    for name in ['quickstart-windows.md', 'desktop.md', 'result-format.md', 'third-party-notices.md', 'validation.md', 'manual.md', 'agent-extension.md', 'inspection-agent.md', 'content-analysis.md', 'windows-signing.md']:
        for localized_name in (name, name.replace('.md', '.ko.md')):
            target = APP / 'docs' / localized_name
            target.parent.mkdir(exist_ok=True)
            shutil.copy2(ROOT / 'docs' / localized_name, target)
    for name in ('DESIGN.md', 'DESIGN.ko.md'):
        shutil.copy2(ROOT / name, APP / name)
    for name in ('LICENSE', 'NOTICE'):
        shutil.copy2(ROOT / name, APP / name)
    shutil.copy2(ROOT / '.env.example', APP / '.env.example')
    (APP / 'README_FIRST.txt').write_text(
        f'Chickadee Studio {VERSION} / Windows x64\n\n'
        'ZIP 전체를 새 폴더에 압축 해제한 다음 Chickadee.exe를 실행하세요.\n'
        'Windows 앱 제어 정책으로 실행이 차단되면 같은 폴더의 ChickadeeRuntime.exe를 실행하세요.\n'
        '호환 실행기는 공식 Electron 원본 파일이며 같은 앱·모델을 실행합니다. 보안 설정을 바꾸지 않습니다.\n'
        'resources 등 함께 있는 폴더를 유지하세요. Python/Node.js/Docker 설치는 필요하지 않습니다.\n'
        'URL 입력 → 검사 실행. 로컬 예제는 실행 옆 화살표 메뉴 → 데모 검사.\n'
        '일시정지·재개, 검토 상태·메모·일괄 처리, Ctrl K 빠른 명령을 지원합니다.\n'
        '기본 저장: 문서/Chickadee/results/실행별 폴더\n'
        '탐지 결과 result.json 및 추가 관측 result_extra.json은 위 실행별 폴더에 생성합니다.\n'
        '검사 구성은 고정 순서로 실행하며 이미지 OCR 사용 여부는 노드 설정에서 선택합니다.\n'
        '사용 안내: docs/quickstart-windows.ko.md, docs/desktop.ko.md\n'
        '이미지 속 한국어 문구도 자동 검사합니다. OCR 모델은 동봉되어 별도 설치가 필요하지 않습니다.\n'
        '한국어 Laya 모델과 CPU 실행 환경도 동봉되어 별도 설치 없이 OCR → ML → Laya로 분석합니다.\n'
        '설정의 제한시간은 웹 탐색에 적용합니다. 수집 자료의 로컬 분석은 별도의 최대 30분 안에서 이어갑니다. 중단 버튼으로 멈출 수 있습니다.\n'
        '학습한 문자·화면 AI 분석은 무료 로컬 처리입니다. 근거 패널과 검사 분석 → AI 검토에서 확인하세요.\n'
        '설정 → 일반 → 실행 환경에서 자동·표준·절약 모드와 CPU·메모리를 확인합니다. 절약 모드는 이미지 OCR을 생략합니다.\n'
        'OCR 기능 확인 버튼은 인터넷 접속 없이 동봉된 한국어 모델을 시험합니다. GPU는 필수가 아닙니다.\n'
        'Groq 추가 검토는 AI 설정에서 키를 등록한 뒤 실행합니다. 기본 누적 한도: 검사당 6회 / 24,000토큰.\n'
        'API 키는 현재 앱 세션에서만 사용하며, 환경 변수나 다른 프로젝트의 키를 자동 사용하지 않습니다.\n'
        '선택한 외부 키 파일: Chickadee.exe --groq-env-file "설정파일의 전체 경로". docs/quickstart-windows.ko.md 참고.\n'
        '서명 서비스 가입 없이 제공되는 미서명 패키지입니다.\n'
        'https://github.com/Kafrika-Labs/chickadee_studio\n', encoding='utf-8-sig')
    (APP / 'README_FIRST.en.txt').write_text(
        f'Chickadee Studio {VERSION} / Windows x64\n\n'
        'Extract the entire ZIP into a new folder and run Chickadee.exe.\n'
        'If Windows app control blocks it, run ChickadeeRuntime.exe in the same folder.\n'
        'This official unmodified Electron runtime runs the same app and models without changing security settings.\n'
        'Keep resources and all accompanying folders. No separate Python, Node.js or Docker installation is needed.\n'
        'Enter a URL and choose Run scan (검사 실행); the adjacent menu offers a local Demo scan (데모 검사).\n'
        'Pause/resume, review states, notes, bulk review and Ctrl K quick commands are supported.\n'
        'Default storage: Documents/Chickadee/results/<run folder>/.\n'
        'result.json and additional observations in result_extra.json are saved in that run folder.\n'
        'The workflow order is fixed; enable image OCR in its node settings.\n'
        'Guides: docs/quickstart-windows.md and docs/desktop.md. The app interface is in Korean.\n'
        'Korean OCR, the trained Laya model and its CPU runtime are bundled for local OCR -> ML -> Laya analysis.\n'
        'The configured deadline bounds web collection. Collected evidence has a separate offline analysis budget of up to 30 minutes; Stop remains available.\n'
        'Text and visual AI run locally without paid requests. Review evidence and Inspection analysis -> AI review.\n'
        'Settings -> General -> Runtime offers Auto, Standard and Economy; Economy skips image OCR.\n'
        'The OCR check tests bundled models offline. No GPU is required.\n'
        'Optional Groq review requires a user-provided key. Default per-scan budget: 6 calls / 24,000 tokens.\n'
        'Keys stay in the current app session; keys from other projects or arbitrary environment variables are not used automatically.\n'
        'Explicit external key file: Chickadee.exe --groq-env-file "absolute path to settings file". See the quick start guide.\n'
        'This package is unsigned.\n'
        'https://github.com/Kafrika-Labs/chickadee_studio\n', encoding='utf-8-sig')
    output = ROOT / 'artifacts' / f'Chickadee-Studio-{VERSION}-win-x64.zip'
    temporary = output.with_suffix('.zip.tmp')
    entries = [(file, (Path(f'Chickadee-{VERSION}') / file.relative_to(APP)).as_posix())
               for file in sorted(APP.rglob('*')) if file.is_file()]
    validate_zip_paths(name for _, name in entries)
    with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for file, name in entries:
            # Large tensor checkpoints dominate packaging CPU time. Fast DEFLATE
            # preserves their exact bytes and keeps the release below GitHub's
            # per-asset size limit without recompressing them at level six.
            archive.write(file, name, compresslevel=1 if file.suffix == '.safetensors' else 6)
    with zipfile.ZipFile(temporary) as archive:
        invalid = archive.testzip()
        if invalid:
            raise RuntimeError(f'ZIP checksum failed: {invalid}')
    temporary.replace(output)
    digest = sha256()
    with output.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    output.with_suffix('.zip.sha256').write_text(f'{digest.hexdigest()}  {output.name}\n', encoding='ascii')
    print(json.dumps({'archive': str(output), 'bytes': output.stat().st_size, 'sha256': digest.hexdigest(), 'frontend_license_count': count}))


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app-directory', type=Path)
    main(parser.parse_args().app_directory)
