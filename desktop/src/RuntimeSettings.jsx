import React, { useEffect, useState } from "react";
import "./runtime-settings.css";
import { t } from "./i18n.mjs";

const names = { auto: t("자동"), standard: t("표준"), economy: t("절약") };
const gb = value => Number.isFinite(value) ? `${(value / 1024**3).toFixed(1)} GB` : t("확인 불가");
export default function RuntimeSettings({ disabled }) {
  const [data, setData] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function refresh() { setData(await window.chickadee.environment()); }
  useEffect(() => { refresh().catch(error => setMessage(error.message)); }, []);
  useEffect(() => {
    if (data?.ocr_check?.status !== "running") return;
    const timer = setInterval(() => refresh().catch(error => setMessage(error.message)), 600);
    return () => clearInterval(timer);
  }, [data?.ocr_check?.status]);
  async function action(fn) {
    setBusy(true); setMessage("");
    try { await fn(); await refresh(); } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  const checking = data?.ocr_check?.status === "running";
  const features = data?.features || {}, hardware = data?.hardware || {};
  const ocrStatus = checking ? t("확인 중") : data?.ocr_check?.status === "completed" ? t("구동 확인") : data?.ocr_check?.status === "failed" ? t("확인 실패") : t("모델 확인");
  return <div className="settings-field runtime-field">
    <span>{t("실행 환경")}</span>
    <details className="runtime-settings" aria-label={t("실행 환경")}>
    <summary><span>{data ? data.mode === 'auto' ? t("자동 · {mode}", { mode: names[data.effective_mode] }) : names[data.mode] : t("확인 중")}</span></summary>
    {data && <div className="runtime-content">
      <dl className="runtime-hardware"><dt>CPU</dt><dd>{t("논리 프로세서 {count}개", { count: hardware.logical_cpus })}</dd><dt>{t("메모리")}</dt><dd>{t("{total} · 사용 가능 {available}", { total: gb(hardware.total_bytes), available: gb(hardware.available_bytes) })}</dd></dl>
      <div className="runtime-mode-heading">{t("실행 모드")}</div>
      <div className="runtime-mode" role="group" aria-label={t("실행 모드")}>{Object.entries(names).map(([mode, name]) =>
        <button key={mode} type="button" aria-pressed={data.mode === mode} disabled={disabled || busy || checking}
          onClick={() => action(() => window.chickadee.configureRuntime({ mode }))}>{name}</button>)}</div>
      <p className="runtime-mode-description">{data.effective_mode === "economy" ? t("이미지 OCR을 생략하고 문자·화면 AI를 사용합니다.") : t("이미지 OCR 처리 한도: {count}장. 사용 가능한 기능은 아래에서 확인하세요.", { count: data.ocr_max_images })}</p>
      <dl className="runtime-features"><dt>{t("필수 탐지 4종")}</dt><dd>{t("사용")}</dd>
        <dt>{t("문자 AI")}</dt><dd>{features.text_ai ? t("사용 가능") : t("모델 확인 필요")}</dd>
        <dt>{t("피싱 화면 AI")}</dt><dd>{features.visual_ai ? t("사용 가능") : t("모델 확인 필요")}</dd>
        <dt>{t("이미지 OCR")}</dt><dd>{!features.ocr_available ? t("모델·실행 파일 확인 필요") : !features.ocr_enabled ? t("끔 · 절약 모드") : ocrStatus}</dd></dl>
      <div className="runtime-actions"><button type="button" disabled={disabled || busy || checking || !features.ocr_available}
        onClick={() => action(() => window.chickadee.testRuntime())}>{checking ? t("기능 확인 중…") : t("OCR 기능 확인")}</button>
        <button type="button" disabled={busy || checking} onClick={() => action(refresh)}>{t("환경 새로고침")}</button></div>
      {data.reasons?.length > 0 && <p className="runtime-info">{t("자동 권장: {mode} · {reasons}", { mode: names[data.recommended_mode], reasons: data.reasons.join(" · ") })}</p>}
      {data.ocr_check?.message && <p role="status">{data.ocr_check.message}</p>}
      <p className="runtime-info">{hardware.os} · {hardware.architecture} · {t("{bits}비트 · CPU 실행", { bits: hardware.process_bits })}</p>
    </div>}
    {message && <p role="status">{message}</p>}
  </details></div>;
}
