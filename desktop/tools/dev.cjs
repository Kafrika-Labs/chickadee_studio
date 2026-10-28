// Local component development: real Python backend, no public HTTP backend API.
// This does not launch or replace the organization's pinned Electron runtime.
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {launch} = require('../tests/source-ui-harness.cjs');

const desktop = path.resolve(__dirname, '..');
const root = path.dirname(desktop);
const headless = process.argv.includes('--headless');
const dataArgument = process.argv.find(arg => arg.startsWith('--data-dir='));
const data = dataArgument ? path.resolve(dataArgument.slice(11)) : path.join(root, 'artifacts/dev-session');
const env = {...process.env, CHICKADEE_TEST_DATA: data, PYTHONIOENCODING: 'utf-8'};
delete env.ELECTRON_RUN_AS_NODE;
const browsers = path.join(root, '.venv/Lib/site-packages/playwright/driver/package/.local-browsers');
if (!env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(browsers)) env.PLAYWRIGHT_BROWSERS_PATH = browsers;
// Reuse an existing isolated source-model environment; never install or fetch
// weights or read a credential file as a side effect of opening the UI.
const layaPython = path.join(root, 'artifacts/laya-venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const model = path.join(root, 'artifacts/laya-model');
if (!env.CHICKADEE_LAYA_CONFIG && !env.CHICKADEE_LAYA_WORKER && !env.CHICKADEE_LAYA_PYTHON && fs.existsSync(layaPython)) {
  env.CHICKADEE_LAYA_PYTHON = layaPython;
}
if (!env.CHICKADEE_LAYA_CONFIG && !env.CHICKADEE_LAYA_MODEL_DIR && fs.existsSync(path.join(model, 'manifest.json'))) {
  env.CHICKADEE_LAYA_MODEL_DIR = model;
}
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
let app, page, watcher, closing = false, pendingReload = false, interval;
let queue = Promise.resolve();

async function stop(code = 0) {
  if (closing) return;
  closing = true;
  clearInterval(interval);
  watcher?.kill();
  if (app) await app.close().catch(error => console.error('Preview close:', error.message));
  process.exitCode = code;
  console.log('DEV_STOPPED');
}

async function reload() {
  if (closing || !page || page.isClosed()) return;
  const state = await page.evaluate(() => window.chickadee.state());
  if (state.running) {
    if (!pendingReload) console.log('Build ready; refresh deferred until the current scan finishes.');
    pendingReload = true;
    return;
  }
  pendingReload = false;
  await page.reload({waitUntil: 'domcontentloaded'});
  console.log('DEV_RELOADED');
}

function built() {
  queue = queue.then(async () => {
    if (closing) return;
    if (app) return reload();
    const opened = await launch({env, headless, channel: process.platform === 'win32' ? 'msedge' : undefined, chromiumSandbox: true, browserClipboard:true});
    if (closing) { await opened.close(); return; }
    app = opened;
    page = await app.firstWindow();
    page.once('close', () => stop());
    await page.waitForFunction(() => window.chickadee?.state);
    const state = await page.evaluate(() => window.chickadee.state());
    console.log('DEV_READY '+JSON.stringify({mode:'browser-development-real-python',headless,url:app.url,version:state.version,dataDirectory:data}));
  }).catch(async error => {console.error(error.stack || error.message); await stop(1);});
}

console.log('Chickadee local development: browser UI + real Python scanner.');
console.log('Save UI source files to rebuild. Refresh waits for active scans to finish.');
console.log('Restart this development window after changing Python backend code.');
console.log('Native file dialogs, OS notifications and login windows require the Electron app.');
console.log('No API key is loaded automatically. Close the development window or press Ctrl+C to stop.');
watcher = spawn(process.execPath, [vite, 'build', '--watch'], {cwd:desktop, env, stdio:['ignore','pipe','pipe'],windowsHide:true});
let output = '';
watcher.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  output += chunk.toString().replace(/\x1b\[[0-9;]*m/g, '');
  let end;
  while ((end = output.indexOf('\n')) !== -1) {
    const line = output.slice(0, end); output = output.slice(end + 1);
    if (/\bbuilt in\b/.test(line)) built();
  }
});
watcher.stderr.on('data', chunk => process.stderr.write(chunk));
watcher.once('error', async error => {console.error(error.message); await stop(1);});
watcher.once('exit', code => {if (!closing) stop(code || 1);});
interval = setInterval(() => {if (pendingReload && !closing) queue = queue.then(reload).catch(async error=>{console.error(error.message);await stop(1);});}, 1500);
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
// An optional private stdin control is useful for a development smoke check;
// it is not a network endpoint and carries no application credentials.
if (process.argv.includes('--control')) {
  const lines = require('node:readline').createInterface({input:process.stdin});
  lines.on('line', line => {if (line.trim() === 'stop') {lines.close();stop();}});
}
