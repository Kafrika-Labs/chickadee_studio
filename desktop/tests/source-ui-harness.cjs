// Component integration driver: Chromium renders local UI, Python performs
// real scans over stdio. Native Electron dialogs/window launch are not tested.
const { chromium } = require("playwright");
const { Backend } = require("../electron/backend.cjs");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");

exports.launch = async ({ env }) => {
  const root = path.resolve(__dirname, "../..");
  const data = env.CHICKADEE_TEST_DATA;
  const { Notifications } = require('../electron/notifications.cjs');
  const notifications = new Notifications({ directory: data, safeStorage: { isAsyncEncryptionAvailable: async () => false }, supported: () => false });
  await notifications.load();
  const dist = path.join(root, "desktop/dist");
  await fs.mkdir(data, { recursive: true });
  let preferences = await fs
    .readFile(path.join(data, "preferences.json"), "utf8")
    .then(JSON.parse)
    .catch(() => ({}));
  let page,
    browser,
    closing = false,
    delivery = Promise.resolve();
  const outputRoot = path.join(data, "results");
  const dialog = {
    showSaveDialog: async () => ({ canceled: true }),
    showOpenDialog: async () => ({ canceled: true }),
  };
  const backend = new Backend(
    env.CHICKADEE_TEST_ENGINE || path.join(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python"),
    [...(env.CHICKADEE_TEST_ENGINE ? [] : ["-m", "chickadee.bridge"]), "--data-dir", data],
    { cwd: root, env: { ...env, PYTHONIOENCODING: "utf-8" } },
    (event) => {
      if (env.CHICKADEE_TEST_DROP_DONE === '1' && event.kind === 'done') return;
      if (!closing && page)
        delivery = delivery
          .then(() =>
            page.evaluate((value) => window.__sourceEvent?.(value), event),
          )
          .catch(() => {});
    },
  );
  const { Schedules } = require('../electron/schedules.cjs');
  const schedules = new Schedules({ directory: data, start: value => backend.request('start', { ...value, output_root: outputRoot }), busy: async () => (await backend.request('state')).running });
  await schedules.load();
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        dist,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(dist + path.sep)) throw new Error("outside root");
      const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
      };
      response.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      });
      response.end(await fs.readFile(file));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  // Some Windows hosts transiently reject loopback listen with EFAULT. Retry
  // server initialization only, before loading the UI or running assertions.
  for (let attempt = 0; ; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const failed = (error) => { server.off('listening', ready); reject(error); };
        const ready = () => { server.off('error', failed); resolve(); };
        server.once('error', failed); server.once('listening', ready);
        server.listen(0, '127.0.0.1');
      });
      break;
    } catch (error) {
      if (error.code !== 'EFAULT' || attempt === 4) { await backend.close(); throw error; }
      console.warn('Source UI server initialization retry:', error.code, attempt + 1);
      await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
  const origin = `http://127.0.0.1:${server.address().port}`;
  let updateStatus = 'idle';
  async function invoke(method, value) {
    if (method === 'reloadLanguage') {
      const language = env.CHICKADEE_LANGUAGE || preferences.language || 'ko';
      setTimeout(() => page.goto(origin + '?language=' + encodeURIComponent(language)).catch(() => {}), 0);
      return true;
    }
    if (method === 'exportReport') {
      const selected = await dialog.showSaveDialog();
      if (selected.canceled) return null;
      const state = await backend.request('state');
      const data = await backend.request('inspection', {run_id:state.run_id});
      await fs.writeFile(selected.filePath, data.review_report.html, 'utf8');
      return {saved:true};
    }
    if (method === 'checkUpdates') updateStatus = 'current';
    if (['checkUpdates', 'updateState'].includes(method)) return { current: require('../package.json').version, status: updateStatus };

    if (method === "scheduleState") return schedules.state();
    if (method === "saveSchedule") return schedules.save(value);
    if (method === "removeSchedule") return schedules.remove(value);
    if (method === "notificationState") return notifications.state();
    if (method === "saveNotifications") return notifications.save(value);
    if (method === "testNotification") return notifications.testDesktop();
    const extensions = { inspection: "inspection", configureAgent: "agent-configure", runAgent: "agent-run", stopAgent: "agent-stop",
      environment: "runtime-info", configureRuntime: "runtime-configure", testRuntime: "runtime-test", analyzeContent: "content-analyze" };
    if (extensions[method]) return backend.request(extensions[method], value || {});
    if (method === "state")
      return {
        ...(await backend.request("state")),
        outputRoot,
        preferences,
        workflow: await fs
          .readFile(path.join(data, "workflow.json"), "utf8")
          .then(JSON.parse)
          .catch(() => null),
      };
    if (method === "start")
      return backend.request("start", { ...value, output_root: outputRoot });
    if (["stop", "pause", "resume", "capabilities"].includes(method))
      return backend.request(method);
    if (method === "history") {
      const state = await backend.request("state");
      const item = state.history.find((record) => record.id === value);
      if (!item) throw new Error("검사 기록이 없습니다.");
      return backend.request("load", { path: item.path });
    }
    if (method === "load") {
      const selected = await dialog.showOpenDialog();
      return selected.canceled
        ? null
        : backend.request("load", { path: selected.filePaths[0] });
    }
    if (method === "exportCSV") {
      const selected = await dialog.showSaveDialog();
      return selected.canceled
        ? null
        : backend.request("export", { path: selected.filePath });
    }
    if (method === "review")
      return backend.request("review", { ...value, actor: "human" });
    if (method === "preferences") {
      preferences = { ...preferences, ...value };
      await fs.writeFile(
        path.join(data, "preferences.json"),
        JSON.stringify(preferences),
      );
      return preferences;
    }
    if (method === "saveWorkflow") {
      await fs.writeFile(
        path.join(data, "workflow.json"),
        JSON.stringify(value),
      );
      return true;
    }
    throw new Error("통합 검사에서 지원하지 않는 네이티브 동작: " + method);
  }
  async function close() {
    closing = true;
    await backend.close();
    await delivery;
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  try {
    browser = await chromium.launch({
      executablePath: env.CHICKADEE_PREVIEW_CHROMIUM,
      headless: true,
    });
    page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.route("**/*", (route) =>
      route
        .request()
        .url()
        .startsWith(origin + "/")
        ? route.continue()
        : route.abort(),
    );
    await page.exposeBinding("__sourceInvoke", (_source, method, value) =>
      invoke(method, value),
    );
    await page.addInitScript(() => {
      window.chickadee = Object.fromEntries(
        [
          "state",
          "start",
          "pause",
          "resume",
          "stop",
          "capabilities",
          "inspection", "configureAgent", "runAgent", "stopAgent", "environment", "configureRuntime", "testRuntime", "analyzeContent", "notificationState", "saveNotifications", "testNotification", "scheduleState", "saveSchedule", "removeSchedule",
          "updateState", "checkUpdates", "downloadUpdate", "showUpdateFile", "openReleaseNotes",
          "preferences", "reloadLanguage",
          "history",
          "load",
          "exportCSV",
          "exportReport",
          "review",
          "saveWorkflow",
          "exportWorkflow",
          "loadWorkflow",
          "copy",
          "openFolder",
          "chooseFolder",
        ].map((method) => [
          method,
          (value) => window.__sourceInvoke(method, value),
        ]),
      );
      window.chickadee.language = new URLSearchParams(location.search).get('language') || 'ko';
      window.chickadee.onEvent = (callback) => {
        window.__sourceEvents ||= new Set();
        window.__sourceEvents.add(callback);
        window.__sourceEvent = (event) => window.__sourceEvents.forEach((listener) => listener(event));
        return () => {
          window.__sourceEvents.delete(callback);
        };
      };
    });
    await page.goto(origin + '?language=' + encodeURIComponent(env.CHICKADEE_LANGUAGE || preferences.language || 'ko'));
    return {
      firstWindow: async () => page,
      evaluate: async (callback, value) => callback({ dialog }, value),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
};
