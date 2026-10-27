"""Offline, self-contained review reports built only from persisted observations."""
from html import escape
import re
from .candidates import CATEGORY_LABELS
from .detection import LABELS as TECHNIQUE_LABELS

LABELS = {'ad_suspected': '광고 의심', 'benign_context': '정상 문맥', 'uncertain': '추가 확인'}
STATUS = {'completed': '완료', 'partial': '부분 검토', 'stopped': '중단', 'running': '검토 중',
          'cancelled': '중단', 'failed': '실패'}


def review_report(result, scan, agent):
    review = agent.get('report') or {}
    assessments = review.get('assessments', agent.get('assessments', []))
    packets = {p['id']: p for p in scan.get('evidence_packets', [])}
    total = review.get('total', len(packets))
    completed = review.get('completed', len(assessments))
    ledger, meta = agent.get('ledger', {}), result.get('meta', {})
    lines = ['# Chickadee 검사 리포트', '', '## 검사 개요', '',
             f"- 대상: {meta.get('entry_url', '')}", f"- 검사 상태: {STATUS.get(scan.get('status'), scan.get('status', '미확인'))}",
             f"- 검사 종료: {meta.get('finished_at', '기록 없음')}",
             f"- 방문 페이지: {len(scan.get('pages_scanned', []))}개",
             f"- 필수 기법 탐지: {len(result.get('findings', []))}개",
             f"- 광고 문맥 후보: {scan.get('candidate_count', 0)}개", '', '## AI 검토 요약', '',
             f"- 검토 상태: {STATUS.get(review.get('status'), '미실행')}",
             f'- 수집 영역: {total}개 / 검토 완료: {completed}개 / 미검토: {max(0, total-completed)}개',
             f"- AI 요청: {ledger.get('calls', 0)} / {ledger.get('call_limit', 6)}회",
             f"- 한도 차감 토큰: {ledger.get('charged_tokens', 0)} / {ledger.get('token_limit', 24000)}",
             '- 의심 근거를 우선 검토합니다. 미검토 항목은 정상으로 판정하지 않습니다.',
             '- AI 의견과 모델 점수는 위법 여부의 확정 판정이 아닙니다. 원문과 문맥을 함께 확인하세요.']
    if review.get('stop_reason'):
        lines += [f"- 종료 사유: {review['stop_reason']}"]
    local, ocr = scan.get('local_ai') or {}, scan.get('ocr_summary') or {}
    lines += ['', '## 처리 통계', '',
              f"- ML 문자 분석: {local.get('text_analyzed', 0)}개 영역",
              f"- ML 이미지 분류: {(scan.get('content_visual') or {}).get('analyzed', 0)}장 / 검토 신호 {(scan.get('content_visual') or {}).get('flagged', 0)}건",
              f"- Laya 분석: {(local.get('laya') or {}).get('analyzed', 0)}개 영역 (검증된 결과가 없으면 미적용)",
              f"- OCR: 문자 추출 {max(0, ocr.get('completed', 0)-ocr.get('unreadable', 0))}장 / 판독 불가 {ocr.get('unreadable', 0)}장 / 처리 실패 {ocr.get('failed', 0)}장 / 생략 {ocr.get('skipped', 0)}장",
              '- OCR은 이미지가 있을 때만 실행합니다. 문자 인식 오류와 수집 생략은 탐지 실패와 구분합니다.',
              '', '## 로컬 탐지 결과', '']
    images = []
    captures = scan.get('screenshots') or {}
    image_sources = {image['id']: image for image in scan.get('ocr_images', [])}
    local_rows = [{**item, **scan.get('evidence_details', {}).get(item.get('id'), {})}
                  for item in result.get('findings', [])] + scan.get('ad_candidates', [])
    if not local_rows:
        lines += ['저장된 로컬 탐지 항목이 없습니다. 미확인 이미지와 누락 페이지는 처리 통계를 확인하세요.']
    included_images = set()
    for index, item in enumerate(local_rows, 1):
        label = TECHNIQUE_LABELS.get(item.get('technique'), CATEGORY_LABELS.get(item.get('category'), '검토 항목'))
        lines += [f"### {index}. {label}", '', f"- 항목 ID: {item.get('id', '')}",
                  f"- 페이지: {item.get('url', '')}", f"- 위치: {item.get('location', '')}",
                  '- 검출 사유: ' + ' / '.join(item.get('reasons', [])), '', '원문:', '',
                  '> ' + str(item.get('evidence_text', item.get('text', '기록 없음')))[:4000].replace('\n', '\n> '), '']
        image = image_sources.get(item.get('image_id'), {})
        screenshot = captures.get(item.get('screenshot_id'), {})
        for data in (image.get('preview_data_url', ''), screenshot.get('data_url', '')):
            if data not in included_images and len(data) <= 270000 and re.fullmatch(r'data:image/jpeg;base64,[A-Za-z0-9+/=]+', data):
                included_images.add(data)
                images.append((len(lines), data))
                lines += ['저장된 이미지 근거:', '']
    lines += ['', '## 항목별 AI 검토', '']
    if not assessments:
        lines += ['아직 AI 검토 결과가 없습니다. 위 검사 통계는 로컬 검사 결과입니다.']
    for index, item in enumerate(assessments, 1):
        ids = item.get('evidence_ids', [])
        source = next((packets[i] for i in ids if i in packets), {})
        lines += [f"### {index}. {LABELS.get(item.get('assessment'), '추가 확인')}", '',
                  item.get('summary', ''), '', f"- 근거 ID: {', '.join(ids) or '없음'}",
                  f"- 페이지: {source.get('url', '기록 없음')}",
                  f"- 위치: {source.get('location', '기록 없음')}",
                  f"- 입력: {'이미지 OCR' if source.get('source_kind') == 'image_ocr' else '웹페이지 문자'}",
                  f"- 미확인: {', '.join(item.get('missing_evidence', [])) or '없음'}",
                  f"- 피싱 검토: { {'suspected':'의심 신호', 'no_observed_signal':'관측 신호 없음', 'uncertain':'추가 확인'}.get(item.get('phishing_assessment'), '미평가')}",
                  f"- 검토 모델: {item.get('provider', 'groq')} / {item.get('model', '기록 없음')}", '', '원문:', '',
                  '> ' + str(source.get('text', '기록 없음'))[:1600].replace('\n', '\n> '), '']
        captures = scan.get('screenshots') or {}
        screenshot = next((captures[key] for key in (item.get('snapshot_id'), source.get('snapshot_id'), source.get('last_snapshot_id')) if key in captures), {})
        data = screenshot.get('data_url', '')
        if len(data) <= 270000 and re.fullmatch(r'data:image/jpeg;base64,[A-Za-z0-9+/=]+', data):
            images.append((len(lines), data))
            lines += ['촬영 당시 화면:', '']
    lines += ['## 검토 기준', '', '광고 문맥, 문자 위장, CSS 관측, 피싱 신호를 구분합니다. '
              '예방 안내나 보도에 등장하는 주제어만으로 광고로 판정하지 않습니다. '
              '화면에 보이지 않는 요소는 스크린샷에 나타나지 않을 수 있습니다.']
    markdown = '\n'.join(lines).replace('\x00', '') + '\n'
    body = []
    image_map = dict(images)
    for i, line in enumerate(lines):
        if i in image_map:
            body.append('<figure><img alt="촬영 당시 화면" src="' + image_map[i] + '"></figure>')
        if line.startswith('#'):
            level = len(line)-len(line.lstrip('#'))
            body.append(f'<h{level}>' + escape(line[level:].strip()) + f'</h{level}>')
        elif line.startswith('> '):
            body.append('<blockquote>' + escape(line[2:]).replace('\n&gt; ', '<br>') + '</blockquote>')
        elif line:
            body.append('<p>' + escape(line) + '</p>')
    html = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Chickadee 검사 리포트</title><style>
body{font:15px/1.7 Pretendard,"Malgun Gothic",sans-serif;color:#202833;margin:48px auto;padding:0 28px;max-width:980px;overflow-wrap:anywhere}
h1{font-size:30px;border-bottom:2px solid #243c55;padding-bottom:20px}h2{margin-top:38px;font-size:21px}h3{margin-top:30px;font-size:18px}
p{margin:8px 0}blockquote{margin:16px 0;padding:18px;background:#f3f5f7;white-space:pre-wrap}figure{margin:20px 0}img{max-width:100%;border:1px solid #dce1e7}
@media print{body{margin:0;max-width:none;font-size:11px}h2,h3{break-after:avoid}figure,blockquote{break-inside:avoid}}</style><body>''' + '\n'.join(body) + '</body></html>'
    return {'markdown': markdown, 'html': html}
