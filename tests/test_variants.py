import unittest
from chickadee.variants import find_variants
from chickadee.detection import analyze, analyze_element


class VariantTests(unittest.TestCase):
    def test_requested_variants_preserve_source(self):
        cases = [('밖!콰라', '바카라'), ('qkzkfk', '바카라'), ('ㅂㅋㄹ', '바카라'),
                 ('카\u200b지노', '카지노'), ('안전 놀이터', '안전놀이터'),
                 ('카2노', '카지노'), ('카징노', '카지노'), ('토.토', '토토'),
                 ('ⓒⓐⓢⓘⓝⓞ', 'casino'), ('ᴄᴀsɪɴᴏ', 'casino'),
                 ('🅲🅰🆂🅸🅽🅾', 'casino'), ('🄲🄰🅂🄸🄽🄾', 'casino'),
                 ('çáśîñö', 'casino'), ('c a s i n o', 'casino'),
                 ('саsіnо', 'casino'), ('ｃａｓｉｎｏ', 'casino')]
        for raw, keyword in cases:
            with self.subTest(raw=raw):
                text = '😀 ' + raw + ' 가입 보너스'
                hit = next(m for m in find_variants(text, (keyword,)) if m['original'] == raw)
                self.assertEqual(text[slice(*hit['source_span'])], raw)
                self.assertEqual(hit['canonical'], keyword)
                self.assertTrue(analyze(text)['is_advertisement'])

    def test_no_topic_only_or_prevention_promotion(self):
        for text in ['밖!콰라', 'ㅂㅋㄹ 예방 안내', 'qkzkfk 피해상담 가입', '바카라 실무개론 무료']:
            self.assertFalse(analyze(text)['is_advertisement'], text)

    def test_no_cross_line_or_ordinary_word_matches(self):
        self.assertEqual(find_variants('ca\nsino timeslot 오피스 opinion', ('casino','slot','오피')), [])

    def test_variant_is_a_review_candidate_without_inventing_a_technique(self):
        from chickadee.candidates import analyze_candidate
        from chickadee.detection import techniques
        text = '밖!콰라 가입 보너스'
        hit = analyze_candidate(text)[0]
        self.assertEqual(hit['category'], 'GAMBLING')
        self.assertEqual(hit['analysis']['matches'][0]['original'], '밖!콰라')
        self.assertEqual(techniques(text), [])

    def test_span_merge_keeps_original(self):
        text = '일반 글\n밖!콰라 가입 보너스'
        result = analyze_element({'text':text, 'text_breaks':[len('일반 글\n')]})
        hit = next(m for m in result['matches'] if m.get('canonical') == '바카라')
        self.assertEqual(text[slice(*hit['source_span'])], '밖!콰라')


if __name__ == '__main__':
    unittest.main()
