import { t } from "./i18n.mjs";

// Review groups, not legal determinations. General includes untyped AI hits.
const riskTopics = new Set(["GAMBLING", "ADULT", "DRUGS", "ACCOUNT_TRADE"]);
export function advertisingGroup(record) {
  if (!record.category) return "required";
  if (record.category === "IMAGE_REVIEW" || record.source_kind === "image_visual") return "image_review";
  if (riskTopics.has(record.category)) return "illegal_suspected";
  if (["LOAN", "INVESTMENT"].includes(record.category) &&
      /신용\s*확인\s*없이|무등록|작업\s*대출|원금\s*보장|수익\s*보장|고수익/.test(record.evidence_text || "")) {
    return "illegal_suspected";
  }
  return "general_ads";
}

// Normalize historical photo-only rows for display without rewriting evidence.
export function normalizeVisualCandidates(rows, images = []) {
  const seen = new Set();
  return rows.flatMap(row => {
    if (row.source_kind !== 'image_visual') return [row];
    const visual = row.local_ai?.content_visual;
    const image = images.find(image => image.id === row.image_id);
    const occurrences = images.filter(image => image.image_sha256 && image.image_sha256 === visual?.image_sha256);
    const repeated = new Set(occurrences.map(image => image.url)).size >= 3;
    const brandedInterface = /(?:^|[ .])(?:logo|brand|site-logo|brand-logo)(?=[ >:.]|$)/.test(image?.location || row.location || '');
    if (image?.interface_image || brandedInterface || repeated) return [];
    const key = visual?.image_sha256 || `${row.url}|${row.image_id || row.location}`;
    if (seen.has(key)) return [];
    seen.add(key);
    if (rows.some(other => other.source_kind !== 'image_visual' && other.category &&
        other.url === row.url && other.image_id && other.image_id === row.image_id)) return [];
    return [{...row, category: 'IMAGE_REVIEW',
      evidence_text: /^(도박 이미지|성인물 이미지|마약 관련 이미지)$/.test(row.evidence_text || '')
        ? t("문자 근거 없는 이미지 · 검토 필요") : row.evidence_text,
      reasons: [t("사진 모델의 단독 신호로 남긴 이미지 검토 항목입니다."),
        t("광고 여부와 도박·성인·마약 주제는 확인되지 않았습니다.")]}];
  });
}

export function commercialSupport(text) {
  text = (text || '').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
  if (/(?:새로나온|신제품|출시).{0,40}(?:사용해보세요|체험해보세요|경험해보세요)/.test(text)) return true;
  const subject = /상품|제품|서비스|판매|구매|주문|가격|예약|시술|수술|수강|배송|매장|쇼핑|브랜드|스토어|숙박|업체|대출|투자|카지노|슬롯|토토|베팅|성인방송|마약|계좌/.test(text);
  const offer = /할인|특가|무료체험|쿠폰|혜택|보너스|사은품|증정|최저가|우대가|적립|수익|\d+(?:,\d{3})*(?:만|천)?원/.test(text);
  const action = /문의|상담|신청|구매|주문|예약|방문|받으|가입|클릭/.test(text);
  const pitch = /추천합니다|놓치지마|만나보세요|판매합니다|예약하세요|구매하세요|주문하세요/.test(text);
  return subject && ((offer && action) || pitch);
}

export function normalizeCandidates(rows, images = []) {
  return normalizeVisualCandidates(rows, images).filter(row => row.category !== 'AI_CONTEXT' || commercialSupport(row.evidence_text));
}
