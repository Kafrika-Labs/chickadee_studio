const { contextBridge, ipcRenderer } = require("electron");
async function invoke(channel, ...args) {
  try {
    return await ipcRenderer.invoke(channel, ...args);
  } catch (error) {
    throw new Error(
      error.message.replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        "",
      ),
    );
  }
}
contextBridge.exposeInMainWorld(
  "chickadee",
  Object.freeze({
    language: ipcRenderer.sendSync("desktop:language"),
    reloadLanguage: () => invoke("desktop:reload-language"),
    openLogin: requestId => invoke("desktop:login-open", requestId),
    completeLogin: requestId => invoke("desktop:login-complete", requestId),
    skipLogin: requestId => invoke("desktop:login-skip", requestId),
    restart: () => invoke("desktop:restart"),
    updateState: () => invoke("desktop:update-state"),
    checkUpdates: () => invoke("desktop:update-check"),
    downloadUpdate: () => invoke("desktop:update-download"),
    showUpdateFile: () => invoke("desktop:update-show"),
    openReleaseNotes: () => invoke("desktop:update-notes"),
    scheduleState: () => invoke("desktop:schedule-state"),
    saveSchedule: (value) => invoke("desktop:schedule-save", value),
    removeSchedule: (id) => invoke("desktop:schedule-remove", id),
    notificationState: () => invoke("desktop:notification-state"),
    saveNotifications: (value) => invoke("desktop:notification-save", value),
    openNotificationSettings: () => invoke("desktop:notification-system-settings"),
    testNotification: () => invoke("desktop:notification-test"),
    state: () => invoke("desktop:state"),
    start: (options) => invoke("desktop:start", options),
    stop: () => invoke("desktop:stop"),
    pause: () => invoke("desktop:pause"),
    resume: () => invoke("desktop:resume"),
    capabilities: () => invoke("desktop:capabilities"),
    inspection: (value) => invoke("desktop:inspection", value),
    environment: () => invoke("desktop:runtime-info"),
    configureRuntime: (value) => invoke("desktop:runtime-configure", value),
    testRuntime: () => invoke("desktop:runtime-test"),
    analyzeContent: (value) => invoke("desktop:content-analyze", value),
    configureAgent: (value) => invoke("desktop:agent-configure", value),
    runAgent: (value) => invoke("desktop:agent-run", value),
    stopAgent: () => invoke("desktop:agent-stop"),
    preferences: (value) => invoke("desktop:preferences", value),
    review: (value) => invoke("desktop:review", value),
    load: () => invoke("desktop:load"),
    history: (id) => invoke("desktop:history", id),
    exportCSV: () => invoke("desktop:export"),
    exportReport: () => invoke("desktop:export-report"),
    chooseFolder: () => invoke("desktop:choose-folder"),
    openFolder: () => invoke("desktop:open-folder"),
    saveWorkflow: (value) => invoke("desktop:save-workflow", value),
    exportWorkflow: (value) => invoke("desktop:export-workflow", value),
    loadWorkflow: () => invoke("desktop:load-workflow"),
    openExternal: (url) => invoke("desktop:open-external", url),
    copy: (text) => invoke("desktop:copy", text),
    onEvent: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on("desktop:event", listener);
      return () => ipcRenderer.removeListener("desktop:event", listener);
    },
  }),
);
