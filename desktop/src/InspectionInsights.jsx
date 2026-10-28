// Independent feature surface. Existing app layout/theme stays owned by its designer.
import React, { useEffect, useMemo, useState, useRef, useId } from "react";
import { ReactFlow, ReactFlowProvider, Controls, Background, Handle, Position, BaseEdge, useReactFlow, useStore } from "@xyflow/react";
import { explorationFlow, withRunMarkers } from "./inspection-model.mjs";
import "./inspection.css";
import EvidenceScreenshot from "./EvidenceScreenshot.jsx";
import ImageOCR from "./ImageOCR.jsx";
import LocalAIAnalysis from "./LocalAIAnalysis.jsx";
import LocalAIResults from "./LocalAIResults.jsx";
import ModelStatistics from "./ModelStatistics.jsx";
import { t } from "./i18n.mjs";
import { RefreshCw, GitBranch, Sparkles, FileText, ClipboardCheck, Download, Info, X, Cpu, SlidersHorizontal } from "lucide-react";

import pageIcon from "../assets/browser.png";
import collectIcon from "../assets/collection.png";
import noRecordImage from "../assets/no_record.png";

function ReviewHelp() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className="review-help" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); event.stopPropagation(); } }}>
    <button type="button" className="review-help-trigger" aria-label={t("전체 검토 안내")} aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}><Info size={14} aria-hidden="true" /></button>
    <span id={id} role="tooltip" className={`review-help-tooltip${open ? " is-open" : ""}`}>
      <span className="review-help-item"><span aria-hidden="true">•</span><span>{t("수집 영역을 순서대로 검토")}</span></span>
      <span className="review-help-item"><span aria-hidden="true">•</span><span>{t("한도 도달 또는 중단 시 완료된 결과만 포함")}</span></span>
      <span className="review-help-item"><span aria-hidden="true">•</span><span>{t("필요 시 같은 사이트를 추가 확인")}</span></span>
    </span>
  </span>;
}

const PAGE_STATUS = { pending: t("방문 대기"), scanned: t("검사 완료"), failed: t("검사 실패"), error: t("검사 실패"), skipped: t("건너뜀"), visiting: t("방문 중") };
function ObservedNode({ data, selected }) {
  return <div className={`observed-node${selected ? " is-selected" : ""}`}>
    <div className="observed-node-tile">
      <Handle type="target" position={Position.Left} />
      <img src={data.kind === "page" ? pageIcon : collectIcon} alt="" draggable={false} />
      <Handle type="source" position={Position.Right} />
    </div>
    <div className="observed-node-title" title={data.title}>{data.title || t("페이지")}</div>
    <div className="observed-node-caption">{data.kind === "page" ? (PAGE_STATUS[data.status] || data.status || t("상태 미확인")) : t("{count}개 영역 수집", { count: data.count })}</div>
  </div>;
}
function BoundaryNode({ data }) {
  return <div className={`observed-node boundary-node boundary-${data.boundary}`}>
    <div className="observed-node-tile">
      {data.boundary === "end" && <Handle type="target" position={Position.Left} />}
      <span className="boundary-symbol" aria-hidden="true">{data.boundary === "start" ? "▶" : "■"}</span>
      {data.boundary === "start" && <Handle type="source" position={Position.Right} />}
    </div>
    <div className="observed-node-title">{data.title}</div>
    <div className="observed-node-caption">{data.caption}</div>
  </div>;
}
const nodeTypes = { observed: ObservedNode, boundary: BoundaryNode };
function OuterEndEdge({ id, sourceX, sourceY, targetX, targetY, data, style }) {
  const lane = data.routeY;
  const middle = (sourceX + targetX) / 2;
  const path = `M ${sourceX} ${sourceY} C ${sourceX + 48} ${sourceY}, ${sourceX + 24} ${lane}, ${middle} ${lane} C ${targetX - 24} ${lane}, ${targetX - 64} ${targetY}, ${targetX} ${targetY}`;
  return <BaseEdge id={id} path={path} style={style} />;
}
const edgeTypes = { outerEnd: OuterEndEdge };
function NodeDetailModal({ children, onClose, ...props }) {
  const ref = useRef(null), timer = useRef(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => { clearTimeout(timer.current); if (previous?.isConnected) previous.focus(); };
  }, []);
  function close() {
    if (closing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return; }
    setClosing(true);
    timer.current = setTimeout(onClose, 180);
  }
  return <dialog {...props} ref={ref} className="inspection-detail node-detail-modal" data-closing={closing} onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>{children(close)}</dialog>;
}
function InitialGraphFit({ run, hasObservations }) {
  const { getNodes, setViewport, viewportInitialized } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const fitted = useRef(null);
  useEffect(() => {
    const key = `${run || "idle"}:${hasObservations}`;
    if (!viewportInitialized || !width || !height || fitted.current === key) return;
    const start = getNodes().find((node) => node.data.boundary === "start");
    const end = getNodes().find((node) => node.data.boundary === "end");
    if (!start || !end) return;
    fitted.current = key;
    const zoom = Math.min(0.85, (width - 96) / (end.position.x - start.position.x + 160));
    setViewport({ x: width / 2 - ((start.position.x + end.position.x) / 2 + 80) * zoom, y: height / 2 - ((start.position.y + end.position.y) / 2 + 38) * zoom, zoom });
  }, [viewportInitialized, run, hasObservations, width, height, getNodes, setViewport]);
  return null;
}
const api = window.chickadee;
const EMPTY = { graph: { nodes: [], edges: [] }, packets: [], agent: { assessments: [], ledger: {} } };

