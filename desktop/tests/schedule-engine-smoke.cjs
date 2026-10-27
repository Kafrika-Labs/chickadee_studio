// Local-only scheduled scan through the real Python backend; no webhooks or AI.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const { Schedules } = require('../electron/schedules.cjs');
const { Backend } = require('../electron/backend.cjs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');
const http = require('node:http');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '../..');
  const directory = path.join(root, 'artifacts', 'schedule-engine-' + Date.now());
  const { defaultWorkflow } = await import(pathToFileURL(path.join(root, 'desktop/src/workflow.mjs')));
  await fs.mkdir(directory, { recursive: true });
  const server = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<p>예약 검사 로컬 테스트</p>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let finish;
  const completed = new Promise(resolve => { finish = resolve; });
  const backend = new Backend(path.join(root, '.venv/bin/python'), ['-m', 'chickadee.bridge', '--data-dir', directory], { cwd: root, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }, event => { if (['done', 'error'].includes(event.kind)) finish(event); });
  let clock = +new Date(2026, 9, 21, 8, 59), timeout;
  try {
    const schedules = new Schedules({ directory, now: () => clock, busy: async () => (await backend.request('state')).running, start: options => backend.request('start', { ...options, output_root: directory }) });
    await schedules.load();
    await schedules.save({ name: 'Local scheduled scan', enabled: true, repeat: 'once', date: '2026-10-21', time: '09:00', days: [], options: { url: `http://127.0.0.1:${server.address().port}/`, max_pages: 1, timeout_sec: 30, profile: 'default', preview: false, workflow: defaultWorkflow() } });
    clock = +new Date(2026, 9, 21, 9); await schedules.tick();
    const event = await Promise.race([completed, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Scheduled scan timed out')), 60000); })]);
    assert.equal(event.kind, 'done'); assert.equal(event.report.pages_scanned.length, 1);
    await schedules.tick(); assert.equal((await backend.request('state')).history.length, 1);
    assert.equal(schedules.state().items[0].enabled, false);
    console.log(JSON.stringify({ status: 'passed', scheduledRealScan: true, onceOnly: true, directory }));
  } finally { clearTimeout(timeout); await backend.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
