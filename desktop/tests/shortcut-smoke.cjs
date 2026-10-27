// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const { launch } = require('./source-ui-harness.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const app = await launch({ env: { ...process.env, CHICKADEE_TEST_DATA: path.resolve('../artifacts/shortcut-ui-' + Date.now()) } });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(10000); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '사용 가이드 닫기', exact: true }).click();
    assert.equal(await page.locator('.command-launcher').count(), 0);
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByRole('button', { name: '단축키', exact: true }).click();
    await page.getByRole('button', { name: '빠른 명령 단축키 변경', exact: true }).click();
    await page.keyboard.press('Control+Shift+p');
    await page.getByRole('status').filter({ hasText: '단축키를 저장했습니다.' }).waitFor();
    await page.getByRole('button', { name: '사용 가이드 단축키 변경', exact: true }).click();
    await page.keyboard.press('Control+Shift+p');
    await page.getByRole('status').filter({ hasText: '이미 다른 명령' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: '단축키 검색' }).fill('빠른');
    assert.equal(await page.locator('.shortcut-row').count(), 1);
    await page.getByRole('textbox', { name: '단축키 검색' }).fill('');
    await page.screenshot({ path: path.resolve('../artifacts/shortcut-settings.png') });
    await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click();
    await page.keyboard.press('Control+k'); assert.equal(await page.getByRole('dialog', { name: '빠른 명령' }).count(), 0);
    await page.keyboard.press('Control+Shift+p'); await page.getByRole('dialog', { name: '빠른 명령' }).waitFor();
    await page.keyboard.press('Escape');
    await page.reload(); await page.locator('.header-run-controls').waitFor();
    await page.waitForFunction(async () => (await window.chickadee.state()).preferences.shortcuts.palette === 'Mod+Shift+KeyP');
    await page.keyboard.press('Control+Shift+p'); await page.getByRole('dialog', { name: '빠른 명령' }).waitFor();
    console.log('Shortcut UI: recording, conflicts, search, dispatch and persistence passed');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