function ReportExport({ onExport }) {
  const [open, setOpen] = useState(false), ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = event => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    ref.current?.querySelector('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  return <div className="action-menu" ref={ref} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus(); event.stopPropagation(); } }}>
    <button className="review-text-action" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><Download size={14} aria-hidden="true" />{t("리포트 저장")}</button>
    <div className="action-menu-panel" role="menu" data-open={open} inert={!open} aria-hidden={!open}>
      {[['원본 리포트', false], ['공유용 리포트', true]].map(([label, shared]) => <button key={label} role="menuitem" onClick={() => { setOpen(false); onExport(shared); }}>{t(label)}</button>)}
    </div>
  </div>;
}

export default function InspectionInsights({ runStatus = "idle", onOpenSettings, onOpenHistory, agentConfig, tab, setTab }) {
  const [data, setData] = useState(EMPTY), [run, setRun] = useState(null);
  const [selected, setSelected] = useState(null), [packetId, setPacketId] = useState("");
  const [message, setMessage] = useState(""), [working, setWorking] = useState(false);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  const [localOpen, setLocalOpen] = useState(false);
  const tokenLimit = agentConfig?.token_limit || 24000, callLimit = agentConfig?.call_limit || 6;
  async function refresh() {
    const state = await api.state();
    setRun(state.run_id);
    if (state.run_id) setData(await api.inspection({ run_id: state.run_id }));
    else setData(EMPTY);
  }
  async function action(fn) {
    setWorking(true); setMessage("");
    try { await fn(); await refresh(); } catch (error) { setMessage(error.message); }
    finally { setWorking(false); }
  }
  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
    return api.onEvent((event) => {
      if (event.kind === "started") { setData(EMPTY); setRun(event.run_id); setSelected(null); setPacketId(""); }
      if (event.kind === "exploration") {
        setData((previous) => {
          const nodes = new Map(previous.graph.nodes.map((node) => [node.id, node]));
          const edges = new Map(previous.graph.edges.map((edge) => [edge.id, edge]));
          nodes.set(event.node.id, event.node); if (event.edge) edges.set(event.edge.id, event.edge);
          return { ...previous, graph: { ...previous.graph, nodes: [...nodes.values()], edges: [...edges.values()] } };
        });
      }
      if (event.kind === "agent_started") setData((previous) => ({ ...previous, agent: { ...previous.agent, running: true } }));
      if (["done", "agent_done", "agent_failed"].includes(event.kind)) {
        if (event.kind === "agent_failed") setMessage(event.message);
        refresh().catch((error) => setMessage(error.message));
      }
    });
  }, []);
  useEffect(() => {
    if (!data.agent?.running) return;
    const id = setInterval(() => refresh().catch((error) => setMessage(error.message)), 1000);
    return () => clearInterval(id);
  }, [data.agent?.running]);
  const observedFlow = useMemo(() => explorationFlow(data.graph, 1000), [data.graph]);
  const flow = useMemo(() => withRunMarkers(observedFlow, runStatus), [observedFlow, runStatus]);
  const packet = data.packets.find((item) => item.id === packetId);
  const ledger = data.agent?.ledger || {};
  const busy = working || data.agent?.running;
  const report = data.agent?.report;
  const assessments = report?.assessments || data.agent?.assessments || [];
  const total = report?.total ?? data.packets.filter(item => !item.supplemental).length;
  const completed = report?.completed || 0;
  const assessmentLabel = value => ({ ad_suspected: t("광고 의심"), benign_context: t("정상 문맥 제안"), uncertain: t("보류") }[value] || value);
  async function downloadReport(shared = false) {
    await action(async () => {
      const result = await api.exportReport({ shared });
      if (result?.saved) setMessage(t("리포트를 저장했습니다."));
    });
  }
  return <section className="inspection-extension" data-tab={tab} aria-label={t("검사 분석")}>
    <div className="inspection-toolbar">
    <div className="inspection-tabs" role="tablist" aria-label={t("분석 보기")}>
      {[["graph", t("탐색 그래프"), GitBranch], ["agent", t("AI 검토"), Sparkles]].map(([id, label, TabIcon]) =>
        <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><TabIcon size={15} aria-hidden="true" />{label}</button>)}
      </div>
      <button className="inspection-refresh" aria-label={t("새로고침")} title={t("새로고침")} onClick={() => action(refresh)} disabled={working}><RefreshCw size={16} aria-hidden="true" /></button>
    </div>
    {message && <div key={message} className="inspection-feedback" role="status"><Info size={15} aria-hidden="true" /><span>{message.includes("수집된 근거 ID") ? t("앱을 재실행한 뒤 전체 검토를 시작해 주세요.") : message}</span><button aria-label={t("안내 닫기")} onClick={() => setMessage("")}><X size={14} /></button></div>}
    {!run && tab !== "graph" && <div className="inspection-awaiting">
      <img src={noRecordImage} alt="" draggable={false} />
      <div><strong>{t("분석할 검사 결과가 없습니다")}</strong><p>{t("상단에서 검사를 실행하거나, 왼쪽")} <button type="button" className="inspection-history-link" onClick={onOpenHistory}>{t("검사 기록")}</button>{t("에서 이전 결과를 열어 주세요.")}</p></div>
    </div>}
    {tab === "graph" && <>
      <div className="inspection-graph" data-testid="exploration-graph">
        {!run && <div className="graph-awaiting"><Info size={16} aria-hidden="true" /><div><strong>{t("검사 대기 중")}</strong><p>{t("검사를 실행하거나")} <button type="button" className="inspection-history-link" onClick={onOpenHistory}>{t("검사 기록")}</button>{t("을 열면 탐색 경로가 표시됩니다.")}</p></div></div>}
        <ReactFlowProvider><ReactFlow proOptions={{ hideAttribution: true }} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodes={flow.nodes} edges={flow.edges} fitViewOptions={{ padding: 0.2, maxZoom: 0.85 }} minZoom={0.08} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false}
          onNodeClick={(_event, node) => {
            if (node.type === "boundary") return;
            if (selected?.id === node.id) { setSelected(null); setPacketId(""); return; }
            const observed = data.graph.nodes.find((item) => item.id === node.id);
            setSelected(observed); setPacketId(observed?.packet_ids?.[0] || "");
          }} onPaneClick={() => { setSelected(null); setPacketId(""); }}><InitialGraphFit run={run} hasObservations={observedFlow.nodes.length > 0} /><Background color="#414246" gap={22} size={1} /><Controls showInteractive={false} /></ReactFlow></ReactFlowProvider>
      </div>
      {(flow.omitted > 0 || data.graph.truncated) && <footer className="inspection-graph-status" aria-label={t("그래프 표시 현황")}>
        <div className="graph-status-counts">
          <span>{t("표시")} <strong>{observedFlow.nodes.length.toLocaleString()}</strong></span>
          <span>{t("전체 관측")} <strong>{data.graph.nodes.length.toLocaleString()}</strong></span>
          {flow.omitted > 0 && <span className="graph-status-note">{t("{count}개는 화면에서 생략", { count: flow.omitted.toLocaleString() })}</span>}
        </div>
        {data.graph.truncated && <span className="graph-limit-badge"><span aria-hidden="true" />{t("수집 한도 도달")}</span>}
      </footer>}
      {selected && <NodeDetailModal onClose={() => { setSelected(null); setPacketId(""); }} aria-label={t("선택한 노드 상세")}>{close => <><header className="inspection-detail-heading"><div><strong>{selected.kind === "page" ? t("페이지 정보") : selected.label}</strong><span className="inspection-detail-status" data-status={selected.status}>{selected.kind === "state" ? t("{count}개 영역 관측", { count: selected.packet_ids?.length || 0 }) : PAGE_STATUS[selected.status] || selected.status}</span></div><button type="button" aria-label={t("상세 닫기")} onClick={close}><X size={16} aria-hidden="true" /></button></header>
        {selected.url && <p className="inspection-detail-url">{selected.url}</p>}
        {packet && <><pre>{packet.text}</pre><LocalAIAnalysis analysis={packet.local_ai} />{!packet.supplemental && <ImageOCR image={data.ocr_images?.find(image => image.id === packet.image_id)} />}<EvidenceScreenshot screenshot={data.screenshots?.[selected.screenshot_id || packet.snapshot_id]} hidden={packet.transparent || packet.offscreen} /></>}</>}</NodeDetailModal>}
    </>}
    {tab === "agent" && <>
      <div className="review-workspace">
        {data.local_ai && <>
        <header className="review-heading"><div><h2><Cpu size={20} aria-hidden="true" />{t("로컬 AI 분석")}</h2><p>{t("문자와 화면의 분석 결과 및 처리 현황을 확인합니다.")}</p></div></header>
        <section className="local-ai-overview" aria-label={t("로컬 AI 결과")}>
          <div className="local-ai-overview-header">
            <strong className="local-ai-status-title">{t("분석 현황")}</strong>
            <div className="local-ai-metrics"><span>{t("문자")} <b>{data.local_ai.text_analyzed ?? 0}</b></span><span>{t("화면")} <b>{data.local_ai.visual_analyzed ?? 0}</b></span><span>API <b>{t("{count}회", { count: 0 })}</b></span>
              {data.ocr_summary?.enabled === false && <span>{t("이미지 OCR 끔")}</span>}{data.local_ai.status !== "completed" && <span className="local-ai-partial">{t("일부 분석 미완료")}</span>}
            </div>
          </div>
          <details className="local-ai-results" onToggle={event => setLocalOpen(event.currentTarget.open)}><summary>{t("분석 결과")} <span>{t("{count}개 영역", { count: total })}</span></summary>
            {localOpen && <LocalAIResults key={run} packets={data.packets} />}
          </details>
        </section></>}
        {data.local_ai && <ModelStatistics data={data} />}
        <header className="review-heading"><div><h2><FileText size={20} />{t("검사 결과 리포트")}</h2><p>{t("수집한 전체 영역을 검토하고 확인이 필요한 내용을 정리합니다.")}</p></div>{data.agent?.running ? <button className="review-stop" onClick={() => action(() => api.stopAgent())}>{t("검토 중단")}</button> : <button className="review-primary" disabled={!total || busy || ["running", "paused"].includes(runStatus)} onClick={() => action(() => api.runAgent({ run_id: run, scope: "all" }))}>{t("전체 검토 시작")}</button>}</header>
        <section className="review-overview" aria-label={t("검토 범위")}>
          <div><span>{t("검토 범위")}</span><strong>{t("전체 수집 영역")}</strong></div>
          <div data-metric="collected"><span>{t("수집 영역")}</span><strong>{total.toLocaleString()}<small>{t("개")}</small></strong></div>
          <div data-metric="completed" data-empty={completed === 0}><span>{t("검토 완료")}</span><strong>{completed.toLocaleString()}<small>{t("개")}</small></strong></div>
          <div data-metric="pending" data-empty={total - completed === 0}><span>{t("미검토")}</span><strong>{(total - completed).toLocaleString()}<small>{t("개")}</small></strong></div>
        </section>
        {report && <div className="review-progress" role="status"><progress max={Math.max(total, 1)} value={completed} /><span>{({running: t("검토 중"), completed: t("전체 검토 완료"), stopped: t("검토 중단"), partial: t("일부 검토 완료")})[report.status]} / {completed}/{total}{report.status !== "completed" && !data.agent?.running ? ` / ${t("미검토 {count}개", { count: total - completed })}` : ""}</span></div>}
        <details className="review-notice"><summary>{t("검토 안내 및 사용량")}</summary><div className="review-usage">{[[t("요청 횟수"), ledger.calls || 0, ledger.call_limit || callLimit, t("회")], [t("토큰 사용량"), ledger.charged_tokens || 0, ledger.token_limit || tokenLimit, t("토큰")]].map(([label, used, limit, unit]) => <div className="review-meter" key={label}><div><span>{label}</span><strong>{used.toLocaleString()}<small> / {limit.toLocaleString()}{unit}</small></strong></div><progress aria-label={label} value={Math.min(used, limit)} max={limit} /><small>{t("{value} 남음", { value: `${Math.max(0, limit - used).toLocaleString()}${unit}` })}</small></div>)}</div><div className="review-usage-footer"><span className="review-usage-caption"><span>{t("현재 검사 기준 · 토큰은 사용 한도에서 차감된 양입니다.")}</span><ReviewHelp /></span><button className="review-text-action" onClick={onOpenSettings}><SlidersHorizontal size={14} aria-hidden="true" />{t("AI 설정")}</button></div></details>
        {!assessments.length && !data.agent?.running && <div className="review-empty"><ClipboardCheck size={30} strokeWidth={1.5} aria-hidden="true" /><strong>{t("전체 검토를 시작하면 리포트가 표시됩니다.")}</strong><span>{t("영역별 검토 의견과 확인이 필요한 근거를 모아 볼 수 있습니다.")}</span></div>}
      {data.agent?.events?.length > 0 && <details open={Boolean(data.agent.running)}><summary>{t("조사 과정")}</summary><ol>
        {data.agent.events.slice(-20).map((event, index) => <li key={index}>{({model_request: t("AI 요청"), tool_result: t("근거 조회"), site_explore: t("같은 사이트 추가 탐색"), browser_phase: t("브라우저 확인"), browser_request_blocked: t("요청 차단"), browser_warning: t("수집 알림"), exploration_incomplete: t("추가 확인 미완료")})[event.action] || event.kind}{event.tool && ` / ${event.tool}`}{event.url && ` / ${event.url}`}{event.message && ` / ${event.message}`}{event.reason && ` / ${event.reason}`}</li>)}
      </ol></details>}
      {data.agent?.explorations?.map((visit, index) => <details key={index}><summary>{t("추가 탐색 {index}", { index: index + 1 })} / {visit.status}</summary><p>{visit.url}</p><p>{t("수집 영역 {packets}개 / 차단 요청 {blocked}개", { packets: visit.packets.length, blocked: visit.blocked_requests.length })}</p>
        {visit.blocked_requests.map((item, i) => <p key={i}>{item.reason} / {item.target_url || item.url}</p>)}
        <EvidenceScreenshot screenshot={Object.values(visit.screenshots || {})[0]} />
      </details>)}
      {data.review_report && !busy && <div className="review-results-heading"><h3>{t("검토 결과")} <span>{assessments.length}</span></h3><ReportExport onExport={downloadReport} /></div>}
      {assessments.slice().reverse().map((item, index) => <article className="inspection-detail" key={index}>
        <strong>{{ ad_suspected: t("광고 의심"), benign_context: t("정상 문맥 제안"), uncertain: t("보류") }[item.assessment]}</strong><p>{item.summary}</p>
        {item.phishing_assessment && <p>{t("피싱 분석:")} {{ suspected: t("의심 신호"), no_observed_signal: t("관측 신호 없음"), uncertain: t("추가 확인") }[item.phishing_assessment]}{item.phishing_reasons?.length > 0 && ` / ${item.phishing_reasons.join(" / ")}`}</p>}
        <p>{item.reads.map((read) => read.tool).join(" → ")} / {item.provider} / {item.model}</p>
        {item.missing_evidence.length > 0 && <p>{t("미확인:")} {item.missing_evidence.join(", ")}</p>}
        {item.exploration_status && <p>{t("추가 확인:")} {({completed: t("완료"), incomplete: t("미완료"), budget_exhausted: t("예산 부족")})[item.exploration_status]}</p>}
      </article>)}
      </div>
    </>}
  </section>;
}
