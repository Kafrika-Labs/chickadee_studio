// Current guide navigation and layout against the real renderer; no scans or API calls.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch } = require('./source-ui-harness.cjs');
(async () => {
 const app = await launch({env:{...process.env,CHICKADEE_TEST_DATA:path.resolve(__dirname,'../../artifacts/guide-navigation-'+Date.now())}});
 try {
  const page=await app.firstWindow();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  const guide=page.getByRole('dialog',{name:'사용 가이드',exact:true});
  await guide.waitFor();
  const {guideSteps}=await import('../src/guide-content.mjs');
  for(const size of [{width:1600,height:1000},{width:1280,height:800},{width:720,height:600},{width:390,height:650},{width:640,height:400}]) {
   await page.setViewportSize(size);
   let initial;
   for(const [index,step] of guideSteps.entries()) {
    await guide.getByRole('button',{name:`${index+1}단계: ${step.label}`,exact:true}).click();
    await page.waitForFunction(()=>{const i=document.querySelector('.tutorial-screen img');return i?.complete && i.naturalWidth>0;});
    assert.equal(await guide.locator('h3').innerText(),step.title);
    assert.equal(await guide.locator('.tutorial-instructions > div').count(),step.instructions.length);
    const bounds=await guide.evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth,footer:el.querySelector('footer').getBoundingClientRect().bottom}));
    assert.ok(bounds.scroll<=bounds.width+1,'Guide must not overflow horizontally');
    assert.ok(bounds.footer<=size.height,'Footer remains reachable');
    assert.equal(await guide.locator('.tutorial-content').evaluate(el=>el.scrollTop),0);
    const geometry = await guide.evaluate(el => {
     const box = node => { const {x,y,width,height} = node.getBoundingClientRect(); return {x,y,width,height}; };
     return {dialog:box(el),footer:box(el.querySelector('footer')),content:box(el.querySelector('.tutorial-content'))};
    });
    initial ||= geometry;
    for (const area of ['dialog','footer','content']) {
     for (const dimension of ['x','y','width','height']) {
      assert.ok(Math.abs(geometry[area][dimension]-initial[area][dimension])<1, `${size.width}px ${step.label}: ${area}.${dimension} changed`);
     }
    }
    assert.ok(geometry.content.height >= 100, 'Guide reserves usable reading space');
   }
  }
  await page.setViewportSize({width:1280,height:800});
  await guide.getByRole('button',{name:'2단계: 구성·OCR',exact:true}).click();
  await guide.getByRole('button',{name:'화면 크게 보기',exact:true}).click();
  await page.getByRole('dialog',{name:'가이드 화면 확대',exact:true}).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.tutorial-image-dialog').count(),0);
  assert.equal(await guide.count(),1);
  await page.screenshot({path:path.resolve(__dirname,'../../artifacts/guide-desktop.png')});
  await page.setViewportSize({width:390,height:650});
  await page.screenshot({path:path.resolve(__dirname,'../../artifacts/guide-small.png')});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.tutorial-dialog').count(),0);
  await page.setViewportSize({width:1280,height:800});
  await page.getByRole('button',{name:'설정',exact:true}).click();
  await page.getByRole('button',{name:'사용 가이드',exact:true}).click();
  await guide.waitFor();
  assert.equal(await guide.getByRole('button',{name:'1단계: 검사 시작',exact:true}).getAttribute('aria-current'),'step');
  await page.keyboard.press('Escape');
  for (const size of [{width:1600,height:1000},{width:1280,height:800},{width:900,height:640}]) {
   await page.setViewportSize(size);
   let reference;
   for (const name of ['일반','업데이트','알림','단축키','AI 연결','예약 검사','일반']) {
    await page.getByRole('navigation',{name:'설정 메뉴'}).getByRole('button',{name,exact:true}).click();
    await page.locator('.settings-page-heading h2').filter({hasText:name}).waitFor();
    const geometry = await page.evaluate(() => {
     const box = selector => {const {x,width}=document.querySelector(selector).getBoundingClientRect();return {x,width};};
     return {main:box('.main'),heading:box('.settings-page-heading'),content:box('.settings-page-content')};
    });
    reference ||= geometry;
    assert.deepEqual(geometry,reference,`Settings geometry changed for ${name} at ${size.width}px`);
   }
   await page.getByRole('button',{name:'앱으로 돌아가기',exact:true}).click();
   const main = await page.locator('.main').boundingBox();
   assert.equal(main.x,reference.main.x,'Sidebar width stays fixed when leaving settings');
   assert.equal(main.width,reference.main.width,'Workspace width stays fixed when leaving settings');
   await page.getByRole('button',{name:'설정',exact:true}).click();
  }
  await page.setViewportSize({width:1280,height:800});
  await page.screenshot({path:path.resolve(__dirname,'../../artifacts/settings-layout.png')});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({guideTopics:guideSteps.length,viewports:5,stableGeometry:true,screenshots:true,zoomEscape:true,reopen:true,status:'passed'}));
 } finally {await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
