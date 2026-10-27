import UpdateSettings from "./UpdateSettings.jsx";
import { LANGUAGES, language, t, tc } from "./i18n.mjs";
import { advertisingGroup, normalizeCandidates } from "./advertising-groups.mjs";
import { groupPageRecords, pageReview, expandPageIds, evidenceRole } from "./page-records.mjs";
import { sortDetections } from "./result-list.mjs";
import React, {
  useState,
  useId,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import EvidenceScreenshot from "./EvidenceScreenshot.jsx";
import ImageOCR from "./ImageOCR.jsx";
import LocalAIAnalysis from "./LocalAIAnalysis.jsx";
import RuntimeSettings from "./RuntimeSettings.jsx";
import ShortcutSettings from "./ShortcutSettings.jsx";
import { defaults as defaultShortcuts, validateShortcuts, fromEvent, keyLabel } from "./shortcuts.mjs";
import SettingsNav from "./SettingsNav.jsx";
import ScheduleSettings from "./ScheduleSettings.jsx";
import NotificationSettings from "./NotificationSettings.jsx";
import GrokSettings from "./GrokSettings.jsx";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  BaseEdge,
  getSmoothStepPath,
  applyNodeChanges,
} from "@xyflow/react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bird,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  CircleAlert,
  CircleCheck,
  Copy,
  CornerDownRight,
  Cpu,
  Dice5,
  TrendingUp,
  Landmark,
  ShoppingCart,
  ShieldAlert,
  EyeOff,
  Download,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  FolderOpen,
  GitBranch,
  Globe2,
  History,
  Info,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  Monitor,
  MousePointer2,
  Network,
  PanelsTopLeft,
  Play,
  Pause,
  Command,
  MoreHorizontal,
  RotateCcw,
  Save,
  ScanLine,
  ScanSearch,
  Search,
  ShieldX,
  SlidersHorizontal,
  Settings,
  Bell,
  Sparkles,
  ArrowLeft,
  Square,
  TextSearch,
  Unplug,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import {
  DEFINITIONS,
  defaultWorkflow,
  normalizeWorkflow,
  branchEnabled,
  restoreWorkflowLayout,
  ocrPresentation,
  workflowPorts,
  workflowRoute,
  hasOCREvidence,
} from "./workflow.mjs";
import "./style.css";
import "./theme.css";
import brandMark from "../assets/app-mark.png";
import LoginPrompt from "./LoginPrompt.jsx";
import InspectionInsights from "./InspectionInsights.jsx";
import targetMap from "../assets/map.png";
import browserImage from "../assets/browser.png";
import collectionImage from "../assets/collection.png";
import duplicateRemoveImage from "../assets/duplicate_remove.png";
import paddleOCRImage from "../assets/paddle_ocr.png";
import searchImage from "../assets/search.png";
import hierarchyImage from "../assets/hierarchy.png";
import layaImage from "../assets/laya.png";
import csvImage from "../assets/csv.png";
import diceImage from "../assets/dice.png";
import profitsImage from "../assets/profits.png";
import creditCardImage from "../assets/3d-credit-card.png";
import shoppingCartImage from "../assets/shopping-cart.png";
import warningImage from "../assets/image_warning.png";
import errorImage from "../assets/error.png";
import pauseImage from "../assets/pause.png";
import resumeImage from "../assets/resume.png";
import stopImage from "../assets/stop.png";
import checkImage from "../assets/check.png";
import deleteImage from "../assets/delete.png";
import saveImage from "../assets/save.png";
import refreshImage from "../assets/refresh.png";
import noFileImage from "../assets/no_file.png";
import noLocationImage from "../assets/no_location.png";
import waitDetectionImage from "../assets/wait_detection.png";
import noRecordImage from "../assets/no_record.png";
import Tutorial, { rememberTutorial, shouldShowTutorial } from "./Tutorial.jsx";

const nodeImages = {
  target: targetMap,
  browser: browserImage,
  collector: collectionImage,
  ocr: paddleOCRImage,
  dedup: duplicateRemoveImage,
  techniques: searchImage,
  candidates: hierarchyImage,
  laya: layaImage,
  report: csvImage,
};

const api = window.chickadee;
const NODE_LAYOUT_KEY = "chickadee.node-layout.v5";
function restoreNodeLayout(nodes) {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(NODE_LAYOUT_KEY));
  } catch {}
  // Start the reorganized canvas on its clean grid; subsequent manual changes
  // are restored from the new layout key without touching analysis settings.
  const arranged = defaultWorkflow().nodes.map(stage => ({
    ...nodes.find(node => node.id === stage.id), position: { ...stage.position },
  }));
  return restoreWorkflowLayout(arranged, saved);
}
const Icons = {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Bird,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  CircleAlert,
  CircleCheck,
  Copy,
  CornerDownRight,
  Cpu,
  Dice5,
  TrendingUp,
  Landmark,
  ShoppingCart,
  ShieldAlert,
  EyeOff,
  Download,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  FolderOpen,
  GitBranch,
  Globe2,
  History,
  Info,
  ListFilter,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  Monitor,
  MousePointer2,
  Network,
  PanelsTopLeft,
  Play,
  Pause,
  Command,
  MoreHorizontal,
  RotateCcw,
  Save,
  ScanLine,
  ScanSearch,
  Search,
  ShieldX,
  SlidersHorizontal,
  Settings,
  Bell,
  Sparkles,
  ArrowLeft,
  Square,
  TextSearch,
  Unplug,
  Upload,
  Workflow,
  X,
};
const LABELS = {
  HOMOGLYPH: t("닮은꼴 문자"),
  JAMO: t("자모 분해"),
  TRANSPARENT: t("투명 텍스트"),
  OFFSCREEN: t("화면 밖 은닉"),
  GAMBLING: t("도박 홍보 의심"),
  ADULT: t("성인 콘텐츠 의심"),
  LOAN: t("대출 모집 의심"),
  INVESTMENT: t("투자 모집 의심"),
  COMMERCIAL: t("구매·추천 유도"),
  AI_CONTEXT: t("AI 광고 문맥"),
  IMAGE_REVIEW: t("이미지 검토 필요"),
  ACCOUNT_TRADE: t("계좌·통장 거래 의심"),
  DRUGS: t("마약 거래·홍보 의심"),
};
const TYPE_ICONS = {
  GAMBLING: "Dice5",
  INVESTMENT: "TrendingUp",
  LOAN: "Landmark",
  COMMERCIAL: "ShoppingCart",
  AI_CONTEXT: "Sparkles",
  IMAGE_REVIEW: "ScanSearch",
  ADULT: "ShieldAlert",
  HOMOGLYPH: "Fingerprint",
  JAMO: "TextSearch",
  TRANSPARENT: "EyeOff",
  OFFSCREEN: "PanelsTopLeft",
};
const TYPE_IMAGES = {
  GAMBLING: diceImage,
  INVESTMENT: profitsImage,
  LOAN: creditCardImage,
  COMMERCIAL: shoppingCartImage,
};
function TypeBadgeContent({ type }) {
  return <>
    {TYPE_IMAGES[type]
      ? <img className="type-badge-image" src={TYPE_IMAGES[type]} alt="" width={16} height={16} draggable={false} />
      : <Icon name={TYPE_ICONS[type] || "CircleAlert"} size={13} />}
    <span>{LABELS[type] || type}</span>
  </>;
}

const STATUS = {
  idle: "",
  running: t("검사 진행 중"),
  stopping: t("중단 처리 중"),
  pausing: t("일시정지 요청"),
  paused: tc("status", "일시정지"),
  completed: t("검사 완료"),
  partial: t("일부 결과"),
  cancelled: t("사용자 중단"),
  failed: t("검사 실패"),
  imported: t("불러온 결과"),
};
const STAGE_NAMES = {
  target: t("검사 대상"),
  browser: t("페이지 확인"),
  collector: t("콘텐츠 수집"),
  techniques: t("위장·은닉 분석"),
  candidates: t("ML 문맥 분석"),
  ocr: t("이미지 문자 추출"),
  laya: t("Laya 문맥 검토"),
  dedup: t("중복 정리"),
  report: t("결과 저장"),
};
function Icon({ name, size = 18, ...props }) {
  const Component = Icons[name] || Icons.Circle;
  return <Component size={size} strokeWidth={1.7} {...props} />;
}
function shortUrl(value) {
  try {
    const u = new URL(value);
    return u.host + (u.pathname === "/" ? "" : u.pathname) + u.search;
  } catch {
    return value || t("대상 URL을 입력하세요");
  }
}
function relativeUrl(value) {
  try {
    const u = new URL(value);
    return u.pathname + u.search;
  } catch {
    return value || "";
  }
}
function time(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString(language() === "ko" ? "ko-KR" : "en-US", { hour12: false });
}
function formatElapsed(seconds) {
  return seconds < 60
    ? t("{s}초", { s: Math.floor(seconds) })
    : t("{m}분 {s}초", { m: Math.floor(seconds / 60), s: Math.floor(seconds % 60) });
}
function Button({
  icon,
  image,
  children,
  className = "",
  variant = "secondary",
  ...props
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {image ? <img className="button-image" src={image} alt="" width={20} height={20} draggable={false} /> : icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
    </button>
  );
}
function FlowNode({ id, data, selected }) {
  const def = DEFINITIONS[id];
  const positions = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom };
  const status = { active: t("실행 중"), paused: tc("status", "일시정지"), done: t("실행됨"), partial: t("일부 완료"), error: id === "ocr" ? t("미확인") : t("오류"), disabled: t("사용 안 함"), skipped: t("생략") }[data.state] || t("대기");
  const statusIcon = { active: "LoaderCircle", paused: "Pause", done: "Check", partial: "CircleAlert", error: "X", disabled: "Unplug", skipped: "CornerDownRight" }[data.state];
  const caption = id === "target" ? shortUrl(data.url) : (data.state || id === "ocr") && data.caption ? data.caption : def.subtitle;
  return (
    <div className={`flow-node tone-${def.tone} ${data.state || ""} ${selected ? "selected" : ""}`}>
      <div className="node-tile">
        {def.input && workflowPorts(id, 'in').map(port => <Handle key={port.id} id={port.id}
          type="target" position={positions[def.input]} style={{ top: `${port.top}%` }} isConnectable={false} />)}
        {nodeImages[id] ? <img src={nodeImages[id]} alt="" width={44} height={44} className={`node-symbol node-symbol-${id}`} draggable={false} /> : <Icon name={def.icon} size={44} />}
        {statusIcon && (
          <span className="node-run-state" title={status} aria-label={status}>
            <Icon name={statusIcon} size={15} className={data.state === "active" ? "spin" : ""} />
          </span>
        )}
        {def.output && workflowPorts(id, 'out').map(port => <Handle key={port.id} id={port.id}
          type="source" position={positions[def.output]} style={{ top: `${port.top}%` }} isConnectable={false} />)}
      </div>
      <strong>{def.title}</strong>
      <p className="node-caption" title={caption}>{caption}</p>
      {["active", "paused", "partial", "error", "disabled", "skipped"].includes(data.state) && <span className="node-state-text">{status}</span>}
    </div>
  );
}

const nodeTypes = { stage: FlowNode };
function WorkflowEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  markerEnd, style }) {
  const [path] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    ...workflowRoute(source, target, sourceX, targetX),
  });
  return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />;
}
const edgeTypes = { workflow: WorkflowEdge };
const REVIEW_LABELS = {
  unreviewed: t("미검토"),
  confirmed: t("검토 확인"),
  dismissed: t("제외"),
};

