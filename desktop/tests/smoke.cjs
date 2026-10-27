// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const path = require("node:path");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const http = require("node:http");
const launch =
  process.env.CHICKADEE_SERVICE_UI === "1"
    ? require("./source-ui-harness.cjs").launch
    : require("./native-app.cjs").launch;
async function waitForHistory(page, count) {
  const deadline = Date.now() + 180000;
  let state;
  while (Date.now() < deadline) {
    state = await page.evaluate(() => window.chickadee.state());
    if (!state.running && state.history.length === count) return state;
    if (state.status === "failed")
      throw new Error("검사 실패: " + JSON.stringify(state));
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("검사 완료 대기 실패: " + JSON.stringify(state));
}

(async () => {
  const root = path.resolve(__dirname, "../..");
  const artifacts = path.join(root, "artifacts");
  const data = path.join(artifacts, "electron-test-" + Date.now());
  const executable = process.env.CHICKADEE_PACKAGED_EXE || require("electron");
  const args = process.env.CHICKADEE_PACKAGED_EXE
    ? []
    : [path.join(root, "desktop")];
  const env = { ...process.env, CHICKADEE_TEST_DATA: data };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await launch({
    executablePath: executable,
    args,
    env,
    timeout: 45000,
  });
  let server;
  let passed = false;
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const guide = page.getByRole("dialog", { name: "사용 가이드" });
    await guide.waitFor();
    await guide.getByRole("button", { name: "사용 가이드 닫기", exact: true }).click();
    await page
      .locator(".header-run-controls button.primary:not(:disabled)")
      .waitFor({ timeout: 30000 });
    assert.equal(
      await page
        .locator(
          ".engine-indicator,.heading .eyebrow,.canvas-footer,.flow-caption,.statusbar",
        )
        .count(),
      0,
    );
    assert.equal(await page.locator(".react-flow__node").count(), 9);
    assert.ok(
      await page.evaluate(() => document.fonts.check("600 14px Pretendard")),
    );
    assert.equal(await page.locator(".brand-mark img").count(), 1);
    await page.screenshot({
      path: path.join(artifacts, "electron-workflow-empty.png"),
    });
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "빠른 명령" }).waitFor();
    await page.getByRole("textbox", { name: "명령 검색" }).fill("설정");
    await page.keyboard.press("Enter");
    await page.getByLabel("최대 페이지", { exact: true }).fill("20");
    await page.getByRole("button", { name: "앱으로 돌아가기", exact: true }).click();
    await page.getByRole("button", { name: "검사 옵션", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "데모 검사", exact: true })
      .click();
    await page.getByRole("button", { name: "일시정지", exact: true }).click();
    await page
      .getByRole("button", { name: "검사 재개", exact: true })
      .waitFor({ timeout: 30000 });
    await page.screenshot({
      path: path.join(artifacts, "electron-paused.png"),
    });
    await page.getByRole("button", { name: "검사 재개", exact: true }).click();
    await page
      .locator(".scan-status strong")
      .filter({ hasText: "검사 완료" })
      .waitFor({ timeout: 90000 });
    await page.getByRole("button", { name: "검사 구성", exact: true }).click();
    await page.getByRole("button", { name: "미리보기·진행 기록", exact: true }).click();
    await page.locator(".preview-image img").waitFor();
    const firstPreview = await page
      .locator(".preview-image img")
      .getAttribute("src");
    const firstPreviewUrl = await page
      .locator(".browser-chrome span[title]")
      .getAttribute("title");
    const firstRun = await page.evaluate(() => window.chickadee.state());
    const firstResultPath = firstRun.history[0].path;
    await page.getByRole("button", { name: "화면 확대" }).click();
    await page.getByRole("dialog", { name: "검사 화면" }).waitFor();
    assert.equal(
      await page.getByAltText("검사 화면 확대").getAttribute("src"),
      firstPreview,
    );
    assert.ok(
      (await page.locator(".preview-modal").innerText()).includes(
        firstPreviewUrl,
      ),
    );
    await page.getByRole("button", { name: "미리보기 닫기" }).click();
    const firstResult = JSON.parse(await fs.readFile(firstResultPath, "utf8"));
    assert.equal(firstResult.findings.length, 14);
    assert.equal(new Set(firstResult.findings.map(row => row.url)).size, 2);
    assert.equal(await page.locator(".summary-numbers button").filter({ hasText: "필수 탐지" }).locator("b").innerText(), "2");
    await page.screenshot({
      path: path.join(artifacts, "electron-workflow.png"),
    });
    await page.getByRole("button", { name: /^탐지 내역/ }).click();
    await page.locator("tbody tr").first().waitFor();
    assert.equal(await page.locator("tbody tr").count(), 2);
    const firstNewest = await page.locator('tbody tr input[type="checkbox"]').first().getAttribute('aria-label');
    const firstFinding = firstResult.findings.find(row => row.id === firstNewest.replace(/ 선택$/, ""));
    assert.ok(firstFinding);
    const confirmedEvidenceCount = firstResult.findings.filter(row => row.url === firstFinding.url).length;
    const dismissedEvidenceCount = firstResult.findings.length - confirmedEvidenceCount;
    await page.getByRole('button', {name:'정렬 방식',exact:true}).click();
    await page.getByRole('menuitemradio',{name:'오래된순',exact:true}).click();
    assert.notEqual(await page.locator('tbody tr input[type="checkbox"]').first().getAttribute('aria-label'),firstNewest);
    await page.getByRole('button', {name:'정렬 방식',exact:true}).click();
    await page.getByRole('menuitemradio',{name:'최신순',exact:true}).click();
    assert.equal(await page.locator('tbody tr input[type="checkbox"]').first().getAttribute('aria-label'),firstNewest);
    await page.locator("tbody tr").first().click();
    const evidenceCard = page.locator('.page-evidence-item').first();
    await evidenceCard.waitFor();
    await evidenceCard.screenshot({ path: path.join(artifacts, 'evidence-card.png') });
    await evidenceCard.getByRole('button', { name: '스크린샷 확대', exact: true }).click();
    await page.getByRole('dialog', { name: '스크린샷 확대', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await evidenceCard.locator('.capture-metadata summary').click();
    await evidenceCard.locator('.capture-metadata dl').waitFor();
    await evidenceCard.locator('.capture-metadata summary').click();
    await page.locator(".review-note-details > summary").click();
    await page
      .getByRole("textbox", { name: "검토 메모" })
      .fill("문자 변형과 원문 확인 · 통합 검사");
    await page.getByRole("button", { name: "검토 확인", exact: true }).click();
    await page
      .getByRole("dialog", { name: "검토 저장 완료" })
      .filter({ hasText: "1건의 검토 내용을 저장했습니다." })
      .waitFor();
    await page.getByRole("dialog", { name: "검토 저장 완료" }).getByRole("button", { name: "확인", exact: true }).click();
    await page.getByRole("button", { name: "검토 상태 필터:", exact: false }).click();
    await page.getByRole("menuitemradio", { name: "미검토", exact: true }).click();
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page.getByRole("checkbox", { name: "표시 항목 전체 선택" }).check();
    await page
      .locator(".bulk-toolbar")
      .getByRole("button", { name: "검토 제외", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "검토 저장 완료" })
      .filter({ hasText: "1건의 검토 내용을 저장했습니다." })
      .waitFor();
    await page.getByRole("dialog", { name: "검토 저장 완료" }).getByRole("button", { name: "확인", exact: true }).click();
    assert.equal(await page.locator("tbody tr").count(), 0);
    const savedReview = JSON.parse(await fs.readFile(path.join(path.dirname(firstResultPath), "review.json"), "utf8"));
    assert.equal(Object.values(savedReview.items).filter(item => item.status === "confirmed").length, confirmedEvidenceCount);
    assert.equal(Object.values(savedReview.items).filter(item => item.status === "dismissed").length, dismissedEvidenceCount);
    for (const finding of firstResult.findings) {
      assert.equal(savedReview.items[finding.id].status, finding.url === firstFinding.url ? "confirmed" : "dismissed");
    }
    await page.getByRole("button", { name: "검토 상태 필터:", exact: false }).click();
    await page.getByRole("menuitemradio", { name: "검토 전체", exact: true }).click();
    await page.getByRole("button", { name: "검사 기록", exact: true }).click();
    await page.locator("tbody tr").first().click();
    await page.locator("tbody tr .review-confirmed").first().waitFor();
    assert.equal(await page.locator("tbody tr .review-confirmed").count(), 1);
    assert.equal(await page.locator("tbody tr .review-dismissed").count(), 1);
    await page.locator("tbody tr").first().click();
    assert.equal(
      await page.getByRole("textbox", { name: "검토 메모" }).inputValue(),
      "문자 변형과 원문 확인 · 통합 검사",
    );
    await page.screenshot({
      path: path.join(artifacts, "electron-results.png"),
    });
    const csv = path.join(data, "export-test.csv");
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, csv);
    await page.getByRole("button", { name: "CSV 저장", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "CSV를 저장했습니다" })
      .waitFor();
    const bytes = await fs.readFile(csv);
    assert.ok(bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191])));
    await page.getByRole("button", { name: "탐색 경로", exact: true }).click();
    await page.locator('.content-area[data-view="pages"] tbody tr').nth(3).waitFor();
    assert.equal(await page.locator("tbody tr").count(), 4);
    assert.equal(await page.locator('.path-group-toggle').count(), 0);
    await page.getByRole("button", { name: "진행 기록", exact: true }).click();
    await page.screenshot({
      path: path.join(artifacts, "electron-activity.png"),
    });
    assert.ok(
      (await page.locator(".full-timeline").innerText()).includes("DOM"),
    );
    await page.getByRole("button", { name: "검사 구성", exact: true }).click();
    const edge = page.locator('[data-testid="rf__edge-techniques-dedup"]');
    await edge.waitFor();
    await edge.dispatchEvent("click");
    await page.keyboard.press("Delete");
    // Conditional OCR and optional Laya keep all 11 fixed pipeline connections.
    assert.equal(await page.locator(".react-flow__edge").count(), 11);
    await edge.waitFor();
    assert.equal(await page.locator(".react-flow__handle.connectable").count(), 0);
    await page.locator('.react-flow__node[data-id="ocr"]').click();
    const ocrSwitch = page.getByRole('checkbox', { name: /이미지 OCR 사용/ });
    await ocrSwitch.uncheck();
    assert.equal(await page.locator('.react-flow__node[data-id="ocr"] .flow-node.disabled').count(), 1);
    await ocrSwitch.check();
    assert.equal(await page.getByRole("button", { name: "구성 저장", exact: true }).count(), 0);
    assert.equal(errors.length, 0, errors.join("\n"));
    // Owned loopback fixture: verify the real single-page action and recheck.
    server = http.createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(
        '<!doctype html><html lang="ko"><title>단일 페이지 검사</title><body><p style="opacity:0">카지노 가입 보너스 지급</p><a href="/other">다음 글</a></body></html>',
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const fixtureUrl = `http://127.0.0.1:${server.address().port}/first`;
    await page.locator('.react-flow__node[data-id="target"]').click();
    await page.getByRole("textbox", { name: "검사 대상 URL" }).fill(fixtureUrl);
    await page.getByRole("button", { name: "검사 옵션", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "이 페이지만 검사", exact: true })
      .click();
    await waitForHistory(page, 2);
    const onePage = await page.evaluate(() => window.chickadee.state());
    const oneReport = JSON.parse(
      await fs.readFile(
        path.join(path.dirname(onePage.history[0].path), "scan-report.json"),
        "utf8",
      ),
    );
    assert.equal(oneReport.pages_scanned.length, 1);
    assert.equal(oneReport.enabled_stages.follow_links, false);
    await page.getByRole("button", { name: /^탐지 내역/ }).click();
    await page.locator("tbody tr").first().click();
    await page.getByRole("button", { name: "항목 작업", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "이 페이지만 재검사", exact: true })
      .click();
    await waitForHistory(page, 3);
    const rechecked = await page.evaluate(() => window.chickadee.state());
    assert.equal(rechecked.history[0].url, fixtureUrl);
    assert.equal(rechecked.history[0].pages, 1);
    const preferences = JSON.parse(
      await fs.readFile(path.join(data, "preferences.json"), "utf8"),
    );
    assert.equal(preferences.maxPages, 20);
    assert.equal(preferences.url, fixtureUrl);
    // A run without preview must not inherit the preceding run's image.
    await page.getByRole("button", { name: "설정", exact: true }).click();
    await page.getByLabel("실시간 브라우저 화면", { exact: false }).uncheck();
    await page.getByRole("button", { name: "앱으로 돌아가기", exact: true }).click();
    await page.getByRole("button", { name: "검사 옵션", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "데모 검사", exact: true })
      .click();
    await waitForHistory(page, 4);
    assert.equal(await page.locator(".preview-image img").count(), 0);
    // Reopen an older run and restore its exact screenshot, URL and review.
    await page.getByRole("button", { name: "검사 기록", exact: true }).click();
    await page.locator("tbody tr").last().click();
    await page.locator("tbody tr .review-confirmed").first().waitFor();
    await page
      .getByRole("textbox", { name: "결과 검색" })
      .fill("없는 검색어 · filter reset");
    await page.getByRole("button", { name: "검사 구성", exact: true }).click();
    await page.locator('.react-flow__node[data-id="collector"]').click();
    await page.locator(".node-config").waitFor();
    await app.evaluate(({ dialog }, resultPath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [resultPath],
      });
    }, firstResultPath);
    await page
      .getByRole("button", { name: "결과 불러오기", exact: true })
      .click();
    await page.locator("tbody tr").first().waitFor();
    assert.equal(
      await page.getByRole("textbox", { name: "결과 검색" }).inputValue(),
      "",
    );
    assert.equal(await page.locator("tbody tr").count(), 2);
    await page.getByRole("button", { name: "검사 구성", exact: true }).click();
    await page.locator(".preview-image img").waitFor();
    assert.equal(await page.locator(".node-config").count(), 0);
    assert.equal(
      await page.locator(".preview-image img").getAttribute("src"),
      firstPreview,
    );
    assert.equal(
      await page.locator(".browser-chrome span[title]").getAttribute("title"),
      firstPreviewUrl,
    );
    await page.screenshot({
      path: path.join(artifacts, "studio-clean-workflow.png"),
    });
    await page.getByRole("button", { name: "진행 기록", exact: true }).click();
    await page.getByRole("button", { name: "HTTP 통신", exact: true }).click();
    assert.ok((await page.locator(".full-timeline .event-row").count()) > 0);
    await page.locator(".full-timeline .event-row").first().click();
    await page.locator(".event-modal").waitFor();
    assert.ok(
      (await page.locator(".event-modal pre").innerText()).includes(
        "http_response",
      ),
    );
    await page.locator(".event-modal .modal-heading > button").click();
    assert.equal(errors.length, 0, errors.join("\n"));
    passed = true;
    console.log(
      JSON.stringify({
        status: "passed",
        findings: 14,
        pages: 4,
        preview: true,
        previewZoom: true,
        previewReloadExact: true,
        previewOffClearsImage: true,
        resultImportResetsFilters: true,
        savedNetworkEvents: true,
        csv: true,
        fixedPipeline: true,
        pauseResume: true,
        reviewReload: true,
        bulkReview: true,
        commandPalette: true,
        singlePageRecheck: true,
        preferencesPersisted: true,
        mode:
          process.env.CHICKADEE_SERVICE_UI === "1"
            ? "source-ui-real-python"
            : "electron",
        data,
      }),
    );
  } finally {
    const process = app.process?.();
    // Context closure can precede native process exit and release of the profile lock.
    const exited = process && process.exitCode === null && process.signalCode === null
      ? new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Previous Electron process did not exit before restart')), 30000);
          process.once('exit', () => { clearTimeout(timer); resolve(); });
        }) : Promise.resolve();
    await app.close();
    await exited;
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
  if (passed) {
    const restarted = await launch({
      executablePath: executable,
      args,
      env,
      timeout: 45000,
    });
    try {
      const page = await restarted.firstWindow({ timeout: 60000 });
      await page
        .locator(".header-run-controls button.primary:not(:disabled)")
        .waitFor({ timeout: 30000 });
      // The source harness uses a new HTTP origin on restart.
      const startupGuide = page.getByRole("dialog", { name: "사용 가이드" });
      if (await startupGuide.isVisible()) {
        await startupGuide.getByRole("button", { name: "사용 가이드 닫기" }).click();
      }
      const prefs = JSON.parse(
        await fs.readFile(path.join(data, "preferences.json"), "utf8"),
      );
      await page.locator('.react-flow__node[data-id="target"]').click();
      assert.equal(
        await page.getByRole("textbox", { name: "검사 대상 URL" }).inputValue(),
        prefs.url,
      );
      console.log(JSON.stringify({ restartPreferences: "passed" }));
    } finally {
      await restarted.close();
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
