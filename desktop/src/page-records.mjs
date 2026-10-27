import { t } from "./i18n.mjs";

const risk = ['DRUGS', 'ACCOUNT_TRADE', 'GAMBLING', 'ADULT', 'LOAN', 'INVESTMENT', 'COMMERCIAL', 'AI_CONTEXT', 'IMAGE_REVIEW'];
const unique = values => [...new Set(values.filter(Boolean))];

export function evidenceRole(source) {
  let role = source.source_role;
  // Older captures called every heading a post title.
  if (role === 'title' && /(?:^| > )h[2-6](?=[:.# >]|$)/.test(source.location || '') &&
      !/(?:post-title|board-title|entry-title|article-title)/.test(source.location || '')) role = 'heading';
  return ({title:t("제목"), heading:t("소제목"), comment:t("댓글"), body:t("본문")})[role] ||
    (['image_ocr','image_visual'].includes(source.source_kind) ? t("이미지") : t("텍스트"));
}

export function groupPageRecords(rows, details = {}) {
  const pages = new Map();
  for (const row of rows) {
    const key = row.url.split('#')[0]; // Keep query parameters: they identify individual posts.
    if (!pages.has(key)) pages.set(key, []);
    pages.get(key).push(row);
  }
  return [...pages.values()].map(members => {
    const types = unique(members.map(r => r.category)).sort((a, b) => risk.indexOf(a) - risk.indexOf(b));
    const categories = types.length > 1 ? types.filter(c => c !== 'IMAGE_REVIEW') : types;
    const primary = members.find(r => r.technique) || members.find(r => r.category === categories[0]) || members[0];
    const evidence = members.map(row => ({...row, ...(row._detail || details[row.id] || {}),
      id: row.id, technique: row.technique, category: row.category, evidence_text: row.evidence_text}));
    const primaryEvidence = evidence.find(r => r.id === primary.id);
    const texts = unique([primary.evidence_text, ...members.map(r => r.evidence_text),
      ...evidence.flatMap(item => (item.evidence_sources || []).map(source => source.text))]);
    const sources = evidence.flatMap(item => (item.evidence_sources?.length ? item.evidence_sources : [{
      source_kind: item.source_kind || 'dom_text', source_role: item.source_role,
      location: item.location, text: item.evidence_text, image_id: item.image_id,
      screenshot_id: item.screenshot_id,
    }]).map(source => ({...source, category: item.category, technique: item.technique})));
    const sourceKeys = new Set();
    const evidence_sources = sources.filter(source => {
      const key = JSON.stringify([source.source_kind, source.location, source.image_id, source.text]);
      if (sourceKeys.has(key)) return false;
      sourceKeys.add(key); return true;
    });
    const merged = {...primaryEvidence, ...primary, id: members[0].id,
      member_ids: members.map(r => r.id), categories, techniques: unique(members.map(r => r.technique)),
      category: categories[0], evidence_text: texts.join('\n\n'), evidence_sources,
      page_evidence: evidence, page_group: true,
      matched_keywords: unique(evidence.flatMap(r => r.matched_keywords || [])),
      reasons: unique(evidence.flatMap(r => r.reasons || r.style_reasons || []))};
    merged._detail = {...primaryEvidence, ...merged};
    return merged;
  });
}

export function pageReview(record, items) {
  const ids = record.member_ids || [record.id];
  const values = ids.map(id => items[id]?.status || 'unreviewed');
  return {...items[record.id], status: values.every(status => status === values[0]) ? values[0] : 'unreviewed'};
}

export function expandPageIds(ids, records) {
  return unique(ids.flatMap(id => records.find(record => record.id === id)?.member_ids || [id]));
}