function AnimatedTabs({ value, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const tabs = ref.current;
    const measure = () => {
      const active = tabs.querySelector("button.active");
      if (!active) {
        tabs.style.setProperty("--tab-width", "0px");
        return;
      }
      tabs.style.setProperty("--tab-left", `${active.offsetLeft}px`);
      tabs.style.setProperty("--tab-top", `${active.offsetTop + active.offsetHeight - 2}px`);
      tabs.style.setProperty("--tab-width", `${active.offsetWidth}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tabs);
    for (const button of tabs.querySelectorAll("button")) observer.observe(button);
    return () => observer.disconnect();
  }, [value]);
  return <div className="segmented animated-tabs" ref={ref}>{children}<span className="tab-indicator" aria-hidden="true" /></div>;
}

function ActionMenu({ label, items, className = "", triggerImage, triggerIcon = "ChevronDown", triggerText, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    (ref.current.querySelector('[role="menuitemradio"][aria-checked="true"]') ||
      ref.current.querySelector('.action-menu-panel button:not(:disabled)'))?.focus();
    const dismiss = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return (
    <div className={`action-menu ${className}`} ref={ref}>
      <button
        className="menu-trigger"
        disabled={disabled}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {triggerText && <span>{triggerText}</span>}
        {triggerImage ? <img className="button-image" src={triggerImage} alt="" width={20} height={20} draggable={false} /> : <Icon name={triggerIcon} size={16} />}
      </button>
        <div
          className="action-menu-panel"
          data-open={open}
          aria-hidden={!open}
          inert={!open}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            const buttons = [
              ...event.currentTarget.querySelectorAll("button:not(:disabled)"),
            ];
            const index = buttons.indexOf(document.activeElement);
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        buttons.length) %
                      buttons.length;
              buttons[next]?.focus();
            }
            if (event.key === "Escape") {
              setOpen(false);
              ref.current.querySelector(".menu-trigger").focus();
            }
          }}
        >
          {items.map((item) => (
            <button
              role={typeof item.selected === "boolean" ? "menuitemradio" : "menuitem"}
              aria-checked={typeof item.selected === "boolean" ? item.selected : undefined}
              key={item.label}
              disabled={item.disabled}
              className={item.danger ? "danger-text" : ""}
              onClick={() => {
                setOpen(false);
                ref.current.querySelector(".menu-trigger").focus();
                item.action();
              }}
            >
              {typeof item.selected === "boolean"
                ? item.icon ? <Icon name={item.icon} size={16} aria-hidden="true" /> : <span className="menu-selection-mark" aria-hidden="true">{item.selected && <Icon name="Check" size={16} />}</span>
                : item.image
                ? <img className={`menu-item-image ${item.imageClassName || ""}`} src={item.image} alt="" width={20} height={20} draggable={false} />
                : <Icon name={item.icon} size={16} />}
              <span>{item.label}</span>
              {typeof item.selected === "boolean" && item.icon && <span className="menu-selection-mark" aria-hidden="true">{item.selected && <Icon name="Check" size={16} />}</span>}
              {item.shortcut && <kbd>{item.shortcut}</kbd>}
            </button>
          ))}
        </div>
    </div>
  );
}

function CommandPalette({ commands, onClose }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const choices = commands.filter(
    (command) =>
      command.label.toLowerCase().includes(query.toLowerCase()) ||
      command.keywords?.includes(query.toLowerCase()),
  );
  const run = (command) => {
    if (command && !command.disabled) {
      onClose();
      command.action();
    }
  };
  return (
    <div className="modal-backdrop command-backdrop" onClick={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t("빠른 명령")}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            setIndex(
              (value) =>
                (value +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  choices.length) %
                Math.max(1, choices.length),
            );
          }
          if (event.key === "Enter") {
            event.preventDefault();
            run(choices[index]);
          }
        }}
      >
        <div className="command-search">
          <Icon name="Search" />
          <input
            autoFocus
            aria-label={t("명령 검색")}
            placeholder={t("무엇을 할까요?")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="command-results" role="listbox" aria-label={t("명령 목록")}>
          {choices.map((command, i) => (
            <button
              role="option"
              aria-selected={i === index}
              key={command.label}
              disabled={command.disabled}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(command)}
            >
              <Icon name={command.icon} size={17} />
              <span>
                {command.label}
                <small>{command.description}</small>
              </span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
            </button>
          ))}
          {!choices.length && <p>{t("일치하는 명령 없음")}</p>}
        </div>
        <footer>
          {t("↑↓ 이동")} <span>{t("Enter 실행")}</span>
          <span>{t("Ctrl K 열기")}</span>
        </footer>
      </section>
    </div>
  );
}

let pageTransition;
let pageTransitionRequest = 0;
function transitionPage(update) {
  const request = ++pageTransitionRequest;
  pageTransition?.skipTransition();
  if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    update();
    return;
  }
  const transition = document.startViewTransition(() => {
    // A rapid second navigation must win over a pending snapshot callback.
    if (request === pageTransitionRequest) flushSync(update);
  });
  pageTransition = transition;
  transition.ready.catch(() => {});
  transition.finished.catch(() => {}).finally(() => {
    if (pageTransition === transition) pageTransition = undefined;
  });
}

function App() {
  const [flow, setFlow] = useState(defaultWorkflow),
    [url, setUrl] = useState("http://113.198.66.73:18244/"),
    [view, setCurrentView] = useState("workflow");
  const setView = useCallback(next => {
    if (next !== view || pageTransition) transitionPage(() => setCurrentView(next));
  }, [view]);
  const [status, setStatus] = useState("idle"),
    [active, setActive] = useState(null),
    [visited, setVisited] = useState(new Set());
  const [events, setEvents] = useState([]),
    [rawRecords, setRecords] = useState([]),
    [pages, setPages] = useState([]),
    [history, setHistory] = useState([]);
  const [liveScreenshots, setLiveScreenshots] = useState({});
  const [ocrLive, setOcrLive] = useState({});
  const [preview, setPreview] = useState(null),
    [currentUrl, setCurrentUrl] = useState(""),
    [queue, setQueue] = useState(0),
    [discovered, setDiscovered] = useState(0);
  const [selectedNode, setSelectedNode] = useState(null),
    [selectedRecord, setSelectedRecord] = useState(null),
    [selectedEvent, setSelectedEvent] = useState(null);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState(false);
  const startRequest = useRef(false);
  const lastSelectedRecord = useRef(null);
  useEffect(() => {
    if (selectedRecord) lastSelectedRecord.current = selectedRecord;
  }, [selectedRecord]);
  const [pending, setPending] = useState([]),
    [pageFilter, setPageFilter] = useState("visited");
  const [recordOrder, setRecordOrder] = useState("newest");
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [eventFilter, setEventFilter] = useState("all"),
    [notice, setNotice] = useState(null);
  const [reviewNotice, setReviewNotice] = useState(null);
  const [agentConfig, setAgentConfig] = useState({ model: "openai/gpt-oss-20b", token_limit: 24000, call_limit: 6 });
  const [inspectionTab, setInspectionTab] = useState("graph");
  const [shortcuts, setShortcuts] = useState(defaultShortcuts);
  const [settingsTab, setSettingsTab] = useState("general");
  const settingsReturnView = useRef("workflow");
  const openSettings = (section = "general") => { setSettingsTab(typeof section === "string" ? section : "general"); settingsReturnView.current = view === "settings" ? settingsReturnView.current : view; setView("settings"); };
  const [profile, setProfile] = useState("default"),
    [maxPages, setMaxPages] = useState(1000),
    [timeout, setTimeoutValue] = useState(1800);
  const [scanInterval, setScanInterval] = useState(0.5);
  const [livePreview, setLivePreview] = useState(true),
    [outputRoot, setOutputRoot] = useState(""),
    [outcome, setOutcome] = useState(null),
    [zoomPreview, setZoomPreview] = useState(false);
  const [startTime, setStartTime] = useState(null),
    [elapsed, setElapsed] = useState(0),
    [booted, setBooted] = useState(false);
  const [reviewData, setReviewData] = useState({ revision: 0, items: {} });
  const records = useMemo(() => groupPageRecords(rawRecords, outcome?.report.evidence_details), [rawRecords, outcome]);
  const detailRecord = records.find(record => record.url === selectedRecord?.url) || selectedRecord || lastSelectedRecord.current;
  const [reviewFilter, setReviewFilter] = useState("all");
  const [pageSearch, setPageSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reviewSaving, setReviewSaving] = useState(false);
  const [generalSettingsSaving, setGeneralSettingsSaving] = useState(false);
  const [palette, setPalette] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [visualPreview, setVisualPreview] = useState(false);
  const [runTarget, setRunTarget] = useState("");
  const activeRun = useRef(null);
  const [tutorial, setTutorial] = useState(shouldShowTutorial);
  useEffect(() => {
    if (!booted || flow.nodes.some(node => node.dragging)) return;
    try {
      localStorage.setItem(NODE_LAYOUT_KEY, JSON.stringify(Object.fromEntries(
        flow.nodes.map(node => [node.id, node.position]),
      )));
    } catch {
      // Keep the canvas usable if browser storage is unavailable.
    }
  }, [booted, flow.nodes]);
  const [canvasApi, setCanvasApi] = useState(null);
  useEffect(() => {
    const canvas = document.querySelector(".flow-area");
    if (!canvasApi || !canvas || view !== "workflow") return;
    let frame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        canvasApi.fitView({ padding: 0.2, maxZoom: 0.75, minZoom: 0.2, duration: 0 });
      });
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [canvasApi, view]);
  const focusTargetAfterGuide = useRef(false);
  useEffect(() => {
    if (!tutorial && focusTargetAfterGuide.current) {
      focusTargetAfterGuide.current = false;
      document.getElementById("target-url")?.focus();
    }
  }, [tutorial]);
  const closeTutorial = () => {
    rememberTutorial();
    setTutorial(false);
  };
  const timelineRef = useRef(null),
    autoScroll = useRef(true);
  const [loginRequest, setLoginRequest] = useState(null);
  const running = ["running", "pausing", "paused", "stopping"].includes(status);
  const tell = (message, type = "info") => {
    if (message === "이미 검사 중입니다.") {
      setScanNotice(true);
      return;
    }
    setNotice({ message, type, key: Date.now() });
  };
  const action = async (fn) => {
    try {
      return await fn();
    } catch (error) {
      tell(error.message, "error");
      return null;
    }
  };
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [notice]);
  const appendEvent = useCallback((event) => {
    setEvents((items) => [
      ...items.slice(-1999),
      { ...event, key: crypto.randomUUID() },
    ]);
  }, []);
  const applyOutcome = useCallback((value) => {
    setOutcome(value);
    setSelectedNode(null);
    setZoomPreview(false);
    if (value.events) {
      setSearch("");
      setFilter("all");
      setReviewFilter("all");
      setPageSearch("");
      setPageFilter("visited");
      setEventFilter("all");
    }
    setRunTarget(value.result.meta.entry_url);
    setSelectedRecord(null);
    setReviewData(value.reviews || { revision: 0, items: {} });
    setSelectedIds(new Set());
    setRecords([
      ...value.result.findings.map(record => ({ ...record, _detail: value.report.evidence_details?.[record.id] })),
      ...normalizeCandidates(value.report.ad_candidates || [], value.report.ocr_images || []),
    ]);
    setPages(
      value.report.page_diagnostics ||
        value.report.pages_scanned.map((url) => ({ url, status: "scanned" })),
    );
    setPending(value.report.pending_urls || []);
    if ([1, 2, 3].includes(value.report.workflow?.version)) {
      try {
        const restored = normalizeWorkflow(value.report.workflow);
        setFlow(current => ({
          ...restored,
          nodes: restored.nodes.map(node => ({
            ...current.nodes.find(item => item.id === node.id),
            ...node,
            position: current.nodes.find(item => item.id === node.id)?.position || node.position,
          })),
        }));
      } catch {}
    }
    if (value.events)
      setVisited(
        new Set(
          value.events
            .filter((e) => e.kind === "phase" || e.kind === "started")
            .map((e) => (e.kind === "started" ? "target" : e.stage)),
        ),
      );
    setStatus(value.report.status);
    setElapsed(value.result.meta.elapsed_sec || 0);
    setCurrentUrl(
      (previous) =>
        value.preview?.url ||
        (value.events
          ? value.result.meta.entry_url
          : previous || value.result.meta.entry_url),
    );
    if (!value.report.desktop_options?.demo)
      setUrl(value.result.meta.entry_url);
    setDiscovered(
      value.report.crawl_summary?.discovered_urls ||
        value.report.pages_scanned.length,
    );
    setQueue(value.report.pages_remaining || 0);
    setActive(null);
    if (value.history) setHistory(value.history);
    if (value.events)
      setEvents(
        value.events
          .slice(-2000)
          .map((event) => ({ ...event, key: crypto.randomUUID() })),
      );
    if (Object.hasOwn(value, "preview")) setPreview(value.preview);
  }, []);
  useEffect(() => {
    if (!api) {
      tell(t("데스크톱 앱에서 실행하세요."), "error");
      return;
    }
    api
      .state()
      .then((state) => {
        setHistory(state.history);
        setOutputRoot(state.outputRoot);
        setVisualPreview(Boolean(state.preview_only));
        const prefs = state.preferences || {};
        try { if (prefs.shortcuts) setShortcuts(validateShortcuts(prefs.shortcuts)); } catch {}
        if (typeof prefs.url === "string") setUrl(prefs.url);
        if (Number.isFinite(prefs.scanInterval) && prefs.scanInterval >= 0 && prefs.scanInterval <= 30) setScanInterval(prefs.scanInterval);
        if (Number.isInteger(prefs.maxPages)) setMaxPages(prefs.maxPages);
        if (Number.isFinite(prefs.timeout)) setTimeoutValue(prefs.timeout);
        if (["default", "test", "public"].includes(prefs.profile))
          setProfile(prefs.profile);
        if (typeof prefs.livePreview === "boolean")
          setLivePreview(prefs.livePreview);
        api
          .capabilities()
          .then(setCapabilities)
          .catch(() => {});
        if (state.workflow) {
          try {
            const restored = normalizeWorkflow(state.workflow);
            setFlow({ ...restored, nodes: restoreNodeLayout(restored.nodes) });
          } catch {
            setFlow(current => ({ ...current, nodes: restoreNodeLayout(current.nodes) }));
          }
        } else {
          setFlow(current => ({ ...current, nodes: restoreNodeLayout(current.nodes) }));
        }
        setLoginRequest(state.authentication || null);
        setBooted(true);
      })
      .catch((error) => tell(error.message, "error"));
    return api.onEvent((event) => {
      if (event.kind === "login_required") setLoginRequest(event);
      if (["login_finished", "done", "started"].includes(event.kind)) setLoginRequest(null);
      if (event.kind === "evidence_screenshot") {
        if (event.screenshot && event.screenshot_id) setLiveScreenshots(previous => ({ ...previous, [event.screenshot_id]: event.screenshot }));
        return;
      }
      if (event.kind === "preview") {
        if (/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(event.data_url))
          setPreview(event);
        return;
      }
      appendEvent(event);
      if (event.kind === "control")
        setStatus((previous) =>
          previous === "stopping" ? previous : event.state,
        );
      if (
        event.url &&
        ["phase", "started", "page_complete"].includes(event.kind)
      )
        setCurrentUrl(event.url);
      if (event.kind === "started") {
        activeRun.current = event.run_id;
        setRecords([]); setPages([]); setPending([]); setEvents([{ ...event, key: crypto.randomUUID() }]); setPreview(null); setOutcome(null); setLiveScreenshots({}); setOcrLive({});
        setReviewData({ revision: 0, items: {} }); setSelectedIds(new Set()); setSelectedRecord(null);
        setDiscovered(0); setQueue(0); setElapsed(0); setSearch(""); setFilter("all"); setReviewFilter("all");
        setRunTarget(event.url);
        setStartTime(Date.now());
        setStatus("running");
        setCurrentUrl(event.url);
        setVisited(new Set(["target"]));
      }
      if (event.kind === "phase") {
        setActive(event.stage);
        setVisited((previous) => new Set([...previous, event.stage]));
      }
      if (event.kind === "progress") {
        setQueue(event.queue_remaining);
      }
      if (event.kind === "image_ocr" && event.image_id)
        setOcrLive(items => ({ ...items, [event.image_id]: event }));
      if (event.kind === "url_discovered")
        setPending((items) => [...items, event]);
      if (event.kind === "phase" && event.action === "navigate")
        setPending((items) => items.filter((item) => item.url !== event.url));
      if (event.kind === "page_complete") {
        setPages((items) => [...items, event.page]);
        setQueue(event.queue_remaining);
        setDiscovered(event.discovered_urls);
      }
      if (event.kind === "finding")
        setRecords((items) => [
          ...items.filter(item => item.id !== event.finding.id),
          { ...event.finding, _detail: event.detail },
        ]);
      if (event.kind === "candidate")
        setRecords((items) => normalizeCandidates([...items.filter(item => item.id !== event.candidate.id), event.candidate]));
      if (event.kind === "done") {
        applyOutcome(event);
        setView(previous => previous === "workflow" ? "results" : previous);
      }
      if (event.kind === "error") {
        setStatus("failed");
        setActive(null);
        tell(event.message, "error");
      }
    });
  }, [appendEvent, applyOutcome]);
  // Recover a missed terminal event without mistaking a slow OCR/model load for completion.
  useEffect(() => {
    if (!api || !booted || !running) return;
    let disposed = false,
      checking = false;
    const timer = window.setInterval(async () => {
      if (checking || startRequest.current || !activeRun.current) return;
      checking = true;
      try {
        const state = await api.state();
        if (disposed || state.running || state.run_id !== activeRun.current)
          return;
        const entry = state.history?.find((item) => item.id === state.run_id);
        if (entry) {
          const value = await api.history(entry.id);
          if (!disposed && activeRun.current === state.run_id) {
            applyOutcome(value);
            setView((previous) =>
              previous === "workflow" ? "results" : previous,
            );
          }
        } else if (state.status === "failed") {
          setStatus("failed");
          setActive(null);
          tell(
            t("검사가 종료되었습니다. 진행 기록과 결과 폴더의 failure.log를 확인하세요."),
            "error",
          );
        }
      } catch (error) {
        // The transport already surfaces an engine exit; polling never masks it.
      } finally {
        checking = false;
      }
    }, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [booted, running, applyOutcome]);
  useEffect(() => {
    if (
      !booted ||
      !Number.isInteger(Number(maxPages)) ||
      Number(maxPages) < 1 ||
      Number(maxPages) > 10000 ||
      !Number.isFinite(Number(timeout)) ||
      Number(timeout) <= 0 ||
      Number(timeout) > 1800
    )
      return;
    const id = window.setTimeout(
      () =>
        api
          .preferences({
            url,
            maxPages: Number(maxPages),
            timeout: Number(timeout),
            profile,
            livePreview,
            scanInterval,
          })
          .catch((error) => tell(error.message, "error")),
      450,
    );
    return () => window.clearTimeout(id);
  }, [booted, url, maxPages, timeout, profile, livePreview, scanInterval]);
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter, reviewFilter, search]);
  useEffect(() => {
    const keydown = (event) => {
      if (event.key === "Escape") {
        setPalette(false);
        setSelectedEvent(null);
        setZoomPreview(false);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  useEffect(() => {
    if (!running || !startTime) return;
    const id = window.setInterval(
      () => setElapsed((Date.now() - startTime) / 1000),
      500,
    );
    return () => window.clearInterval(id);
  }, [running, startTime]);
  useEffect(() => {
    if (autoScroll.current && timelineRef.current)
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
  }, [events]);
  const findings = records.filter((r) => r.technique),
    candidates = records.filter((r) => r.category);
  const flowNodes = useMemo(
    () =>
      flow.nodes.map((node) => {
        const enabled =
          !["techniques", "candidates", "ocr", "dedup"].includes(node.id) ||
          branchEnabled(flow, node.id);
        const layaSkipped = node.id === "laya" && (outcome?.report.local_ai?.laya?.status === "unavailable" || events.findLast(event => event.kind === "phase" && event.stage === "laya")?.action === "skipped");
        const layaReason = outcome?.report.local_ai?.laya?.reason || outcome?.report.evidence_packets?.find(packet => packet.local_ai?.laya?.reason === "insufficient_memory")?.local_ai.laya.reason;
        const ocr = node.id === "ocr" ? ocrPresentation(outcome?.report.ocr_summary) : null;
        const state = layaSkipped ? "skipped" : !enabled
          ? "disabled"
          : ocr?.state || (active === node.id
            ? status === "failed"
              ? "error"
              : status === "paused"
                ? "paused"
                : "active"
            : visited.has(node.id)
              ? "done"
              : "");
        let caption =
          node.id === "browser"
            ? t("{count}페이지 방문", { count: pages.length })
            : node.id === "collector"
              ? t("{count}개 URL 발견", { count: discovered })
              : node.id === "dedup" ? t("동일 문구 · 근거 보존") : node.id === "ocr" ? t("{count}장 처리", { count: Object.keys(ocrLive).length }) : node.id === "techniques"
                ? t("{count}건 발견", { count: findings.length })
                : node.id === "laya"
                  ? layaSkipped ? ({insufficient_memory:t("메모리 부족"),timeout:t("처리 시간 초과"),time_budget:t("검사 시간 부족"),runtime_unavailable:t("실행 환경 확인 필요")}[layaReason] || t("분석 미완료")) : outcome?.report.local_ai?.laya ? t("{analyzed}개 검토 · {omitted}개 미확인", { analyzed: outcome.report.local_ai.laya.analyzed, omitted: outcome.report.local_ai.laya.omitted }) : t("로컬 문맥 검토")
                : node.id === "candidates"
                  ? outcome?.report.local_ai ? `${t("{count}개 문맥", { count: outcome.report.local_ai.text_analyzed })}${outcome.report.content_visual?.analyzed ? ` · ${t("사진 {count}장", { count: outcome.report.content_visual.analyzed })}` : ""} · ${t("{count}건 광고 의심", { count: candidates.length })}` : t("{count}건 광고 의심", { count: candidates.length })
                  : node.id === "target"
                    ? ""
                    : outcome
                      ? t("JSON · CSV 저장 완료")
                      : t("실행 종료 후 저장");
        if (!enabled) caption = node.id === "ocr" && flow.ocr_enabled === false ? t("사용 안 함") : t("분석 경로 연결 안 됨");
        if (ocr) caption = ocr.caption;
        return {
          ...node,
          type: "stage",
          deletable: false,
          data: {
            state,
            caption,
            url:
              outcome?.result.meta.entry_url ||
              (running ? runTarget || url : url),
          },
        };
      }),
    [
      flow,
      active,
      visited,
      pages.length,
      discovered,
      findings.length,
      candidates.length,
      records,
      ocrLive,
      outcome,
      url,
      running,
      status,
      runTarget,
      events,
    ],
  );
  const flowEdges = useMemo(
    () =>
      flow.edges.map((edge) => ({
        ...edge,
        type: "workflow",
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#687a72" },
        selectable: false,
        deletable: false,
        focusable: false,
        reconnectable: false,
        animated:
          status === "running" &&
          !([edge.source,edge.target].includes("ocr") && ["disabled","skipped"].includes(flowNodes.find(n=>n.id==="ocr")?.data.state)) &&
          (edge.target === active || edge.source === active),
        style: {
          stroke:
            [edge.source,edge.target].includes("ocr") && ["disabled","skipped"].includes(flowNodes.find(n=>n.id==="ocr")?.data.state)
              ? "#62666b" : edge.target === active
              ? "#2563a6"
              : visited.has(edge.source)
                ? "#41765b"
                : "#62666b",
          strokeWidth: edge.target === active ? 2.8 : 1.8,
          strokeDasharray: [edge.source,edge.target].includes("ocr") && ["disabled","skipped"].includes(flowNodes.find(n=>n.id==="ocr")?.data.state) ? "4 4" : undefined,
        },
      })),
    [flow.edges, status, active, visited, flowNodes],
  );
  const onNodesChange = useCallback(
    (changes) =>
      setFlow((value) => ({
        ...value,
        nodes: applyNodeChanges(changes, value.nodes),
      })),
    [],
  );
  const start = async (demo = false, overrides = {}) => {
    if (running || startRequest.current) {
      tell("이미 검사 중입니다.");
      return;
    }
    if (
      !Number.isInteger(Number(maxPages)) ||
      Number(maxPages) < 1 ||
      Number(maxPages) > 10000
    ) {
      tell(t("최대 페이지는 1~10000 사이의 정수로 지정하세요."), "error");
      return;
    }
    if (
      !Number.isFinite(Number(timeout)) ||
      Number(timeout) <= 0 ||
      Number(timeout) > 1800
    ) {
      tell(t("제한시간은 1~1800초로 지정하세요."), "error");
      return;
    }
    let entry = (overrides.url || url).trim();
    if (!entry && !demo) {
      tell(t("검사할 URL을 입력하세요."), "error");
      return;
    }
    if (!entry.includes("://"))
      entry = /^(?:\d{1,3}\.){3}|^localhost/.test(entry)
        ? "http://" + entry
        : "https://" + entry;
    if (!demo) {
      try {
        const target = new URL(entry);
        if (
          !["http:", "https:"].includes(target.protocol) ||
          target.username ||
          target.password
        )
          throw new Error();
      } catch {
        tell(t("http 또는 https 웹사이트 주소를 입력하세요."), "error");
        return;
      }
    }
    const nextFlow = overrides.singlePage
      ? { ...flow, follow_links: false }
      : flow;
    if (!demo) setUrl(entry);
    if (overrides.singlePage) setFlow(nextFlow);
    startRequest.current = true;
    setStatus("running");
    setRunTarget(demo ? "" : entry);
    setRecords([]);
    setSearch("");
    setFilter("all");
    setReviewFilter("all");
    setPages([]);
    setPending([]);
    setEvents([]);
    setPreview(null);
    setOutcome(null);
    setReviewData({ revision: 0, items: {} });
    setSelectedIds(new Set());
    setActive("target");
    setVisited(new Set(["target"]));
    setDiscovered(0);
    setQueue(0);
    setElapsed(0);
    setStartTime(Date.now());
    setView((previous) => previous === "inspection" ? "inspection" : "workflow");
    setSelectedNode(null);
    setSelectedRecord(null);
    try {
      await api.start({
        url: demo ? "http://127.0.0.1/" : entry,
        max_pages: Number(maxPages),
        timeout_sec: Number(timeout),
        profile,
        preview: livePreview,
        interval_sec: scanInterval,
        demo,
        workflow: nextFlow,
      });
    } catch (error) {
      setStatus("failed");
      tell(error.message, "error");
    } finally {
      startRequest.current = false;
    }
  };
  const load = async () => {
    const value = await action(() => api.load());
    if (value) {
      applyOutcome(value);
      setView("results");
      setSelectedRecord(null);
    }
  };
  const pause = () =>
    action(async () => {
      const resuming = status === "paused" || status === "pausing";
      setStatus(resuming ? "running" : "pausing");
      try {
        await (resuming ? api.resume() : api.pause());
      } catch (error) {
        const value = await api.state();
        setStatus(value.status);
        throw error;
      }
    });
  const stop = () =>
    action(async () => {
      setStatus("stopping");
      await api.stop();
    });
  const updateReview = (ids, status, note) =>
    action(async () => {
      setReviewSaving(true);
      try {
        const memberIds = expandPageIds(ids, records);
        let value = reviewData;
        for (let start = 0; start < memberIds.length; start += 500) {
          value = await api.review({
          ids: memberIds.slice(start, start + 500),
          status,
          ...(note === undefined ? {} : { note }),
          expected_revision: value.revision,
        });
        setReviewData(value);
        }
        setSelectedIds(new Set());
        setReviewNotice(t("{count}건의 검토 내용을 저장했습니다.", { count: ids.length }));
      } finally {
        setReviewSaving(false);
      }
    });
  const commands = [
    {
      label: t("검사 실행"),
      keywords: "run scan",
      description: t("현재 URL과 구성으로 검사"),
      icon: "Play",
      disabled: running || !booted,
      action: () => start(),
    },
    {
      label: t("데모 검사"),
      keywords: "demo",
      description: t("로컬 예제 · 필수 탐지 14건"),
      icon: "FlaskConical",
      disabled: running || !booted,
      action: () => start(true),
    },
    {
      label:
        status === "paused" || status === "pausing" ? t("검사 재개") : t("일시정지"),
      icon: "Pause",
      disabled: !running || status === "stopping",
      action: pause,
    },
    {
      label: t("검사 중단"),
      icon: "Square",
      disabled: !running || status === "stopping",
      action: stop,
    },
    ...[
      ["workflow", t("검사 구성"), "Workflow"],
      ["results", t("탐지 내역"), "ListFilter"],
      ["pages", t("탐색 경로"), "Network"],
      ["activity", t("진행 기록"), "Activity"],
      ["history", t("검사 기록"), "History"],
    ].map(([id, label, icon]) => ({ label, icon, action: () => setView(id) })),
    {
      label: t("결과 불러오기"),
      icon: "FolderOpen",
      disabled: running,
      action: load,
    },
    {
      label: t("CSV 저장"),
      icon: "Download",
      disabled: !outcome || running,
      action: () =>
        action(async () => {
          const value = await api.exportCSV();
          if (value) tell(t("CSV를 저장했습니다."), "success");
        }),
    },
    {
      label: t("설정"),
      icon: "Settings",
      action: () => openSettings(),
    },
    {
      label: t("사용 가이드"),
      keywords: "tutorial help 도움말 튜토리얼",
      icon: "MousePointer2",
      action: () => setTutorial(true),
    },
  ];
  useEffect(() => {
    const handle = event => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.target.closest?.('[data-shortcut-recorder]')) return;
      const key = fromEvent(event);
      const id = key && Object.keys(shortcuts).find(id => shortcuts[id] === key);
      if (!id) return;
      if (event.target.closest?.('input, textarea, [contenteditable="true"], [role="dialog"]') && id !== 'palette') return;
      event.preventDefault();
      if (id === 'palette') setPalette(previous => !previous);
      else if (id === 'settings') openSettings();
      else if (id === 'guide') setTutorial(true);
      else if (id === 'load') { if (!running) load(); }
      else setView(id);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [shortcuts, running, load, openSettings]);
  const filteredRecords = sortDetections(records.filter(
    (record) =>
      (reviewFilter === "all" ||
        pageReview(record, reviewData.items).status ===
          reviewFilter) &&
      (filter === "all" ||
        (filter === "required" && record.technique) ||
        (filter === "candidates" && record.category) ||
        (["general_ads", "illegal_suspected", "image_review"].includes(filter) && advertisingGroup(record) === filter) ||
        record.techniques?.includes(filter) || record.technique === filter) &&
      [
        record.url,
        record.evidence_text,
        record.location,
        ...(record.techniques || []).map(type => LABELS[type]),
        ...(record.categories || []).map(type => LABELS[type]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  ), recordOrder);
  const filteredEvents = events.filter(
    (event) =>
      eventFilter === "all" ||
      (eventFilter === "phase" &&
        ["phase", "page_complete", "started", "done"].includes(event.kind)) ||
      (eventFilter === "network" &&
        ["http_response", "request_blocked"].includes(event.kind)) ||
      (eventFilter === "findings" &&
        ["finding", "candidate", "warning", "error"].includes(event.kind)),
  );
  const phaseTitle = ["paused", "pausing", "stopping"].includes(status)
    ? STATUS[status]
    : active
      ? STAGE_NAMES[active]
      : STATUS[status];
  const displayedPreviewUrl = preview
    ? typeof preview.url === "string"
      ? preview.url
      : ""
    : currentUrl || url;
  return (
    <div className="app-shell">
      <div className="window-titlebar" aria-hidden="true" />
      <aside className={`sidebar ${view === "settings" ? "settings-sidebar" : ""}`}>
        {view === "settings" ? <>
          <SettingsNav selected={settingsTab} onSelect={tab => { if (tab !== settingsTab) transitionPage(() => setSettingsTab(tab)); }} onBack={() => setView(settingsReturnView.current)} onGuide={() => setTutorial(true)} />
        </> : <>

          <div className="brand sidebar-brand">
            <span className="brand-mark"><img src={brandMark} alt={t("Chickadee 로고")} /></span>
            <span>chickadee<span className="brand-dot">.</span></span>
          </div>

        <nav>
          {[
            ["workflow", "Workflow", t("검사 구성")],
            ["results", "ListFilter", t("탐지 내역")],
            ["pages", "Network", t("탐색 경로")],
            ["inspection", "GitBranch", t("검사 분석")],
            ["activity", "Activity", t("진행 기록")],
            ["history", "History", t("검사 기록")],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => setView(id)}
            >
              <Icon name={icon} />
              <span>{label}</span>
              {id === "results" && records.length > 0 && (
                <b className="detection-count">{records.length}</b>
              )}
              {id === "activity" && running && <span className="live-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom sidebar-tools">
          <SidebarTool label={t("설정")} icon="Settings" shortcut={shortcuts.settings} onClick={openSettings} />
          <SidebarTool label={t("앱 재실행")} icon="RotateCcw" disabled={running || !booted} onClick={() => action(() => api.restart())} />
          <SidebarTool label={t("결과 불러오기")} icon="FolderOpen" shortcut={shortcuts.load} disabled={running} onClick={load} />
        </div>
        </>}
      </aside>
      <main className="main">
        <header className="topbar">
            <h1>
              {view === "settings" ? t("설정") : view === "inspection" ? t("검사 분석") : view === "history"
                ? t("검사 기록")
                : view === "results"
                  ? t("탐지 내역")
                  : view === "pages"
                    ? t("탐색 경로")
                    : view === "activity"
                      ? t("진행 기록")
                      : t("검사 구성")}
            </h1>
          <div className="header-run-controls" aria-label={t("검사 실행 제어")}>
          <div className="run-actions" key={running ? status : "ready"}>
            {running ? (
              <>
                <Button
                  icon={
                    status === "paused" || status === "pausing"
                      ? "Play"
                      : "Pause"
                  }
                  variant="secondary"
                  disabled={status === "stopping" || Boolean(loginRequest)}
                  onClick={pause}
                  title={t("현재 페이지 검사가 끝나면 일시정지합니다.")}
                >
                  {status === "paused"
                    ? t("검사 재개")
                    : status === "pausing"
                      ? t("정지 요청 취소")
                      : t("일시정지")}
                </Button>
                <Button
                  icon="Square"
                  variant="danger"
                  className="stop-button"
                  onClick={stop}
                  disabled={status === "stopping"}
                >
                  {t("검사 중단")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  icon="Play"
                  className="primary"
                  disabled={!booted}
                  onClick={() => start()}
                >
                  {t("검사 실행")}
                </Button>
                <ActionMenu
                  label={t("검사 옵션")}
                  items={[
                    {
                      label: t("데모 검사"),
                      icon: "FlaskConical",
                      disabled: !booted,
                      action: () => start(true),
                    },
                    {
                      label: t("이 페이지만 검사"),
                      icon: "ScanLine",
                      disabled: !booted,
                      action: () => start(false, { singlePage: true }),
                    },
                    {
                      label: t("설정"),
                      icon: "Settings",
                      action: () => openSettings(),
                    },
                  ]}
                />
              </>
            )}
          </div>
          </div>
          <div className="topbar-right">
            {visualPreview && (
              <span className="local-label">{t("디자인 미리보기 · 저장된 데모")}</span>
            )}
          </div>
        </header>
        <section
          className="summary-strip"
          hidden={view === "settings" || (!running && !outcome && status !== "failed")}
        >
          <div className="scan-status">
            <span
              className={
                running
                  ? status === "paused"
                    ? "warning-dot"
                    : "pulse-dot"
                  : status === "failed"
                    ? "error-dot"
                    : "ready-dot"
              }
            />
            <strong>{phaseTitle}</strong>
            {elapsed > 0 && <span>{formatElapsed(elapsed)}</span>}
          </div>
          <div className="summary-numbers">
            <button
              className={
                view === "pages" && pageFilter === "visited" ? "active" : ""
              }
              onClick={() => {
                setView("pages");
                setPageFilter("visited");
                setSearch("");
              }}
            >
              <Icon name="Network" size={13} />
              <span>{t("방문")}</span>
              <b>{pages.length}</b>
            </button>
            <button
              className={
                view === "results" && filter === "required" ? "active" : ""
              }
              onClick={() => {
                setView("results");
                setFilter("required");
                setSearch("");
              }}
            >
              <Icon name="Fingerprint" size={13} />
              <span>{t("필수 탐지")}</span>
              <b>{findings.length}</b>
            </button>
            {[["general_ads", t("일반 광고"), "ShoppingCart"], ["illegal_suspected", t("불법 의심"), "ShieldAlert"], ["image_review", t("이미지 검토"), "ScanSearch"]].map(([group, label, icon]) => (
              <button key={group} className={view === "results" && filter === group ? "active" : ""}
                onClick={() => { setView("results"); setFilter(group); setSearch(""); }}>
                <Icon name={icon} size={13} />
                <span>{label}</span>
                <b className="amber-text">{candidates.filter(record => advertisingGroup(record) === group).length}</b>
              </button>
            ))}
            <button
              className={
                view === "pages" && pageFilter === "pending" ? "active" : ""
              }
              onClick={() => {
                setView("pages");
                setPageFilter("pending");
                setSearch("");
              }}
            >
              <Icon name="LoaderCircle" size={13} />
              <span>{t("대기")}</span>
              <b>{queue}</b>
            </button>
          </div>
        </section>
        <div className="content-area" data-view={view} key={view}>
          {view === "settings" && <div className="settings-page" key={settingsTab}>
            <section className="settings-modal settings-page-content" aria-label={t("설정")}>
              <div className="settings-page-heading">
                <div><h2>{{ general: t("일반"), ai: t("AI 연결"), notifications: t("알림"), schedules: t("예약 검사"), shortcuts: t("단축키"), updates: t("업데이트") }[settingsTab]}</h2><p>{{ general: t("검사 방식과 결과 저장 위치를 관리합니다."), ai: t("근거 검토에 사용할 AI 제공자와 사용 한도를 설정합니다."), notifications: t("검사 완료 알림과 채널별 리포트를 설정합니다."), schedules: t("정해진 시간에 저장된 구성으로 검사를 실행합니다."), shortcuts: t("자주 쓰는 명령의 키보드 단축키를 설정합니다."), updates: t("최신 릴리스를 확인하고 새 버전을 다운로드합니다.") }[settingsTab]}</p></div>
              </div>
            {settingsTab === "general" && <>
            <div className="settings-field">
              <span>{t("언어")}</span>
              <ActionMenu
                className="profile-menu language-menu"
                label={t("언어")}
                triggerText={LANGUAGES.find((entry) => entry.id === language())?.label}
                items={LANGUAGES.map(({ id, label }) => ({
                  label, selected: language() === id,
                  action: () => action(async () => {
                    if (id === language()) return;
                    await api.preferences({ language: id });
                    await api.reloadLanguage();
                  }),
                }))}
              />
            </div>
            <RuntimeSettings disabled={running} />
            <div className="settings-field">
              <span>{t("사이트 탐색 설정")}</span>
              <ActionMenu
                className="profile-menu"
                label={t("사이트 탐색 설정")}
                disabled={running}
                triggerText={{
                  default: t("기본 탐색 · 같은 사이트 전체"),
                  test: t("사용자 모의 게시판 · .post-detail 본문"),
                  public: t("공공 사이트 기본 설정"),
                }[profile]}
                items={[
                  ["default", t("기본 탐색 · 같은 사이트 전체")],
                  ["test", t("사용자 모의 게시판 · .post-detail 본문")],
                  ["public", t("공공 사이트 기본 설정")],
                ].map(([id, label]) => ({
                  label, selected: profile === id, disabled: running,
                  action: () => setProfile(id),
                }))}
              />
            </div>
            <div className="form-row">
              <label>
                {t("최대 페이지")}
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={maxPages}
                  disabled={running}
                  onChange={(event) => setMaxPages(event.target.value)}
                />
              </label>
              <label>
                {t("전체 제한시간 (초)")}
                <input
                  type="number"
                  min="1"
                  max="1800"
                  value={timeout}
                  disabled={running}
                  onChange={(event) => setTimeoutValue(event.target.value)}
                />
              </label>
            </div>
            <div className="scan-pace">
              <div className="scan-pace-heading"><strong>{t("탐색 속도")}</strong><span>{t("{seconds}초 간격", { seconds: scanInterval })}</span></div>
              <div className="scan-pace-options" role="group" aria-label={t("탐색 속도")}>{[[0, t("빠르게"), t("대기 없이 탐색")], [0.5, t("보통"), t("기본 속도")], [5, t("천천히"), t("다른 작업과 함께")]].map(([value, label, hint]) => <button key={value} type="button" disabled={running} aria-pressed={scanInterval === value} onClick={() => setScanInterval(value)}><strong>{label}</strong><small>{hint}</small></button>)}</div>
              <label>{t("페이지 사이 대기 시간")}<input aria-label={t("페이지 사이 대기 시간")} type="range" min="0" max="30" step="0.5" value={scanInterval} disabled={running} onChange={event => setScanInterval(Number(event.target.value))} /></label>
              <p>{t("다음 페이지로 이동하기 전 기다리는 시간입니다. 천천히 검사할 때는 전체 제한시간도 늘려 주세요. 검사 중인 페이지의 처리 속도는 유지됩니다.")}</p>
            </div>
            <label className="toggle-label">
              <div>
                <strong>{t("실시간 브라우저 화면")}</strong>
                <small>{t("검사 중인 페이지를 미리보기로 표시합니다.")}</small>
              </div>
              <input
                type="checkbox"
                checked={livePreview}
                disabled={running}
                onChange={(event) => setLivePreview(event.target.checked)}
              />
            </label>
            <label>
              {t("결과 저장 위치")}
              <div className="folder-input">
                <span title={outputRoot}>{outputRoot}</span>
                <button
                  type="button"
                  className="folder-change-icon"
                  aria-label={t("결과 저장 위치 변경")}
                  title={t("결과 저장 위치 변경")}
                  disabled={running}
                  onClick={() =>
                    action(async () => setOutputRoot(await api.chooseFolder()))
                  }
                >
                  <Icon name="FolderOpen" size={18} />
                </button>
              </div>
            </label>
            <p className="settings-folder-hint">{t("각 검사는 별도 폴더에 저장됩니다.")}</p>
            <div className="general-settings-save">
              <p>{t("변경 사항은 자동 저장됩니다.")}</p>
              <Button icon="Save" disabled={running || generalSettingsSaving || !Number.isInteger(Number(maxPages)) || Number(maxPages) < 1 || Number(maxPages) > 10000 || !Number.isFinite(Number(timeout)) || Number(timeout) <= 0 || Number(timeout) > 1800}
                aria-label={t("일반 설정 저장")} onClick={() => action(async () => {
                  setGeneralSettingsSaving(true);
                  try {
                    await api.preferences({url, maxPages:Number(maxPages), timeout:Number(timeout), profile, livePreview, scanInterval});
                    tell(t("일반 설정을 저장했습니다."), "success");
                  } finally { setGeneralSettingsSaving(false); }
                })}>{generalSettingsSaving ? t("저장 중…") : t("설정 저장")}</Button>
            </div>
            </>}
            {settingsTab === "ai" && <>
            <GrokSettings config={agentConfig} onConfigured={setAgentConfig} ActionMenu={ActionMenu} />
            <details className="automation-info">
              <summary>{t("에이전트 확장 규격")}</summary>
              <p>
                {t("로컬 도구 {tools}개 · 규격 v{version}. 실행 ID와 입력 형식을 검증하며, 검사 제어·근거 조회·검토 기록에 같은 기능을 사용합니다.", { tools: capabilities?.tools?.length || 0, version: capabilities?.protocol_version || 1 })}
              </p>
              <small>
                {t("AI 검토는 사용자가 실행할 때만 호출합니다. 페이지 본문과 광고 문구는 분석 대상 데이터로 취급합니다.")}
              </small>
            </details>
            </>}
            {settingsTab === "shortcuts" && <ShortcutSettings value={shortcuts} onChange={async value => { await api.preferences({ shortcuts: value }); setShortcuts(value); }} />}
            {settingsTab === "notifications" && <NotificationSettings />}
            {settingsTab === "updates" && <UpdateSettings />}
            {settingsTab === "schedules" && <ScheduleSettings options={{ url, max_pages: Number(maxPages), timeout_sec: Number(timeout), profile, preview: livePreview, interval_sec: scanInterval, workflow: flow }} />}
            </section>
          </div>}
          {view === "inspection" && <InspectionInsights onOpenHistory={() => setView("history")} tab={inspectionTab} setTab={setInspectionTab} runStatus={status} onOpenSettings={() => openSettings("ai")} agentConfig={agentConfig} />}
          {view === "workflow" && (
            <div className={`studio ${selectedNode || monitorOpen ? "panel-open" : "panel-closed"}`}>
              <section className="canvas-shell">
                <div className="canvas-toolbar">
                  <span className="canvas-flow-heading"><strong>{t("검사 흐름")}</strong><small className="canvas-route-legend">
                    <span>{t("본문")} <Icon name="ChevronRight" size={12} /> ML</span>
                    <span>{t("이미지")} <Icon name="ChevronRight" size={12} /> OCR <Icon name="ChevronRight" size={12} /> ML</span>
                  </small></span>
                  <div className="canvas-flow-actions">
                    <SidebarTool
                      label={t("자동 정렬")}
                      icon="Workflow"
                      onClick={() => {
                        const positions = defaultWorkflow().nodes;
                        setFlow(value => ({ ...value, nodes: value.nodes.map(node => ({ ...node, position: positions.find(item => item.id === node.id).position })) }));
                        requestAnimationFrame(() => requestAnimationFrame(() => canvasApi?.fitView({ padding: 0.2, maxZoom: 0.75, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200 })));
                      }}
                    />
                    <SidebarTool
                      label={t("기본 구성으로 되돌리기")}
                      icon="RotateCcw"
                      disabled={running}
                      onClick={() => {
                        setFlow(defaultWorkflow());
                        setSelectedNode(null);
                      }}
                    />
                    <SidebarTool
                      label={t("구성 내보내기")}
                      icon="Download"
                      onClick={() => action(() => api.exportWorkflow(flow))}
                    />
                  </div>
                </div>
                <div className="flow-area">
                  {booted && <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodesChange={onNodesChange}
                    deleteKeyCode={null}
                    nodesDraggable={!running}
                    nodesConnectable={false}
                    edgesReconnectable={false}
                    edgesFocusable={false}
                    onNodeClick={(_event, node) => setSelectedNode(node.id)}
                    onPaneClick={() => setSelectedNode(null)}
                    onInit={setCanvasApi}
                    fitView
                    fitViewOptions={{ padding: 0.2, maxZoom: 0.75, minZoom: 0.2 }}
                    minZoom={0.2}
                    maxZoom={1.5}
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background color="#2b2d2e" gap={24} size={0.7} />
                    <Controls showInteractive={false} />
                    <MiniMap
                      nodeColor="#60646b"
                      maskColor="rgba(23,23,23,.65)"
                      style={{ width: 120, height: 74 }}
                      pannable
                      zoomable
                    />
                  </ReactFlow>}

                </div>
              </section>
              <aside
                className="monitor-panel"
                id="workflow-side-panel"
                aria-hidden={!selectedNode && !monitorOpen}
                inert={!selectedNode && !monitorOpen}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSelectedNode(null);
                    setMonitorOpen(false);
                    document.querySelector(".workspace-rail button")?.focus();
                  }
                }}
              >
                {selectedNode ? (
                  <NodeSettings
                    id={selectedNode}
                    flow={flow}
                    setFlow={setFlow}
                    url={url}
                    setUrl={setUrl}
                    running={running}
                    onClose={() => setSelectedNode(null)}
                  />
                ) : (
                  <>
                    <div className="panel-heading">
                      <span>
                        <strong>{t("미리보기")}</strong>
                      </span>
                      <button aria-label={t("미리보기·진행 기록 닫기")} onClick={() => setMonitorOpen(false)}>
                        <Icon name="X" size={15} />
                      </button>
                    </div>
                    <div className="browser-preview">
                      <div className="browser-chrome">
                        <span className="browser-dots">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span title={displayedPreviewUrl}>
                          <Icon
                            name={
                              displayedPreviewUrl.startsWith("https:")
                                ? "LockKeyhole"
                                : "Globe2"
                            }
                            size={11}
                          />
                          {displayedPreviewUrl
                            ? shortUrl(displayedPreviewUrl)
                            : t("캡처 주소 없음")}
                        </span>
                        <button
                          title={t("화면 확대")}
                          aria-label={t("미리보기 화면 확대")}
                          disabled={!preview}
                          onClick={() => setZoomPreview(true)}
                        >
                          <Icon name="Maximize2" size={13} />
                        </button>
                      </div>
                      {preview ? (
                        <button
                          className="preview-image"
                          aria-label={t("검사 화면 크게 보기")}
                          onClick={() => setZoomPreview(true)}
                        >
                          <img
                            src={preview.data_url}
                            alt={t("실제 검사 브라우저의 현재 화면")}
                          />
                        </button>
                      ) : (
                        <div className="preview-placeholder">
                          <Icon name="PanelsTopLeft" size={28} />
                          <strong>
                            {livePreview
                              ? running ? t("화면을 기다리는 중") : t("검사 시작 전")
                              : t("미리보기 꺼짐")}
                          </strong>
                          <span>
                            {livePreview
                              ? running ? t("캡처가 도착하면 표시됩니다.") : t("실행하면 방문한 페이지가 표시됩니다.")
                              : t("설정에서 미리보기를 켤 수 있습니다.")}
                          </span>
                        </div>
                      )}
                      <div className="preview-caption">
                        <span className="preview-status">
                          <i data-active={Boolean(preview && running && livePreview)} />
                          {!livePreview ? t("꺼짐") : preview ? t("최근 캡처") : running ? t("캡처 대기") : t("대기 중")}
                        </span>
                        <span>
                          {preview?.timestamp ? time(preview.timestamp) : ""}
                        </span>
                      </div>
                    </div>
                    {currentUrl && currentUrl !== preview?.url && (
                      <div className="current-location">
                        <span>{t("검사 위치")}</span>
                        <strong title={currentUrl}>
                          {currentUrl
                            ? relativeUrl(currentUrl)
                            : t("검사를 시작해 주세요.")}
                        </strong>
                      </div>
                    )}
                    <div className="activity-heading">
                      <strong>{t("진행 기록")}</strong>
                      <button onClick={() => setView("activity")}>
                        {t("전체 기록")} <Icon name="ArrowUpRight" size={13} />
                      </button>
                    </div>
                    <div
                      className="mini-timeline"
                      ref={timelineRef}
                      onScroll={(event) => {
                        autoScroll.current =
                          event.target.scrollHeight -
                            event.target.scrollTop -
                            event.target.clientHeight <
                          90;
                      }}
                    >
                      {events
                        .filter((event) =>
                          [
                            "phase",
                            "finding",
                            "candidate",
                            "page_complete",
                            "warning",
                            "error",
                            "done",
                            "started",
                          ].includes(event.kind),
                        )
                        .slice(-100)
                        .map((event) => (
                          <EventRow
                            key={event.key}
                            event={event}
                            onClick={() => setSelectedEvent(event)}
                            compact
                          />
                        ))}
                      {events.length === 0 && (
                        <div className="timeline-empty">
                          <div className="timeline-waiting">
                            <span className="timeline-waiting-dot" />
                            <strong>{t("아직 기록이 없습니다")}</strong>
                          </div>
                          <p>{t("검사를 실행하면 아래 과정이 기록됩니다.")}</p>
                          <ol className="timeline-outline" aria-label={t("검사 과정 안내")}>
                            {[
                              ["Globe2", t("페이지 이동"), t("방문한 주소와 응답 상태")],
                              ["ScanLine", t("콘텐츠 수집"), t("페이지 본문과 하위 링크")],
                              ["Search", t("탐지 · 분류"), t("발견한 항목과 판단 근거")],
                              ["FileCheck2", t("결과 저장"), t("검사 요약과 출력 파일")],
                            ].map(([icon, title, description]) => (
                              <li key={title}>
                                <span className="timeline-outline-icon"><Icon name={icon} size={15} /></span>
                                <div><strong>{title}</strong><span>{description}</span></div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </aside>
              <div className="workspace-rail">
                <button
                  aria-label={t("미리보기·진행 기록")}
                  title={t("미리보기·진행 기록")}
                  aria-expanded={Boolean(monitorOpen || selectedNode)}
                  aria-controls="workflow-side-panel"
                  onClick={() => {
                    setMonitorOpen(!(selectedNode || monitorOpen));
                    setSelectedNode(null);
                  }}
                >
                  <Icon name="ChevronRight" size={17} />
                </button>
              </div>
            </div>
          )}
          {view === "results" && (
            <div className={`results-layout ${selectedRecord ? "detail-open" : "detail-closed"}`}>
              <section className="table-section">
                <div className="list-toolbar results-filters-toolbar">
                  <div className="search">
                    <Icon name="Search" size={15} />
                    <input
                      aria-label={t("결과 검색")}
                      placeholder={t("원문, URL 검색")}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <ActionMenu
                    className="result-category-menu"
                    label={t("탐지 분류 필터: {value}", { value: {all:t("전체"), required:t("필수 탐지"), general_ads:t("일반 광고"), illegal_suspected:t("불법 의심"), image_review:t("이미지 검토")}[filter] || t("전체") })}
                    triggerText={t("분류: {value}", { value: {all:t("전체"), required:t("필수 탐지"), general_ads:t("일반 광고"), illegal_suspected:t("불법 의심"), image_review:t("이미지 검토")}[filter] || t("전체") })}
                    items={[["all", t("전체"), "ListFilter"], ["required", t("필수 탐지"), "Fingerprint"], ["general_ads", t("일반 광고"), "ShoppingCart"], ["illegal_suspected", t("불법 의심"), "ShieldAlert"], ["image_review", t("이미지 검토"), "ScanSearch"]].map(([id, label, icon]) => ({label, icon, selected:filter === id, action:() => setFilter(id)}))}
                  />
                  <ActionMenu
                    className="review-filter-menu"
                    label={t("검토 상태 필터: {value}", { value: reviewFilter === "all" ? t("검토 전체") : REVIEW_LABELS[reviewFilter] })}
                    triggerText={reviewFilter === "all" ? t("검토 전체") : REVIEW_LABELS[reviewFilter]}
                    items={[["all", t("검토 전체")], ...Object.entries(REVIEW_LABELS)].map(([id, label]) => ({
                      label,
                      selected: reviewFilter === id,
                      action: () => setReviewFilter(id),
                    }))}
                  />
                  <ActionMenu
                    label={t("정렬 방식")}
                    triggerText={recordOrder === "newest" ? t("최신순") : t("오래된순")}
                    items={[["newest", t("최신순")], ["oldest", t("오래된순")]].map(([id, label]) => ({ label,
                      selected: recordOrder === id, action: () => setRecordOrder(id),
                    }))}
                  />
                  <Button
                    icon="Download"
                    disabled={!outcome || running}
                    onClick={() =>
                      action(async () => {
                        const result = await api.exportCSV();
                        if (result) tell(t("CSV를 저장했습니다."), "success");
                      })
                    }
                  >
                    {t("CSV 저장")}
                  </Button>
                </div>
                {selectedIds.size > 0 && (
                  <div className="bulk-toolbar">
                    <strong>{t("{count}개 선택", { count: selectedIds.size })}</strong>
                    <Button
                      icon="CheckCheck"
              image={checkImage}
                      variant="ghost"
                      disabled={reviewSaving || running}
                      onClick={() =>
                        updateReview([...selectedIds], "confirmed")
                      }
                    >
                      {tc("action", "검토 확인")}
                    </Button>
                    <Button
                      icon="X"
                      variant="ghost"
                      disabled={reviewSaving || running}
                      onClick={() =>
                        updateReview([...selectedIds], "dismissed")
                      }
                    >
                      {tc("action", "검토 제외")}
                    </Button>
                    <Button
                      icon="RotateCcw"
                      variant="ghost"
                      disabled={reviewSaving || running}
                      onClick={() =>
                        updateReview([...selectedIds], "unreviewed")
                      }
                    >
                      {tc("action", "미검토")}
                    </Button>
                    <button
                      aria-label={t("선택 해제")}
                      className="bulk-clear"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      <Icon name="X" size={15} />
                    </button>
                  </div>
                )}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th className="selection-cell">
                          <input
                            type="checkbox"
                            aria-label={t("표시 항목 전체 선택")}
                            disabled={
                              running || !outcome || !filteredRecords.length
                            }
                            checked={
                              filteredRecords.length > 0 &&
                              filteredRecords
                                .slice(0, 500)
                                .every((record) => selectedIds.has(record.id))
                            }
                            onChange={(event) =>
                              setSelectedIds(
                                event.target.checked
                                  ? new Set(
                                      filteredRecords
                                        .slice(0, 500)
                                        .map((record) => record.id),
                                    )
                                  : new Set(),
                              )
                            }
                          />
                        </th>
                        <th>{t("유형")}</th>
                        <th>{t("탐지 원문")}</th>
                        <th>{t("페이지")}</th>
                        <th>{t("검토")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record) => (
                        <tr
                          key={record.id}
                          className={
                            selectedRecord?.id === record.id ? "selected" : ""
                          }
                          onClick={() => setSelectedRecord(record)}
                        >
                          <td
                            className="selection-cell"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              aria-label={t("{id} 선택", { id: record.id })}
                              disabled={running || !outcome || reviewSaving}
                              checked={selectedIds.has(record.id)}
                              onChange={(event) =>
                                setSelectedIds((previous) => {
                                  const next = new Set(previous);
                                  if (event.target.checked) {
                                    if (next.size < 500) next.add(record.id);
                                  } else next.delete(record.id);
                                  return next;
                                })
                              }
                            />
                          </td>
                          <td className="record-type-cell">
                            <div className="record-types">
                            <button
                              className={`type-badge type-filter ${record.technique ? "purple" : "amber"}`}
                              data-type={record.technique || record.category}
                              onClick={(event) => {
                                event.stopPropagation();
                                setFilter(record.technique || advertisingGroup(record));
                              }}
                            >
                              <TypeBadgeContent type={record.technique || record.category} />
                            </button>
                            {(record.techniques.length + record.categories.length > 1) && <button
                              className="record-type-more" type="button"
                              aria-label={t("추가 유형 {count}개 보기", { count: record.techniques.length + record.categories.length - 1 })}
                              title={[...record.techniques, ...record.categories].filter(type => type !== (record.technique || record.category)).map(type => LABELS[type]).join(" · ")}
                              onClick={event => { event.stopPropagation(); setSelectedRecord(record); }}>
                              {t("외 {count}개", { count: record.techniques.length + record.categories.length - 1 })}
                            </button>}
                            </div>
                          </td>
                          <td className="evidence-cell">
                            {hasOCREvidence(record) && <span className="ocr-source-badge" title={t("이미지에서 읽은 문구 포함")}>OCR</span>}{" "}
                            {record.evidence_text}
                          </td>
                          <td className="url-cell" title={record.url}>
                            {shortUrl(record.url)}
                          </td>
                          <td>
                            <span
                              className={`review-label review-${pageReview(record, reviewData.items).status}`}
                            >
                              {
                                REVIEW_LABELS[
                                  pageReview(record, reviewData.items).status ||
                                    "unreviewed"
                                ]
                              }
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {outcome?.report.ocr_summary?.status === "partial" && <div className="ocr-coverage-notice" role="status"><Icon name="CircleAlert" size={17} /><div><strong>{t("이미지 검사에 미확인 항목이 있습니다")}</strong><span>{t("처리 실패 {failed} · 판독 불가 {unreadable} · 생략 {skipped} — 탐지 내역이 없어도 정상으로 판단하지 마세요.", { failed: outcome.report.ocr_summary.failed, unreadable: outcome.report.ocr_summary.unreadable || 0, skipped: outcome.report.ocr_summary.skipped || 0 })}</span></div></div>}
                  {filteredRecords.length === 0 && (
                    <Empty
                      icon="ScanSearch"
                      image={running ? undefined : noFileImage}
                      loading={running}
                      title={running ? t("분석 진행") : t("탐지 내역 없음")}
                      text={t("검사를 시작하거나 저장된 result.json을 불러오세요.")}
                    />
                  )}
                </div>
                {(filteredRecords.length > 0 || running) && <div className="table-footer">
                  {t("{count}개 페이지 · 같은 페이지의 제목·본문·댓글·이미지 근거를 묶어 표시합니다.", { count: filteredRecords.length })}{" "}
                  {running && <span>{active === "laya"
                    ? t("· 문맥 분석 중이며 광고 후보가 추가될 수 있습니다.")
                    : t("· 검사 진행 중의 임시 목록입니다. 최종 문맥 분석 후 광고 후보가 추가될 수 있습니다.")}</span>}
                </div>}
              </section>
              <div className="record-drawer" aria-hidden={!selectedRecord} inert={!selectedRecord}>
              {detailRecord && <RecordDetail
                key={detailRecord.id}
                record={detailRecord}
                liveScreenshots={liveScreenshots}
                outcome={outcome}
                review={
                  pageReview(detailRecord, reviewData.items)
                }
                onReview={(status, note) =>
                  updateReview([detailRecord.id], status, note)
                }
                reviewDisabled={running || !outcome || reviewSaving}
                onRecheck={() =>
                  start(false, { url: detailRecord.url, singlePage: true })
                }
                recheckDisabled={
                  running || !booted || outcome?.report.desktop_options?.demo
                }
                onCopy={(text) => action(async () => {
                  await api.copy(text);
                  tell(t("클립보드에 복사했습니다."), "success");
                })}
                onOpen={(url) => action(() => api.openExternal(url))}
                onClose={() => setSelectedRecord(null)}
              />}
              </div>
            </div>
          )}
          {view === "pages" && (
            <section className="table-section">
              <div className="list-toolbar">
                <AnimatedTabs value={pageFilter}>
                  <button
                    className={pageFilter === "visited" ? "active" : ""}
                    aria-pressed={pageFilter === "visited"}
                    onClick={() => setPageFilter("visited")}
                  >
                    <Icon name="Globe2" size={15} aria-hidden="true" />
                    {t("방문")} <span className="path-tab-count">{pages.length}</span>
                  </button>
                  <button
                    className={pageFilter === "pending" ? "active" : ""}
                    aria-pressed={pageFilter === "pending"}
                    onClick={() => setPageFilter("pending")}
                  >
                    <Icon name="History" size={15} aria-hidden="true" />
                    {t("대기")} <span className="path-tab-count">{queue}</span>
                  </button>
                </AnimatedTabs>
                <span className="path-discovered">{t("발견한 링크")} <strong>{discovered}</strong></span>
                <div className="search">
                  <Icon name="Search" size={15} />
                  <input
                    placeholder={t("경로 검색")}
                    aria-label={t("경로 검색")}
                    value={pageSearch}
                    onChange={(event) => setPageSearch(event.target.value)}
                  />
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("응답")}</th>
                      <th>{t("검사한 경로")}</th>
                      <th>{t("발견 링크")}</th>
                      <th>{t("분석 요소")}</th>
                      <th>{t("후보")}</th>
                      <th>{t("소요")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pageFilter === "pending" ? pending : pages)
                      .filter((page) =>
                        page.url
                          .toLowerCase()
                          .includes(pageSearch.toLowerCase()),
                      )
                      .map((page, index) => (
                        <tr
                          key={index}
                          onClick={() =>
                            setSelectedEvent(
                              pageFilter === "pending"
                                ? { kind: "url_discovered", ...page }
                                : { kind: "page_complete", page },
                            )
                          }
                        >
                          <td>
                            <span
                              className={`http-badge ${page.http_status >= 400 ? "bad" : ""}`}
                            >
                              {page.http_status || "—"}
                            </span>
                          </td>
                          <td className="path-cell">
                            <Icon name="CornerDownRight" size={14} />
                            <span title={page.url}>
                              {relativeUrl(page.url)}
                            </span>
                            {page.status === "authentication_required" && <small>{t("로그인 필요 · 미수집")}</small>}
                            {page.discovered_from && (
                              <small title={page.discovered_from}>
                                ↳ {relativeUrl(page.discovered_from)}
                              </small>
                            )}
                          </td>
                          <td>{page.links_discovered ?? "—"}</td>
                          <td>{page.elements_examined ?? "—"}</td>
                          <td>{page.candidates_added ?? "—"}</td>
                          <td>
                            {page.elapsed_sec
                              ? `${page.elapsed_sec.toFixed(1)}s`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!(pageFilter === "pending" ? pending : pages).length && (
                  <Empty
                    icon="Network"
                    image={noLocationImage}
                    title={
                      pageFilter === "pending"
                        ? t("대기 주소 없음")
                        : t("탐색 경로 없음")
                    }
                    text={t("발견한 실제 링크와 방문한 페이지를 확인할 수 있습니다.")}
                  />
                )}
              </div>
            </section>
          )}
          {view === "activity" && (
            <section className="activity-section">
              <div className="list-toolbar">
                <AnimatedTabs value={eventFilter}>
                  {[
                    ["all", t("전체"), "ListFilter"],
                    ["phase", t("진행 단계"), "Workflow"],
                    ["network", t("HTTP 통신"), "Network"],
                    ["findings", t("탐지·오류"), "CircleAlert"],
                  ].map(([id, label, icon]) => (
                    <button
                      key={id}
                      className={eventFilter === id ? "active" : ""}
                      aria-pressed={eventFilter === id}
                      onClick={() => setEventFilter(id)}
                    >
                      <Icon name={icon} size={15} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </AnimatedTabs>
                <div className="activity-log-meta">
                  <span>{t("최근 기록")} <strong>{events.length}</strong></span>
                  <span className="activity-log-storage">{t("전체 기록 저장")}</span>
                </div>
              </div>
              <div className="full-timeline">
                {filteredEvents.map((event) => (
                  <EventRow
                    key={event.key}
                    event={event}
                    onClick={() => setSelectedEvent(event)}
                  />
                ))}
                {!filteredEvents.length && (
                  <Empty
                    icon="Activity"
                    image={waitDetectionImage}
                    title={t("검사 과정을 기다리고 있습니다")}
                    text={t("실제 수행한 작업만 시간순으로 기록합니다.")}
                  />
                )}
              </div>
            </section>
          )}
          {view === "history" && (
            <section className="table-section">
              <div className="list-toolbar">
                <strong>{t("최근 검사")}</strong>
                <Button icon="FolderOpen" disabled={running} onClick={load}>
                  {t("결과 불러오기")}
                </Button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("대상")}</th>
                      <th>{t("상태")}</th>
                      <th>{t("방문 페이지")}</th>
                      <th>{t("필수 / 후보")}</th>
                      <th>{t("완료 시각")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() =>
                          !running &&
                          action(async () => {
                            const value = await api.history(item.id);
                            applyOutcome(value);
                            setView("results");
                          })
                        }
                      >
                        <td>{shortUrl(item.url)}</td>
                        <td>
                          <span className="history-status-badge" data-status={item.status}>
                            {STATUS[item.status] || item.status || t("상태 없음")}
                          </span>
                        </td>
                        <td>{item.pages}</td>
                        <td>
                          {item.findings} / {item.candidates}
                        </td>
                        <td>
                          {new Date(item.finished_at).toLocaleString(language() === "ko" ? "ko-KR" : "en-US")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!history.length && (
                  <Empty
                    icon="History"
                    image={noRecordImage}
                    title={t("첫 검사를 시작해 보세요")}
                    text={t("검사마다 별도 폴더에 결과와 진행 기록을 보관합니다.")}
                  />
                )}
              </div>
            </section>
          )}
        </div>
      </main>
      {scanNotice && <ScanNotice onClose={() => setScanNotice(false)} />}
      {reviewNotice && <ReviewSavedNotice message={reviewNotice} onClose={() => setReviewNotice(null)} />}
      {notice && (
        <div className={`toast ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
          <Icon
            name={
              notice.type === "error"
                ? "CircleAlert"
                : notice.type === "success"
                  ? "CircleCheck"
                  : "Info"
            }
          />
          <span>{notice.message}</span>
          <button aria-label={t("알림 닫기")} onClick={() => setNotice(null)}>
            <Icon name="X" size={15} />
          </button>
        </div>
      )}
      {palette && (
        <CommandPalette commands={commands} onClose={() => setPalette(false)} />
      )}
      {loginRequest && <LoginPrompt key={loginRequest.request_id} request={loginRequest} onStop={() => api.stop()} />}
      {tutorial && (
        <Tutorial
          onClose={closeTutorial}
          canDemo={booted && !running}
          onDemo={() => {
            closeTutorial();
            start(true);
          }}
          onInspect={() => {
            focusTargetAfterGuide.current = true;
            closeTutorial();
            setView("workflow");
            setSelectedNode("target");
          }}
        />
      )}
      {selectedEvent && (
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)}>
          <section
            className="modal event-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>{t("실행 내역")}</h2>
              </div>
              <button onClick={() => setSelectedEvent(null)}>
                <Icon name="X" />
              </button>
            </div>
            <p className="event-summary">{eventLabel(selectedEvent).title}</p>
            <pre>
              {JSON.stringify(
                selectedEvent,
                (key, value) => (key === "key" ? undefined : value),
                2,
              )}
            </pre>
          </section>
        </div>
      )}
      {zoomPreview && preview && (
        <div
          className="modal-backdrop preview-backdrop"
          onClick={() => setZoomPreview(false)}
        >
          <section
            className="preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("검사 화면")}
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <strong>{t("검사 화면")}</strong>
              <span>{preview.url}</span>
              <button
                aria-label={t("미리보기 닫기")}
                onClick={() => setZoomPreview(false)}
              >
                <Icon name="X" />
              </button>
            </div>
            <img src={preview.data_url} alt={t("검사 화면 확대")} />
          </section>
        </div>
      )}
    </div>
  );
}
function ReviewSavedNotice({ message, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="review-saved-dialog"
      aria-labelledby="review-saved-title"
      aria-describedby="review-saved-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button className="review-saved-close" aria-label={t("닫기")} onClick={onClose}><Icon name="X" size={18} /></button>
      <img className="review-saved-icon" src={checkImage} alt="" width={32} height={32} />
      <h2 id="review-saved-title">{t("검토 저장 완료")}</h2>
      <p id="review-saved-description">{message}</p>
      <button className="review-saved-confirm" autoFocus onClick={onClose}>{t("확인")}</button>
    </dialog>
  );
}

