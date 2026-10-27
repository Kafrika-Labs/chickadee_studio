// Actual renderer + Python bridge + localhost fixture. No paid API requests.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const packaged = Boolean(process.env.CHICKADEE_PACKAGED_EXE);
const launch = packaged ? require("./native-app.cjs").launch : require("./source-ui-harness.cjs").launch;
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");

(async () => {
  const root = path.resolve(__dirname, "../..");
  const data = path.join(root, "artifacts", "inspection-ui-" + Date.now());
  let revision = 0;
  const server = http.createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(request.url === "/" ? '<a href="/post">게시글</a>' :
      `<article id="post" style="opacity:${revision ? 0 : 1}"><p>카지노 가입 보너스 ${revision}</p><p>caѕino join now</p><a href="https://example.invalid/${revision}">주소</a></article>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const env = { ...process.env, CHICKADEE_TEST_DATA: data, GROQ_API_KEY: 'test_ambient_key_must_not_be_used' };
  let app;
  try {
    app = await launch({ env, ...(packaged ? { executablePath: process.env.CHICKADEE_PACKAGED_EXE, args: [] } : {}) });
    const page = await app.firstWindow();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByRole("dialog", { name: "사용 가이드" }).getByRole("button", { name: "사용 가이드 닫기", exact: true }).click();
    await page.locator(".header-run-controls button.primary:not(:disabled)").waitFor();
    const fixedEdgeCount = await page.locator('.react-flow__edge').count();
    assert.equal(fixedEdgeCount, 11);
    await page.locator('[data-testid="rf__edge-techniques-dedup"]').dispatchEvent('click');
    await page.keyboard.press('Delete');
    assert.equal(await page.locator('.react-flow__edge').count(), fixedEdgeCount);
    assert.equal(await page.locator('.react-flow__handle.connectable').count(), 0);
    await page.locator('.react-flow__node[data-id="target"]').click();
    await page.getByRole("textbox", { name: "검사 대상 URL" }).fill(`http://127.0.0.1:${server.address().port}/`);
    await page.getByRole("button", { name: "검사 분석", exact: true }).click();
    async function assertStartCentered() {
      await page.waitForFunction(() => {
        const graph = document.querySelector('.inspection-graph');
        const start = document.querySelector('.inspection-graph .boundary-start');
        if (!graph || !start) return false;
        const viewport = graph.getBoundingClientRect(), node = start.getBoundingClientRect();
        return node.left >= viewport.left && node.right <= viewport.right &&
          node.top >= viewport.top && node.bottom <= viewport.bottom &&
          Math.abs((node.left + node.right - viewport.left - viewport.right) / 2) < 80;
      });
    }
    await assertStartCentered();
    await page.getByRole('button', { name: '진행 기록', exact: true }).click();
    await page.getByRole('button', { name: '검사 분석', exact: true }).click();
    await assertStartCentered();
    async function wait(count) {
      const deadline = Date.now() + 180000;
      let state;
      do {
        state = await page.evaluate(() => window.chickadee.state());
        if (!state.running && state.history.length === count) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      } while (Date.now() < deadline);
      assert.equal(state.history.length, count);
      assert.equal(state.running, false);
      await page.waitForFunction(() => document.querySelectorAll('.inspection-graph .react-flow__node').length >= 4);
      return state;
    }
    await page.evaluate(() => {
      const unsubscribe = window.chickadee.onEvent(event => {
        // The evidence panel below selects mandatory findings; an earlier
        // context candidate belongs to a different tab and cannot satisfy it.
        if (event.kind === 'finding') {
          unsubscribe(); window.chickadee.pause().catch(() => {});
        }
      });
    });
    await page.locator(".header-run-controls button.primary").click();
    await page.waitForFunction(async () => (await window.chickadee.state()).status === 'paused');
    await page.getByRole('button', { name: /^탐지 내역/ }).click();
    await page.locator('tbody tr').first().click();
    await page.getByAltText('검사 브라우저에서 촬영한 스크린샷', { exact: true }).first().waitFor();
    assert.equal((await page.evaluate(() => window.chickadee.state())).running, true);
    await page.evaluate(() => window.chickadee.resume());
    await page.getByRole('button', { name: '검사 분석', exact: true }).click();
    await wait(1);
    const firstGraph = await page.locator('.inspection-graph .react-flow__node').count();
    assert.ok(firstGraph >= 4);
    await page.getByRole('button', { name: /^탐지 내역/ }).click();
    await page.locator('tbody tr').first().click();
    const evidence = page.getByAltText('검사 브라우저에서 촬영한 스크린샷', { exact: true }).first();
    await evidence.waitFor({ state: 'attached' });
    await page.waitForFunction(() => document.querySelector('.evidence-capture img')?.naturalWidth > 0);
    // Completion loads the persisted outcome asynchronously after live rows;
    // select the saved row once its screenshot has arrived.
    await page.locator('tbody tr .evidence-cell').first().click();
    await page.locator('.record-drawer[aria-hidden="false"]').waitFor();
    const badgeOffset = await page.locator('.record-header-actions .review-label').evaluate(el => {
      const badge = el.getBoundingClientRect(), header = el.closest('.panel-heading').getBoundingClientRect();
      return Math.abs((badge.top + badge.bottom - header.top - header.bottom) / 2);
    });
    assert.ok(badgeOffset <= 1, `Review badge is off center by ${badgeOffset}px`);
    await page.getByRole('button', { name: '항목 작업', exact: true }).click();
    const itemMenu = page.getByRole('menu', { name: '항목 작업', exact: true });
    await itemMenu.waitFor();
    for (const item of await itemMenu.getByRole('menuitem').all()) {
      assert.ok((await item.boundingBox()).width > 180);
      assert.equal(await item.evaluate(el => getComputedStyle(el).display), 'flex');
    }
    await page.screenshot({ path: path.join(root, 'artifacts/record-action-menu.png') });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '스크린샷 확대', exact: true }).first().waitFor();
    await page.screenshot({ path: path.join(root, 'artifacts/evidence-panel-0.8.0.png') });
    await page.getByRole('button', { name: '스크린샷 확대', exact: true }).first().click();
    await page.getByRole('dialog', { name: '스크린샷 확대' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: '스크린샷 확대' }).waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: '스크린샷 확대', exact: true }).first().evaluate(el => el === document.activeElement), true);
    await page.locator('.record-technical > summary').click();
    const captureLink = page.locator('.record-technical .detail-url a');
    assert.equal(await page.locator('.capture-metadata a').count(), 0);
    assert.match(await captureLink.getAttribute('href'), /^https?:/);
    if (!packaged) {
      await page.evaluate(() => { window.__openedURL = null; window.chickadee.openExternal = async url => { window.__openedURL = url; }; });
      await captureLink.click();
      assert.equal(await page.evaluate(() => window.__openedURL), await captureLink.getAttribute('href'));
    }
    await page.getByRole('button', { name: '검사 분석', exact: true }).click();
    revision = 1;
    await page.locator(".header-run-controls button.primary").click();
    const current = await wait(2);
    assert.equal(await page.getByRole('tab', { name: '변경 비교', exact: true }).count(), 0);
    assert.equal(current.history.length, 2);
    const result = current.history[0].path;
    const raw = await fs.readFile(result);
    // Invisible source text must still allow opening the saved reference screenshot.
    await page.getByRole('button', { name: /^탐지 내역/ }).click();
    await page.locator('tbody tr').first().click();
    await page.getByRole('button', { name: '스크린샷 확대', exact: true }).first().click();
    await page.getByRole('dialog', { name: '스크린샷 확대' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '검사 분석', exact: true }).click();
    await assert.rejects(fs.access(path.join(path.dirname(result), 'comparison.json')), { code: 'ENOENT' });
    assert.equal(await page.evaluate(() => typeof window.chickadee.compare), 'undefined');
    await page.getByRole('tab', { name: 'AI 검토', exact: true }).click();
    const htmlExport = path.join(data, 'inspection-report.html');
    await app.evaluate(({dialog}, file) => { dialog.showSaveDialog = async () => ({canceled:false, filePath:file}); }, htmlExport);
    await page.getByRole('button', { name: '리포트 저장', exact: true }).click();
    await page.getByRole('status').filter({hasText:'리포트를 저장했습니다.'}).waitFor();
    assert.match(await fs.readFile(htmlExport, 'utf8'), /Chickadee 검사 리포트/);
    const localResults = page.getByRole('region', { name: '로컬 AI 결과', exact: true });
    await localResults.waitFor();
    await localResults.locator('.local-ai-results > summary').click();
    await localResults.locator('.local-ai-row > summary').first().click();
    await localResults.getByRole('region', { name: '로컬 AI 분석', exact: true }).first().waitFor();
    await page.getByText('검토 안내 및 사용량', { exact: true }).click();
    await page.getByRole('button', { name: 'AI 설정', exact: true }).click();
    assert.equal((await page.evaluate(async () => window.chickadee.inspection({ run_id: (await window.chickadee.state()).run_id }))).agent.configured, false);
    await page.getByText('미등록', { exact: true }).waitFor();
    await page.getByRole('button', { name: '설정 적용', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'AI 연결 설정에서 선택한 제공자의 API 키를 입력하세요.' }).waitFor();
    await page.getByRole('button', { name: 'API 키 등록', exact: true }).click();
    await page.getByLabel('API 키', { exact: true }).fill('test_key_not_real');
    await page.getByRole('button', { name: '모델 및 사용 한도', exact: true }).click();
    await page.getByLabel('누적 토큰 한도', { exact: true }).fill('1000');
    await page.getByRole('button', { name: '설정 적용', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('input[aria-label="API 키"]'));
    await page.getByRole('button', { name: '일반', exact: true }).click();
    await page.getByRole('button', { name: 'AI 연결', exact: true }).click();
    await page.getByRole('button', { name: '설정 적용', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'AI 연결 설정을 적용했습니다.' }).waitFor();
    await page.getByRole('button', { name: '알림', exact: true }).click();
    await page.getByLabel('Slack 웹훅 URL', { exact: true }).waitFor();
    await page.getByRole('button', { name: '알림 설정 저장', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '알림 설정을 저장했습니다.' }).waitFor();
    await page.screenshot({ path: path.join(root, 'artifacts/notification-settings.png') });
    await page.getByRole('button', { name: '일반', exact: true }).click();
    await page.getByRole('button', { name: '천천히 다른 작업과 함께', exact: true }).click();
    await page.waitForFunction(async () => (await window.chickadee.state()).preferences.scanInterval === 5);
    assert.equal(await page.getByLabel('페이지 사이 대기 시간', { exact: true }).inputValue(), '5');
    await page.screenshot({ path: path.join(root, 'artifacts/scan-pace-settings.png') });
    await page.getByRole('button', { name: '업데이트', exact: true }).click();
    await page.getByRole('button', { name: '업데이트 확인', exact: true }).waitFor();
    if (!packaged) {
      await page.getByRole('button', { name: '업데이트 확인', exact: true }).click();
      await page.getByRole('status').filter({ hasText: '새로운 릴리스가 없습니다.' }).waitFor();
    }
    await page.screenshot({ path: path.join(root, 'artifacts/update-settings.png') });
    await page.getByRole('button', { name: '예약 검사', exact: true }).click();
    await page.getByRole('button', { name: '예약 추가', exact: true }).click();
    await page.getByLabel('예약 이름', { exact: true }).fill('매일 아침 점검');
    await page.getByRole('button', { name: '예약 저장', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '예약을 저장했습니다.' }).waitFor();
    assert.equal((await page.evaluate(() => window.chickadee.scheduleState())).items[0].time, '09:00');
    assert.equal((await page.evaluate(() => window.chickadee.scheduleState())).items[0].options.interval_sec, 5);
    await page.getByLabel('매일 아침 점검 예약 활성화', { exact: true }).click();
    await page.waitForFunction(async () => !(await window.chickadee.scheduleState()).items[0].enabled);
    await page.screenshot({ path: path.join(root, 'artifacts/schedule-settings.png') });
    await page.getByRole('button', { name: '매일 아침 점검 수정', exact: true }).click();
    await page.getByLabel('실행 시간', { exact: true }).fill('10:00');
    await page.getByRole('button', { name: '예약 저장', exact: true }).click();
    await page.waitForFunction(async () => (await window.chickadee.scheduleState()).items[0].time === '10:00');
    await page.getByRole('button', { name: '매일 아침 점검 삭제', exact: true }).click();
    await page.waitForFunction(async () => (await window.chickadee.scheduleState()).items.length === 0);
    await page.getByRole('button', { name: '일반', exact: true }).click();
    await page.getByLabel('최대 페이지', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Slack 웹훅 URL', { exact: true }).count(), 0);
    await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click();
    const insight = await page.evaluate(async () => {
      const state = await window.chickadee.state();
      return window.chickadee.inspection({ run_id: state.run_id });
    });
    assert.equal(await page.getByLabel('검토 영역', { exact: true }).count(), 0);
    await page.getByRole('button', { name: '전체 검토 시작', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '한도' }).waitFor();
    await page.getByText('검토 안내 및 사용량', { exact: true }).click();
    await page.getByRole('progressbar', { name: '요청 횟수', exact: true }).waitFor();
    await page.screenshot({ path: path.join(root, 'artifacts/ai-review-usage.png') });
    const stored = await fs.readFile(path.join(path.dirname(result), 'agent.json'), 'utf8');
    assert.ok(!stored.includes('test_key_not_real'));
    assert.equal(JSON.parse(stored).ledger.calls, 0);
    assert.deepEqual(await fs.readFile(result), raw);
    await page.getByRole('button', { name: '검사 기록', exact: true }).click();
    await page.locator('tbody tr').first().click();
    await page.getByRole('button', { name: '검사 분석', exact: true }).click();
    await page.getByRole('tab', { name: '탐색 그래프', exact: true }).click();
    await page.getByTestId('exploration-graph').waitFor();
    assert.equal(await page.getByRole('tab', { name: '변경 비교', exact: true }).count(), 0);
    await page.getByRole('button', { name: /^탐지 내역/ }).click();
    await page.locator('tbody tr').first().click();
    await page.getByAltText('검사 브라우저에서 촬영한 스크린샷', { exact: true }).first().waitFor();
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(JSON.stringify({ status: 'passed', mode: packaged ? 'electron-packaged' : 'source-ui-real-python', explorationGraph: true,
      comparisonRemoved: true, grokConfiguration: true,
      evidenceScreenshot: true, screenshotReload: true,
      budgetBlockedBeforeNetwork: true, immutableResult: true, secretNotPersisted: true, data }));
  } finally {
    if (app) await app.close();
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
