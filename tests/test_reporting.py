import unittest
from chickadee.reporting import review_report


class ReportTests(unittest.TestCase):
    def test_ocr_candidate_and_original_are_exported_without_groq(self):
        row={'id':'c_1','category':'ACCOUNT_TRADE','url':'https://example.invalid/post',
             'location':'img.ad','evidence_text':'계좌 임대 등록비 <script>test</script>',
             'reasons':['계좌 거래와 대가 지급 문맥'],'image_id':'im_1'}
        output=review_report({'meta':{},'findings':[]},{'ad_candidates':[row],
            'ocr_images':[{'id':'im_1','preview_data_url':'data:image/jpeg;base64,/9j/'}]}, {})
        self.assertIn('계좌·통장 거래 의심',output['html'])
        self.assertIn('계좌 임대 등록비',output['html'])
        self.assertIn('저장된 이미지 근거',output['html'])
        self.assertNotIn('<script>',output['html'])

    def test_partial_report_has_traceability_counts_and_inert_content(self):
        result = {'meta': {'entry_url': 'https://example.invalid/'}, 'findings': [{}]}
        scan = {'status': 'completed', 'pages_scanned': ['/'], 'candidate_count': 2,
                'evidence_packets': [{'id': 'p1', 'url': 'https://example.invalid/post',
                                     'location': 'article', 'text': '<script>alert(1)</script>',
                                     'source_kind': 'image_ocr', 'snapshot_id': 's1'}],
                'screenshots': {'s1': {'data_url': 'data:image/jpeg;base64,/9j/'}},
                'ocr_summary': {'completed': 1}, 'local_ai': {'text_analyzed': 1}}
        agent = {'ledger': {'calls': 6, 'charged_tokens': 12000},
                 'report': {'status': 'partial', 'total': 10, 'completed': 1,
                            'stop_reason': '사용 한도 도달', 'assessments': [
                                {'assessment': 'uncertain', 'summary': '<img onerror=alert(1)>',
                                 'evidence_ids': ['p1'], 'missing_evidence': ['가입 유도 문맥']}]}}
        output = review_report(result, scan, agent)
        self.assertIn('미검토: 9개', output['markdown'])
        self.assertIn('https://example.invalid/post', output['markdown'])
        self.assertIn('근거 ID: p1', output['markdown'])
        self.assertIn('이미지 OCR', output['markdown'])
        self.assertIn('사용 한도 도달', output['markdown'])
        self.assertNotIn('<script>', output['html'])
        self.assertNotIn('<img onerror', output['html'])
        self.assertIn('Content-Security-Policy', output['html'])
        self.assertIn('src="data:image/jpeg;', output['html'])

    def test_scan_report_available_without_paid_review(self):
        output = review_report({'meta': {}, 'findings': []}, {'status': 'cancelled'}, {})
        self.assertIn('미실행', output['markdown'])
        self.assertIn('아직 AI 검토 결과가 없습니다', output['markdown'])
        self.assertNotIn('전체 검토 완료', output['markdown'])
