// Record the actual desktop pipeline against a local Korean fixture. No paid API calls.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");
const { launch } = require("./native-app.cjs");

(async () => {
  const root = path.resolve(__dirname, "../..");
  const out = path.resolve(
    process.env.CHICKADEE_CAPTURE_DIR ||
      path.join(root, "artifacts/service-recording"),
  );
  const data = path.join(out, "profile-" + Date.now());
  await fs.mkdir(data, { recursive: true });
  const modelConfig = process.env.CHICKADEE_LAYA_CONFIG;
  if (!modelConfig && !process.env.CHICKADEE_PACKAGED_EXE)
    throw Error(
      "Set CHICKADEE_LAYA_CONFIG to an installed local model configuration.",
    );
  const image = await fs.readFile(
    path.join(root, "tests/fixtures/ocr/promotion.png"),
  );
  const html =
    '<!doctype html><meta charset="utf-8"><style>body{font:20px sans-serif;padding:32px}article{margin:18px 0}</style>' +
    '<h1>한국어 게시글과 댓글 기능 검증</h1><article id="normal">도서관 이용 시간과 시설 안내입니다.</article>' +
    '<article id="lookalike">ｃａｓｉｎｏ 가입 보너스 지급</article><article id="jamo">ㅋㅏㅈㅣㄴㅗ 가입 보너스 지급</article>' +
    '<article id="transparent" style="opacity:0">카지노 가입하고 보너스 받으세요</article>' +
    '<article id="offscreen" style="position:absolute;left:-9999px">카지노 신규 회원 보너스 지급</article>' +
    '<article><img src="/promotion.png"></article><div id="comments"></div>' +
    '<script>setTimeout(()=>fetch("/comments").then(r=>r.text()).then(t=>document.querySelector("#comments").innerHTML=t),80)</script>';
  const server = http.createServer((request, response) => {
    response.setHeader(
      "Content-Type",
      request.url === "/promotion.png"
        ? "image/png"
        : "text/html;charset=utf-8",
    );
    response.end(
      request.url === "/promotion.png"
        ? image
        : request.url === "/comments"
          ? '<article data-comment-id="1">ｃａｓｉｎｏ 신규 회원 가입 보너스 지급</article>'
          : html,
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { defaultWorkflow } = await import(
    pathToFileURL(path.join(root, "desktop/src/workflow.mjs"))
  );
  let app,
    timer,
    ff,
    busy = false,
    frames = 0,
    ffError = "";
  const segments = [];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    app = await launch({
      executablePath: process.env.CHICKADEE_PACKAGED_EXE || require("electron"),
      args: process.env.CHICKADEE_PACKAGED_EXE
        ? []
        : [path.join(root, "desktop")],
      env: {
        ...process.env,
        CHICKADEE_TEST_DATA: data,
        CHICKADEE_LAYA_CONFIG: modelConfig,
      },
    });
    const p = await app.firstWindow();
    p.setDefaultTimeout(15000);
    await p
      .getByRole("button", { name: "사용 가이드 닫기", exact: true })
      .click()
      .catch(() => {});
    await p
      .locator(".header-run-controls button.primary:not(:disabled)")
      .waitFor();
    await p.evaluate(() =>
      window.chickadee.configureRuntime({ mode: "standard" }),
    );
    ff = spawn(
      path.join(
        root,
        ".venv/Lib/site-packages/playwright/driver/package/.local-browsers/ffmpeg-1013/ffmpeg-win64.exe",
      ),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-r",
        "4",
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "libvpx-vp9",
        "-deadline",
        "realtime",
        "-cpu-used",
        "8",
        "-threads",
        "2",
        "-crf",
        "30",
        "-b:v",
        "0",
        "-y",
        path.join(out, "service.webm"),
      ],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    ff.stderr.on("data", (v) => (ffError += v));
    ff.stdin.on("error", () => {});
    timer = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        if (!ff.stdin.write(await p.screenshot({ type: "jpeg", quality: 75 })))
          await once(ff.stdin, "drain");
        frames++;
      } finally {
        busy = false;
      }
    }, 250);
    async function segment(name, action) {
      const start = frames / 4;
      await action();
      await wait(1600);
      segments.push({ name, start, end: frames / 4 });
    }
    const nav = (name) =>
      p
        .getByRole(
          "button",
          name === "탐지 내역" ? { name: /^탐지 내역/ } : { name, exact: true },
        )
        .click();
    await segment("01-target", async () => {
      await p.locator('.react-flow__node[data-id="target"]').click();
      await p
        .getByRole("textbox", { name: "검사 대상 URL" })
        .fill(`http://127.0.0.1:${server.address().port}/`);
    });
    await p
      .getByRole("button", { name: "단계 설정 닫기", exact: true })
      .click();
    await p.evaluate((options) => window.chickadee.start(options), {
      url: `http://127.0.0.1:${server.address().port}/`,
      max_pages: 1,
      timeout_sec: 120,
      page_timeout_sec: 60,
      settle_ms: 300,
      interval_sec: 0,
      preview: true,
      workflow: defaultWorkflow(),
    });
    let state;
    const deadline = Date.now() + 210000;
    do {
      state = await p.evaluate(() => window.chickadee.state());
      if (!state.running && state.history.length > 0) break;
      await wait(250);
    } while (Date.now() < deadline);
    assert.ok(
      state.history.length > 0 && !state.running,
      JSON.stringify(state),
    );
    const report = JSON.parse(
      await fs.readFile(
        path.join(path.dirname(state.history[0].path), "scan-report.json"),
        "utf8",
      ),
    );
    const result = JSON.parse(await fs.readFile(state.history[0].path, "utf8"));
    const techniques = [
      ...new Set(result.findings.map((f) => f.technique)),
    ].sort();
    assert.deepEqual(techniques, [
      "HOMOGLYPH",
      "JAMO",
      "OFFSCREEN",
      "TRANSPARENT",
    ]);
    assert.ok(
      result.findings.some(
        (f) => f.location.startsWith("div") && f.technique === "HOMOGLYPH",
      ),
      "Delayed comment must be detected",
    );
    assert.ok(
      report.local_ai.laya.analyzed > 0,
      JSON.stringify(report.local_ai.laya),
    );
    assert.ok(
      report.ocr_summary.completed > 0,
      JSON.stringify(report.ocr_summary),
    );
    await segment("02-pipeline", async () => {
      await nav("검사 구성");
      await p.screenshot({ path: path.join(out, "01-pipeline.png") });
    });
    await segment("03-detection", async () => {
      await nav("탐지 내역");
      await p.getByRole("button", { name: /^탐지 분류 필터:/ }).click();
      await p.getByRole("menuitemradio", { name: "필수 탐지", exact: true }).click();
      await p.locator("tbody tr .evidence-cell").first().click();
      await p.screenshot({ path: path.join(out, "22-four-techniques.png") });
      await wait(600);
      await p.locator("tbody tr .evidence-cell").last().click();
    });
    await segment("04-ocr", async () => {
      await p.getByRole("button", { name: /^탐지 분류 필터:/ }).click();
      await p.getByRole("menuitemradio", { name: "전체", exact: true }).click();
      const cells = p.locator("tbody tr .evidence-cell");
      let found = false;
      for (let i = 0; i < (await cells.count()); i++) {
        await cells.nth(i).click();
        if (
          await p
            .getByRole("region", { name: "이미지 OCR 근거", exact: true })
            .count()
        ) {
          found = true;
          break;
        }
      }
      assert.ok(found, "OCR item must be visible");
      const ocr = p.getByRole("region", {
        name: "이미지 OCR 근거",
        exact: true,
      });
      await ocr.scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(out, "23-ocr-boxes.png") });
      for (const b of await ocr.locator(".image-ocr-lines button").all()) {
        await b.click();
        await wait(700);
      }
      await p.screenshot({ path: path.join(out, "24-ocr-line.png") });
    });
    await segment("05-analysis", async () => {
      await nav("검사 분석");
      await p.getByRole("tab", { name: "AI 검토", exact: true }).click();
      await p.locator(".local-ai-results > summary").click();
      await wait(800);
      await p.locator(".model-statistics").scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(out, "02-statistics.png") });
      const table = p.locator(".model-statistics");
      assert.ok(await table.getByText("Laya", { exact: true }).count());
    });
    await segment("06-graph", async () => {
      await p.getByRole("tab", { name: "탐색 그래프", exact: true }).click();
      await p.locator(".react-flow__controls-fitview").last().click();
      await wait(400);
      await p.locator(".react-flow__controls-zoomin").last().click();
      await wait(500);
      await p.locator(".react-flow__controls-fitview").last().click();
    });
    if (process.env.CHICKADEE_CAPTURE_REVIEW_RESULT) {
      await app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
      }, path.resolve(process.env.CHICKADEE_CAPTURE_REVIEW_RESULT));
      await p
        .getByRole("button", { name: "결과 불러오기", exact: true })
        .click();
      await segment("07-groq", async () => {
        await nav("검사 분석");
        await p.getByRole("tab", { name: "AI 검토", exact: true }).click();
        await p.locator(".review-results-heading").scrollIntoViewIfNeeded();
        await wait(600);
        assert.ok(
          (await p.locator(".inspection-detail").count()) > 0,
          "Saved Groq opinions must exist",
        );
        await p.screenshot({ path: path.join(out, "03-groq-report.png") });
        await p.locator(".inspection-detail").last().scrollIntoViewIfNeeded();
        await wait(800);
      });
      await segment("08-report", async () => {
        await app.evaluate(
          ({ dialog }, file) => {
            dialog.showSaveDialog = async () => ({
              canceled: false,
              filePath: file,
            });
          },
          path.join(out, "review-report.html"),
        );
        await p
          .getByRole("button", { name: "리포트 저장", exact: true })
          .click();
        await p
          .getByRole("status")
          .filter({ hasText: "리포트를 저장했습니다." })
          .waitFor();
        await p.screenshot({ path: path.join(out, "05-report-saved.png") });
        await nav("탐지 내역");
        await p.getByRole("button", { name: /^탐지 분류 필터:/ }).click();
      await p.getByRole("menuitemradio", { name: "전체", exact: true }).click();
        await p.locator("tbody tr .evidence-cell").first().click();
        await wait(700);
      });
    }
    const summary = {
      status: "passed",
      fixture: "local Korean posts, delayed comment and image",
      ocr: report.ocr_summary,
      laya: report.local_ai.laya,
      mandatory_techniques: techniques,
      delayed_comment_detected: true,
      paid_requests: 0,
      segments,
    };
    await fs.writeFile(
      path.join(out, "recording.json"),
      JSON.stringify(summary, null, 2),
    );
    console.log(JSON.stringify(summary));
  } finally {
    clearInterval(timer);
    while (busy) await wait(100);
    if (ff) {
      ff.stdin.end();
      await once(ff, "exit");
    }
    if (app) await app.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    if (ffError) console.error(ffError);
  }
})().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
