const { spawn } = require("node:child_process");
const readline = require("node:readline");
const { t } = require("./i18n.cjs");
class Backend {
  constructor(executable, args, options, onEvent) {
    this.pending = new Map();
    this.sequence = 0;
    this.stderr = "";
    this.child = spawn(executable, args, {
      ...options,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdin.on("error", () => {});
    readline
      .createInterface({ input: this.child.stdout })
      .on("line", (line) => {
        try {
          const message = JSON.parse(line);
          if (message.event) onEvent(message.event);
          else {
            const request = this.pending.get(message.id);
            if (!request) return;
            clearTimeout(request.timer);
            this.pending.delete(message.id);
            if (message.error) request.reject(new Error(message.error));
            else request.resolve(message.result);
          }
        } catch (error) {
          onEvent({
            kind: "error",
            message: t("엔진 응답을 읽지 못했습니다: {error}", { error: error.message }),
          });
        }
      });
    this.child.stderr.on("data", (data) => {
      this.stderr = (this.stderr + data.toString("utf8")).slice(-12000);
    });
    const fail = (message) => {
      for (const request of this.pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error(message));
      }
      this.pending.clear();
      if (!this.closing) onEvent({ kind: "error", message });
    };
    this.child.on("error", (error) =>
      fail(t("검사 엔진을 시작하지 못했습니다: {error}", { error: error.message })),
    );
    this.child.on("exit", (code) =>
      fail(t("검사 엔진 종료 ({code}). {stderr}", { code, stderr: this.stderr.slice(-1200) })),
    );
  }
  request(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.child.stdin.writable)
        return reject(new Error(t("검사 엔진에 연결되지 않았습니다.")));
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(t("엔진 응답 시간이 초과되었습니다.")));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  async close() {
    this.closing = true;
    if (this.child.exitCode !== null) return;
    try {
      await this.request("stop");
    } catch (_) {}
    this.child.stdin.end();
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.child.kill();
        resolve();
      }, 10000);
      this.child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
module.exports = { Backend };
