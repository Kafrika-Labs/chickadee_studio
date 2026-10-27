// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const assert = require('node:assert/strict');
const path = require('node:path');
const {launch} = require('./native-app.cjs');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const app = await launch({args: [path.join(root, 'desktop')],
    env: {...process.env, CHICKADEE_TEST_DATA: path.join(root, 'artifacts/ad-groups-ui-' + Date.now())}});
  try {
    const page = await app.firstWindow();
    await page.getByRole('dialog', {name: '사용 가이드'}).getByRole('button', {name: '사용 가이드 닫기', exact: true}).click();
    await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
    const rows = [
      {id: 'c_00001', category: 'COMMERCIAL', evidence_text: '제품 할인 안내'},
      {id: 'c_00002', category: 'AI_CONTEXT', evidence_text: '서비스 예약 할인 혜택 신청'},
      {id: 'c_00003', category: 'DRUGS', evidence_text: '마약 거래 의심 문맥'},
      {id: 'c_00004', category: 'GAMBLING', source_kind: 'image_visual', evidence_text: '도박 이미지',
        local_ai: {content_visual: {image_sha256: 'a'.repeat(64), scores: {gambling: .753}}}},
      {id: 'c_00005', category: 'GAMBLING', source_kind: 'image_visual', evidence_text: '도박 이미지',
        local_ai: {content_visual: {image_sha256: 'a'.repeat(64), scores: {gambling: .753}}}},
    ].map((row, index) => ({...row, url: `https://example.invalid/post/${index}`, location: 'article', review_required: true}));
    await app.evaluate(({BrowserWindow}, rows) => {
      for (const candidate of rows) BrowserWindow.getAllWindows()[0].webContents.send('desktop:event', {kind: 'candidate', candidate});
    }, rows);
    await page.locator('nav button').filter({hasText: '탐지 내역'}).click();
    const toolbar = page.locator('.list-toolbar');
    async function chooseCategory(label) {
      await toolbar.getByRole('button', {name: /^탐지 분류 필터:/}).click();
      await toolbar.getByRole('menuitemradio', {name: label, exact:true}).click();
    }
    await chooseCategory('일반 광고');
    await page.locator('tbody tr').nth(1).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 2);
    assert.match(await page.locator('.summary-numbers').innerText(), /일반 광고\s*2/);
    assert.match(await page.locator('.summary-numbers').innerText(), /불법 의심\s*1/);
    await page.screenshot({path: path.join(root, 'artifacts/ad-groups-general.png')});
    await chooseCategory('불법 의심');
    await page.getByRole('cell', {name: '마약 거래 의심 문맥', exact: true}).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.screenshot({path: path.join(root, 'artifacts/ad-groups-risk.png')});
    await chooseCategory('이미지 검토');
    await page.getByRole('cell', {name: '문자 근거 없는 이미지 · 검토 필요', exact: true}).waitFor();
    assert.equal(await page.locator('tbody tr').count(), 1);
    assert.doesNotMatch(await page.locator('tbody').innerText(), /도박 홍보 의심|도박 이미지/);
    assert.match(await page.locator('.summary-numbers').innerText(), /이미지 검토\s*1/);
    await page.screenshot({path: path.join(root, 'artifacts/ad-groups-photo-review.png')});
    await page.locator('tbody tr').first().click();
    await page.setViewportSize({width:1120, height:800});
    for (const label of ['전체', '필수 탐지', '일반 광고', '불법 의심', '이미지 검토']) {
      await chooseCategory(label);
      const fits = await toolbar.locator('.result-category-menu .menu-trigger').evaluate(el => {
        const button = el.getBoundingClientRect(), text = el.querySelector('span').getBoundingClientRect(), icon = el.querySelector('svg').getBoundingClientRect();
        return text.right <= icon.left && icon.right <= button.right && el.scrollWidth <= el.clientWidth;
      });
      assert.ok(fits, `Category label clipped: ${label}`);
    }
    assert.ok(await toolbar.evaluate(el => el.scrollWidth <= el.clientWidth), 'Filter toolbar must fit with detail open');
    await page.screenshot({path:path.join(root, 'artifacts/results-filters-compact.png')});
    console.log('PASS: general, suspected-illegal and neutral image review filters and counts');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
