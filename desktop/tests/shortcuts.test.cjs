// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const test = require('node:test');
const assert = require('node:assert/strict');
test('shortcut validation rejects duplicate, reserved, malformed and unmodified keys', async () => {
  const { defaults, validateShortcuts, fromEvent } = await import('../src/shortcuts.mjs');
  assert.equal(validateShortcuts({ ...defaults(), palette: 'Mod+Shift+KeyP' }).palette, 'Mod+Shift+KeyP');
  assert.throws(() => validateShortcuts({ ...defaults(), guide: 'Mod+KeyK' }), /이미/);
  for (const key of ['Mod+KeyQ', 'Mod+KeyF', 'KeyK', 'Alt+KeyK']) assert.throws(() => validateShortcuts({ ...defaults(), palette: key }));
  assert.equal(validateShortcuts({ ...defaults(), palette: '' }).palette, '');
  assert.equal(fromEvent({ ctrlKey: true, shiftKey: true, code: 'KeyP' }), 'Mod+Shift+KeyP');
  assert.equal(fromEvent({ metaKey: true, isComposing: true, code: 'KeyP' }), '');
});
