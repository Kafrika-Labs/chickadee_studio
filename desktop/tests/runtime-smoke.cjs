// Real settings, persisted mode, scan behavior and offline Paddle capability.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const packaged = Boolean(process.env.CHICKADEE_PACKAGED_EXE);
const launch = packaged ? require('./native-app.cjs').launch : require('./source-ui-harness.cjs').launch;
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
(async () => {
  const root = path.resolve(__dirname, '../..');
  const data = path.join(root, 'artifacts', 'runtime-ui-' + Date.now());
  const banner = await fs.readFile(path.join(root, 'tests/fixtures/ocr/promotion.png'));
  let images = 0, app;
  const server = http.createServer((request, response) => {
    if (request.url === '/banner.png') images++;
    response.writeHead(200, { 'Content-Type': request.url === '/banner.png' ? 'image/png' : 'text/html; charset=utf-8' });
    response.end(request.url === '/banner.png' ? banner : '<!doctype html><meta charset="utf-8"><article>카지노 가입 보너스<img src="/banner.png"></article>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    app = await launch({ env: { ...process.env, CHICKADEE_TEST_DATA: data }, ...(packaged ? { executablePath: process.env.CHICKADEE_PACKAGED_EXE, args: [], inspectMain: false } : {}) });
    const page = await app.firstWindow();
    page.setDefaultTimeout(20000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: '사용 가이드 닫기', exact: true }).click();
    await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
    await page.getByRole('button', { name: '설정', exact: true }).click();
    const settings = page.locator('details.runtime-settings');
    await settings.locator('summary').click();
    await settings.getByRole('button', { name: '절약', exact: true }).click();
    await page.waitForFunction(async () => (await window.chickadee.environment()).mode === 'economy');
    assert.equal((await page.evaluate(() => window.chickadee.environment())).features.ocr_enabled, false);
    await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click();
    await page.locator('.react-flow__node[data-id="target"]').click();
    await page.getByRole('textbox', { name: '검사 대상 URL' }).fill(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('.header-run-controls button.primary').click();
    let state;
    const deadline = Date.now() + 180000;
    do {
      state = await page.evaluate(() => window.chickadee.state());
      if (!state.running && state.history.length === 1) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    assert.equal(state.history.length, 1, JSON.stringify(state));
    const report = JSON.parse(await fs.readFile(path.join(path.dirname(state.history[0].path), 'scan-report.json'), 'utf8'));
    assert.equal(report.status, 'completed', JSON.stringify(report.errors));
    assert.equal(report.runtime_environment.effective_mode, 'economy');
    assert.equal(report.ocr_summary.enabled, false);
    assert.equal(report.ocr_summary.skipped, 1);
    assert.equal(report.ocr_summary.completed, 0);
    assert.ok(report.ocr_images.every(image => image.recognition_status === 'skipped' && image.lines.length === 0));
    // OCR is disabled independently of the CPU photo classifier. Retained
    // pixels are image evidence, not evidence that OCR ran in economy mode.
    if (packaged || report.content_visual?.status === 'completed') {
      assert.equal(report.ocr_images.length, 1);
      assert.equal(report.content_visual.analyzed, 1);
      assert.equal(report.content_visual.failed, 0);
      assert.equal(report.ocr_images[0].local_ai.content_visual.status, 'completed');
    }
    assert.ok(report.local_ai.text_analyzed > 0);
    assert.ok(report.local_ai.visual_analyzed > 0);
    await page.getByRole('button', { name: '설정', exact: true }).click();
    if (!(await settings.evaluate(element => element.open))) await settings.locator('summary').click();
    await settings.getByRole('button', { name: '표준', exact: true }).click();
    await page.waitForFunction(async () => (await window.chickadee.environment()).mode === 'standard');
    await settings.getByRole('button', { name: 'OCR 기능 확인', exact: true }).click();
    let environment;
    const probeDeadline = Date.now() + 60000;
    do {
      environment = await page.evaluate(() => window.chickadee.environment());
      if (['completed', 'failed'].includes(environment.ocr_check.status)) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < probeDeadline);
    assert.equal(environment.ocr_check.status, 'completed', JSON.stringify(environment));
    assert.equal(environment.ocr_check.network_requests, 0);
    await settings.getByText('구동 확인', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(root, 'artifacts/runtime-settings.png') });
    assert.equal(JSON.parse(await fs.readFile(path.join(data, 'runtime-settings.json'), 'utf8')).mode, 'standard');
    assert.deepEqual(errors, []);
    const direct = await require('./content-smoke.cjs').checkContent(page, root);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ status: 'passed', mode: packaged ? 'electron-packaged' : 'source-ui-real-python', economyReport: true, persisted: true, offlineOCR: true, environment, browserImageRequests: images, ...direct }));
  } finally {
    if (app) await app.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
