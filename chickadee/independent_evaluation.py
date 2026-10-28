"""Offline, source-separated Korean evaluation. Does not promote app models."""
import argparse
import asyncio
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import time
from .exports import atomic_write


def normalized(text):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text).casefold())


def distance(a, b):
    previous = list(range(len(b)+1))
    for i, x in enumerate(a, 1):
        current = [i]
        for j, y in enumerate(b, 1): current.append(min(current[-1]+1, previous[j]+1, previous[j-1]+(x != y)))
        previous = current
    return previous[-1]


def metrics(truth, predicted):
    tp = sum(a and b for a,b in zip(truth,predicted));fp=sum(not a and b for a,b in zip(truth,predicted))
    fn=sum(a and not b for a,b in zip(truth,predicted));tn=sum(not a and not b for a,b in zip(truth,predicted))
    return {'tp':tp,'fp':fp,'fn':fn,'tn':tn,'precision':tp/(tp+fp) if tp+fp else None,
            'recall':tp/(tp+fn) if tp+fn else None,'false_positive_rate':fp/(fp+tn) if fp+tn else None,
            'sufficient_support':tp+fn >= 5 and tn+fp >= 5}


def validate_manifest(rows, root):
    """Test sources, captures, exact/near images and normalized text must be disjoint."""
    from PIL import Image, ImageOps
    root=Path(root).resolve();ids=set();groups={};hashes={};texts={};visual=[]
    for row in rows:
        if not isinstance(row,dict) or not isinstance(row.get('id'),str) or row['id'] in ids: raise ValueError('중복·누락 ID')
        ids.add(row['id'])
        if row.get('split') not in ('train','validation','test'): raise ValueError('분할 지정 필요')
        if row.get('language') != 'ko' or row.get('origin') != 'real': raise ValueError('한국어 실제 수집 자료만 평가에 사용합니다.')
        if type(row.get('is_ad')) is not bool or not isinstance(row.get('text',''),str): raise ValueError('광고 정답·원문 필요')
        if not isinstance(row.get('topics',[]),list): raise ValueError('주제 정답 오류')
        for field in ('source_group','capture_group'):
            value=row.get(field)
            if not isinstance(value,str) or not value: raise ValueError('수집 출처·캡처 그룹 필요')
            key=field,value
            if key in groups and groups[key] != row['split']: raise ValueError('출처·캡처 그룹 분할 누수')
            groups[key]=row['split']
        text=normalized(row.get('text',''))
        if text:
            if text in texts and texts[text] != row['split']: raise ValueError('동일 문구 분할 누수')
            texts[text]=row['split']
        if row.get('image'):
            path=(root/row['image']).resolve()
            if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size>2_000_000: raise ValueError('이미지 경로·크기 오류')
            sha=hashlib.sha256(path.read_bytes()).hexdigest()
            if row.get('sha256') != sha: raise ValueError('이미지 무결성 불일치')
            if sha in hashes and hashes[sha] != row['split']: raise ValueError('동일 이미지 분할 누수')
            hashes[sha]=row['split']
            with Image.open(path) as image:
                if image.width*image.height>8_000_000: raise ValueError('이미지 해상도 초과')
                image=ImageOps.exif_transpose(image).convert('L').resize((9,8))
                pixels=image.tobytes();ph=sum((pixels[y*9+x] > pixels[y*9+x+1]) << (y*8+x) for y in range(8) for x in range(8))
            for other,split in visual:
                if split != row['split'] and (ph^other).bit_count() <= 4: raise ValueError('유사 이미지 분할 누수 · 캡처 그룹 재검토 필요')
            visual.append((ph,row['split']))
    tests=[row for row in rows if row['split']=='test']
    if not tests: raise ValueError('독립 테스트 자료가 없습니다.')
    return tests


