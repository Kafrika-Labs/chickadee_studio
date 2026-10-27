"""Reuse the unchanged CPU worker from a pinned, previously verified release."""
import argparse
import hashlib
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess
import sys
import zipfile

ROOT=Path(__file__).resolve().parents[1]
BASE='v0.10.11'
ARCHIVE='Chickadee-Studio-0.10.11-win-x64.zip'
EXPECTED='cb5241e6da4bffd4629dab02b7cd00e776c8012316d52f70b4b4278368f1f186'
SOURCES=['requirements-laya.txt','run_laya.py','scripts/laya.spec','chickadee/laya_worker.py']


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--version',required=True);args=parser.parse_args()
    from release import version
    if args.version!=version():raise ValueError('Runtime destination version mismatch')
    fetched=subprocess.run(['git','fetch','--depth=1','origin','tag',BASE],cwd=ROOT)
    if fetched.returncode:
        print('Pinned historical runtime is unavailable: build a fresh verified worker.')
        return 2
    changed=subprocess.run(['git','diff','--quiet',BASE,'HEAD','--',*SOURCES],cwd=ROOT).returncode
    if changed==1:
        print('Laya source/dependencies changed: build a fresh worker.');return 2
    if changed!=0:raise RuntimeError('Cannot compare Laya runtime source')
    folder=ROOT/'artifacts/prebuilt-laya';folder.mkdir(parents=True,exist_ok=True)
    archive=folder/ARCHIVE
    if not archive.exists():
        subprocess.run(['gh','release','download',BASE,'--repo','Kafrika-Labs/chickadee_studio','--pattern',ARCHIVE,'--dir',str(folder)],check=True,cwd=ROOT)
    with archive.open('rb') as stream:
        if hashlib.file_digest(stream,'sha256').hexdigest()!=EXPECTED:raise ValueError('Pinned runtime archive SHA256 mismatch')
    prefixes={f'Chickadee-0.10.11/resources/laya/':ROOT/f'artifacts/laya-{args.version}/ChickadeeLaya',
              'Chickadee-0.10.11/resources/laya-model/':ROOT/'artifacts/laya-model'}
    with zipfile.ZipFile(archive) as package:
        for item in package.infolist():
            if item.is_dir():continue
            for prefix,dest in prefixes.items():
                if not item.filename.startswith(prefix):continue
                relative=PurePosixPath(item.filename[len(prefix):])
                if relative.is_absolute() or '..' in relative.parts or stat.S_ISLNK(item.external_attr>>16):raise ValueError('Unsafe runtime archive path')
                target=dest.joinpath(*relative.parts)
                if not target.resolve().is_relative_to(dest.resolve()):raise ValueError('Runtime path escapes destination')
                target.parent.mkdir(parents=True,exist_ok=True)
                with package.open(item) as source,target.open('wb') as output:shutil.copyfileobj(source,output)
    subprocess.run([sys.executable,str(ROOT/'scripts/prepare_laya_models.py')],cwd=ROOT,check=True)
    if not (ROOT/f'artifacts/laya-{args.version}/ChickadeeLaya/ChickadeeLaya.exe').is_file():raise ValueError('CPU worker missing')
    print('Pinned CPU runtime restored; source and model contracts unchanged.');return 0


if __name__=='__main__':sys.exit(main())
