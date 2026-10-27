import { t } from "./i18n.mjs";

// Titles, subtitles, details and edge labels are display text only; saved workflows keep node IDs and positions.
export const DEFINITIONS = {
  target: {
    title: t("검사 대상"),
    subtitle: t("검사 범위"),
    icon: "Globe2",
    tone: "blue",
    detail: t("시작 URL과 검사 범위를 지정합니다."),
    input: null,
    output: "right",
  },
  browser: {
    title: t("브라우저"),
    subtitle: t("페이지 렌더링"),
    icon: "PanelsTopLeft",
    tone: "blue",
    detail: t("페이지 이동 · 렌더링 · 응답 확인"),
    input: "left",
    output: "right",
  },
  collector: {
    title: t("콘텐츠 수집"),
    subtitle: t("본문 · 링크"),
    icon: "ScanLine",
    tone: "teal",
    detail: t("본문 · 링크 · 계산된 스타일 추출"),
    input: "left",
    output: "right",
  },
  ocr: {
    title: t("이미지 OCR"), subtitle: t("이미지 있을 때만"), icon: "ScanLine", tone: "teal",
    detail: t("이미지가 있을 때만 글자를 추출해 ML에 전달합니다. 본문 텍스트는 OCR을 거치지 않습니다."), input: "left", output: "right",
  },
  techniques: {
    title: t("필수 탐지"),
    subtitle: t("4개 유형"),
    icon: "Fingerprint",
    tone: "purple",
    detail: t("닮은꼴 · 자모 · 투명 · 화면 밖"),
    input: "left",
    output: "right",
  },
  candidates: {
    title: "ML",
    subtitle: t("광고 문맥"),
    icon: "TextSearch",
    tone: "amber",
    detail: t("본문과 OCR 문자를 규칙·Random Forest로 분석합니다."),
    input: "left",
    output: "right",
  },
  laya: {
    title: "Laya", subtitle: t("문맥 검토"), icon: "Sparkles", tone: "teal",
    detail: t("독립 검증을 통과한 로컬 모델로 문맥을 추가 검토합니다. 미적용·생략은 완료로 표시하지 않습니다."),
    input: "left", output: "right",
  },
  dedup: {
    title: t("중복 정리"), subtitle: t("본문 · 이미지 근거"), icon: "Copy", tone: "teal",
    detail: t("같은 페이지·유형·문구의 본문과 OCR 결과를 합치고 각각의 근거를 보존합니다."), input: "left", output: "right",
  },
  report: {
    title: t("결과 출력"),
    subtitle: "JSON · CSV",
    icon: "FileCheck2",
    tone: "teal",
    detail: t("JSON · CSV · 실행 기록 저장"),
    input: "left",
    output: null,
  },
};
export const PAIRS = [
  ["target", "browser"],
  ["browser", "collector"],
  ["collector", "techniques"],
  ["collector", "candidates"],
  ["collector", "ocr"],
  ["ocr", "candidates"],
  ["ocr", "techniques"],
  ["techniques", "dedup"],
  ["candidates", "laya"],
  ["laya", "dedup"],
  ["dedup", "report"],
];
export function workflowPorts(id, direction) {
  const peers = PAIRS.filter(([source, target]) => direction === 'in' ? target === id : source === id)
    .map(([source, target]) => direction === 'in' ? source : target);
  // Match the vertical order of destinations, independently of PAIRS order.
  // OCR uses the middle port, so the image path stays horizontal.
  if (['collector', 'ocr'].includes(id) && direction === 'out') {
    const order = ['techniques', 'ocr', 'candidates'];
    peers.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  // Keep the bypass from the collector below the OCR route into ML.
  if (id === 'candidates' && direction === 'in') peers.reverse();
  return peers.map((peer, index) => ({
    id: peers.length === 1 ? direction : `${direction}-${peer}`,
    peer, top: peers.length === 1 ? 50 : 25 + index * 50 / (peers.length - 1),
  }));
}
export function workflowRoute(source, target, sourceX, targetX) {
  const options = { borderRadius: 12, offset: 24 };
  if (targetX - sourceX < 100) return options;
  if (source === 'collector' && target === 'techniques') options.centerX = sourceX + 44;
  if (source === 'collector' && target === 'candidates') options.centerX = sourceX + 64;
  if (source === 'ocr' && target === 'techniques') options.centerX = targetX - 44;
  if (source === 'ocr' && target === 'candidates') options.centerX = targetX - 64;
  if (source === 'techniques' && target === 'dedup') options.centerX = targetX - 104;
  if (source === 'laya' && target === 'dedup') options.centerX = targetX - 44;
  return options;
}
export const edgeFor = (source, target) => ({
  id: source + "-" + target,
  source,
  target,
  type: "default",
  sourceHandle: workflowPorts(source, 'out').find(port => port.peer === target).id,
  targetHandle: workflowPorts(target, 'in').find(port => port.peer === source).id,
  ...({"collector-ocr":"이미지", "collector-candidates":"본문", "ocr-candidates":"추출 문자"}[source+"-"+target] ? {
    label: {"collector-ocr":t("이미지"), "collector-candidates":t("본문"), "ocr-candidates":t("추출 문자")}[source+"-"+target],
    labelShowBg: true,
    labelStyle: { fill: "#e0e5eb", fontSize: 12, fontWeight: 500 },
    labelBgStyle: { fill: "#242628", stroke: "#41464b", strokeWidth: 1 },
    labelBgPadding: [8, 5], labelBgBorderRadius: 5,
  } : {}),
});
export function hasOCREvidence(record) {
  return record.source_kind === "image_ocr" || record._detail?.source_kind === "image_ocr" ||
    [...(record.evidence_sources || []), ...(record._detail?.evidence_sources || [])]
      .some(source => source.source_kind === "image_ocr");
}
export function ocrPresentation(summary) {
  if (!summary) return null;
  if (summary.enabled === false) return {state:"disabled",caption:t("사용 안 함")};
  if (summary.status === "no_images") return {state:"skipped",caption:t("이미지 없음")};
  if (!["completed","partial"].includes(summary.status)) return null;
  const missing=(summary.failed||0)+(summary.unreadable||0)+(summary.skipped||0);
  const readable=Math.max(0,(summary.completed||0)-(summary.unreadable||0));
  if (missing) return {state: readable ? "partial" : summary.failed || summary.unreadable ? "error" : "skipped",
    caption:t("{total}장 처리 · 문자 추출 {readable}장 · 미확인 {missing}장", {total: summary.completed||0, readable, missing})};
  return {state:"done",caption:t("{total}장 처리 · 문자 추출 {readable}장", {total: summary.completed||0, readable})};
}
export const defaultWorkflow = () => ({
  version: 3,
  follow_links: true,
  ocr_enabled: true,
  nodes: [
    { id: "target", position: { x: 0, y: 160 } },
    { id: "browser", position: { x: 210, y: 160 } },
    { id: "collector", position: { x: 420, y: 160 } },
    { id: "techniques", position: { x: 850, y: 0 } },
    { id: "ocr", position: { x: 630, y: 160 } },
    { id: "candidates", position: { x: 850, y: 320 } },
    { id: "laya", position: { x: 1070, y: 320 } },
    { id: "dedup", position: { x: 1290, y: 160 } },
    { id: "report", position: { x: 1510, y: 160 } },
  ],
  edges: PAIRS.map(([a, b]) => edgeFor(a, b)),
});
export function validConnection(connection) {
  return PAIRS.some(
    ([a, b]) => a === connection.source && b === connection.target,
  );
}
function layaPosition(nodes) {
  const a = nodes.find(n => n.id === "candidates"), b = nodes.find(n => n.id === "dedup");
  if (!a || !b) throw new Error(t("필수 노드가 없습니다."));
  const from = a.position;
  const to = b.position;
  return { x: (from.x + to.x) / 2, y: Math.min(9800, Math.max(from.y, to.y) + 220) };
}
export function restoreWorkflowLayout(nodes, saved) {
  const valid = p => p && [p.x, p.y].every(n => Number.isFinite(n) && Math.abs(n) < 10000);
  const restored = nodes.map(node => ({ ...node, position: valid(saved?.[node.id]) ? { ...saved[node.id] } : { ...node.position } }));
  const laya = restored.find(n => n.id === "laya");
  if (laya && !valid(saved?.laya) && restored.some(n => n.id !== "laya" && Math.abs(n.position.x-laya.position.x)<160 && Math.abs(n.position.y-laya.position.y)<160)) {
    laya.position = layaPosition(restored);
  }
  return restored;
}
export function normalizeWorkflow(value) {
  if (
    !value ||
    ![1, 2, 3].includes(value.version) ||
    !Array.isArray(value.nodes) ||
    !(value.version === 3 ? value.nodes.length === 9 : value.version === 2 ? value.nodes.length === 8 : [6, 7].includes(value.nodes.length)) ||
    (value.ocr_enabled !== undefined && typeof value.ocr_enabled !== "boolean") ||
    !Array.isArray(value.edges) ||
    value.edges.length > 12
  )
    throw new Error(t("지원하는 워크플로 JSON이 아닙니다."));
  const ids = new Set();
  const nodes = value.nodes.map((node) => {
    if (
      !DEFINITIONS[node.id] ||
      ids.has(node.id) ||
      ![node.position?.x, node.position?.y].every(
        (n) => Number.isFinite(n) && Math.abs(n) < 10000,
      )
    )
      throw new Error(t("노드 정보가 올바르지 않습니다."));
    ids.add(node.id);
    return { id: node.id, position: node.position };
  });
  const keys = new Set();
  value.edges.forEach((edge) => {
    if (!(validConnection(edge) || (value.version < 3 && edge.source === "candidates" && edge.target === "dedup") || (value.version === 1 && ["techniques", "candidates"].includes(edge.source) && edge.target === "report")) || keys.has(edge.source + "-" + edge.target))
      throw new Error(t("지원하지 않거나 중복된 연결입니다."));
    keys.add(edge.source + "-" + edge.target);
  });
  if (!ids.has("ocr")) {
    nodes.push(defaultWorkflow().nodes.find(node => node.id === "ocr"));
  }
  if (value.version === 1) {
    if (!ids.has("dedup")) nodes.push(defaultWorkflow().nodes.find(node => node.id === "dedup"));

  }
  if (!ids.has("laya")) {
    // Existing user positions are never moved during migration.
    nodes.push({ id: "laya", position: layaPosition(nodes) });
  }
  if (Object.keys(DEFINITIONS).some(id => !nodes.some(node => node.id === id))) throw new Error(t("필수 노드가 없습니다."));
  return {
    version: 3,
    ocr_enabled: value.ocr_enabled !== false,
    nodes,
    edges: defaultWorkflow().edges,
    follow_links: value.follow_links !== false,
  };
}
export function branchEnabled(flow, id) {
  return id !== "ocr" || flow.ocr_enabled !== false;
}
