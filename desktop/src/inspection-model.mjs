// Presentation adapter only: backend IDs and observed edges are never invented.
import { t } from "./i18n.mjs";

export function explorationFlow(graph, limit = 240) {
  const source = Array.isArray(graph?.nodes) ? graph.nodes.slice(0, limit) : [];
  const ids = new Set(source.map((node) => node.id));
  const edges = (Array.isArray(graph?.edges) ? graph.edges : []).filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  );
  const depth = new Map();
  for (const node of source) {
    if (!edges.some((edge) => edge.target === node.id)) depth.set(node.id, 0);
  }
  // Minimum observed path depth; bounded even when navigation contains cycles.
  for (let pass = 0; pass < source.length; pass++) {
    let changed = false;
    for (const edge of edges) {
      if (!depth.has(edge.source)) continue;
      const next = depth.get(edge.source) + 1;
      if (!depth.has(edge.target) || next < depth.get(edge.target)) {
        depth.set(edge.target, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const rows = new Map();
  return {
    nodes: source.map((node) => {
      const column = depth.get(node.id) || 0;
      const row = rows.get(column) || 0;
      rows.set(column, row + 1);
      let page = node.url || "";
      try { page = new URL(page).pathname; } catch {}
      return { id: node.id, type: "observed", position: { x: column * 270, y: row * 160 },
        data: { kind: node.kind, title: node.kind === "page" ? page : node.label, status: node.status, count: node.packet_ids?.length || 0, label: node.kind === "page" ? `${page.slice(0, 45)} · ${node.status}` : t("{label} · {count}영역", { label: node.label, count: node.packet_ids?.length || 0 }) } };
    }),
    edges: edges.map((edge) => ({ ...edge, type: "default", style: { stroke: "#62666b", strokeWidth: 1.5 }, labelStyle: { fill: "#b4b8bf", fontSize: 10 }, labelBgStyle: { fill: "#202123" }, labelBgPadding: [5, 3], labelBgBorderRadius: 3 })),
    omitted: Math.max(0, (graph?.nodes?.length || 0) - source.length),
  };
}


// Display-only run markers; never persisted as observations or navigation edges.
export function withRunMarkers(flow, status = "idle") {
  const used = new Set(flow.nodes.map((node) => node.id));
  const markerId = (name) => { let id = `ui:${name}`; while (used.has(id)) id += ":"; used.add(id); return id; };
  const start = markerId("start"), end = markerId("end");
  const roots = flow.nodes.filter((node) => !flow.edges.some((edge) => edge.target === node.id));
  const leaves = flow.nodes.filter((node) => !flow.edges.some((edge) => edge.source === node.id));
  const maxX = Math.max(0, ...flow.nodes.map((node) => node.position.x));
  const centerY = (Math.min(0, ...flow.nodes.map((node) => node.position.y)) + Math.max(0, ...flow.nodes.map((node) => node.position.y))) / 2;
  const captions = { idle: t("검사 대기"), running: t("검사 진행 중"), paused: t("일시정지"), pausing: t("일시정지 요청"), stopping: t("중단 중"), completed: t("검사 완료"), stopped: t("검사 중단"), cancelled: t("검사 중단"), failed: t("검사 실패"), partial: t("일부 결과") };
  const markers = [
    { id: start, type: "boundary", position: { x: -270, y: centerY }, data: { title: "START", caption: status === "idle" ? t("검사 대기") : t("검사 시작"), boundary: "start" } },
    { id: end, type: "boundary", position: { x: maxX + 270, y: centerY }, data: { title: "END", caption: captions[status] || t("검사 종료"), boundary: "end", status } },
  ];
  const connectors = [
    ...roots.map((node) => ({ source: start, target: node.id })),
    ...leaves.map((node) => ({ source: node.id, target: end })),
  ].map((edge, index) => ({ ...edge, id: `${start}:connector:${index}`, type: "default", selectable: false, data: { displayOnly: true }, style: { stroke: "#666c75", strokeWidth: 1.5, strokeDasharray: "4 5" } }));
  return { ...flow, nodes: [...markers, ...flow.nodes], edges: [...flow.edges, ...connectors] };
}
