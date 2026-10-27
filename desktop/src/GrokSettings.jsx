import React, { useEffect, useState } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import { t } from "./i18n.mjs";
import groqLogo from "../assets/groq-logo.png";
import codexLogo from "../assets/codex-logo.png";
import claudeLogo from "../assets/claude-logo.svg";

const providers = {
  groq: { label: "Groq", model: "openai/gpt-oss-20b", logo: groqLogo },
  openai: { label: "OpenAI (GPT)", model: "gpt-4.1-mini", logo: codexLogo },
  anthropic: { label: "Anthropic (Claude)", model: "claude-haiku-4-5-20251001", logo: claudeLogo },
};

export default function GrokSettings({ config, onConfigured, ActionMenu }) {
  const [editing, setEditing] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [key, setKey] = useState("");
  const [draft, setDraft] = useState({ provider: "groq", ...config });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const provider = draft.provider || "groq";
  const selected = providers[provider];
  const hasKey = provider === (config.provider || "groq") && Boolean(config.sessionKey);
  const update = (name, value) => setDraft((previous) => ({ ...previous, [name]: value }));
  useEffect(() => {
    let active = true;
    window.chickadee.state().then(state => window.chickadee.inspection({run_id:state.run_id}))
      .then(data => { if (active) onConfigured(previous => ({ ...previous, provider: data.agent?.provider || previous.provider || "groq", model: data.agent?.model || previous.model, sessionKey:Boolean(data.agent?.configured) })); })
      .catch(() => {});
    return () => { active = false; };
  }, [onConfigured]);
  useEffect(() => {
    setDraft(previous => ({ ...previous, ...config, provider: config.provider || "groq" }));
  }, [config]);
  function selectProvider(value) {
    setDraft(previous => ({ ...previous, provider: value, model: providers[value].model }));
    setKey(""); setMessage(""); setEditing(true);
  }
  async function apply() {
    setBusy(true); setMessage("");
    try {
      const result = await window.chickadee.configureAgent({ provider, model: draft.model,
        token_limit: draft.token_limit, call_limit: draft.call_limit, api_key: key });
      onConfigured({ provider: result.provider, model: result.model, token_limit: result.token_limit, call_limit: result.call_limit, sessionKey: Boolean(result.configured) });
      setKey(""); setEditing(false); setMessage(t("AI 연결 설정을 적용했습니다."));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section className="grok-settings" aria-label={t("AI 연결 설정")}>
    <div className="settings-field"><span>{t("AI 제공자")}</span>
      <ActionMenu className="profile-menu ai-provider-menu" label={t("AI 제공자")}
        triggerText={selected.label} disabled={busy}
        items={Object.entries(providers).map(([id, value]) => ({
          label: value.label, selected: provider === id,
          action: () => { if (provider !== id) selectProvider(id); },
        }))} />
    </div>
    <div className="grok-settings-heading">
      <span className="ai-provider-brand">{provider === 'groq'
        ? <span className="grok-provider-logo"><img src={selected.logo} alt="Groq" /></span>
        : <><img src={selected.logo} alt="" /><strong>{selected.label}</strong></>}</span>
      <button type="button" className="grok-add-key" onClick={() => setEditing(!editing)} aria-expanded={editing} aria-controls="grok-key-editor" disabled={busy}>{editing ? <X size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}{editing ? t("닫기") : t("API 키 등록")}</button>
    </div>
    <p className="grok-intro">{t("선택한 탐지 근거를 AI로 추가 검토합니다. 분석을 실행할 때만 선택한 제공자에 요청합니다.")}</p>
    <p className="grok-intro">{t("ChatGPT·Claude 구독과 API 사용 요금은 별도입니다.")}</p>
    <div className="grok-connection-card"><div><strong>{hasKey ? t("현재 세션 키") : t("API 키")}</strong><span>{hasKey ? t("등록됨") : t("미등록")}</span></div>
      <p>{hasKey ? t("등록한 키는 앱을 종료하면 삭제됩니다. 서버 연결은 분석 실행 시 확인합니다.") : t("AI 검토를 사용하려면 선택한 제공자의 API 키를 등록하세요.")}</p>
    </div>
    {editing && <div id="grok-key-editor" className="grok-key-editor">
      <label>{t("API 키")}<input aria-label={t("API 키")} type="password" autoComplete="off" spellCheck={false} value={key} onChange={(event) => setKey(event.target.value)} placeholder={t("API 키 입력")} disabled={busy} autoFocus /></label>
      <p>{t("키는 파일에 저장하지 않습니다. 입력 후 아래 설정 적용을 눌러주세요.")}</p>
    </div>}
    <button type="button" className="grok-advanced-toggle" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced} aria-controls="grok-advanced"><ChevronDown size={14} aria-hidden="true" />{t("모델 및 사용 한도")}</button>
    {advanced && <div id="grok-advanced">
    <label>{t("모델")}<input aria-label={t("모델")} value={draft.model} onChange={(event) => update("model", event.target.value)} disabled={busy} /></label>
    <div className="form-row">
      <label>{t("누적 토큰 한도")}<input aria-label={t("누적 토큰 한도")} type="number" min="1000" max="60000" value={draft.token_limit} onChange={(event) => update("token_limit", Number(event.target.value))} disabled={busy} /></label>
      <label>{t("누적 호출 한도")}<input aria-label={t("누적 호출 한도")} type="number" min="1" max="12" value={draft.call_limit} onChange={(event) => update("call_limit", Number(event.target.value))} disabled={busy} /></label>
    </div>
    </div>}
    <div className="grok-settings-actions"><p role="status">{message}</p><button type="button" onClick={apply} disabled={busy}>{busy ? t("적용 중…") : t("설정 적용")}</button></div>
  </section>;
}
