process.env.CHICKADEE_LANGUAGE ??= 'ko';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { launch } = require('./native-app.cjs');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const data = path.join(root, 'artifacts', 'site-access-ui-' + Date.now());
  const options = { args:[path.join(root, 'desktop')], env:{...process.env, CHICKADEE_TEST_DATA:data} };
  let app = await launch(options);
  try {
    let page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.getByRole('button', {name:'사용 가이드 닫기', exact:true}).click();
    await page.getByRole('button', {name:'설정', exact:true}).click();
    await page.getByRole('button', {name:'인증', exact:true}).click();
    const panel = page.getByRole('region', {name:'검사기 인증', exact:true});
    await panel.getByLabel('사이트 주소 (HTTPS)', {exact:true}).fill('https://example.test');
    await panel.getByLabel('허용 경로', {exact:true}).fill('/boards');
    await panel.getByRole('button', {name:'토큰 생성', exact:true}).click();
    const token = await panel.getByLabel('검사 인증 토큰', {exact:true}).inputValue();
    assert.match(token, /^[a-f0-9]{64}$/);
    await panel.getByRole('button', {name:'인증 적용', exact:true}).click();
    await panel.getByText('https://example.test/boards', {exact:true}).waitFor();
    assert.equal(await panel.getByLabel('검사 인증 토큰', {exact:true}).inputValue(), '');
    const registered = await page.evaluate(() => window.chickadee.siteAccess());
    assert.equal(registered.sites.length, 1);
    assert.ok(!JSON.stringify(registered).includes(token));
    await panel.locator('.site-access-guide > summary').click();
    await panel.screenshot({path:path.join(root, 'artifacts/site-access-settings.png')});
    await panel.getByRole('button', {name:'https://example.test 인증 해제', exact:true}).click();
    await page.waitForFunction(async () => (await window.chickadee.siteAccess()).sites.length === 0);
    await panel.getByLabel('검사 인증 토큰', {exact:true}).fill(token);
    await panel.getByRole('button', {name:'인증 적용', exact:true}).click();
    await panel.getByText('https://example.test/boards', {exact:true}).waitFor();
    await app.close();
    for (const file of await fs.readdir(data)) {
      if (/\.json$/.test(file)) assert.ok(!(await fs.readFile(path.join(data,file),'utf8')).includes(token));
    }
    app = await launch(options);
    page = await app.firstWindow();
    await page.waitForFunction(() => !!window.chickadee);
    assert.equal((await page.evaluate(() => window.chickadee.siteAccess())).sites.length, 0);
    console.log('PASS: token generation, scoped registration, masked input clearing, removal and session-only restart; no external site requests.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
