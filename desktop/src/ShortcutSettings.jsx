import React, { useState } from 'react';
import { Search, RotateCcw, X } from 'lucide-react';
import { SHORTCUTS, defaults, validateShortcuts, fromEvent, keyLabel } from './shortcuts.mjs';
import { t } from './i18n.mjs';
export default function ShortcutSettings({ value, onChange }) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [recording, setRecording] = useState(null), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const mac = navigator.platform.includes('Mac');
  const items = SHORTCUTS.filter(item => `${item.label} ${keyLabel(value[item.id], mac)}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'changed' ? value[item.id] !== item.defaultKey : !value[item.id])));
  async function save(next) { try { const clean = validateShortcuts(next); setBusy(true); await onChange(clean); setRecording(null); setMessage(t("단축키를 저장했습니다.")); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
  return <section className="settings-card shortcut-settings">
    <div className="schedule-heading"><h3>{t("키보드 단축키")}</h3><button className="settings-small-button" disabled={busy} onClick={() => save(defaults())}><RotateCcw size={13} />{t("기본값 복원")}</button></div>
    <p className="settings-help">{t("단축키를 눌러 원하는 키 조합을 입력하세요. 앱에 초점이 있을 때 적용됩니다.")}</p>
    <div className="shortcut-search"><Search size={15} aria-hidden="true" /><input aria-label={t("단축키 검색")} placeholder={t("명령 또는 키 검색")} value={query} onChange={e => setQuery(e.target.value)} /><span>{items.length}/{SHORTCUTS.length}</span></div>
    <div className="shortcut-filters">{[['all',t("전체")],['changed',t("변경됨")],['unassigned',t("미지정")]].map(([id,label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
    <div className="shortcut-list">{items.map(item => <div className="shortcut-row" key={item.id}><div><strong>{item.label}</strong><small>{item.group}</small></div><div className="shortcut-row-actions">
      <button className={`shortcut-key ${recording === item.id ? 'recording' : ''}`} data-shortcut-recorder="true" aria-label={t("{label} 단축키 변경", { label: item.label })} disabled={busy} onClick={() => { setRecording(item.id); setMessage(t("Ctrl 또는 ⌘와 키를 함께 누르세요. Esc로 취소합니다.")); }} onBlur={() => setRecording(null)} onKeyDown={event => { if (recording !== item.id) return; event.preventDefault(); event.stopPropagation(); if (event.key === 'Escape') { setRecording(null); setMessage(''); return; } if (event.repeat) return; const key = fromEvent(event); if (key) save({ ...value, [item.id]: key }); }}>{recording === item.id ? t("키 조합 입력…") : <kbd>{keyLabel(value[item.id], mac)}</kbd>}</button>
      <button className="shortcut-clear" aria-label={t("{label} 단축키 해제", { label: item.label })} title={t("단축키 해제")} disabled={busy || !value[item.id]} onClick={() => save({ ...value, [item.id]: '' })}><X size={14} /></button>
    </div></div>)}{!items.length && <p className="settings-help">{t("일치하는 단축키가 없습니다.")}</p>}</div>
    <p className="settings-help" role="status">{message}</p>
  </section>;
}