async def evaluate(manifest, output, *, include_laya=False, include_images=False):
    from .local_ai import text_analysis
    from .image_ocr import OCRSession, recognized_text
    from .content_visual import ContentSession, model_contract
    from .laya_review import LayaSession
    path=Path(manifest);raw=path.read_bytes()
    if len(raw)>20_000_000: raise ValueError('평가 목록 크기 초과')
    all_rows=[json.loads(line) for line in raw.decode('utf-8-sig').splitlines() if line.strip()]
    rows=validate_manifest(all_rows,path.parent)
    started=time.time()
    def status(value, **extra):
        atomic_write(Path(output)/'run-status.json',(json.dumps({'status':value,'started_at':started,
            'updated_at':time.time(),'manifest_sha256':hashlib.sha256(raw).hexdigest(),**extra},ensure_ascii=False)+'\n').encode())
    status('running', completed=0, total=len(rows))
    ocr,photo,laya=OCRSession(),ContentSession(),LayaSession()
    results=[];ocr_errors=ocr_chars=0
    try:
        for row in rows:
            text=row.get('text','');record={'id':row['id'],'is_ad':row['is_ad'],'topics':row.get('topics',[])}
            if include_images and row.get('image'):
                data=(path.parent/row['image']).read_bytes()
                recognized=await ocr.recognize(data)
                if recognized.get('status') != 'completed':
                    record['ocr']={'status':'failed','message':recognized.get('message','')};text=''
                else:
                    text=recognized_text(recognized)['text'];truth=normalized(row.get('transcription',''))
                    if not truth: raise ValueError('OCR 평가에는 한국어 정답 전사가 필요합니다.')
                    errors=distance(truth,normalized(text));ocr_errors+=errors;ocr_chars+=len(truth)
                    record['ocr']={'status':'completed','character_errors':errors,'reference_characters':len(truth)}
                if model_contract(): record['photo']=await photo.recognize(data)
            record['rf']=text_analysis(text)
            if include_laya: record['laya']=(await laya.analyze([text[:4000] or ' ']))[0]
            results.append(record)
            # Recoverable progress after EVERY item. Raw texts/images are not copied.
            atomic_write(Path(output)/'predictions.jsonl', ''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in results).encode())
            status('running',completed=len(results),total=len(rows))
        summary={'manifest_sha256':hashlib.sha256(raw).hexdigest(),'samples':len(rows),'language':'ko','split':'test',
                 'paid_requests':0,'model_changed':False,'ocr':{'character_error_rate':ocr_errors/ocr_chars if ocr_chars else None,
                 'reference_characters':ocr_chars,'failed':sum(r.get('ocr',{}).get('status')=='failed' for r in results)},'models':{}}
        for kind in ('rf','laya'):
            present=[r for r in results if r.get(kind,{}).get('status')=='completed' and r[kind].get('score') is not None]
            summary['models'][kind]={'evaluated':len(present),'missing':len(results)-len(present),
                **(metrics([r['is_ad'] for r in present],[r[kind].get('review_priority')=='high' for r in present]) if present else {})}
        summary['photo']={topic:metrics([topic in r['topics'] for r in results if r.get('photo')],
            [r['photo']['scores'][topic]>=r['photo']['thresholds'][topic] for r in results if r.get('photo')])
            for topic in ('sexual_content','gambling','drugs')}
        summary['topic_support']=dict(Counter(t for r in rows for t in r.get('topics',[])))
        summary['leakage_check_scope']='supplied_manifest_only'
        summary['training_reference_included']=any(r['split']=='train' for r in all_rows)
        summary['validation_reference_included']=any(r['split']=='validation' for r in all_rows)
        summary['elapsed_seconds']=round(time.time()-started,3)
        summary['model_files']={}
        for name, model_path in (('rf',Path(__file__).parent/'data/ai-models.json'),
                                 ('ocr',Path(__file__).parent/'data/ai-models/ocr/manifest.json'),
                                 ('photo',Path(__file__).parent/'data/ai-models/content/manifest.json')):
            if model_path.is_file(): summary['model_files'][name]=hashlib.sha256(model_path.read_bytes()).hexdigest()
        atomic_write(Path(output)/'metrics.json',(json.dumps(summary,ensure_ascii=False,indent=2)+'\n').encode())
        status('completed',completed=len(results),total=len(rows))
        return summary
    except BaseException as exc:
        status('failed',completed=len(results),total=len(rows),error_type=type(exc).__name__)
        raise
    finally:
        await ocr.close();await photo.close();await laya.close()


def main():
    parser=argparse.ArgumentParser(description='독립 한국어 테스트셋 평가 · 앱 모델 변경 없음')
    parser.add_argument('manifest',type=Path);parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--laya',action='store_true');parser.add_argument('--images',action='store_true')
    args=parser.parse_args()
    from .async_runtime import event_loop_runner
    with event_loop_runner() as runner: print(json.dumps(runner.run(evaluate(args.manifest,args.output,
        include_laya=args.laya,include_images=args.images)),ensure_ascii=False,indent=2))


if __name__=='__main__': main()
