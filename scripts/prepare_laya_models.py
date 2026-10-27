"""Prepare the evaluated, offline deployment model without duplicate base weights."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from chickadee.laya_worker import verified_bundle, digest

RELEASE = 'https://github.com/Kafrika-Labs/chickadee_studio/releases/download/laya-ko-v1/'
HASHES = {
    'best.safetensors': '457f08418e36a4b22fdd392f591023b3537398b5bacb0ff5003976effce433fb',
    'laya-config.zip': 'aed47ede044185b2d7b2925fc7b4d35ecd4c38c8933cf2dd774c32a2bb5f5cd9',
}


def download(name, folder):
    target = folder/name
    if target.is_file() and digest(target) == HASHES[name]:
        return target
    temporary = target.with_suffix(target.suffix + '.partial')
    request = urllib.request.Request(RELEASE+name, headers={'User-Agent': 'Chickadee-build'})
    with urllib.request.urlopen(request, timeout=120) as response, temporary.open('wb') as output:
        shutil.copyfileobj(response, output, 1024*1024)
    if digest(temporary) != HASHES[name]:
        raise ValueError('Laya release SHA256 mismatch: '+name)
    temporary.replace(target)
    return target


def prepare(destination, source=None):
    destination = destination.resolve()
    if (destination/'manifest.json').is_file():
        verified_bundle(destination)
        return destination
    if source:
        source, manifest = verified_bundle(source)
        checkpoint = source/('base/model.safetensors' if manifest['format'] == 2 else 'best.safetensors')
    else:
        source = ROOT/'artifacts/laya-download'
        source.mkdir(parents=True, exist_ok=True)
        archive = download('laya-config.zip', source)
        with zipfile.ZipFile(archive) as z:
            if len(z.infolist()) > 100 or sum(i.file_size for i in z.infolist()) > 100_000_000:
                raise ValueError('Laya config archive too large')
            for item in z.infolist():
                relative = Path(item.filename)
                if relative.is_absolute() or '..' in relative.parts:
                    raise ValueError('Laya config path traversal')
                target = (source/relative).resolve()
                if not target.is_relative_to(source.resolve()):
                    raise ValueError('Laya config path traversal')
                if not item.is_dir():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(z.read(item))
        manifest = json.loads((source/'manifest.json').read_text('utf-8'))
        checkpoint = download('best.safetensors', source)
    if digest(checkpoint) != HASHES['best.safetensors']:
        raise ValueError('Checkpoint differs from the independently evaluated full model')
    destination.mkdir(parents=True, exist_ok=True)
    files = []
    for item in manifest['files']:
        name = item['path']
        if not name.startswith('base/'):
            continue
        src = checkpoint if name == 'base/model.safetensors' else source/name
        if name != 'base/model.safetensors' and (src.stat().st_size != item['bytes'] or digest(src) != item['sha256']):
            raise ValueError('Invalid model config: '+name)
        target = destination/name
        if not target.resolve().is_relative_to(destination) or target.exists():
            raise ValueError('Unsafe or existing model target')
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(src, target)
        except OSError:
            shutil.copyfile(src, target)
        files.append({'path':name, 'bytes':target.stat().st_size, 'sha256':digest(target)})
    manifest = {**manifest, 'format':2, 'files':files}
    (destination/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    verified_bundle(destination)
    return destination


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path)
    parser.add_argument('--destination',type=Path,default=ROOT/'artifacts/laya-model')
    args=parser.parse_args()
    result=prepare(args.destination,args.source)
    print(json.dumps({'status':'verified','model_dir':str(result),'format':2,'checkpoint_sha256':HASHES['best.safetensors']}))
