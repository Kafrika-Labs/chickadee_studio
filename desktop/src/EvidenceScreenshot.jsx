import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, CircleAlert, ExternalLink, ZoomIn, X } from "lucide-react";
import { t, language } from "./i18n.mjs";

function ScreenshotModal({ screenshot, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(<dialog ref={ref} className="screenshot-viewer" aria-label={t("스크린샷 확대")}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => event.stopPropagation()}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="screenshot-viewer-content">
      <header><strong>{t("스크린샷")}</strong><span>{t("촬영 당시 화면")}</span><button type="button" autoFocus aria-label={t("스크린샷 닫기")} onClick={onClose}><X size={18} /></button></header>
      <div className="screenshot-viewer-image"><img src={screenshot.data_url} alt={t("촬영한 스크린샷 확대 보기")} /></div>
    </section>
  </dialog>, document.body);
}

// Only saved, inert JPEG data is rendered. Never load a page URL in the app.
export default function EvidenceScreenshot({ screenshot, hidden = false, caption = t("스크린샷"), showPageURL = true }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setExpanded(false); setError(""); }, [screenshot?.data_url, hidden]);
  if (!screenshot || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(screenshot.data_url || "") || screenshot.data_url.length > 270000) {
    return <figure className="evidence-capture"><figcaption>{caption}</figcaption><p className="evidence-capture-note capture-guidance"><span>{t("저장된 스크린샷이 없습니다. 원문·CSS 근거를 확인하세요.")}</span></p></figure>;
  }
  let url = null;
  try {
    const parsed = new URL(screenshot.url);
    if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password) url = parsed.href;
  } catch {}
  const date = new Date(screenshot.observed_at);
  const capturedAt = Number.isNaN(date.getTime()) ? t("기록 없음") : new Intl.DateTimeFormat(language() === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium", timeStyle: "medium" }).format(date);
  const openURL = async (event) => {
    event.preventDefault();
    try { await window.chickadee.openExternal(url); setError(""); }
    catch { setError(t("앱을 재실행한 뒤 다시 시도해 주세요.")); }
  };
  return <figure className="evidence-capture">
    <figcaption><span>{caption}</span><button type="button" className="capture-enlarge" onClick={() => setExpanded(true)} aria-label={t("참고 화면 크게 보기")}><ZoomIn size={13} aria-hidden="true" />{t("확대")}</button></figcaption>
    <button className="evidence-capture-frame" type="button" aria-label={t("스크린샷 확대")} aria-haspopup="dialog" onClick={() => setExpanded(true)}>
      <span className="evidence-capture-image"><img src={screenshot.data_url} alt={t("검사 브라우저에서 촬영한 스크린샷")} /></span>
    </button>
    <p className="evidence-capture-note capture-guidance">{hidden ? t("투명하거나 화면 밖의 요소는 보이지 않을 수 있습니다. 원문·CSS 근거를 함께 확인하세요.") : screenshot.capture === "target_element" ? t("탐지된 요소를 직접 촬영한 화면입니다.") : t("페이지 수집 당시의 참고 화면입니다. 탐지 문구의 정확한 위치를 촬영한 화면은 아닙니다.")}</p>
    <details className="capture-metadata"><summary><span>{t("촬영 정보")}</span><ChevronDown className="capture-metadata-chevron" size={14} aria-hidden="true" /></summary>
      <dl>{showPageURL && <div><dt>{t("페이지")}</dt><dd>{url ? <a href={url} onClick={openURL} title={t("기본 브라우저에서 열기")}>{screenshot.url}<ExternalLink size={13} aria-hidden="true" /></a> : t("주소 없음")}</dd></div>}
        <div><dt>{t("촬영 시각")}</dt><dd><time dateTime={screenshot.observed_at}>{capturedAt}</time></dd></div>
        <div><dt>SHA-256</dt><dd className="capture-hash">{screenshot.sha256 || t("기록 없음")}</dd></div></dl>
      {error && <div className="capture-error" role="alert">
        <CircleAlert size={17} aria-hidden="true" />
        <div><strong>{t("페이지를 열지 못했어요")}</strong><span>{error}</span></div>
        <button type="button" aria-label={t("오류 안내 닫기")} onClick={() => setError("")}><X size={14} aria-hidden="true" /></button>
      </div>}
    </details>
    {expanded && <ScreenshotModal screenshot={screenshot} onClose={() => setExpanded(false)} />}
  </figure>;
}
