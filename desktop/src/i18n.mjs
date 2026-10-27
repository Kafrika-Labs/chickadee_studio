// UI language. Korean source text is the lookup key; English comes from locales/en.
// The language is fixed for the page lifetime: changing it saves the preference and reloads.
import en from "./locales/en/index.mjs";

export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "ko", label: "한국어" },
];
const valid = (value) => LANGUAGES.some((entry) => entry.id === value);

function initial() {
  const fromApp = globalThis.window?.chickadee?.language;
  if (valid(fromApp)) return fromApp;
  const fromEnv = globalThis.process?.env?.CHICKADEE_LANGUAGE;
  if (valid(fromEnv)) return fromEnv;
  try {
    const stored = globalThis.localStorage?.getItem("chickadee.language");
    if (valid(stored)) return stored;
  } catch {}
  return "ko";
}

let current = initial();
if (globalThis.document) document.documentElement.lang = current;

export const language = () => current;

export function t(text, vars) {
  return fill(current === "ko" ? text : (en[text] ?? text), vars);
}

// For Korean text that needs different English depending on use, e.g. the
// "일시정지" button (Pause) versus the status (Paused). Korean is unchanged.
export function tc(context, text, vars) {
  return fill(current === "ko" ? text : (en[`${context}|${text}`] ?? en[text] ?? text), vars);
}

function fill(value, vars) {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : match,
  );
}
