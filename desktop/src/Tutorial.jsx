import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Maximize2, X } from "lucide-react";
import { guideSteps } from "./guide-content.mjs";
import { t } from "./i18n.mjs";
const screens = import.meta.glob("../assets/guide/*.png", { eager: true, import: "default" });
const steps = guideSteps.map(step => ({ ...step, image: screens[`../assets/guide/${step.image}.png`] }));

const STORAGE_KEY = "chickadee.guide.v1.seen";
export function shouldShowTutorial() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "true";
  } catch {
    return true;
  }
}
export function rememberTutorial() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // The guide remains usable even when browser storage is unavailable.
  }
}

export default function Tutorial({ onClose, onDemo, onInspect, canDemo }) {
  const [step, setStep] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const dialog = useRef(null);
  const heading = useRef(null);
  const tabs = useRef(null);
  const content = useRef(null);
  const current = steps[step];
  const last = step === steps.length - 1;
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element.showModal();
    return () => {
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    content.current?.scrollTo({ top: 0 });
    const active = tabs.current?.querySelector('[aria-current="step"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [step]);
  useLayoutEffect(() => {
    const list = tabs.current;
    const measure = () => {
      const active = list.querySelector('[aria-current="step"]');
      if (!active) return;
      list.style.setProperty("--tab-left", `${active.offsetLeft}px`);
      list.style.setProperty("--tab-top", `${active.offsetTop + active.offsetHeight - 2}px`);
      list.style.setProperty("--tab-width", `${active.offsetWidth}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    list.querySelectorAll("button").forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [step]);

  return (
    <dialog
      ref={dialog}
      className="tutorial-dialog"
      aria-labelledby="tutorial-label"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="tutorial-header">
        <div className="tutorial-heading"><h2 id="tutorial-label">{t("사용 가이드")}</h2><span className="tutorial-progress" aria-hidden="true">{step + 1} / {steps.length}</span></div>
        <button type="button" className="tutorial-close" aria-label={t("사용 가이드 닫기")} onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </header>
      <nav className="tutorial-steps" aria-label={t("안내 순서")}>
        <ol ref={tabs}>
          {steps.map((item, index) => (
            <li key={item.label}>
              <button
                type="button"
                aria-label={t("{step}단계: {label}", { step: index + 1, label: item.label })}
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
              >{item.label}</button>
            </li>
          ))}
          <li className="tab-indicator" aria-hidden="true" />
        </ol>
      </nav>
      <div className="tutorial-content" ref={content}>
        <h3 id="tutorial-title" tabIndex={-1} ref={heading} aria-describedby="tutorial-step-count">{current.title}</h3>
        <span id="tutorial-step-count" className="tutorial-sr-only">{t("{total}단계 중 {current}단계", { total: steps.length, current: step + 1 })}</span>
        <p id="tutorial-description">{current.description}</p>
        <div className="tutorial-walkthrough">
        <div className="tutorial-visual">
        <figure className="tutorial-screen">
          <button className="tutorial-screen-button" type="button" aria-label={t("화면 크게 보기")} title={t("화면 크게 보기")} onClick={() => setZoomed(true)}>
            <img src={current.image} alt={current.caption} />
            <span className="tutorial-zoom-icon" aria-hidden="true"><Maximize2 size={14} /></span>
          </button>
          <figcaption>{current.caption}</figcaption>
        </figure>
        {current.example && <p className="tutorial-address">{t("주소 예시")} <code>{current.example}</code></p>}
        <p className="tutorial-hint"><span>{t("참고")}</span>{current.note}</p>
        </div>
        <dl className="tutorial-instructions">
          {current.instructions.map(([label, description], index) => (
            <div key={label}><dt><span className="tutorial-number" aria-hidden="true">{index + 1}</span>{label}</dt><dd>{description}</dd></div>
          ))}
        </dl>
        </div>
        {last && !canDemo && <p id="tutorial-demo-unavailable" className="tutorial-unavailable" role="status">{t("지금은 데모를 시작할 수 없습니다. 검사 엔진이 준비되고 진행 중인 검사가 끝난 뒤 다시 시도하세요.")}</p>}
      </div>
      <footer className="tutorial-footer">
          {step > 0 && <button type="button" className="button button-secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={18} aria-hidden="true" /> {t("이전")}</button>}
          <div>
          {last ? (
            <>
              <button type="button" className="button button-secondary" disabled={!canDemo} aria-describedby={!canDemo ? "tutorial-demo-unavailable" : undefined} onClick={onDemo}>{t("데모로 연습하기")}</button>
              <button type="button" className="button button-primary" onClick={onInspect}>{t("직접 검사하기")}</button>
            </>
          ) : (
            <button type="button" className="button button-primary" onClick={() => setStep(step + 1)}>{t("다음")} <ArrowRight size={18} aria-hidden="true" /></button>
          )}
        </div>
      </footer>
      {zoomed && <ScreenPreview image={current.image} caption={current.caption} onClose={() => setZoomed(false)} />}
    </dialog>
  );
}

function ScreenPreview({ image, caption, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = ref.current;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="tutorial-image-dialog" aria-label={t("가이드 화면 확대")}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={(event) => event.stopPropagation()}>
    <header><span>{caption}</span><button type="button" aria-label={t("확대 화면 닫기")} onClick={onClose}><X size={18} /></button></header>
    <img src={image} alt={caption} />
  </dialog>;
}
