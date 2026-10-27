// One backend entry point through the real preload/renderer, without new UI controls.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const packaged = Boolean(process.env.CHICKADEE_PACKAGED_EXE);
const launch = packaged ? require('./native-app.cjs').launch : require('./source-ui-harness.cjs').launch;
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
async function checkContent(page, root) {
  const image = 'data:image/png;base64,' + (await fs.readFile(path.join(root, 'tests/fixtures/ocr/promotion.png'))).toString('base64');
    const history = (await page.evaluate(() => window.chickadee.state())).history;
    const before = await page.getByRole('button').count();
    await page.evaluate(() => window.chickadee.configureRuntime({ mode: 'standard' }));
    const job = await page.evaluate(image_data_url => window.chickadee.analyzeContent({ text: '도서관 이용 안내', image_data_url }), image);
    let value;
    const deadline = Date.now() + 180000;
    do {
      value = await page.evaluate(analysis_id => window.chickadee.analyzeContent({ analysis_id }), job.analysis_id);
      if (value.status !== 'running') break;
      await new Promise(resolve => setTimeout(resolve, 150));
    } while (Date.now() < deadline);
    assert.equal(value.status, 'completed', JSON.stringify(value));
    assert.equal(value.result.sources.length, 2);
    assert.equal(value.result.sources[0].text, '도서관 이용 안내');
    assert.equal(value.result.sources[0].ad_candidates.length, 0);
    assert.ok(value.result.sources[1].text.includes('카지노'));
    assert.ok(value.result.sources[1].ad_candidates.length > 0);
    assert.equal(value.result.image.local_ai.visual.status, 'completed');
    assert.equal(value.result.sources[1].local_ai.text.status, 'completed');
    if (packaged || process.env.CHICKADEE_LAYA_WORKER) {
      assert.ok(value.result.sources.every(source => source.local_ai.laya.status === 'completed'), JSON.stringify(value.result.sources));
    }
    assert.equal(value.result.paid_requests, 0);
    assert.deepEqual((await page.evaluate(() => window.chickadee.state())).history, history);
    assert.equal(await page.getByRole('button').count(), before);
    return { directImageText: true, sourceSeparation: true, models: true, paidCalls: 0, newButtons: 0 };
}
module.exports = { checkContent };

if (require.main === module) (async () => {
  const root = path.resolve(__dirname, '../..');
  const app = await launch({ env: { ...process.env, CHICKADEE_TEST_DATA: path.join(root, 'artifacts/content-ui-' + Date.now()) },
    ...(packaged ? { executablePath: process.env.CHICKADEE_PACKAGED_EXE, args: [] } : {}) });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(20000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.getByRole('button', { name: '사용 가이드 닫기', exact: true }).click();
    await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
    await checkContent(page, root);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: 'passed', mode: packaged ? 'electron-packaged' : 'source-ui-real-python', directImageText: true, sourceSeparation: true, models: true, paidCalls: 0, newButtons: 0 }));
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
