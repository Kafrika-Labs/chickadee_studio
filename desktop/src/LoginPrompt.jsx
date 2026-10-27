import React, {useEffect, useRef, useState} from 'react';
import {LockKeyhole, ExternalLink, Play, Info, Square, Globe} from 'lucide-react';
import {t} from './i18n.mjs';

export default function LoginPrompt({request, onStop}) {
 const ref = useRef(null);
 const [busy, setBusy] = useState(false);
 const [message, setMessage] = useState('');
 const [opened, setOpened] = useState(false);
 const [iconFailed, setIconFailed] = useState(false);
 const [helpOpen, setHelpOpen] = useState(false);
 const [resumeBefore, resumeAfter = ''] = t("로그인 후 돌아와 {action}를 누르세요.").split('{action}');
 useEffect(() => {
  const previous = document.activeElement;
  ref.current.showModal();
  ref.current.querySelector(`[aria-label="${t("로그인 창 열기")}"]`)?.focus();
  return () => { if (previous?.isConnected) previous.focus(); };
 }, []);
 async function action(fn) {
  setBusy(true); setMessage('');
  try { await fn(); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
 }
 return <dialog ref={ref} className="login-prompt" aria-labelledby="login-title" aria-describedby="login-description" onCancel={event => event.preventDefault()} onKeyDown={event => event.stopPropagation()}>
  <div className="login-body">
   <header><LockKeyhole size={18} aria-hidden="true"/><h2 id="login-title">{t("로그인 필요")}</h2><button className="login-info" type="button" aria-label={t("로그인 안내")} aria-expanded={helpOpen} aria-controls="login-help-panel" onClick={() => setHelpOpen(value => !value)}><Info size={16} aria-hidden="true"/></button></header>
   <p id="login-description">{t("로그인 후 검사를 이어갈 수 있어요.")}</p>
   <div className="login-site"><div className="login-site-identity">{request.favicon?.startsWith('data:image/png;base64,') && !iconFailed ? <img src={request.favicon} alt="" onError={() => setIconFailed(true)}/> : <Globe size={22} aria-hidden="true"/>}<div><strong>{request.title || new URL(request.requested_url || request.url).host}</strong>{request.title && <small>{new URL(request.requested_url || request.url).host}</small>}</div></div></div>
   <div id="login-help-panel" className={`login-help-panel${helpOpen ? ' is-open' : ''}`} inert={!helpOpen} aria-hidden={!helpOpen}><div><ul><li>{resumeBefore}<strong>{t("검사 재개")}</strong>{resumeAfter}</li><li>{t("로그인 대기 시간은 검사 시간에 포함되지 않습니다.")}</li><li>{t("인증 쿠키는 이번 검사에서만 사용합니다.")}</li></ul></div></div>
   <div className="login-actions">
    <button aria-label={t("이 페이지 건너뛰기")} className="login-skip" disabled={busy} onClick={() => action(() => window.chickadee.skipLogin(request.request_id))}>{t("건너뛰기")}</button>
    <div className="login-main-actions">
     <button autoFocus aria-label={t("로그인 창 열기")} className={!opened ? 'login-primary' : ''} disabled={busy} onClick={() => action(async () => { await window.chickadee.openLogin(request.request_id); setOpened(true); })}><ExternalLink size={14} aria-hidden="true"/>{opened ? t("로그인 창") : t("로그인")}</button>
     {opened && <button aria-label={t("로그인 완료 · 검사 재개")} className="login-primary" disabled={busy} onClick={() => action(() => window.chickadee.completeLogin(request.request_id))}><Play size={14} aria-hidden="true"/>{t("검사 재개")}</button>}
     <button className="login-stop" aria-label={t("검사 중단")} title={t("검사 중단")} disabled={busy} onClick={() => action(onStop)}><Square size={13} aria-hidden="true"/>{t("중단")}</button>
    </div>
   </div>
   {message && <p role="alert" className="login-error">{message}</p>}
  </div>
 </dialog>;
}
