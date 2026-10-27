import React, { useEffect, useState } from "react";
import { Bell, Volume2, Monitor } from "lucide-react";
import slackLogo from "../assets/slack.svg";
import discordLogo from "../assets/discord.svg";
import { t } from "./i18n.mjs";
const api = window.chickadee;
export default function NotificationSettings() {
  const [testMessage, setTestMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState(null), [message, setMessage] = useState("");
  const [urls, setUrls] = useState({ slack: "", discord: "" }), [remove, setRemove] = useState({}), [busy, setBusy] = useState(false);
  useEffect(() => { api.notificationState?.().then(setSettings).catch(() => setMessage(t("알림 설정을 불러오지 못했습니다."))); }, []);
  const update = (key, value) => setSettings((previous) => ({ ...previous, [key]: value }));
  async function save() {
    setBusy(true); setMessage("");
    try { setSettings(await api.saveNotifications({ ...settings, slackUrl: urls.slack, discordUrl: urls.discord, slackRemove: remove.slack, discordRemove: remove.discord })); setUrls({ slack: "", discord: "" }); setRemove({}); setMessage(t("알림 설정을 저장했습니다.")); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  if (!settings) return <p role="status">{message || t("알림 설정을 불러오는 중…")}</p>;
  return <div className="notification-settings">
    <section className="settings-card"><h3>{t("데스크톱 알림")}</h3>
      {[["desktop", t("알림 활성화"), t("검사가 완료되거나 중단·실패하면 알립니다."), Bell], ["sound", t("알림 소리"), t("운영체제의 기본 알림음을 사용합니다."), Volume2], ["suppressFocused", t("앱을 보고 있을 때 생략"), t("Chickadee에 초점이 있을 때 데스크톱 알림을 생략합니다."), Monitor]].map(([key, title, note, Icon]) => <label className="toggle-label" key={key}><div><strong><Icon size={15} aria-hidden="true" />{title}</strong><small>{note}</small></div><input type="checkbox" checked={settings[key]} onChange={(event) => update(key, event.target.checked)} disabled={busy || !settings.desktopSupported} /></label>)}
      <p className="settings-help">{t("알림이 보이지 않으면 시스템 설정에서 Chickadee의 알림·배너를 허용하고 집중 모드를 확인하세요. 테스트에는 저장된 소리 설정이 적용됩니다.")}</p>
      <button className="settings-small-button" disabled={!settings.desktopSupported || busy || testing} onClick={async () => { setTesting(true); setTestMessage(""); try { await api.testNotification(); } catch (error) { setTestMessage(error.message); } finally { setTesting(false); } }}>{testing ? t("알림 보내는 중…") : t("테스트 알림 보내기")}</button>
      {testMessage && <p className="settings-help" role="alert">{testMessage}</p>}
    </section>
    <section className="settings-card"><h3>{t("완료 리포트")}</h3><p className="settings-help">{t("검사 종료 후 상태·방문 페이지 수·탐지 건수를 전송합니다. 사이트 주소, 원문, 이미지와 결과 파일은 보내지 않습니다.")}</p>
      {!settings.secureStorage && <p className="settings-help">{t("OS 보안 저장소를 사용할 수 없어 새 웹훅을 저장할 수 없습니다.")}</p>}
      {[['slack', 'Slack', 'https://hooks.slack.com/services/…'], ['discord', 'Discord', 'https://discord.com/api/webhooks/…']].map(([provider, label, placeholder]) => <div className="webhook-settings" key={provider}>
        <label className="toggle-label"><div><strong><img className="webhook-provider-logo" src={provider === "slack" ? slackLogo : discordLogo} alt="" />{label}</strong><small>{settings[provider + 'Configured'] ? t("웹훅 등록됨 · 비워두면 기존 주소 유지") : t("받을 채널의 Incoming Webhook을 등록하세요.")}</small></div><input type="checkbox" aria-label={t("{label} 리포트 전송", { label })} checked={settings[provider]} onChange={(event) => update(provider, event.target.checked)} disabled={busy || remove[provider]} /></label>
        <label>{t("웹훅 URL")}<input type="password" aria-label={t("{label} 웹훅 URL", { label })} autoComplete="off" spellCheck={false} placeholder={placeholder} value={urls[provider]} onChange={(event) => setUrls({ ...urls, [provider]: event.target.value })} disabled={busy || !settings.secureStorage || remove[provider]} /></label>
        {settings[provider + 'Configured'] && <label className="webhook-remove"><input type="checkbox" checked={Boolean(remove[provider])} onChange={(event) => { setRemove({ ...remove, [provider]: event.target.checked }); if (event.target.checked) update(provider, false); }} disabled={busy} />{t("저장 시 웹훅 삭제")}</label>}
        {settings.lastDelivery?.filter((item) => item.provider === provider).map((item) => <p className="settings-help" key={item.at}>{t("최근 전송: {message}", { message: item.message })}</p>)}
      </div>)}
      <p className="settings-help">{t("웹훅은 이 기기의 보안 저장소로 암호화합니다. 저장 후 다음 검사부터 적용되며, 전송 실패 시 자동 재시도하지 않습니다.")}</p>
    </section>
    <div className="notification-save"><p role="status">{message}</p><button className="settings-small-button" onClick={save} disabled={busy}>{busy ? t("저장 중…") : t("알림 설정 저장")}</button></div>
  </div>;
}
