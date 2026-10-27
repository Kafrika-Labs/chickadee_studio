const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  clipboard,
  screen,
  Notification,
  safeStorage,
  session,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { fileURLToPath } = require("node:url");
const { createNotifier } = require("./native-notification.cjs");
const { Notifications } = require("./notifications.cjs");
const { Updates } = require("./updates.cjs");
const { Schedules } = require("./schedules.cjs");
const { LoginWindow } = require("./login.cjs");
let loginWindow;
let notifications, activeNotificationRun, schedules;
const { Backend } = require("./backend.cjs");
const { LANGUAGES, setLanguage, language, t } = require("./i18n.cjs");
let window,
  backend,
  outputRoot,
  currentPath,
  closing = false;
let preferences = {};
let preferenceWrites = Promise.resolve();
app.setName("Chickadee");
app.setAppUserModelId("org.chickadee.inspector");
// A branded development executable is still launched through Electron default_app.
const isPackaged = app.isPackaged && !process.defaultApp;
const root = path.resolve(__dirname, "../..");
const smoke = process.env.CHICKADEE_TEST_DATA;
if (smoke) app.setPath("userData", smoke);
const page = path.resolve(__dirname, "../dist/index.html");
const workflowPath = () => path.join(app.getPath("userData"), "workflow.json");
const preferencesPath = () =>
  path.join(app.getPath("userData"), "preferences.json");
