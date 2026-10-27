import React, { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, Pencil, X, Clock3, Monitor, ChevronDown, ArrowRight, RotateCcw } from 'lucide-react';
import { t, language } from './i18n.mjs';
const api = window.chickadee;
const locale = language() === 'ko' ? 'ko-KR' : 'en-US';
const weekdays = [0, 1, 2, 3, 4, 5, 6].map(day => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + day))));
const fresh = (options) => ({ name: '', enabled: true, repeat: 'daily', time: '09:00', date: '', days: [1, 2, 3, 4, 5], options: structuredClone(options) });
const describe = item => item.repeat === 'daily' ? t("매일") : item.repeat === 'once' ? item.date : item.days.map(d => weekdays[d]).join('·');
export default function ScheduleSettings({ options }) {
  const [state, setState] = useState({ items: [], timezone: '' });
  const [loadError, setLoadError] = useState(''), [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function read() {
    try {
      if (!api.scheduleState) throw new Error(t("예약 기능을 사용하려면 앱을 완전히 종료한 뒤 다시 실행하세요."));
      setState(await api.scheduleState()); setLoaded(true); setLoadError('');
    } catch (error) { setLoadError(/No handler|not a function/.test(error.message) ? t("예약 기능을 사용하려면 앱을 완전히 종료한 뒤 다시 실행하세요.") : error.message); }
  }
  useEffect(() => { read(); const timer = setInterval(read, 5000); return () => clearInterval(timer); }, []);
  const update = patch => setDraft(d => ({ ...d, ...patch }));
  async function action(fn) { setBusy(true); setMessage(''); try { setState(await fn()); return true; } catch (error) { setMessage(error.message); return false; } finally { setBusy(false); } }
  async function save(event) { event.preventDefault(); if (await action(() => api.saveSchedule(draft))) { setDraft(null); setMessage(t("예약을 저장했습니다.")); } }
  return <div className="schedule-settings">
    <section className="settings-card schedule-board">
      <div className="schedule-heading"><h3><CalendarClock size={17} aria-hidden="true" />{t("검사 일정")} <span className="schedule-total">{state.items.length}</span></h3><span className="schedule-zone"><Clock3 size={12} aria-hidden="true" />{state.timezone || t("시스템 시간")}</span><button className="settings-small-button" disabled={busy || !loaded || Boolean(loadError)} onClick={() => { setMessage(''); setDraft(fresh(options)); }}><Plus size={14} aria-hidden="true" />{t("예약 추가")}</button></div>
      {loadError ? <div className="schedule-load-error" role="alert"><Monitor size={22} aria-hidden="true" /><strong>{t("예약에 연결하지 못했습니다")}</strong><p>{loadError}</p><button className="settings-small-button" onClick={read}><RotateCcw size={14} aria-hidden="true" />{t("다시 확인")}</button></div> : !loaded ? <p className="schedule-empty">{t("예약을 불러오는 중…")}</p> : !state.items.length && !draft && <div className="schedule-empty-state">
        <div className="schedule-example" aria-hidden="true"><span>{t("매일 아침 점검")}</span><strong>09<span>:</span>00</strong><div className="schedule-week">{[1, 2, 3, 4, 5, 6, 0].map(day => <span key={day}>{weekdays[day]}</span>)}</div><small>{t("반복 일정 예시")}</small></div>
        <div className="schedule-empty-copy"><h4>{t("첫 검사 일정을 만들어 보세요")}</h4><p>{t("출근 전 홈페이지 점검처럼,")}<br />{t("반복하는 검사를 정해진 시간에 실행하세요.")}</p><button className="schedule-create-link" onClick={() => setDraft(fresh(options))}>{t("매일 오전 9시로 만들기")}<ArrowRight size={14} aria-hidden="true" /></button></div>
      </div>}
      {state.items.map(item => <article className="schedule-item" key={item.id}>
        <div className="schedule-item-header"><div className="schedule-clock"><strong>{item.time}</strong><span>{describe(item)}</span></div><div className="schedule-item-name"><strong>{item.name}</strong><span className={`schedule-state ${item.enabled ? "enabled" : ""}`}>{item.enabled ? t("예약됨") : t("비활성")}</span></div><div className="schedule-actions">
          <input type="checkbox" aria-label={t("{name} 예약 활성화", { name: item.name })} checked={item.enabled} disabled={busy} onChange={() => action(() => api.saveSchedule({ ...item, enabled: !item.enabled }))} />
          <button type="button" aria-label={t("{name} 수정", { name: item.name })} title={t("수정")} disabled={busy} onClick={() => setDraft(structuredClone(item))}><Pencil size={15} /></button>
          <button type="button" aria-label={t("{name} 삭제", { name: item.name })} title={t("삭제")} disabled={busy} onClick={() => action(() => api.removeSchedule(item.id))}><Trash2 size={15} /></button>
        </div></div>
        <p className="schedule-url" title={item.options.url}>{item.options.url}</p>
        <p className="settings-help">{item.nextAt ? t("다음 실행: {time}", { time: new Date(item.nextAt).toLocaleString(locale) }) : t("예약 비활성")} · {t("최대 {pages}페이지 · {seconds}초", { pages: item.options.max_pages, seconds: item.options.timeout_sec })}</p>
        {item.last && <p className="settings-help">{new Date(item.last.at).toLocaleString(locale)} · {item.last.message}</p>}
      </article>)}
    </section>
    {draft && <form className="settings-card schedule-editor" onSubmit={save}>
      <div className="schedule-heading"><h3>{draft.id ? t("예약 수정") : t("새 예약")}</h3><button type="button" className="schedule-close" aria-label={t("예약 편집 닫기")} onClick={() => setDraft(null)} disabled={busy}><X size={16} /></button></div>
      <label>{t("예약 이름")}<input value={draft.name} required maxLength={80} placeholder={t("매일 아침 홈페이지 점검")} onChange={e => update({ name: e.target.value })} /></label>
      <label>{t("검사 대상 URL")}<input type="url" required value={draft.options.url} placeholder="https://example.com" onChange={e => update({ options: { ...draft.options, url: e.target.value } })} /></label>
      <fieldset className="schedule-repeat"><legend>{t("반복")}</legend>{[['once', t("한 번만")], ['daily', t("매일")], ['weekly', t("요일 반복")]].map(([id, label]) => <label key={id}><input type="radio" name="schedule-repeat" checked={draft.repeat === id} onChange={() => update({ repeat: id })} />{label}</label>)}</fieldset>
      <div className="form-row"><label>{t("실행 시간")}<input type="time" required value={draft.time} onChange={e => update({ time: e.target.value })} /></label>{draft.repeat === 'once' && <label>{t("실행 날짜")}<input type="date" required value={draft.date} onChange={e => update({ date: e.target.value })} /></label>}</div>
      {draft.repeat === 'weekly' && <fieldset className="schedule-days"><legend>{t("실행 요일")}</legend>{[1, 2, 3, 4, 5, 6, 0].map(day => <label key={day}><input type="checkbox" checked={draft.days.includes(day)} onChange={e => update({ days: e.target.checked ? [...draft.days, day].sort() : draft.days.filter(d => d !== day) })} />{weekdays[day]}</label>)}</fieldset>}
      <p className="settings-help">{t("최대 {pages}페이지 · 제한 {seconds}초 · 저장된 검사 구성으로 실행합니다. 이후 일반 설정 변경은 이 예약에 자동 적용되지 않습니다.", { pages: draft.options.max_pages, seconds: draft.options.timeout_sec })}</p>
      <div className="schedule-editor-actions"><button className="settings-small-button" disabled={busy}>{busy ? t("저장 중…") : t("예약 저장")}</button></div>
    </form>}
    <p className="settings-help" role="status">{message}</p>
    <section className="schedule-faq" aria-label={t("예약 검사 자주 묻는 질문")}>
      <h3>{t("자주 묻는 질문")}</h3>
      {[
        [t("앱을 꺼도 예약 검사가 실행되나요?"), t("앱이 실행 중이고 컴퓨터가 깨어 있어야 합니다. 앱이 종료되어 있거나 컴퓨터가 절전 상태이면 예약 검사가 실행되지 않습니다.")],
        [t("예약 시간을 놓치거나 다른 검사가 실행 중이면 어떻게 되나요?"), t("놓친 예약이나 검사·AI 검토와 겹친 예약은 재실행 없이 건너뜁니다. 이유는 예약 목록에서 확인하세요.")],
        [t("검사가 끝나면 리포트는 어디서 받나요?"), t("결과는 검사 기록에서 확인할 수 있습니다. 설정의 알림에서 Slack·Discord 웹훅을 등록하고 리포트 전송을 켜면, 검사 종료 후 해당 채널로 요약을 받습니다.")],
      ].map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={15} aria-hidden="true" /></summary><p>{answer}</p></details>)}
    </section>
  </div>;
}
