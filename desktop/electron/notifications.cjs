const fs = require('node:fs/promises');
const path = require('node:path');
const { t } = require('./i18n.cjs');
const DEFAULTS = { desktop: false, sound: true, suppressFocused: true, slack: false, discord: false };
function validateWebhook(provider, value) {
  let url;
  try { url = new URL(value); } catch { throw new Error(t("웹훅 URL 형식을 확인하세요.")); }
  const valid = provider === 'slack'
    ? url.hostname === 'hooks.slack.com' && /^\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(url.pathname)
    : provider === 'discord' && url.hostname === 'discord.com' && /^\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9_.-]+$/.test(url.pathname);
  if (!valid || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) throw new Error(t("Slack 또는 Discord의 공식 HTTPS 웹훅 URL을 입력하세요."));
  return url.href;
}
function reportText(event) {
  const report = event.report || {};
  const status = { completed: t("완료"), partial: t("일부 완료"), cancelled: t("중단"), failed: t("실패") }[report.status] || t("실패");
  return t("Chickadee 검사 {status}\n방문 {pages}개 · 필수 탐지 {findings}건 · 광고 의심 {ads}건\n상세 결과는 Chickadee의 검사 기록에서 확인하세요.", {
    status,
    pages: report.pages_scanned?.length || 0,
    findings: event.result?.findings?.length || 0,
    ads: report.ad_candidates?.length || 0,
  });
}
class Notifications {
  constructor({ directory, safeStorage, notify = () => {}, focused = () => false, fetcher = fetch, supported = () => true }) {
    this.file = path.join(directory, 'notifications.json'); this.crypto = safeStorage; this.notify = notify; this.focused = focused; this.fetcher = fetcher; this.supported = supported;
    this.settings = { ...DEFAULTS }; this.secrets = {}; this.lastDelivery = []; this.writes = Promise.resolve(); this.seen = new Set();
  }
  async secure() { return await this.crypto.isAsyncEncryptionAvailable() && this.crypto.getSelectedStorageBackend?.() !== 'basic_text'; }
  async load() {
    try { const value = JSON.parse(await fs.readFile(this.file, 'utf8')); for (const key of Object.keys(DEFAULTS)) if (typeof value.settings?.[key] === 'boolean') this.settings[key] = value.settings[key]; this.secrets = value.secrets || {}; } catch { /* New or unreadable local settings. */ }
    return this.state();
  }
  async state() { return { ...this.settings, slackConfigured: Boolean(this.secrets.slack), discordConfigured: Boolean(this.secrets.discord), secureStorage: await this.secure(), desktopSupported: this.supported(), lastDelivery: this.lastDelivery }; }
  save(value) { const job = this.writes.then(() => this.write(value)); this.writes = job.catch(() => {}); return job; }
  async write(value) {
    if (!value || typeof value !== 'object') throw new Error(t("알림 설정 형식 오류"));
    const settings = { ...this.settings }, secrets = { ...this.secrets };
    for (const key of Object.keys(DEFAULTS)) if (typeof value[key] === 'boolean') settings[key] = value[key];
    for (const provider of ['slack', 'discord']) {
      if (value[`${provider}Remove`]) { delete secrets[provider]; settings[provider] = false; }
      if (value[`${provider}Url`]) {
        const url = validateWebhook(provider, value[`${provider}Url`].trim());
        if (!await this.secure()) throw new Error(t("운영체제 보안 저장소를 사용할 수 없어 웹훅을 저장하지 못했습니다."));
        secrets[provider] = (await this.crypto.encryptStringAsync(url)).toString('base64');
      }
      if (settings[provider] && !secrets[provider]) throw new Error(t("{provider} 웹훅을 먼저 등록하세요.", { provider: provider === 'slack' ? 'Slack' : 'Discord' }));
    }
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file + '.tmp', JSON.stringify({ settings, secrets }), { mode: 0o600 });
    await fs.rename(this.file + '.tmp', this.file);
    this.settings = settings; this.secrets = secrets; return this.state();
  }
  testDesktop() { if (!this.supported()) throw new Error(t("이 환경은 데스크톱 알림을 지원하지 않습니다.")); return this.notify(t("Chickadee 테스트 알림"), t("검사 완료 알림이 이곳에 표시됩니다."), !this.settings.sound); }
  async completed(event) {
    const id = event.run_id || event.path;
    if (!id || this.seen.has(id)) return;
    this.seen.add(id); if (this.seen.size > 1000) this.seen.delete(this.seen.values().next().value);
    const text = reportText(event), settings = { ...this.settings }, secrets = { ...this.secrets };
    if (settings.desktop && this.supported() && !(settings.suppressFocused && this.focused())) {
      try { await this.notify(t("Chickadee 검사 결과"), text, !settings.sound); } catch { /* Webhooks remain independent. */ }
    }
    this.lastDelivery = await Promise.all(['slack', 'discord'].filter((provider) => settings[provider]).map(async (provider) => {
      try {
        if (!await this.secure()) throw new Error();
        const { result } = await this.crypto.decryptStringAsync(Buffer.from(secrets[provider], 'base64'));
        const url = validateWebhook(provider, result);
        const payload = provider === 'slack' ? { text, mrkdwn: false, unfurl_links: false, unfurl_media: false } : { content: text, allowed_mentions: { parse: [] } };
        const response = await this.fetcher(url, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
        await response.body?.cancel();
        return { provider, success: response.ok, message: response.ok ? t("전송 완료") : t("전송 실패 (HTTP {status})", { status: response.status }), at: new Date().toISOString() };
      } catch { return { provider, success: false, message: t("전송 실패: 웹훅 설정 또는 네트워크를 확인하세요."), at: new Date().toISOString() }; }
    }));
  }
}
module.exports = { Notifications, validateWebhook, reportText };
