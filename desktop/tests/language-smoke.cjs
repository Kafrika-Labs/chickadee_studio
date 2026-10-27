const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { launch } = require('./native-app.cjs');

(async () => {
  const data = path.resolve(__dirname, '../../artifacts/language-test-' + Date.now());
  const env = { ...process.env, CHICKADEE_TEST_DATA: data };
  delete env.CHICKADEE_LANGUAGE;
  delete env.ELECTRON_RUN_AS_NODE;
  const options = { executablePath: process.env.CHICKADEE_PACKAGED_EXE || require('electron'), args: process.env.CHICKADEE_PACKAGED_EXE ? [] : [path.resolve(__dirname, '..')], env };
  let app = await launch(options);
  try {
    let page = await app.firstWindow();
    page.setDefaultTimeout(20000);
    await page.locator('.tutorial-close').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
    async function settings(label) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.locator('.language-menu .menu-trigger').waitFor();
    }
    async function change(label, lang) {
      const trigger = page.locator('.language-menu .menu-trigger');
      const width = (await trigger.boundingBox()).width;
      assert.ok(width >= 110 && width <= 140);
      await trigger.click();
      await page.locator('.language-menu').getByRole('menuitemradio', { name: label, exact: true }).click();
      await page.waitForFunction(value => document.documentElement.lang === value, lang);
    }
    await settings('설정');
    await change('English', 'en');
    await settings('Settings');
    await change('한국어', 'ko');
    assert.equal(JSON.parse(await fs.readFile(path.join(data, 'preferences.json'), 'utf8')).language, 'ko');
    await app.close();
    app = await launch(options);
    page = await app.firstWindow();
    await page.waitForFunction(() => window.chickadee?.language === 'ko');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
    console.log('PASS: Korean first launch, English/Korean menu switching, saved preference and restart.');
  } finally {
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
