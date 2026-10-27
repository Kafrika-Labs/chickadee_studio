const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

delete process.env.CHICKADEE_LANGUAGE;
const desktop = path.resolve(__dirname, "..");
const string = '"((?:[^"\\\\]|\\\\.)*)"';
const keysIn = (files) =>
  files.flatMap((file) => {
    const source = fs.readFileSync(file, "utf8");
    const at = path.relative(desktop, file);
    return [
      ...[...source.matchAll(new RegExp(`\\bt\\(\\s*${string}`, "g"))].map((match) => ({
        file: at,
        key: JSON.parse(`"${match[1]}"`),
      })),
      ...[...source.matchAll(new RegExp(`\\btc\\(\\s*${string}\\s*,\\s*${string}`, "g"))].map((match) => ({
        file: at,
        key: `${JSON.parse(`"${match[1]}"`)}|${JSON.parse(`"${match[2]}"`)}`,
      })),
    ];
  });
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function checkDictionary(used, dictionary) {
  const missing = used.filter(({ key }) => !Object.hasOwn(dictionary, key));
  assert.deepEqual(missing, [], "every t() key needs an English entry");
  for (const [key, value] of Object.entries(dictionary)) {
    // Empty is allowed: Korean counters such as "개" have no English equivalent.
    assert.equal(typeof value, "string", key);
    assert.deepEqual(placeholders(value), placeholders(key), `placeholders differ for ${key}`);
  }
}

test("renderer text has English translations", async () => {
  const { default: en } = await import(pathToFileURL(path.join(desktop, "src/locales/en/index.mjs")));
  const files = fs
    .readdirSync(path.join(desktop, "src"))
    .filter((name) => /\.(jsx|mjs)$/.test(name))
    .map((name) => path.join(desktop, "src", name));
  checkDictionary(keysIn(files), en);
});

test("main-process text has English translations", () => {
  const en = require("../electron/locales/en.cjs");
  const files = fs
    .readdirSync(path.join(desktop, "electron"))
    .filter((name) => name.endsWith(".cjs"))
    .map((name) => path.join(desktop, "electron", name));
  checkDictionary(keysIn(files), en);
});

test("Korean is the default language and saved language can change", async () => {
  const { language, t } = await import(pathToFileURL(path.join(desktop, "src/i18n.mjs")));
  assert.equal(language(), "ko");
  assert.equal(t("언어"), "언어");
  assert.equal(t("번역 없는 문구"), "번역 없는 문구");
  const main = require("../electron/i18n.cjs");
  assert.equal(main.language(), "ko");
  assert.equal(main.setLanguage("en"), "en");
  assert.equal(main.t("잘못된 주소입니다."), "Invalid address.");
  assert.equal(main.setLanguage("ko"), "ko");
  assert.equal(main.t("언어 {n}", { n: 2 }), "언어 2");
  assert.equal(main.setLanguage("fr"), "ko");
  main.setLanguage("en");
});
