// Browser-only visual QA of local UI files and saved synthetic evidence.
// Does not launch Chickadee.exe, its engine, or any inspected website.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");

(async () => {
  const root = path.resolve(__dirname, "../..");
  const dist = path.join(root, "desktop/dist");
  const fixture = process.env.CHICKADEE_PREVIEW_DATA;
  if (!fixture)
    throw new Error(
      "Set CHICKADEE_PREVIEW_DATA to a saved local-demo test folder.",
    );
  const history = JSON.parse(
    await fs.readFile(path.join(fixture, "history.json"), "utf8"),
  );
  const folder = path.dirname(history[0].path);
  const result = JSON.parse(
    await fs.readFile(path.join(folder, "result.json"), "utf8"),
  );
  const report = JSON.parse(
    await fs.readFile(path.join(folder, "scan-report.json"), "utf8"),
  );
  assert.equal(report.desktop_options?.demo, true);
  const previewMeta = JSON.parse(
    await fs.readFile(path.join(folder, "last-preview.json"), "utf8"),
  );
  const preview = {
    ...previewMeta,
    data_url:
      "data:image/jpeg;base64," +
      (await fs.readFile(path.join(folder, "last-preview.jpg"))).toString(
        "base64",
      ),
  };
  const events = (await fs.readFile(path.join(folder, "events.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  const reviews = await fs
    .readFile(path.join(folder, "review.json"), "utf8")
    .then(JSON.parse)
    .catch(() => ({ revision: 0, items: {} }));
  const outcome = {
    kind: "done",
    result,
    report,
    events,
    reviews,
    preview,
    history,
    path: history[0].path,
  };
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        dist,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(dist + path.sep))
        throw new Error("outside static root");
      const types = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".png": "image/png",
        ".woff2": "font/woff2",
      };
      response.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
      });
      response.end(await fs.readFile(file));
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHICKADEE_PREVIEW_CHROMIUM,
      headless: true,
    });
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) =>
      route
        .request()
        .url()
        .startsWith(origin + "/")
        ? route.continue()
        : route.abort(),
    );
    await page.addInitScript(
      ({ history, outcome }) => {
        const unavailable = async () => {
          throw new Error(
            "디자인 미리보기에서는 검사와 파일 저장을 실행하지 않습니다.",
          );
        };
        window.chickadee = {
          language: "ko",
          state: async () => ({
            history,
            preview_only: true,
            outputRoot: "문서/Chickadee/results",
            workflow: outcome.report.workflow,
          }),
          capabilities: async () => ({ protocol_version: 1, tools: [] }),
          preferences: async () => ({}),
          onEvent: (callback) => {
            window.__showPreview = () => callback(outcome);
            return () => {};
          },
          start: unavailable,
          stop: unavailable,
          pause: unavailable,
          resume: unavailable,
          exportCSV: unavailable,
          load: unavailable,
          review: unavailable,
          chooseFolder: unavailable,
          openFolder: unavailable,
          copy: unavailable,
          saveWorkflow: unavailable,
          exportWorkflow: unavailable,
          loadWorkflow: unavailable,
          history: async () => outcome,
        };
      },
      { history, outcome },
    );
    await page.goto(origin);
    await page.locator(".react-flow__node").first().waitFor();
    await page.evaluate(() => window.__showPreview());
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(root, "artifacts/studio-design-workflow.png"),
    });
    await page.getByRole("button", { name: /^탐지 내역/ }).click();
    await page.locator("tbody tr").first().click();
    await page.screenshot({
      path: path.join(root, "artifacts/studio-design-results.png"),
    });
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "빠른 명령" }).waitFor();
    await page.screenshot({
      path: path.join(root, "artifacts/studio-design-command.png"),
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("button", { name: "검사 구성", exact: true }).click();
    await page.screenshot({
      path: path.join(root, "artifacts/studio-design-1280.png"),
    });
    const bounds = await page.locator(".monitor-panel").boundingBox();
    assert.ok(
      bounds.x + bounds.width <= 1280 && bounds.y + bounds.height <= 800,
    );
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      JSON.stringify({
        mode: "visual-only",
        rendererErrors: errors.length,
        viewports: ["1600x1000", "1280x800"],
      }),
    );
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
