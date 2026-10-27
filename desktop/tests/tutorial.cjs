// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");

(async () => {
  const root = path.resolve(__dirname, "../..");
  const env = {
    ...process.env,
    CHICKADEE_TEST_DATA: path.join(root, "artifacts", `tutorial-test-${Date.now()}`),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({
    executablePath: require("electron"),
    args: [path.join(root, "desktop")],
    env,
  });
  let app = await launch();
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let guide = page.getByRole("dialog");
    await guide.waitFor();
    assert.equal(await guide.getAttribute("aria-labelledby"), "tutorial-label");
    const sizes = await guide.locator("button").evaluateAll(buttons =>
      buttons.map(button => button.getBoundingClientRect().height));
    assert.ok(sizes.every(height => height >= 32), "Guide controls need at least 32px height");
    await guide.getByRole("button", { name: "다음", exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(await guide.getByRole("button", { name: "사용 가이드 닫기" })
      .evaluate(el => el === document.activeElement), true);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await guide.getByRole("button", { name: "다음", exact: true })
      .evaluate(el => el === document.activeElement), true);
    await page.screenshot({ path: path.join(root, "artifacts/tutorial-first-step.png") });
    await guide.getByRole("button", { name: "사용 가이드 닫기" }).click();
    await guide.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "검사 옵션", exact: true }).click();
    assert.equal(await page.getByRole("menuitem").evaluateAll(items => items.every(item => {
      const box = item.getBoundingClientRect();
      return item.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })), true, "Execution menu must appear above the workspace");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#target-url").count(), 0);
    assert.equal(await page.locator(".monitor-panel").getAttribute("aria-hidden"), "true");
    await page.locator('.react-flow__node[data-id="target"]').click();
    await page.getByRole("textbox", { name: "검사 대상 URL" }).waitFor();
    const initialUrl = await page.locator("#target-url").inputValue();
    await page.locator("#target-url").fill("https://example.org/");
    await page.getByRole("button", { name: "단계 설정 닫기" }).click();
    await page.locator('.react-flow__node[data-id="target"]').click();
    assert.equal(await page.locator("#target-url").inputValue(), "https://example.org/");
    await page.locator("#target-url").fill(initialUrl);
    await page.getByRole("button", { name: "단계 설정 닫기" }).click();
    const monitorToggle = page.getByRole("button", { name: "미리보기·진행 기록", exact: true });
    await monitorToggle.click();
    assert.equal(await monitorToggle.getAttribute("aria-expanded"), "true");
    await page.getByRole("button", { name: "미리보기·진행 기록 닫기" }).click();
    assert.equal(await page.locator(".monitor-panel").getAttribute("aria-hidden"), "true");
    await monitorToggle.click();
    await monitorToggle.click();
    assert.equal(await monitorToggle.getAttribute("aria-expanded"), "false");
    await monitorToggle.click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".monitor-panel")).transform === "matrix(1, 0, 0, 1, 0, 0)");
    const layout = await page.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect();
      const main = box(".main");
      const studio = box(".studio");
      const toolbar = box(".canvas-toolbar");
      const panel = box(".monitor-panel > .panel-heading");
      return {
        left: studio.left - main.left,
        right: main.right - studio.right,
        bottom: main.bottom - studio.bottom,
        headerBottom: toolbar.bottom - panel.bottom,
        panelBoundary: box(".flow-area").right - panel.left,
      };
    });
    for (const [edge, difference] of Object.entries(layout)) {
      assert.ok(Math.abs(difference) <= 1, `Workspace ${edge} mismatch: ${difference}px`);
    }
    await page.waitForFunction(() => {
      const canvas = document.querySelector(".flow-area").getBoundingClientRect();
      const nodes = [...document.querySelectorAll(".node-tile")];
      const zoom = new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".react-flow__viewport")).transform).a;
      return zoom <= 0.751 && nodes.length === 6 && nodes.every(node => {
        const box = node.getBoundingClientRect();
        return box.left >= canvas.left && box.right <= canvas.right &&
          box.top >= canvas.top && box.bottom <= canvas.bottom;
      });
    });
    await page.screenshot({ path: path.join(root, "artifacts/monitoring-workspace.png") });
    await require("node:fs/promises").writeFile(
      path.join(root, "artifacts/node-canvas-bounds.json"),
      JSON.stringify({
        bounds: await page.locator(".flow-area").boundingBox(),
        width: await page.evaluate(() => innerWidth),
      }),
    );
    await page.getByRole("button", { name: "사용 가이드", exact: true }).click();
    await guide.waitFor();
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.setMinimumSize(320, 320);
      window.setContentSize(520, 640);
    });
    await page.waitForFunction(() => innerWidth === 520);
    assert.equal(await guide.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.setContentSize(1400, 850);
      window.webContents.setZoomFactor(2);
    });
    await page.waitForFunction(() => innerWidth <= 700);
    assert.equal(await guide.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1));
    assert.equal(await page.evaluate(() => window.chickadee.state()).then(s => s.running), false);
    await guide.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByRole("heading", { name: "발견한 항목의 근거를 확인하세요" }).waitFor();
    await guide.getByRole("button", { name: "이전", exact: true }).click();
    await page.getByRole("heading", { name: "주소를 넣고 검사를 시작하세요" }).waitFor();
    await page.keyboard.press("Escape");
    await guide.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "사용 가이드", exact: true }).click();
    await guide.waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: "사용 가이드", exact: true })
      .evaluate(el => el === document.activeElement), true);
    await page.keyboard.press("Enter");
    await guide.waitFor();
    await guide.getByRole("button", { name: /^3단계:/ }).click();
    await guide.getByRole("button", { name: "직접 검사하기", exact: true }).click();
    await guide.waitFor({ state: "detached" });
    assert.equal(await page.locator("#target-url").evaluate(el => el === document.activeElement), true);
    await page.getByRole("button", { name: "사용 가이드", exact: true }).click();
    await guide.getByRole("button", { name: /^3단계:/ }).click();
    await page.waitForFunction(() => !document.querySelector(".tutorial-footer > div .button-secondary").disabled);
    await guide.getByRole("button", { name: "데모로 연습하기", exact: true }).evaluate(button => {
      button.click();
      button.click();
    });
    await page.locator(".tutorial-dialog").waitFor({ state: "detached" });
    const scanNotice = page.getByRole("dialog", { name: "이미 검사 중입니다" });
    await scanNotice.waitFor();
    assert.equal(await scanNotice.getByRole("button", { name: "확인" }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press("Escape");
    await scanNotice.waitFor({ state: "detached" });
    const deadline = Date.now() + 90000;
    let state;
    do {
      state = await page.evaluate(() => window.chickadee.state());
      if (!state.running && state.status === "completed" && state.history.length === 1) break;
      if (state.status === "failed") throw new Error("Demo scan failed");
      await new Promise(resolve => setTimeout(resolve, 150));
    } while (Date.now() < deadline);
    assert.equal(state.status, "completed");
    assert.equal(state.history[0].pages, 4);
    await page.getByRole("button", { name: /^탐지 내역/ }).click();
    await page.locator(".results-layout .evidence-cell").first().waitFor();
    assert.equal(await page.locator(".record-drawer").getAttribute("aria-hidden"), "true");
    assert.equal(await page.locator(".content-area").evaluate(el => getComputedStyle(el).marginLeft), "0px");
    await page.locator(".results-layout .evidence-cell").first().click();
    await page.waitForFunction(() => document.querySelector(".record-drawer").getBoundingClientRect().width >= 319);
    assert.equal(await page.locator(".record-technical").getAttribute("open"), null);
    assert.equal(await page.locator(".review-note-details").getAttribute("open"), null);
    await page.locator(".review-note-details > summary").click();
    await page.getByRole("textbox", { name: "검토 메모" }).waitFor();
    await page.locator(".record-technical > summary").click();
    await page.locator(".record-technical .detail-url").waitFor();
    await page.getByRole("button", { name: "탐지 근거 닫기" }).click();
    await page.waitForFunction(() => document.querySelector(".record-drawer").getBoundingClientRect().width < 1);
    assert.equal(await page.locator(".record-drawer").getAttribute("aria-hidden"), "true");
    await page.getByRole("textbox", { name: "결과 검색" }).fill("no-matching-record-123456");
    assert.equal(await page.locator(".results-layout tbody tr").count(), 0);
    await page.getByRole("textbox", { name: "결과 검색" }).fill("");
    assert.equal(errors.length, 0, errors.join("\n"));
    await page.getByRole("button", { name: "검사 구성", exact: true }).click();
    const targetTile = page.locator('.react-flow__node[data-id="target"] .node-tile');
    await targetTile.hover();
    const beforeLayout = await page.evaluate(() => localStorage.getItem("chickadee.node-layout.v1"));
    const tile = await targetTile.boundingBox();
    await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
    await page.mouse.down();
    await page.mouse.move(tile.x + tile.width / 2 + 35, tile.y + tile.height / 2 + 25, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(previous => localStorage.getItem("chickadee.node-layout.v1") !== previous, beforeLayout);
    const savedPosition = await page.evaluate(() => JSON.parse(localStorage.getItem("chickadee.node-layout.v1")).target);
    await page.reload();
    await page.locator(".header-run-controls button.primary:not(:disabled)").waitFor();
    await page.waitForFunction(position => {
      const node = document.querySelector('.react-flow__node[data-id="target"]');
      if (!node) return false;
      const transform = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      return Math.abs(transform.e - position.x) < .1 && Math.abs(transform.f - position.y) < .1;
    }, savedPosition);
    await app.close();
    app = await launch();
    const restarted = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    await restarted.locator(".header-run-controls button.primary:not(:disabled)").waitFor();
    assert.equal(await restarted.locator(".tutorial-dialog").count(), 0);
    await restarted.getByRole("button", { name: "사용 가이드", exact: true }).click();
    await restarted.getByRole("dialog").waitFor();
    console.log("Tutorial passed: first launch, navigation, Escape, reopen, input focus, demo, restart persistence.");
  } finally {
    await app.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
