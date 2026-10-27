// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const root = path.resolve(__dirname, '../..');
  const { defaultWorkflow } = await import(pathToFileURL(path.join(root, 'desktop/src/workflow.mjs')));
  const env = { ...process.env, CHICKADEE_TEST_DATA: path.join(root, 'artifacts', `flow-reload-${Date.now()}`) };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'desktop')], env });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '사용 가이드 닫기', exact: true }).click();
    const workflow = defaultWorkflow();
    await page.evaluate(value => window.chickadee.saveWorkflow(value), workflow);
    for (let i = 0; i < 8; i++) {
      await page.reload();
      await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge-path').length === 6);
      const paths = await page.locator('.react-flow__edge-path').evaluateAll(elements => elements.map(el => el.getAttribute('d')));
      assert(paths.every(d => d && !/NaN|undefined/.test(d)), 'All restored edges must have valid geometry');
    }
    // Deliberate disconnections must remain disconnected after reload.
    workflow.edges = workflow.edges.filter(edge => edge.target !== 'candidates');
    await page.evaluate(value => window.chickadee.saveWorkflow(value), workflow);
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__edge-path').length === 5);
    assert.equal(await page.locator('.react-flow__edge[data-id="collector-candidates"]').count(), 0);
    console.log('PASS: eight reloads retain all edges; intentional disconnection preserved');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exit(1); });
