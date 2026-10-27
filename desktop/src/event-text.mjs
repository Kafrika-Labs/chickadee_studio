import { language, t } from './i18n.mjs';

const messages = {
  '문자 TF-IDF · Random Forest': 'Character TF-IDF · Random Forest',
  '화면 특징 · Random Forest': 'Visual features · Random Forest',
  '검증한 Laya 모델을 적용하지 않았습니다.': 'A validated Laya model has not been applied.',
  '문맥 검토에 필요한 원문 범위가 부족합니다.': 'Not enough source text for context review.',
  '검사 제한시간 또는 사용자 중단으로 처리하지 않았습니다.': 'Not processed because the scan timed out or was stopped.',
  '남은 검사 시간이 없어 검토를 생략했습니다.': 'Review skipped because no scan time remained.',
  'Laya 검토에 필요한 메모리가 부족합니다.': 'Not enough memory for Laya review.',
  '로컬 Laya 실행 환경을 찾지 못했습니다.': 'The local Laya runtime could not be found.',
  'Laya 검토 제한시간을 초과했습니다.': 'Laya review timed out.',
  'Laya 검토를 완료하지 못했습니다.': 'Laya review could not be completed.',
  '로컬 문자 모델을 불러오지 못했습니다.': 'The local text model could not be loaded.',
  '지원하지 않거나 손상된 이미지입니다.': 'The image is unsupported or damaged.',
  '화면 모델 분석 실패': 'Visual model analysis failed',
  '브라우저를 준비하고 있습니다.': 'Preparing the browser.',
  '로컬 AI 모델을 준비합니다.': 'Preparing local AI models.',
  '로컬 AI 모델 준비 실패: 원문·규칙 검사는 계속합니다.': 'Local AI models could not be loaded. Text and rule checks will continue.',
  '페이지로 이동하고 HTML 응답을 확인합니다.': 'Opening the page and checking the HTML response.',
  'PNG/JPEG/WebP/GIF 이미지만 수집합니다.': 'Only PNG, JPEG, WebP and GIF images are collected.',
  '탐색과 별도의 로컬 분석 시간으로 수집한 본문과 OCR 문구를 처리합니다.': 'Analyzing collected text and OCR content with a separate local analysis time budget.',
  '이미지 내용을 ML로 분류합니다.': 'Classifying image content with the local model.',
  '이미지 수집 경로에서 처리한 첨부파일입니다. 문서 방문을 생략합니다.': 'This attachment was handled by image collection. Skipping the document visit.',
  '응답 수신 · 렌더링 준비': 'Response received · preparing to render',
  '일시 연결 오류 · 같은 읽기 요청을 한 번 재시도합니다.': 'Temporary connection error · retrying the read request once.',
  'DOM·본문·계산된 CSS·링크를 수집합니다.': 'Collecting the DOM, text, computed styles and links.',
  '화면 미리보기를 생성하지 못했습니다. 본문 검사는 계속합니다.': 'Preview unavailable. Text inspection will continue.',
  '설정된 읽기 버튼을 실행합니다.': 'Activating the configured read button.',
  '광고 주제·권유 문맥·정상 대조 문맥을 분석합니다.': 'Analyzing advertising topics, promotional context and benign context.',
  'PaddleOCR로 이미지 속 글자를 읽습니다.': 'Reading image text with PaddleOCR.',
  '근거 화면 촬영 실패: 원문·CSS 근거는 보존합니다.': 'Evidence screenshot failed. Original text and CSS evidence are preserved.',
  'HTTP 429: 해당 사이트 요청을 중단합니다.': 'HTTP 429: stopping requests to this site.',
  'GET/HEAD 외 요청 차단': 'Blocked a request other than GET or HEAD',
  '로컬 전용 모드: 외부 자원 차단': 'Local-only mode: blocked an external resource',
  'HTTP 429 수신으로 해당 origin 추가 요청 중단': 'Stopped further requests to this origin after HTTP 429',
  '사이트 밖 문서 이동·리다이렉션 차단': 'Blocked off-site navigation or redirect',
  '허용되지 않은 origin 차단': 'Blocked an unapproved origin',
  'HTTP(S) 외 자원 차단': 'Blocked a non-HTTP(S) resource',
  '사이트 밖 리다이렉션 응답 차단': 'Blocked an off-site redirect response',
  '리소스·iframe HTTP 리다이렉션 제한': 'Resource or iframe HTTP redirect limit',
};
const patterns = [
  [/^(\d+)\/(\d+) 페이지 점검 중: (.*)$/s, (_, n, total, url) => `Inspecting page ${n}/${total}: ${url}`],
  [/^동일 문구의 본문·OCR 근거 (\d+)건을 합쳤습니다\.$/, (_, n) => `Merged ${n} text and OCR observations with identical content.`],
  [/^스크롤 (\d+): 지연 로딩과 숨은 콘텐츠 변경을 확인합니다\.$/, (_, n) => `Scroll ${n}: checking lazy-loaded and hidden content changes.`],
  [/^(\d+)개 요소의 문자 위장·자모·투명·화면 밖 은닉을 검사합니다\.$/, (_, n) => `Checking ${n} elements for disguised characters, decomposed Hangul, transparent text and off-screen content.`],
  [/^일시 오류 재시도 (\d+)\/(\d+): (.*)$/s, (_, n, total, url) => `Retrying after a temporary error ${n}/${total}: ${url}`],
  [/^점검 누락: (.*)$/s, (_, detail) => `Inspection skipped: ${detail.replace('페이지 제한시간 초과', 'Page time limit exceeded')}`],
  [/^이미지 OCR 처리 실패: (.*)$/s, (_, detail) => `Image OCR failed: ${eventText(detail)}`],
];

// Translate application messages only; preserve URLs, evidence and unknown diagnostics.
export function eventText(message) {
  if (!message || language() === 'ko') return message;
  if (messages[message]) return messages[message];
  for (const [pattern, replace] of patterns) {
    if (pattern.test(message)) return message.replace(pattern, replace);
  }
  return t(message);
}

export function eventKindLabel(kind) {
  const labels = {
    progress: ['검사 진행 상태 갱신', 'Scan progress updated'],
    exploration: ['탐색 경로 갱신', 'Exploration path updated'],
    image_ocr: ['이미지 OCR 처리', 'Image OCR processing'],
    image_skipped: ['이미지 수집 생략', 'Image collection skipped'],
    request_failed: ['요청 실패', 'Request failed'],
    preview_unavailable: ['미리보기 없음', 'Preview unavailable'],
    control: ['검사 상태 변경', 'Scan state changed'],
  };
  return labels[kind]?.[language() === 'ko' ? 0 : 1] || kind;
}