function savePreferences(value, folder) {
  const saved = preferenceWrites.then(() => writePreferences(value, folder));
  preferenceWrites = saved.catch(() => {});
  return saved;
}
async function writePreferences(value, folder) {
  const next = { ...preferences };
  if (value && Object.hasOwn(value, "shortcuts")) {
    const { validateShortcuts } = await import("../src/shortcuts.mjs");
    next.shortcuts = validateShortcuts(value.shortcuts);
  }
  if (folder !== undefined) next.outputRoot = folder;
  if (!value || typeof value !== "object")
    throw new Error(t("설정 형식이 올바르지 않습니다."));
  for (const key of [
    "url",
    "maxPages",
    "timeout",
    "profile",
    "livePreview",
    "scanInterval",
    "language",
  ]) {
    if (!Object.hasOwn(value, key)) continue;
    const entry = value[key];
    const valid =
      key === "url"
        ? typeof entry === "string" && entry.length <= 4096
        : key === "maxPages"
          ? Number.isInteger(entry) && entry >= 1 && entry <= 10000
          : key === "timeout"
            ? Number.isFinite(entry) && entry > 0 && entry <= 1800
            : key === "scanInterval"
              ? Number.isFinite(entry) && entry >= 0 && entry <= 30
              : key === "profile"
                ? ["default", "test", "public"].includes(entry)
                : key === "language"
                  ? LANGUAGES.includes(entry)
                  : typeof entry === "boolean";
    if (!valid) throw new Error(t("검사 설정 값이 올바르지 않습니다."));
    next[key] = entry;
  }
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  const temporary = preferencesPath() + ".tmp";
  await fs.writeFile(temporary, JSON.stringify(next, null, 2), "utf8");
  await fs.rename(temporary, preferencesPath());
  preferences = next;
  setLanguage(preferences.language);
  return preferences;
}
function authorize(event) {
  try {
    if (
      event.senderFrame !== window.webContents.mainFrame ||
      fileURLToPath(event.senderFrame.url) !== page
    )
      throw new Error();
  } catch (_) {
    throw new Error(t("허용되지 않은 앱 요청입니다."));
  }
}
function handler(name, callback) {
  ipcMain.handle("desktop:" + name, (event, ...args) => {
    authorize(event);
    return callback(...args);
  });
}
// Read synchronously by the preload so the first render already uses the saved language.
ipcMain.on("desktop:language", (event) => {
  event.returnValue = language();
});
async function initialize() {
  let restarting = false;
  handler("restart", async () => {
    if (restarting) return;
    const state = await backend.request("state");
    const agent = await backend.request("agent-status");
    if (state.running || agent.running)
      throw new Error(t("진행 중인 검사·AI 검토를 중단한 뒤 재실행하세요."));
    if (restarting) return;
    restarting = true;
    try {
      await preferenceWrites;
      app.relaunch();
      app.quit();
    } catch (error) {
      restarting = false;
      throw error;
    }
  });
  handler("open-external", async (value) => {
    if (typeof value !== "string" || value.length > 8192)
      throw new Error(t("잘못된 주소입니다."));
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error(t("웹 주소만 열 수 있습니다."));
    await shell.openExternal(url.href);
  });
  notifications = new Notifications({
    directory: app.getPath("userData"),
    safeStorage,
    supported: () => Notification.isSupported(),
    focused: () => Boolean(window?.isFocused()),
    notify: createNotifier(Notification, () => window),
  });
  await notifications.load();
  handler("notification-state", () => notifications.state());
  handler("notification-save", (value) => notifications.save(value));
  handler("notification-test", () => notifications.testDesktop());
  handler("notification-system-settings", async () => {
    const target =
      process.platform === "darwin"
        ? "x-apple.systempreferences:com.apple.Notifications-Settings.extension"
        : process.platform === "win32"
          ? "ms-settings:notifications"
          : null;
    if (!target) throw new Error(t("운영체제 설정에서 알림을 확인하세요."));
    await shell.openExternal(target);
  });
  preferences = await fs
    .readFile(preferencesPath(), "utf8")
    .then(JSON.parse)
    .catch(() => ({}));
  if (
    !preferences ||
    typeof preferences !== "object" ||
    Array.isArray(preferences)
  )
    preferences = {};
  setLanguage(preferences.language);
  outputRoot = path.join(app.getPath("documents"), "Chickadee", "results");
  if (
    typeof preferences.outputRoot === "string" &&
    path.isAbsolute(preferences.outputRoot)
  )
    outputRoot = preferences.outputRoot;
  if (smoke) outputRoot = path.join(smoke, "results");
  const area = screen.getPrimaryDisplay().workAreaSize;
  // Windows Shell cannot read icons inside app.asar. Keep a real ICO available
  // for taskbar pinning, including the unmodified compatibility runtime.
  const appIcon = isPackaged
    ? path.join(process.resourcesPath, "chickadee.ico")
    : path.join(__dirname, "../assets/app.ico");
  window = new BrowserWindow({
    show: false,
    width: Math.min(1530, area.width - 24),
    height: Math.min(990, area.height - 24),
    minWidth: Math.min(1120, area.width - 24),
    minHeight: Math.min(700, area.height - 24),
    backgroundColor: "#f2f4f6",
    title: "Chickadee",
    icon: path.join(__dirname, "../assets/app-mark.png"),
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#242426", symbolColor: "#c9c9cf", height: 40 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  if (process.platform === "win32") {
    window.setAppDetails({
      appId: "org.chickadee.inspector",
      appIconPath: appIcon,
      appIconIndex: 0,
      relaunchCommand: isPackaged
        ? `"${process.execPath}"`
        : `"${process.execPath}" "${app.getAppPath()}"`,
      relaunchDisplayName: "Chickadee",
    });
  }
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  let executable = isPackaged
    ? path.join(
        process.resourcesPath,
        "engine",
        process.platform === "win32"
          ? "ChickadeeEngine.exe"
          : "ChickadeeEngine",
      )
    : process.platform === "win32"
      ? path.join(root, ".venv", "Scripts", "python.exe")
      : path.join(root, ".venv", "bin", "python");
  let args = isPackaged
    ? ["--data-dir", app.getPath("userData")]
    : ["-m", "chickadee.bridge", "--data-dir", app.getPath("userData")];
  if (!isPackaged && process.platform === "darwin") {
    args = [
      process.arch === "arm64" ? "-arm64" : "-x86_64",
      executable,
      ...args,
    ];
    executable = "/usr/bin/arch";
  }
  const notifyLogin = createNotifier(Notification, () => window);
  backend = new Backend(
    executable,
    args,
    {
      cwd: isPackaged ? process.resourcesPath : root,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        CHICKADEE_LAYA_CONFIG:
          process.env.CHICKADEE_LAYA_CONFIG ||
          path.join(app.getPath("userData"), "laya.json"),
        ...(isPackaged
          ? {
              CHICKADEE_LAYA_MODEL_DIR:
                process.env.CHICKADEE_LAYA_MODEL_DIR ||
                path.join(process.resourcesPath, "laya-model"),
              CHICKADEE_LAYA_WORKER:
                process.env.CHICKADEE_LAYA_WORKER ||
                path.join(
                  process.resourcesPath,
                  "laya",
                  process.platform === "win32"
                    ? "ChickadeeLaya.exe"
                    : "ChickadeeLaya",
                ),
            }
          : {}),
      },
    },
    (event) => {
      if (event.kind === "login_required" && Notification.isSupported()) {
        notifyLogin(
          t("Chickadee · 로그인 필요"),
          t("검사를 일시 중지했습니다. 앱에서 로그인 창을 열어 주세요."),
          false,
        ).catch(() => {});
      }
      if (["done", "login_finished"].includes(event.kind))
        loginWindow?.close(event.request_id).catch(() => {});
      if (event.kind === "started") activeNotificationRun = event.run_id;
      if (event.kind === "done") currentPath = event.path;
      if (
        event.kind === "done" ||
        (event.kind === "error" && activeNotificationRun)
      ) {
        const reportEvent =
          event.kind === "done"
            ? event
            : { run_id: activeNotificationRun, report: { status: "failed" } };
        activeNotificationRun = null;
        notifications.completed(reportEvent).catch(() => {});
      }
      if (window && !window.isDestroyed())
        window.webContents.send("desktop:event", event);
    },
  );
  loginWindow = new LoginWindow({
    BrowserWindow,
    session,
    backend,
    owner: () => window,
  });
  handler("login-open", (requestId) => loginWindow.open(requestId));
  handler("login-complete", (requestId) => loginWindow.complete(requestId));
  handler("login-skip", (requestId) => loginWindow.complete(requestId, true));
  const updates = new Updates({
    current: require("../package.json").version,
    directory: path.join(app.getPath("userData"), "updates"),
    reveal: (file) => shell.showItemInFolder(file),
  });
  handler("update-state", () => updates.getState());
  handler("update-check", () => updates.check());
  handler("update-download", () => updates.download());
  handler("update-show", () => updates.showFile());
  handler("update-notes", () => shell.openExternal(updates.notesURL()));
  handler("state", async () => ({
    ...(await backend.request("state")),
    outputRoot,
    preferences,
    workflow: await fs
      .readFile(workflowPath(), "utf8")
      .then(JSON.parse)
      .catch(() => null),
  }));
  const startScan = async (options) => {
    if (!options || typeof options !== "object")
      throw new Error(t("검사 설정이 필요합니다."));
    const keys = [
      "url",
      "max_pages",
      "timeout_sec",
      "settle_ms",
      "interval_sec",
      "profile",
      "preview",
      "demo",
      "workflow",
    ];
    const clean = Object.fromEntries(
      keys
        .filter((key) => Object.hasOwn(options, key))
        .map((key) => [key, options[key]]),
    );
    currentPath = null;
    return backend.request("start", { ...clean, output_root: outputRoot });
  };
  schedules = new Schedules({
    directory: app.getPath("userData"),
    start: startScan,
    busy: async () => {
      const state = await backend.request("state");
      return state.running || (await backend.request("agent-status")).running;
    },
  });
  await schedules.load();
  handler("schedule-state", () => schedules.state());
  handler("schedule-save", (value) => schedules.save(value));
  handler("schedule-remove", (id) => schedules.remove(id));
  handler("start", startScan);
  handler("stop", () => backend.request("stop"));
  handler("pause", () => backend.request("pause"));
  handler("resume", () => backend.request("resume"));
  handler("capabilities", () => backend.request("capabilities"));
  for (const name of [
    "inspection",
    "agent-configure",
    "agent-run",
    "agent-stop",
    "runtime-info",
    "runtime-configure",
    "runtime-test",
    "content-analyze",
  ]) {
    handler(name, (value) => backend.request(name, value || {}));
  }
  handler("preferences", (value) => savePreferences(value));
  handler("reload-language", async () => {
    await preferenceWrites;
    setImmediate(() => window.webContents.reload());
  });
  handler("review", (value) => {
    if (!value || typeof value !== "object")
      throw new Error(t("검토 항목이 필요합니다."));
    const { ids, status, note, expected_revision } = value;
    return backend.request("review", {
      ids,
      status,
      note,
      expected_revision,
      actor: "human",
    });
  });
  handler("load", async () => {
    const selected = await dialog.showOpenDialog(window, {
      title: t("검사 결과 불러오기"),
      filters: [{ name: "result.json", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (selected.canceled) return null;
    const value = await backend.request("load", {
      path: selected.filePaths[0],
    });
    currentPath = value.path;
    return value;
  });
  handler("history", async (id) => {
    const state = await backend.request("state");
    const entry = state.history.find((item) => item.id === id);
    if (!entry) throw new Error(t("검사 기록을 찾을 수 없습니다."));
    const value = await backend.request("load", { path: entry.path });
    currentPath = value.path;
    return value;
  });
  handler("export", async () => {
    const selected = await dialog.showSaveDialog(window, {
      defaultPath: "chickadee-results.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (selected.canceled) return null;
    return backend.request("export", { path: selected.filePath });
  });
  handler("export-report", async () => {
    const state = await backend.request("state");
    if (state.running || !state.run_id)
      throw new Error(t("검사 완료 후 리포트를 저장하세요."));
    const data = await backend.request("inspection", { run_id: state.run_id });
    if (!data.review_report?.html) throw new Error(t("저장할 리포트가 없습니다."));
    const selected = await dialog.showSaveDialog(window, {
      defaultPath: "chickadee-review.html",
      filters: [{ name: t("HTML 리포트"), extensions: ["html"] }],
    });
    if (selected.canceled) return null;
    await fs.writeFile(selected.filePath, data.review_report.html, "utf8");
    return { saved: true };
  });
  handler("choose-folder", async () => {
    const selected = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (!selected.canceled) {
      outputRoot = selected.filePaths[0];
      await savePreferences({}, outputRoot);
    }
    return outputRoot;
  });
  handler("open-folder", async () => {
    const folder = currentPath ? path.dirname(currentPath) : outputRoot;
    await fs.mkdir(folder, { recursive: true });
    return shell.openPath(folder);
  });
  handler("copy", (text) => {
    if (typeof text !== "string" || text.length > 1000000)
      throw new Error(t("복사할 내용이 너무 큽니다."));
    clipboard.writeText(text);
  });
  handler("save-workflow", async (value) => {
    if (
      !value ||
      typeof value !== "object" ||
      JSON.stringify(value).length > 100000
    )
      throw new Error(t("워크플로 형식이 올바르지 않습니다."));
    await fs.mkdir(path.dirname(workflowPath()), { recursive: true });
    const temporary = workflowPath() + ".tmp";
    await fs.writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
    await fs.rename(temporary, workflowPath());
    return true;
  });
  handler("export-workflow", async (value) => {
    if (
      !value ||
      typeof value !== "object" ||
      JSON.stringify(value).length > 100000
    )
      throw new Error(t("구성 형식이 올바르지 않습니다."));
    const selected = await dialog.showSaveDialog(window, {
      defaultPath: "chickadee-workflow.json",
      filters: [{ name: t("검사 구성"), extensions: ["json"] }],
    });
    if (selected.canceled) return null;
    await fs.writeFile(
      selected.filePath,
      JSON.stringify(value, null, 2),
      "utf8",
    );
    return { path: selected.filePath };
  });
  handler("load-workflow", async () => {
    const selected = await dialog.showOpenDialog(window, {
      title: t("워크플로 JSON 불러오기"),
      filters: [{ name: "Workflow", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (selected.canceled) return null;
    const stat = await fs.stat(selected.filePaths[0]);
    if (stat.size > 100000)
      throw new Error(t("워크플로는 100KB 이하여야 합니다."));
    return JSON.parse(await fs.readFile(selected.filePaths[0], "utf8"));
  });
  window.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && !isPackaged) {
      window.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
  await window.loadFile(page);
  window.show();
  try {
    const { startupGroqConfig } = require("./groq-env.cjs");
    const config = await startupGroqConfig(process.argv);
    if (config) await backend.request("agent-configure", config);
  } catch {
    // Invalid optional configuration must never block the core app window.
    dialog
      .showMessageBox(window, {
        type: "warning",
        title: t("Groq 설정 파일"),
        message:
          t("지정한 파일의 GROQ_API_KEY를 확인하세요. 기본 OCR·ML 검사는 계속 사용할 수 있습니다."),
      })
      .catch(() => {});
  }
  schedules.activate();
}
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      window.show();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(() => {
      if (process.platform === "darwin") {
        app.dock.setIcon(path.join(__dirname, "../assets/app-mark.png"));
      }
      return initialize();
    })
    .catch((error) => {
      console.error("Chickadee startup failed:", error);
      dialog.showErrorBox("Chickadee", error.message);
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (backend && !closing) {
      event.preventDefault();
      closing = true;
      schedules?.close();
      backend.close().finally(() => app.quit());
    }
  });
}
