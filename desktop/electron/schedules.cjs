const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { t } = require('./i18n.cjs');

function validate(value) {
  if (!value || !['once', 'daily', 'weekly'].includes(value.repeat)) throw new Error(t("반복 주기를 선택하세요."));
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) throw new Error(t("예약 이름을 80자 이내로 입력하세요."));
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) throw new Error(t("실행 시간을 입력하세요."));
  const days = [...new Set(value.days || [])];
  if (days.some(d => !Number.isInteger(d) || d < 0 || d > 6) || (value.repeat === 'weekly' && !days.length)) throw new Error(t("반복 요일을 선택하세요."));
  if (value.repeat === 'once') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date)) throw new Error(t("실행 날짜를 입력하세요."));
    const d = new Date(value.date + 'T' + value.time);
    if (!Number.isFinite(+d) || d.getFullYear() !== Number(value.date.slice(0, 4)) || d.getMonth() + 1 !== Number(value.date.slice(5, 7)) || d.getDate() !== Number(value.date.slice(8, 10))) throw new Error(t("실행 날짜가 올바르지 않습니다."));
  }
  const o = value.options || {};
  let url;
  try { url = new URL(o.url); } catch { throw new Error(t("검사 대상 URL을 입력하세요.")); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(t("http 또는 https 주소를 입력하세요."));
  if (!Number.isInteger(o.max_pages) || o.max_pages < 1 || o.max_pages > 10000 || !Number.isFinite(o.timeout_sec) || o.timeout_sec <= 0 || o.timeout_sec > 1800) throw new Error(t("최대 페이지와 제한시간을 확인하세요."));
  if (!['default', 'test', 'public'].includes(o.profile)) throw new Error(t("검사 설정이 올바르지 않습니다."));
  if (!o.workflow || JSON.stringify(o.workflow).length > 100000) throw new Error(t("검사 구성이 필요합니다."));
  if (o.interval_sec !== undefined && (!Number.isFinite(o.interval_sec) || o.interval_sec < 0 || o.interval_sec > 30)) throw new Error(t("탐색 대기 시간은 0~30초로 설정하세요."));
  return { name: value.name.trim(), enabled: value.enabled !== false, repeat: value.repeat, time: value.time, date: value.date || '', days, options: { url: url.href, max_pages: o.max_pages, timeout_sec: o.timeout_sec, profile: o.profile, interval_sec: o.interval_sec ?? 0.5, preview: Boolean(o.preview), workflow: o.workflow } };
}
function nextTime(schedule, after) {
  if (!schedule.enabled) return null;
  if (schedule.repeat === 'once') { const time = +new Date(schedule.date + 'T' + schedule.time); return time > after ? time : null; }
  const [hour, minute] = schedule.time.split(':').map(Number);
  for (let day = 0; day < 9; day++) {
    const date = new Date(after); date.setDate(date.getDate() + day); date.setHours(hour, minute, 0, 0);
    if (+date > after && (schedule.repeat === 'daily' || schedule.days.includes(date.getDay()))) return +date;
  }
  return null;
}
class Schedules {
  constructor({ directory, start, busy, now = Date.now }) { this.file = path.join(directory, 'schedules.json'); this.start = start; this.busy = busy; this.now = now; this.items = []; this.queue = Promise.resolve(); }
  serial(action) { const work = this.queue.then(action); this.queue = work.catch(() => {}); return work; }
  state() { return structuredClone({ items: this.items, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); }
  async persist() { await fs.mkdir(path.dirname(this.file), { recursive: true }); await fs.writeFile(this.file + '.tmp', JSON.stringify(this.items, null, 2), { mode: 0o600 }); await fs.rename(this.file + '.tmp', this.file); }
  async load() {
    try { this.items = JSON.parse(await fs.readFile(this.file, 'utf8')); if (!Array.isArray(this.items)) throw new Error(t("예약 저장 파일이 올바르지 않습니다.")); for (const item of this.items) validate(item); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    // App shutdown/sleep does not trigger an unexpected catch-up scan.
    await this.tick(true);
  }
  save(value) { return this.serial(async () => {
    const clean = validate(value), old = this.items.find(i => i.id === value.id);
    if (value.id && !old) throw new Error(t("예약을 찾을 수 없습니다."));
    const nextAt = nextTime(clean, this.now());
    if (clean.enabled && !nextAt) throw new Error(t("현재 시간 이후로 예약하세요."));
    if (!old && this.items.length >= 50) throw new Error(t("예약은 최대 50개까지 등록할 수 있습니다."));
    const item = { ...clean, id: old?.id || randomUUID(), nextAt, last: old?.last || null };
    const previous = this.items; this.items = old ? this.items.map(i => i.id === old.id ? item : i) : [...this.items, item];
    try { await this.persist(); } catch (error) { this.items = previous; throw error; }
    return this.state();
  }); }
  remove(id) { return this.serial(async () => { const previous = this.items; this.items = this.items.filter(i => i.id !== id); try { await this.persist(); } catch (error) { this.items = previous; throw error; } return this.state(); }); }
  tick(missedOnly = false) { return this.serial(async () => {
    for (const item of this.items) {
      const now = this.now();
      if (!item.enabled || !item.nextAt || item.nextAt > now) continue;
      const late = missedOnly || now - item.nextAt >= 60000;
      const due = item.nextAt;
      item.nextAt = nextTime(item, now); if (item.repeat === 'once') item.enabled = false;
      item.last = { at: now, status: 'skipped', message: late ? t("앱 종료·절전 등으로 예약 시간을 놓쳤습니다.") : t("실행 요청 처리 중") };
      // Persist consumption before dispatch: restarting cannot repeat this occurrence.
      await this.persist();
      if (!late) {
        try {
          if (await this.busy()) item.last.message = t("다른 검사 또는 AI 검토가 실행 중이라 건너뛰었습니다.");
          else { const result = await this.start(item.options); item.last = { at: now, due, status: 'started', message: t("검사를 시작했습니다. 결과는 검사 기록에서 확인하세요."), runId: result.run_id }; }
        } catch { item.last = { at: now, status: 'failed', message: t("검사를 시작하지 못했습니다. 대상과 검사 구성을 확인하세요.") }; }
        await this.persist();
      }
    }
  }); }
  activate() { this.timer = setInterval(() => this.tick().catch(() => {}), 5000); this.timer.unref(); }
  close() { clearInterval(this.timer); }
}
module.exports = { Schedules, nextTime, validate };