function ScanNotice({ onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="scan-notice-dialog"
      aria-labelledby="scan-notice-title"
      aria-describedby="scan-notice-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <h2 id="scan-notice-title">{t("이미 검사 중입니다")}</h2>
      <p id="scan-notice-description">{t("현재 검사가 끝난 뒤 다시 실행해 주세요.")}<br />{t("새 검사를 시작하려면 먼저 진행 중인 검사를 중단하세요.")}</p>
      <div><button autoFocus onClick={onClose}>{t("확인")}</button></div>
    </dialog>
  );
}

function SidebarTool({ label, icon, shortcut, hint, disabled, onClick }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="sidebar-tool-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); event.stopPropagation(); } }}>
    <button className="sidebar-tool" aria-label={label} aria-describedby={open ? id : undefined} disabled={disabled} onClick={onClick}><Icon name={icon} /></button>
    {open && <div className="sidebar-tool-tip" id={id} role="tooltip">
      <span>{label}</span>
      {shortcut && <kbd>{keyLabel(shortcut, /Mac/i.test(navigator.platform))}</kbd>}
      {hint && <small>{hint}</small>}
    </div>}
  </div>;
}

function Empty({ icon, image, title, text, loading = false }) {
  return (
    <div className={`empty-state${loading ? " empty-state-loading" : ""}`} role={loading ? "status" : undefined}>
      <span aria-hidden="true">
        {loading ? <Icon name="LoaderCircle" size={26} className="analysis-spinner" /> : image ? <img src={image} alt="" width={32} height={32} /> : <Icon name={icon} size={24} />}
      </span>
      <strong>{title}</strong>
    </div>
  );
}
function NodeSettings({ id, flow, setFlow, url, setUrl, running, onClose }) {
  const def = DEFINITIONS[id];
  return (
    <>
      <div className="panel-heading">
        <strong>{t("단계 설정")}</strong>
        <button onClick={onClose} aria-label={t("단계 설정 닫기")}>
          <Icon name="X" size={16} />
        </button>
      </div>
      <div className={`node-config tone-${def.tone}`}>
        <span className={`config-icon config-icon-${id}`}>
          {nodeImages[id] ? <img src={nodeImages[id]} alt="" width={28} height={28} draggable={false} /> : <Icon name={def.icon} size={28} />}
        </span>
        <small>{def.subtitle}</small>
        <h2>{def.title}</h2>
        <p>{def.detail}</p>
        {id === "target" && (
          <label>
            {t("검사 대상 URL")}
            <input
              id="target-url"
              type="url"
              placeholder="https://example.go.kr"
              value={url}
              readOnly={running}
              onChange={(event) => setUrl(event.target.value)}
            />
          </label>
        )}
        {id === "collector" && (
          <label className="toggle-label">
            <div>
              <strong>{t("하위 링크 탐색")}</strong>
              <small>{t("끄면 입력한 페이지만 검사합니다.")}</small>
            </div>
            <input
              type="checkbox"
              checked={flow.follow_links}
              disabled={running}
              onChange={(event) =>
                setFlow((value) => ({
                  ...value,
                  follow_links: event.target.checked,
                }))
              }
            />
          </label>
        )}
        {id === "ocr" && <label className="toggle-label"><div><strong>{t("이미지 OCR 사용")}</strong><small>{t("이미지 속 글자도 필수 탐지와 광고 분류에 사용합니다.")}</small></div><input type="checkbox" checked={flow.ocr_enabled !== false} disabled={running} onChange={event => setFlow(value => ({ ...value, ocr_enabled: event.target.checked }))} /></label>}
        <dl>
          <dt>{t("입력")}</dt>
          <dd>
            {id === "target"
              ? t("사용자가 입력한 HTTP(S) 주소")
              : id === "browser"
                ? t("대상 URL")
                : id === "collector"
                  ? t("렌더링된 페이지")
                  : id === "ocr" ? t("페이지에서 수집한 이미지") : id === "report"
                    ? t("분석 결과")
                    : t("본문·CSS·요소 위치")}
          </dd>
          <dt>{t("출력")}</dt>
          <dd>
            {id === "report"
              ? "result.json · result.csv · scan-report.json · events.jsonl"
              : id === "target"
                ? t("시작 URL")
                : id === "browser"
                  ? t("Chromium 페이지")
                  : id === "collector"
                    ? t("DOM·스타일·링크")
                    : t("원문과 탐지 근거")}
          </dd>
        </dl>
        <div className="config-note">
          <Icon name="Info" size={16} />
          <span>
            {t("검사는 표시된 순서대로 진행됩니다. OCR 사용 여부는 이미지 OCR 단계에서 설정할 수 있습니다.")}
          </span>
        </div>
      </div>
    </>
  );
}
function eventLabel(event) {
  if (event.kind === "page_complete" && event.page.status === "authentication_required")
    return { icon: "LockKeyhole", title: t("로그인 필요 · 미수집"), detail: event.page.url, tone: "amber" };
  if (event.kind === "url_discovered")
    return {
      icon: "Network",
      title: t("주소 발견"),
      detail: event.url,
      tone: "blue",
    };
  if (event.kind === "phase")
    return {
      icon:
        event.action === "scroll"
          ? "MousePointer2"
          : DEFINITIONS[event.stage]?.icon || "Activity",
      title: event.message,
      detail: event.selector || relativeUrl(event.url),
      tone: "teal",
    };
  if (event.kind === "http_response")
    return {
      icon: "ArrowDownLeft",
      title: `${event.http_status} ${event.method} · ${event.resource_type}`,
      detail: event.url,
      tone: "blue",
    };
  if (event.kind === "request_blocked")
    return {
      icon: "ShieldX",
      title: event.reason,
      detail: event.url,
      tone: "amber",
    };
  if (event.kind === "finding" || event.kind === "candidate") {
    const record = event.finding || event.candidate;
    return {
      icon: "ScanSearch",
      title: t("{type} 발견", { type: LABELS[record.technique || record.category] }),
      detail: record.evidence_text,
      tone: "purple",
    };
  }
  if (event.kind === "page_complete")
    return {
      icon: "CheckCheck",
      title: t("페이지 검사 완료 · 링크 {count}개", { count: event.page.links_discovered }),
      detail: event.page.url,
      tone: "teal",
    };
  if (event.kind === "done")
    return {
      icon: "FileCheck2",
      title: t("{status} · 결과 저장됨", { status: STATUS[event.report.status] }),
      detail: event.path,
      tone: "teal",
    };
  if (event.kind === "started")
    return {
      icon: "Play",
      title: t("검사를 시작했습니다"),
      detail: event.url,
      tone: "teal",
    };
  return {
    icon: ["error", "warning"].includes(event.kind)
      ? "CircleAlert"
      : "Activity",
    title: event.message || event.kind,
    detail: event.url,
    tone: ["error", "warning"].includes(event.kind) ? "amber" : "gray",
  };
}
function EventRow({ event, onClick, compact = false }) {
  const label = eventLabel(event);
  const eventImages = {
    url_discovered: hierarchyImage,
    http_response: browserImage,
    request_blocked: deleteImage,
    finding: searchImage,
    candidate: searchImage,
    page_complete: checkImage,
    done: saveImage,
    started: searchImage,
    error: errorImage,
    warning: warningImage,
  };
  const eventImage = event.kind === "control"
    ? (["paused", "pausing"].includes(event.state) ? pauseImage : event.state === "stopping" ? stopImage : resumeImage)
    : event.kind === "page_complete" && event.page?.status === "authentication_required" ? warningImage
    : event.kind === "done" && event.report?.status === "cancelled" ? stopImage
    : event.kind === "done" && event.report?.status === "failed" ? errorImage
    : event.kind === "phase"
    ? nodeImages[event.stage] || browserImage
    : eventImages[event.kind] || refreshImage;
  const imageScale = eventImage === browserImage ? 1.2
    : eventImage === hierarchyImage ? 1.8
    : eventImage === duplicateRemoveImage ? 1.5
    : eventImage === saveImage ? 1.15
    : eventImage === checkImage ? 1.5
    : eventImage === deleteImage ? 1.8
    : eventImage === searchImage ? .92 : 1;
  return (
    <button
      className={`event-row ${compact ? "compact" : ""}`}
      onClick={onClick}
    >
      <span className="event-icon event-asset">
        <img src={eventImage} alt="" width={compact ? 20 : 26} height={compact ? 20 : 26} style={{ transform: `scale(${imageScale})` }} draggable={false} />
      </span>
      <div>
        <strong>{event.kind === "http_response" ? <span className="http-event-title"><span className={`http-event-status status-${Math.floor(Number(event.http_status) / 100)}`} aria-label={t("HTTP 상태 {status}", { status: event.http_status })}>{event.http_status}</span><span className={`http-event-method method-${String(event.method || "").toLowerCase()}`}>{event.method}</span><span className="http-event-resource">{event.resource_type}</span></span> : label.title}</strong>
        {label.detail && <p title={label.detail}>{label.detail}</p>}
      </div>
      <time>{event.timestamp ? time(event.timestamp) : ""}</time>
    </button>
  );
}
function RecordDetail({
  liveScreenshots = {},
  record,
  outcome,
  onCopy,
  onOpen,
  review,
  onReview,
  reviewDisabled,
  onRecheck,
  recheckDisabled,
  onClose,
}) {
  const [note, setNote] = useState(review?.note || "");
  const additionalTypesRef = useRef(null);
  useEffect(() => setNote(review?.note || ""), [record?.id, review?.note]);
  useEffect(() => {
    const closeOutside = event => {
      if (additionalTypesRef.current && !additionalTypesRef.current.contains(event.target)) additionalTypesRef.current.open = false;
    };
    const closeOnEscape = event => {
      if (event.key === "Escape" && additionalTypesRef.current?.open) {
        additionalTypesRef.current.open = false;
        additionalTypesRef.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, []);
  if (!record)
    return (
      <aside className="record-panel">
        <Empty
          icon="MousePointer2"
          title={t("항목을 선택하세요")}
          text={t("원문·검출 위치·탐지 근거를 확인할 수 있습니다.")}
        />
      </aside>
    );
  let pageURL = null;
  try {
    const parsed = new URL(record.url);
    if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password) pageURL = parsed.href;
  } catch {}
  const detail = record.technique
    ? record._detail || outcome?.report.evidence_details?.[record.id] || {}
    : record;
  const keywords = detail.matched_keywords || [
    ...new Set((detail.analysis?.matches || []).map((match) => match.keyword)),
  ];
  const reasons = [...(detail.style_reasons || detail.reasons || [])];
  const additionalTypes = [...new Set([...(record.techniques || []), ...(record.categories || [])])]
    .filter(type => type !== (record.technique || record.category));
  for (const match of detail.analysis?.matches || []) {
    if (
      (record.technique === "HOMOGLYPH" && match.homoglyph) ||
      (record.technique === "JAMO" && match.jamo)
    ) {
      const span = record.evidence_text.slice(...match.source_span);
      reasons.push(
        t("원문 ‘{span}’에서 {kind}를 확인했습니다. 광고 키워드: {keyword}", { span, kind: record.technique === "JAMO" ? t("분리된 자모") : t("닮은꼴 문자"), keyword: match.keyword }),
      );
    }
  }
  if (record.technique === "HOMOGLYPH")
    for (const match of detail.analysis?.contextual_homoglyphs || [])
      reasons.push(`${match.reason}: ${match.original} → ${match.canonical}`);
  return (
    <aside className="record-panel">
      <div className="panel-heading">
        <strong>{t("탐지 근거")}</strong>
        <span className="record-header-actions">
        <div className="review-control">
          <span
            className={`review-label review-${review?.status || "unreviewed"}`}
          >
            {REVIEW_LABELS[review?.status || "unreviewed"]}
          </span>
          <ActionMenu
            label={t("항목 작업")}
            items={[
              {
                label: outcome?.report.desktop_options?.demo
                  ? t("데모 재실행은 검사 옵션에서")
                  : t("이 페이지만 재검사"),
                icon: "RotateCcw",
                disabled: recheckDisabled,
                action: onRecheck,
              },
              {
                label: t("원문 복사"),
                icon: "Copy",
                action: () => onCopy(record.evidence_text),
              },
              {
                label: t("URL 복사"),
                icon: "Globe2",
                action: () => onCopy(record.url),
              },
            ]}
          />
        </div>
          <button aria-label={t("탐지 근거 닫기")} onClick={onClose}><Icon name="X" size={16} /></button>
        </span>
      </div>
      <div className="record-body">
        <div className="record-overview">
        <span className={`type-badge ${record.technique ? "purple" : "amber"}`} data-type={record.technique || record.category}>
          <TypeBadgeContent type={record.technique || record.category} />
        </span>
        {additionalTypes.length > 0 && <details className="record-additional-types" ref={additionalTypesRef}>
          <summary className="record-type-more" aria-label={t("추가 유형 {count}개 보기", { count: additionalTypes.length })}>
            {t("외 {count}개", { count: additionalTypes.length })} <Icon name="ChevronDown" size={12} aria-hidden="true" />
          </summary>
          <div className="record-additional-types-panel" aria-label={t("추가 탐지 유형")}>
            {additionalTypes.map(type => <span key={type} className={`type-badge ${record.techniques?.includes(type) ? "purple" : "amber"}`} data-type={type}><TypeBadgeContent type={type} /></span>)}
          </div>
        </details>}
        {hasOCREvidence(record) && <span className="ocr-source-badge" title={t("이미지에서 읽은 문구 포함")}>OCR</span>}


        </div>
        <label>{record.page_group ? t("페이지 탐지 요약") : t("발견한 문구")}</label>
        {record.page_group ? <>
          <p className="evidence-capture-note page-evidence-summary">{t("같은 페이지의 근거 {count}곳을 한 항목에 모았습니다.", { count: record.evidence_sources.length })}</p>
        </> : <blockquote>{record.evidence_text}</blockquote>}
        {keywords.length > 0 && (
          <p className="record-keywords"><span>{t("탐지된 표현:")}</span> {keywords.join(", ")}</p>
        )}
        <details className="page-reasons" open={record.page_group ? undefined : true}><summary>{t("탐지 이유")}</summary>
        <ul>
          {(reasons.length
            ? [...new Set(reasons)]
            : [
                t("광고 키워드와 해당 기법의 분석 결과를 근거로 검출했습니다. 상세 값은 원시 데이터에서 확인할 수 있습니다."),
              ]
          ).map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
        </details>
        {record.page_group && <div className="page-evidence-list">{record.evidence_sources.map((source, index) => {
          const screenshot = outcome?.report.screenshots?.[source.screenshot_id] || liveScreenshots[source.screenshot_id];
          const role = evidenceRole(source);
          return <section className="page-evidence-item" key={index}>
            <header className="evidence-item-heading">
              <span className="evidence-item-number">{index + 1}.</span>
              <div><strong>{source.source_kind === "image_ocr" && role !== "이미지" ? t("{role} 이미지", { role: t(role) }) : t(role)}</strong></div>
              {(source.transparent || source.offscreen) && <span className="evidence-visibility" title={source.offscreen ? t("화면 밖에서 발견한 요소") : t("투명하게 표시된 요소")}><Icon name="EyeOff" size={14} /><span>{source.offscreen ? t("화면 밖") : t("투명 요소")}</span></span>}
            </header>
            <div className="evidence-original"><blockquote>{source.text}</blockquote></div>
            {source.image_id && <ImageOCR image={outcome?.report.ocr_images?.find(image => image.id === source.image_id)} />}
            <EvidenceScreenshot screenshot={screenshot} hidden={source.transparent || source.offscreen} showPageURL={false}
              caption={screenshot?.capture === "target_element" ? t("해당 위치 캡처") : t("페이지 참고 화면")} />
          </section>;
        })}</div>}
        {!record.page_group && [...new Set([detail.image_id, ...(detail.evidence_sources || []).map(source => source.image_id)].filter(Boolean))].map(id => <ImageOCR key={id} image={outcome?.report.ocr_images?.find(image => image.id === id)} />)}
        <LocalAIAnalysis analysis={detail.local_ai} />
        {!record.page_group && <EvidenceScreenshot screenshot={outcome ? outcome.report.screenshots?.[detail.screenshot_id] : liveScreenshots[detail.screenshot_id]}

          hidden={record.technique === "TRANSPARENT" || record.technique === "OFFSCREEN"} showPageURL={false} />}
        <div className="review-editor">
          <details className="review-note-details" open={note ? true : undefined}>
          <summary>{t("검토 메모")}</summary>
          <label htmlFor="review-note">
            {t("검토 메모")} <small>{note.length}/2000</small>
          </label>
          <textarea
            id="review-note"
            aria-label={t("검토 메모")}
            maxLength={2000}
            disabled={reviewDisabled}
            placeholder={t("판단 근거, 확인할 사항")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          </details>
          <div className="review-actions">
            <Button
              icon="CheckCheck"
              image={checkImage}
              disabled={reviewDisabled}
              onClick={() => onReview("confirmed", note)}
            >
              {tc("action", "검토 확인")}
            </Button>
            <Button
              icon="X"
              image={deleteImage}
              variant="ghost"
              disabled={reviewDisabled}
              onClick={() => onReview("dismissed", note)}
            >
              {tc("action", "제외")}
            </Button>
            <ActionMenu
              label={t("검토 작업 더보기")}
              className="review-more-menu"
              triggerIcon="MoreHorizontal"
              items={[
                {
                  label: t("메모 저장"),
                  icon: "Save",
                  disabled: reviewDisabled,
                  action: () => onReview(review?.status || "unreviewed", note),
                },
                {
                  label: t("미검토로 변경"),
                  icon: "RotateCcw",
                  disabled: reviewDisabled,
                  action: () => onReview("unreviewed", note),
                },
              ]}
            />
          </div>
        </div>
        {review?.updated_at && (
          <details className="review-metadata">
            <summary>{t("최근 검토 정보")}</summary>
            <dl>
              <div><dt>{t("검토자")}</dt><dd>{review.actor === "agent" ? t("에이전트") : t("사용자")}</dd></div>
              <div><dt>{t("저장 시간")}</dt><dd><time dateTime={review.updated_at}>{new Date(review.updated_at).toLocaleString(language() === "ko" ? "ko-KR" : "en-US")}</time></dd></div>
            </dl>
          </details>
        )}
        <details className="record-technical">
        <summary>{t("페이지 · 기술 정보")}</summary>
        <label>{t("항목 ID")}</label>
        <pre>{record.id}</pre>
        <label>
          {t("페이지 URL")}{" "}
          <button onClick={() => onCopy(record.url)} title={t("URL 복사")}>
            <Icon name="Copy" size={13} />
          </button>
        </label>
        <pre className="detail-url">{pageURL ? <a href={pageURL} title={t("기본 브라우저에서 페이지 열기")}
          onClick={event => { event.preventDefault(); onOpen(pageURL); }}>
          {record.url} <Icon name="ArrowUpRight" size={14} aria-hidden="true" />
        </a> : record.url}</pre>
        <label>
          {t("DOM 위치")}{" "}
          <button onClick={() => onCopy(record.page_group ? record.evidence_sources.map(source => source.location).join('\n') : record.location)} title={t("위치 복사")}>
            <Icon name="Copy" size={13} />
          </button>
        </label>
        {record.page_group ? record.evidence_sources.map((source, index) => <div key={index}>
          <label>{t("근거 {number} · {role}", { number: index + 1, role: t(evidenceRole(source)) })}</label><pre>{source.location}</pre>
        </div>) : <pre>{record.location}</pre>}
        <details>
          <summary>{t("원시 데이터")}</summary>
          <pre>{JSON.stringify({ record, detail }, null, 2)}</pre>
        </details>
        </details>
      </div>
    </aside>
  );
}
createRoot(document.getElementById("root")).render(
  <ReactFlowProvider>
    <App />
  </ReactFlowProvider>,
);
