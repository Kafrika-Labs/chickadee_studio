// Main-process UI language. Korean source text is the lookup key.
const en = require("./locales/en.cjs");

const LANGUAGES = ["en", "ko"];
const forced = LANGUAGES.includes(process.env.CHICKADEE_LANGUAGE)
  ? process.env.CHICKADEE_LANGUAGE
  : null;
let current = forced || "ko";

function setLanguage(value) {
  if (LANGUAGES.includes(value)) current = value;
  return current;
}
const language = () => current;

function t(text, vars) {
  const value = current === "ko" ? text : (en[text] ?? text);
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, key) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : match,
  );
}

module.exports = { LANGUAGES, setLanguage, language, t };
