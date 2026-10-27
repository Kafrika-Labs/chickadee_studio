const { t } = require('./i18n.cjs');
// Retain native objects and report Electron delivery events to the caller.
function createNotifier(Notification, getWindow, timeoutMs = 6000) {
  const active = new Set();
  return (title, body, silent) => new Promise((resolve, reject) => {
    const notification = new Notification({ title, body, silent });
    active.add(notification);
    let settled = false;
    const release = setTimeout(() => active.delete(notification), 60000);
    release.unref?.();
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) { clearTimeout(release); active.delete(notification); reject(error); }
      else resolve(value);
    };
    const timer = setTimeout(() => finish(null, { requested: true, confirmed: false }), timeoutMs);
    notification.once('show', () => finish(null, { requested: true, confirmed: true }));
    notification.once('failed', () => finish(new Error(t("운영체제에서 알림을 표시하지 못했습니다. 시스템 알림 설정에서 Chickadee 허용 여부를 확인하세요."))));
    notification.once('close', () => { clearTimeout(release); active.delete(notification); });
    notification.on('click', () => { const window = getWindow(); if (window && !window.isDestroyed()) { window.show(); window.focus(); } });
    try { notification.show(); } catch { finish(new Error(t("시스템 알림 요청에 실패했습니다. 앱을 재시작하고 알림 권한을 확인하세요."))); }
  });
}
module.exports = { createNotifier };
