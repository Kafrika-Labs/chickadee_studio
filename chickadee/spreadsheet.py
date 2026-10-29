"""Offline XLSX export. Untrusted evidence is always stored as literal text."""
import io
import json
from pathlib import Path
import re
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

from .candidates import CATEGORY_LABELS
from .detection import LABELS
from .exports import atomic_write, csv_bytes

COLUMNS = ('항목 ID', '구분', '탐지 유형', '게시글 주소', '탐지 원문', '위치',
           '출처', 'OCR 추출문', '검토 상태', '검토 메모', '검토 시각', '탐지 시각')
WIDTHS = (18, 16, 24, 48, 68, 38, 18, 68, 16, 44, 28, 28)
REVIEW_LABELS = {'unreviewed': '미검토', 'confirmed': '검토 확인', 'dismissed': '검토 제외'}
_INVALID = re.compile('[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff\ufffe\uffff]')


def selected_outcome(result, report, ids=None):
    if ids is None:
        return result, report
    if not isinstance(ids, list) or not ids or any(not isinstance(i, str) for i in ids):
        raise ValueError('저장할 항목을 선택하세요.')
    requested = set(ids)
    known = {row['id'] for row in [*result['findings'], *report.get('ad_candidates', [])]}
    if not requested <= known:
        raise ValueError('현재 검사에 없는 항목입니다. 내역을 다시 확인하세요.')
    return ({**result, 'findings': [r for r in result['findings'] if r['id'] in requested]},
            {**report, 'ad_candidates': [r for r in report.get('ad_candidates', []) if r['id'] in requested]})


def export_rows(result, report, reviews=None):
    reviews = (reviews or {}).get('items', {})
    images = {image['id']: image for image in report.get('ocr_images', [])}
    for required, entries in ((True, result['findings']), (False, report.get('ad_candidates', []))):
        for entry in entries:
            detail = report.get('evidence_details', {}).get(entry['id'], {}) if required else entry
            sources = [detail, *detail.get('evidence_sources', [])]
            is_ocr = any(s.get('source_kind') == 'image_ocr' for s in sources)
            texts = []
            for source in sources:
                if source.get('source_kind') != 'image_ocr':
                    continue
                image = images.get(source.get('image_id'), {})
                text = image.get('text') or (source.get('text') if source.get('source_kind') == 'image_ocr' else '')
                if text and text not in texts:
                    texts.append(text)
            if is_ocr and not texts:
                texts.append(entry.get('evidence_text', ''))
            review = reviews.get(entry['id'], {})
            yield entry['id'], [entry['id'], '필수 탐지' if required else '광고 의심',
                LABELS.get(entry.get('technique'), CATEGORY_LABELS.get(entry.get('category'), entry.get('category', ''))),
                entry.get('url', ''), entry.get('evidence_text', ''), entry.get('location', ''),
                '이미지 OCR' if is_ocr else ('이미지 분석' if detail.get('source_kind') == 'image_visual' else '텍스트'),
                '\n'.join(texts), REVIEW_LABELS.get(review.get('status'), '미검토'), review.get('note', ''),
                review.get('updated_at', ''), detail.get('observed_at', '')]


def _column(index):
    value = ''
    while index:
        index, remainder = divmod(index - 1, 26)
        value = chr(65 + remainder) + value
    return value


def _text(value):
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)
    value = _INVALID.sub('', str(value if value is not None else ''))
    if len(value.encode('utf-16-le')) // 2 > 32767:
        raise ValueError('엑셀 셀의 글자 한도(32767자)를 넘었습니다. 원문은 JSON 또는 CSV로 저장하세요.')
    return escape(value)


def xlsx_bytes(result, report, reviews=None, *, extra_columns=(), extras=None):
    columns = (*COLUMNS, *extra_columns)
    if len(columns) > 16384:
        raise ValueError('엑셀 열 한도를 넘었습니다.')
    output = io.BytesIO()
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            '</Types>')
        archive.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        archive.writestr('xl/workbook.xml', f'<workbook xmlns="{ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="탐지 내역" sheetId="1" r:id="rId1"/></sheets></workbook>')
        archive.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
        archive.writestr('xl/styles.xml', f'<styleSheet xmlns="{ns}"><fonts count="2">'
            '<font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="맑은 고딕"/></font></fonts>'
            '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
            '<fill><patternFill patternType="solid"><fgColor rgb="FF303238"/><bgColor indexed="64"/></patternFill></fill></fills>'
            '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
            '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs>'
            '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')
        with archive.open('xl/worksheets/sheet1.xml', 'w') as sheet:
            def write(text):
                sheet.write(text.encode('utf-8'))
            write(f'<worksheet xmlns="{ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>')
            write('<cols>' + ''.join(f'<col min="{i}" max="{i}" width="{WIDTHS[i-1] if i<=len(WIDTHS) else 28}" customWidth="1"/>' for i in range(1, len(columns)+1)) + '</cols><sheetData>')
            def row(index, values, header=False):
                if index > 1048576:
                    raise ValueError('엑셀 행 한도를 넘었습니다. 선택 항목을 나누어 저장하세요.')
                write(f'<row r="{index}" ht="{30 if header else 60}" customHeight="1">')
                for i, value in enumerate(values, 1):
                    write(f'<c r="{_column(i)}{index}" s="{1 if header else 0}" t="inlineStr"><is><t xml:space="preserve">{_text(value)}</t></is></c>')
                write('</row>')
            row(1, columns, True)
            last = 1
            for last, (key, values) in enumerate(export_rows(result, report, reviews), 2):
                extra = (extras or {}).get(key, [''] * len(extra_columns))
                if len(extra) != len(extra_columns):
                    raise ValueError('추가 내보내기 열 수가 일치하지 않습니다.')
                row(last, [*values, *extra])
            write(f'</sheetData><autoFilter ref="A1:{_column(len(columns))}{last}"/></worksheet>')
    return output.getvalue()


def save_results(path, result, report, reviews=None, ids=None, **options):
    path = Path(path)
    extension = path.suffix.lower()
    if extension not in ('.xlsx', '.csv'):
        raise ValueError('저장 형식은 XLSX 또는 CSV를 선택하세요.')
    result, report = selected_outcome(result, report, ids)
    payload = xlsx_bytes(result, report, reviews, **options) if extension == '.xlsx' else csv_bytes(result, report)
    atomic_write(path, payload)
    return {'path': str(path), 'format': extension[1:], 'count': len(result['findings']) + len(report.get('ad_candidates', []))}
