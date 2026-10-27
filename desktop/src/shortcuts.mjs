import { t } from './i18n.mjs';
export const SHORTCUTS = [
  { id: 'palette', label: t("빠른 명령"), group: t("앱"), defaultKey: 'Mod+KeyK' },
  { id: 'settings', label: t("설정"), group: t("앱"), defaultKey: 'Mod+Comma' },
  { id: 'guide', label: t("사용 가이드"), group: t("앱"), defaultKey: '' },
  { id: 'workflow', label: t("검사 구성"), group: t("페이지"), defaultKey: '' },
  { id: 'results', label: t("탐지 내역"), group: t("페이지"), defaultKey: '' },
  { id: 'inspection', label: t("검사 분석"), group: t("페이지"), defaultKey: '' },
  { id: 'history', label: t("검사 기록"), group: t("페이지"), defaultKey: '' },
  { id: 'load', label: t("결과 불러오기"), group: t("작업"), defaultKey: '' },
];
export const defaults = () => Object.fromEntries(SHORTCUTS.map(item => [item.id, item.defaultKey]));
export function validateShortcuts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t("단축키 설정이 올바르지 않습니다."));
  const result = defaults(), used = new Set();
  for (const item of SHORTCUTS) {
    const key = value[item.id] ?? item.defaultKey;
    if (typeof key !== 'string' || (key && !/^Mod\+(Shift\+)?(Alt\+)?(Key[A-Z]|Digit[0-9]|Comma|Period|Slash)$/.test(key))) throw new Error(t("Ctrl 또는 ⌘와 문자·숫자 키를 함께 사용하세요."));
    if (/^Mod\+(Key[ACFVWXQRTNZ]|Shift\+Key[ZWTN])$/.test(key)) throw new Error(t("앱·운영체제에서 사용하는 단축키입니다. 다른 조합을 선택하세요."));
    if (key && used.has(key)) throw new Error(t("이미 다른 명령에 지정된 단축키입니다."));
    if (key) used.add(key); result[item.id] = key;
  }
  return result;
}
export function fromEvent(event) {
  if (event.isComposing || (!event.metaKey && !event.ctrlKey)) return '';
  if (!/^(Key[A-Z]|Digit[0-9]|Comma|Period|Slash)$/.test(event.code)) return '';
  return `Mod+${event.shiftKey ? 'Shift+' : ''}${event.altKey ? 'Alt+' : ''}${event.code}`;
}
export function keyLabel(value, mac = false) { return value ? value.split('+').map(key => ({ Mod: mac ? '⌘' : 'Ctrl', Shift: mac ? '⇧' : 'Shift', Alt: mac ? '⌥' : 'Alt', Comma: ',', Period: '.', Slash: '/' }[key] || key.replace(/^(Key|Digit)/, ''))).join(' + ') : t("미지정"); }
