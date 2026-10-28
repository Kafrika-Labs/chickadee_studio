from copy import deepcopy
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import tempfile
import time
from urllib.error import HTTPError
import unittest
from unittest.mock import patch
from chickadee.access_preflight import probe, server_rule
from chickadee.diagnostics import image_failure, image_reasons
from chickadee.independent_evaluation import validate_manifest, metrics, evaluate
from chickadee.privacy import shared_copy
from chickadee.site_access import SiteAccess


class OperationalTests(unittest.TestCase):
    def test_ocr_causes_are_distinct_from_no_text(self):
        self.assertEqual(image_failure(ValueError('허용되지 않은 이미지 origin'),'fetch'),'origin_denied')
        self.assertEqual(image_failure(HTTPError('https://test/',403,'Forbidden',{},None),'fetch'),'auth_required')
        self.assertEqual(image_failure(TimeoutError('timeout'),'recognize'),'ocr_timeout')
        self.assertEqual(image_reasons([{'reason_code':'no_text'},{'reason_code':'no_text'}]),
                         [{'code':'no_text','label':'문자 영역 없음','count':2}])

    def test_shared_copy_removes_secrets_contact_details_and_pixels_but_preserves_original(self):
        source={'text':'홍길동 hello@example.com 010-1234-5678 990101-1234567 secret-token',
                'url':'https://example.org/post?token=abc&post=1','screenshots':{'s':{'data_url':'data:image/jpeg;base64,/9j/'}},
                'api_key':'dont-share','id':'f_001'}
        original=deepcopy(source);shared=shared_copy(source,['secret-token'])
        self.assertEqual(source,original)
        serialized=json.dumps(shared)
        for value in ('hello@example.com','010-1234-5678','990101-1234567','secret-token','dont-share','base64','token=abc'):
            self.assertNotIn(value,serialized)
        self.assertEqual(shared['id'],'f_001');self.assertIn('post=1',shared['url'])

    def entry(self):
        return SiteAccess.create({'origin':'https://example.test','path_prefix':'/boards','token':'t'*40})

    def test_server_rule_has_absolute_expiry_path_boundary_and_no_secret(self):
        auth=self.entry();rule=server_rule(auth)
        self.assertIn('http.request.timestamp.sec lt '+str(int(auth.expires_at)),rule)
        self.assertIn('"/boards/"',rule);self.assertNotIn(auth.token,rule)

    def test_preflight_does_not_mistake_public_login_or_rate_limit_for_authenticated(self):
        class Response:
            status=200
            def __init__(self,text):self.text=text;self.headers=self
            def __enter__(self):return self
            def __exit__(self,*a):pass
            def get_content_charset(self):return 'utf-8'
            def read(self,n):return self.text.encode()
        auth=self.entry()
        for pages,expected in (([HTTPError('',403,'',{},None),Response('회원 전용 자료')],'verified'),
                               ([Response('회원 전용 자료'),Response('회원 전용 자료')],'public'),
                               ([Response(''),Response('<input type="password">회원 전용 자료')],'unconfirmed'),
                               ([HTTPError('',429,'',{},None)],'rate_limited')):
            with patch('chickadee.access_preflight.AddressPolicy') as policy, patch('chickadee.access_preflight.time.sleep'):
                policy.return_value.opener.return_value.open.side_effect=pages
                self.assertEqual(probe(auth,'https://example.test/boards/1','회원 전용 자료')['status'],expected)
        with self.assertRaises(ValueError):probe(auth,'https://example.test/admin','자료')

    def test_independent_split_rejects_source_text_and_near_image_leakage(self):
        a={'id':'a','split':'train','language':'ko','origin':'real','is_ad':True,'text':'가입 보너스',
           'source_group':'campaign-a','capture_group':'capture-a'}
        b={**a,'id':'b','split':'test','text':'독립 문구','source_group':'campaign-b','capture_group':'capture-b'}
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(validate_manifest([a,b],folder),[b])
            for changes in ({'source_group':'campaign-a'},{'capture_group':'capture-a'},{'text':'가 입 보 너 스'}):
                with self.assertRaises(ValueError):validate_manifest([a,{**b,**changes}],folder)
            from PIL import Image
            for name,color in (('one.png','white'),('two.png','grey')):
                path=Path(folder)/name;Image.new('RGB',(50,40),color).save(path)
            def image(row,name):return {**row,'image':name,'sha256':hashlib.sha256((Path(folder)/name).read_bytes()).hexdigest()}
            with self.assertRaises(ValueError):validate_manifest([image(a,'one.png'),image(b,'two.png')],folder)
        self.assertFalse(metrics([True],[True])['sufficient_support'])

    def test_real_local_rf_evaluation_writes_incremental_predictions_without_changing_models(self):
        from chickadee.async_runtime import event_loop_runner
        rows=[{'id':'test-'+str(i),'split':'test','language':'ko','origin':'real','source_group':'campaign-'+str(i),
               'capture_group':'capture-'+str(i),'is_ad':bool(i),'text':text,'topics':[]}
              for i,text in enumerate(['도박 중독 예방 교육 안내','카지노 첫충 보너스 지급'])]
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'samples.jsonl';path.write_text('\n'.join(json.dumps(r,ensure_ascii=False) for r in rows),encoding='utf-8')
            with event_loop_runner() as runner: result=runner.run(evaluate(path,Path(folder)/'output'))
            self.assertEqual(result['paid_requests'],0);self.assertFalse(result['model_changed'])
            self.assertEqual(result['models']['laya']['missing'],2)
            self.assertEqual(len((Path(folder)/'output/predictions.jsonl').read_text(encoding='utf-8').splitlines()),2)
