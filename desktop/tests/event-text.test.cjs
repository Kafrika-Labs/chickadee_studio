const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

function translate(language, message, kind = 'progress') {
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { eventText, eventKindLabel } from './src/event-text.mjs'; console.log(JSON.stringify([eventText(${JSON.stringify(message)}), eventKindLabel(${JSON.stringify(kind)})]));`,
  ], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, CHICKADEE_LANGUAGE: language }, encoding: 'utf8' }));
}

test('English progress preserves the URL and page counts', () => {
  assert.deepEqual(translate('en', '1/1000 페이지 점검 중: https://example.com/한글?q=1'),
    ['Inspecting page 1/1000: https://example.com/한글?q=1', 'Scan progress updated']);
});
test('English model failure remains a failure, with the continuation notice', () => {
  assert.equal(translate('en', '로컬 AI 모델 준비 실패: 원문·규칙 검사는 계속합니다.')[0],
    'Local AI models could not be loaded. Text and rule checks will continue.');
});
test('Korean messages and unknown diagnostics are preserved', () => {
  assert.equal(translate('ko', '브라우저를 준비하고 있습니다.')[0], '브라우저를 준비하고 있습니다.');
  assert.equal(translate('en', 'ERR_CONNECTION_RESET https://example.com')[0], 'ERR_CONNECTION_RESET https://example.com');
});
test('analysis details translate model names and Laya status', () => {
  assert.equal(translate('en', '문자 TF-IDF · Random Forest')[0], 'Character TF-IDF · Random Forest');
  assert.equal(translate('en', '검증한 Laya 모델을 적용하지 않았습니다.')[0], 'A validated Laya model has not been applied.');
});
