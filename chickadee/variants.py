"""Bounded keyword variants with offsets into the untouched source text."""
import re
import unicodedata as ud
from .unicode_security import fold_letters

LEADS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
TAILS = 'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'
KEYS = dict(zip('rRseEfaqQtTdwWczxvgkoiOjpuPhynbml', 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅒㅓㅔㅕㅖㅗㅛㅜㅠㅡㅣ'))
JAMO = dict(zip(map(chr, range(0x1100, 0x1113)), LEADS))
JAMO.update(zip(map(chr, range(0x1161, 0x1176)), VOWELS))
JAMO.update(zip(map(chr, range(0x11A8, 0x11C3)), TAILS))
LATIN = str.maketrans({'ø':'o', 'đ':'d', 'ł':'l', 'þ':'p', 'ð':'d',
    'ᴀ':'a', 'ʙ':'b', 'ᴄ':'c', 'ᴅ':'d', 'ᴇ':'e', 'ꜰ':'f', 'ɢ':'g', 'ʜ':'h',
    'ɪ':'i', 'ᴊ':'j', 'ᴋ':'k', 'ʟ':'l', 'ᴍ':'m', 'ɴ':'n', 'ᴏ':'o', 'ᴘ':'p',
    'ʀ':'r', 'ꜱ':'s', 'ᴛ':'t', 'ᴜ':'u', 'ᴠ':'v', 'ᴡ':'w', 'ʏ':'y', 'ᴢ':'z'})
SOUNDS = str.maketrans({'ㄲ':'ㄱ','ㅋ':'ㄱ','ㄸ':'ㄷ','ㅌ':'ㄷ','ㅃ':'ㅂ','ㅍ':'ㅂ',
    'ㅆ':'ㅅ','ㅉ':'ㅈ','ㅊ':'ㅈ','ㅐ':'ㅔ','ㅒ':'ㅖ','ㅘ':'ㅏ','ㅙ':'ㅔ','ㅚ':'ㅔ','ㅝ':'ㅓ','ㅞ':'ㅔ'})
INITIALS = {'ㅂㅋㄹ':'바카라', 'ㅋㅈㄴ':'카지노', 'ㅌㅌ':'토토'}
DIGITS = {'0':'o', '1':'i', '3':'e', '4':'a', '5':'s', '7':'t', '2':'지'}


def _fold(char):
    char = ''.join(chr(ord('a') + ord(c) - base) if base is not None else c
                   for c in char
                   for base in [next((b for b in (0x1f130, 0x1f150, 0x1f170)
                                      if b <= ord(c) < b + 26), None)])
    normalized = ud.normalize('NFKC', char).casefold().translate(LATIN)
    # Remove accents only from non-Hangul letters; preserve Korean syllables.
    result = ''
    for c in normalized:
        if '\uac00' <= c <= '\ud7a3' or '\u1100' <= c <= '\u11ff':
            result += c
        else:
            result += ''.join(x for x in ud.normalize('NFKD', c) if ud.category(x) != 'Mn')
    return fold_letters(result).translate(LATIN)


def _sound(text):
    out = ''
    for c in text:
        if '\uac00' <= c <= '\ud7a3':
            n = ord(c) - 0xac00
            out += LEADS[n // 588] + VOWELS[n % 588 // 28]
        else:
            out += c
    return out.translate(SOUNDS)


def _jamo(text):
    return ''.join(JAMO.get(c, c) for c in ud.normalize('NFKD', text))


def find_variants(text, keywords):
    """Return interpretation evidence, not an advertising or legality verdict."""
    folded, offsets = [], []
    for i, c in enumerate(text):
        for x in _fold(c):
            if x.isalnum():
                folded.append(x); offsets.append(i)
    compact = ''.join(folded)
    sounds = _sound(compact)
    sound_offsets = [i for i,c in enumerate(compact) for _ in _sound(c)]
    tokens = list(re.finditer(r'[A-Za-z0-9가-힣]+', text))
    found = {}

    def add(start, end, keyword, method):
        raw = text[start:end]
        if raw.casefold() == keyword.casefold():
            return
        # Never join distant paragraphs or arbitrary long punctuation runs.
        if '\n' in raw or '\r' in raw or end - start > max(24, len(keyword) * 5):
            return
        if keyword.isascii() and ((start and text[start-1].isascii() and text[start-1].isalpha()) or
                (end < len(text) and text[end].isascii() and text[end].isalpha())):
            return
        key = (start, end, keyword)
        if key not in found:
            found[key] = {'keyword':keyword, 'source_span':[start,end], 'original':raw,
                          'canonical':keyword, 'variant_methods':[]}
        if method not in found[key]['variant_methods']:
            found[key]['variant_methods'].append(method)

    for keyword in keywords:
        needle = ''.join(c for c in _fold(keyword) if c.isalnum())
        if not needle:
            continue
        for m in re.finditer(re.escape(needle), compact):
            start, end = offsets[m.start()], offsets[m.end()-1]+1
            raw = text[start:end]
            methods = []
            if any(ud.category(c) in {'Cf', 'Mn', 'Me'} for c in raw): methods.append('invisible_or_combining')
            if any(c.isspace() for c in raw): methods.append('spacing')
            if any(ud.category(c).startswith('P') for c in raw): methods.append('symbols')
            if _fold(raw) != raw.casefold(): methods.append('unicode')
            for method in methods: add(start, end, keyword, method)
        # Fuzzy transformations are limited to keywords of three or more syllables.
        if len(keyword) >= 3 and all('\uac00' <= c <= '\ud7a3' for c in keyword):
            for m in re.finditer(re.escape(_sound(keyword)), sounds):
                # Each Hangul syllable produces two sound units; use a separate map.
                start, end = offsets[sound_offsets[m.start()]], offsets[sound_offsets[m.end()-1]]+1
                add(start, end, keyword, 'phonetic')
        if len(keyword) >= 3:
            for m in tokens:
                raw = m[0]
                if len(raw) != len(keyword) or sum(c in DIGITS for c in raw) != 1: continue
                decoded = ''.join(DIGITS.get(c,c) for c in raw)
                if _fold(decoded) == needle: add(*m.span(), keyword, 'substitution')

    allowed = set(keywords)
    for m in re.finditer(r'[ㄱ-ㅎ]+', text):
        if INITIALS.get(m[0]) in allowed: add(*m.span(), INITIALS[m[0]], 'initials')
    for m in re.finditer(r'(?<![A-Za-z])[A-Za-z]{3,30}(?![A-Za-z])', text):
        raw = m[0]
        decoded = ''.join(KEYS.get(c, KEYS.get(c.lower(), c)) for c in raw)
        for keyword in keywords:
            if all('\uac00' <= c <= '\ud7a3' for c in keyword):
                target = _jamo(keyword)
                equal = decoded == target
                phonetic = len(keyword) >= 3 and not any((ord(c)-0xac00)%28 for c in keyword) and decoded.translate(SOUNDS) == target.translate(SOUNDS)
                if equal or phonetic: add(*m.span(), keyword, 'keyboard')
    return list(found.values())
