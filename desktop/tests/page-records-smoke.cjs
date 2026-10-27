// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {launch} = require('./native-app.cjs');
(async()=>{
  const root=path.resolve(__dirname,'../..');
  const payload=JSON.parse(fs.readFileSync(path.join(root,'artifacts/page-evidence-fixture.json'),'utf8'));
  const app=await launch({args:[path.join(root,'desktop')],env:{...process.env,CHICKADEE_TEST_DATA:path.join(root,'artifacts/page-groups-'+Date.now())}});
  try{
    const page=await app.firstWindow();
    await page.getByRole('dialog',{name:'사용 가이드'}).getByRole('button',{name:'사용 가이드 닫기',exact:true}).click();
    await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
    await app.evaluate(({BrowserWindow},payload)=>BrowserWindow.getAllWindows()[0].webContents.send('desktop:event',payload),payload);
    await page.locator('tbody tr').first().waitFor();
    assert.equal(await page.locator('tbody tr').count(),1);
    assert.match(await page.locator('.table-footer').innerText(),/1개 페이지/);
    await page.locator('tbody tr').first().click();
    await page.locator('.page-evidence-item').nth(3).waitFor();
    assert.equal(await page.locator('.page-evidence-item').count(),4);
    const body=await page.locator('.page-evidence-list').innerText();
    const extraTypes = page.locator('.record-additional-types');
    assert.equal(await extraTypes.getAttribute('open'),null);
    await extraTypes.locator('summary').click();
    assert.match(await page.locator('.record-additional-types-panel').innerText(),/구매·추천 유도/);
    assert.equal(await page.locator('.record-additional-types-panel .type-badge').count(),3);
    await page.keyboard.press('Escape');
    assert.equal(await extraTypes.getAttribute('open'),null);
    for(const text of ['제목','본문','댓글','카 지 노 신 규 가 입 혜 택','원금 보장 고수익 투자 모집','신용 확인 없이 당일 대출 상담 신청']) assert.ok(body.includes(text),text);
    assert.equal(await page.locator('.page-evidence-item img[alt="검사 브라우저에서 촬영한 스크린샷"]').count(),4);
    assert.equal(await page.locator('.page-evidence-item').getByText('해당 위치 캡처',{exact:true}).count(),4);
    await page.locator('.results-layout').evaluate(async el=>{
      await Promise.all(el.getAnimations().map(animation=>animation.finished.catch(()=>{})));
    });
    assert.ok(await page.locator('.record-panel').evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1));
    assert.equal(await page.locator('.evidence-capture-zoom').count(),0);
    await page.getByRole('button',{name:'스크린샷 확대',exact:true}).first().click();
    await page.getByRole('dialog',{name:'스크린샷 확대',exact:true}).waitFor();
    await page.getByRole('button',{name:'스크린샷 닫기',exact:true}).click();
    await page.getByRole('dialog',{name:'스크린샷 확대',exact:true}).waitFor({state:'hidden'});
    await page.screenshot({path:path.join(root,'artifacts/page-grouped-evidence.png')});
    console.log('PASS: one page row, four independent title/body/comment evidence captures');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
