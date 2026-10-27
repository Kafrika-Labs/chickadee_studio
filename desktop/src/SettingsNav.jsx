import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, X, SlidersHorizontal, Sparkles, Bell, CalendarClock, BookOpen, Keyboard, Download } from 'lucide-react';
import { t } from './i18n.mjs';
const sections = [
  { label: t("기본 설정"), items: [
    { id: 'general', label: t("일반"), Icon: SlidersHorizontal, keywords: t("검사 탐색 프로필 최대 페이지 제한시간 결과 저장 폴더 위치 미리보기 브라우저 속도 천천히 빠르게 간격 대기 환경 CPU 메모리 사양 OCR 자동 표준 절약"), detail: t("검사 방식 · 실행 환경 · 저장 위치") },
    { id: 'notifications', label: t("알림"), Icon: Bell, keywords: t("slack 슬랙 discord 디스코드 웹훅 webhook 리포트 데스크톱 소리 집중 모드"), detail: t("데스크톱 · Slack · Discord") },
    { id: 'updates', label: t("업데이트"), Icon: Download, keywords: t("버전 릴리스 release 다운로드 설치 update"), detail: t("버전 확인 · 다운로드") },
  ] },
  { label: t("인터페이스"), items: [{ id: 'shortcuts', label: t("단축키"), Icon: Keyboard, keywords: t("키보드 shortcut 빠른 명령 ctrl command 키 조합"), detail: t("키 지정 · 검색 · 기본값 복원") }] },
  { label: t("AI 기능"), items: [{ id: 'ai', label: t("AI 연결"), Icon: Sparkles, keywords: t("groq 그록 그로크 api 키 모델 토큰 한도 에이전트 검토"), detail: t("Groq · API 키 · 사용 한도") }] },
  { label: t("자동화"), items: [{ id: 'schedules', label: t("예약 검사"), Icon: CalendarClock, keywords: t("배치 스케줄 일정 시간 매일 요일 반복 예약 자동 실행"), detail: t("실행 시간 · 반복 일정") }] },
];
export default function SettingsNav({ selected, onSelect, onBack, onGuide }) {
  const [query, setQuery] = useState('');
  const search = useRef(null);
  const term = query.trim().toLowerCase();
  const groups = sections.map(group => ({ ...group, items: group.items.filter(item => `${item.label} ${item.keywords}`.toLowerCase().includes(term)) })).filter(group => group.items.length);
  useEffect(() => { const keydown = event => { if (!event.defaultPrevented && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); search.current?.focus(); search.current?.select(); } }; window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown); }, []);
  return <div className="settings-navigation">
    <button className="settings-back" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" />{t("앱으로 돌아가기")}</button>
    <div className="settings-search-row"><div className="settings-nav-search"><Search size={15} aria-hidden="true" /><input ref={search} type="search" aria-label={t("설정 검색")} placeholder={t("설정 검색")} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); if (event.key === 'Enter' && groups[0]?.items[0]) onSelect(groups[0].items[0].id); }} />{query ? <button onClick={() => { setQuery(''); search.current?.focus(); }} aria-label={t("설정 검색 지우기")}><X size={13} /></button> : <kbd>{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} F</kbd>}</div></div>
    {!term && <button className="settings-guide" onClick={onGuide}><BookOpen size={17} aria-hidden="true" />{t("사용 가이드")}</button>}
    <nav aria-label={t("설정 메뉴")}>
      {groups.map(group => <section key={group.label} className="settings-nav-group"><h3>{group.label}</h3>{group.items.map(({ id, label, Icon, detail }) => <button key={id} className={`settings-nav-link ${selected === id ? 'active' : ''}`} aria-current={selected === id ? 'page' : undefined} onClick={() => onSelect(id)}><Icon size={17} aria-hidden="true" /><span>{label}{term && <small>{detail}</small>}</span></button>)}</section>)}
      {!groups.length && <p className="settings-search-empty" role="status">{t("일치하는 설정이 없습니다.")}<br />{t("‘알림’, ‘API’, ‘예약’으로 검색해 보세요.")}</p>}
    </nav>
  </div>;
}
