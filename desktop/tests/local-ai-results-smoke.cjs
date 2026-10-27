// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch } = require('./native-app.cjs');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const app = await launch({ executablePath: process.env.CHICKADEE_PACKAGED_EXE || require('electron'), args: process.env.CHICKADEE_PACKAGED_EXE ? [] : [path.join(root, 'desktop')], env: { ...process.env, CHICKADEE_TEST_DATA: path.join(root, 'artifacts/local-results-' + Date.now()) } });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '사용 가이드 닫기', exact: true }).click();
    await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
    const state = await page.evaluate(() => window.chickadee.state());
    const packets = Array.from({ length: 857 }, (_, index) => ({
      id: `p_${index}`, source_kind: index % 5 === 0 ? 'image_ocr' : 'dom_text',
      text: index === 845 ? '긴 원문 '.repeat(60) + '검색전용문구' : `분석 문구 ${index + 1}`,
      local_ai: { text: { status: 'completed', label: [250, 500, 856].includes(index) ? 'ad_context' : 'review', score: .6 }, laya: { status: 'unavailable', message: '미적용' } },
    }));
    await app.evaluate(({ ipcMain }, { state, packets }) => {
      ipcMain.removeHandler('desktop:state');
      ipcMain.handle('desktop:state', () => ({ ...state, run_id: 'local-results-fixture', running: false }));
      ipcMain.removeHandler('desktop:inspection');
      ipcMain.handle('desktop:inspection', () => ({ graph: { nodes: [], edges: [] }, packets, agent: { assessments: [], ledger: {} }, local_ai: { status: 'completed', text_analyzed: 857 }, ocr_images: [], screenshots: {} }));
    }, { state, packets });
    await page.locator('nav button').filter({ hasText: '검사 분석' }).click();
    await page.getByRole('tab', { name: 'AI 검토', exact: true }).click();
    await page.locator('.local-ai-results > summary').click();
    await page.locator('.local-ai-row').nth(19).waitFor();
    assert.equal(await page.locator('.local-ai-search').evaluate(el => getComputedStyle(el).flexDirection), 'row');
    assert.equal(await page.locator('.local-ai-row').count(), 20);
    assert.match(await page.locator('.local-ai-row').first().innerText(), /유사 신호/);
    assert.match(await page.locator('.local-ai-pagination').innerText(), /1 \/ 43/);
    await page.locator('.local-ai-pagination').getByRole('button', { name: '다음', exact: true }).click();
    assert.match(await page.locator('.local-ai-pagination').innerText(), /21–40/);
    const filters = page.getByRole('group', { name: '분석 결과 필터' });
    await filters.getByRole('button', { name: /유사 신호/ }).click();
    assert.equal(await page.locator('.local-ai-row').count(), 3);
    assert.equal(await filters.getByRole('button', { name: /유사 신호/ }).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(52, 67, 89)');
    await filters.getByRole('button', { name: /이미지 문구/ }).click();
    assert.ok((await page.locator('.local-ai-row-source').allTextContents()).every(text => text === '이미지 문구'));
    await page.getByRole('textbox', { name: '분석 문구 검색' }).fill('검색전용문구');
    assert.equal(await page.locator('.local-ai-row').count(), 1);
    await page.locator('.local-ai-row > summary').click();
    await page.waitForFunction(() => document.querySelector('.local-ai-row[open] .local-ai-row-text')?.innerText.length > 0);
    assert.equal(await page.locator('.local-ai-row-text').innerText(), packets[845].text);
    assert.match(await page.locator('.local-ai-result-card').innerText(), /모델 점수 0.600/);
    await page.getByRole('textbox', { name: '분석 문구 검색' }).fill('존재하지않는문구');
    await page.getByText('조건에 맞는 분석 결과가 없습니다.', { exact: true }).waitFor();
    assert.equal(await page.locator('.local-ai-pagination button:disabled').count(), 2);
    await page.getByRole('textbox', { name: '분석 문구 검색' }).fill('');
    await filters.getByRole('button', { name: /전체/ }).click();
    await page.locator('.local-ai-list-tools').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(root, 'artifacts/local-ai-compact-results.png') });
    console.log('PASS: 857 results, signal priority, 20-row pagination, source/signal filters, full-text search, expandable analysis and no matches');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
