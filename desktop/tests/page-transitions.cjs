// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const assert = require('node:assert/strict');
const path = require('node:path');
const {launch} = require('./source-ui-harness.cjs');

(async () => {
  const app = await launch({env:{...process.env,CHICKADEE_TEST_DATA:path.resolve(__dirname,'../../artifacts/page-transitions-'+Date.now())}});
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.locator('.tutorial-close').click();
    await page.evaluate(() => {
      window.transitionResults = [];
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = update => {
        const result = {ready:false,finished:false};
        window.transitionResults.push(result);
        const transition = start(update);
        transition.ready.then(() => {
          result.ready = true;
          result.duration = getComputedStyle(document.documentElement,'::view-transition-new(workspace)').animationDuration;
        }).catch(() => {});
        transition.finished.then(() => {result.finished=true;}).catch(() => {});
        return transition;
      };
    });
    const settle = () => page.waitForFunction(() => window.transitionResults.at(-1)?.finished);
    for (const [index,view] of ['workflow','results','pages','inspection','activity','history','workflow'].entries()) {
      if (!index) continue;
      await page.locator('.sidebar nav button').nth(index === 6 ? 0 : index).click();
      await settle();
      assert.equal(await page.locator('.content-area').getAttribute('data-view'),view);
    }
    await page.getByRole('button',{name:'설정',exact:true}).click();
    await settle();
    await page.getByRole('navigation',{name:'설정 메뉴'}).getByRole('button',{name:'알림',exact:true}).click();
    await settle();
    await page.getByRole('button',{name:'앱으로 돌아가기',exact:true}).click();
    await settle();
    assert.equal(await page.locator('.content-area').getAttribute('data-view'),'workflow');
    assert.ok(await page.evaluate(() => window.transitionResults.every(item => item.ready && item.duration === '0.28s')));
    await page.evaluate(() => {
      const buttons=document.querySelectorAll('.sidebar nav button');
      buttons[1].click(); buttons[5].click();
    });
    await settle();
    assert.equal(await page.locator('.content-area').getAttribute('data-view'),'history');
    const count=await page.evaluate(() => window.transitionResults.length);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('.sidebar nav button').first().click();
    assert.equal(await page.locator('.content-area').getAttribute('data-view'),'workflow');
    assert.equal(await page.evaluate(() => window.transitionResults.length),count);
    assert.deepEqual(errors,[]);
    console.log('Passed: all pages, settings round trip, 280ms snapshots, rapid navigation, reduced motion');
  } finally { await app.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
