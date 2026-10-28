process.env.CHICKADEE_LANGUAGE = 'ko';
const assert = require('node:assert/strict');
const path = require('node:path');
const {launch} = require('./native-app.cjs');
(async () => {
 const root = path.resolve(__dirname,'../..');
 const app = await launch({args:[path.join(root,'desktop')],env:{...process.env,CHICKADEE_TEST_DATA:path.join(root,'artifacts/settings-save-'+Date.now())}});
 try {
  const page=await app.firstWindow(); page.setDefaultTimeout(15000);
  await page.getByRole('button',{name:'사용 가이드 닫기',exact:true}).click();
  await page.getByRole('button',{name:'설정',exact:true}).click();
  const input=page.getByLabel('최대 페이지',{exact:true});
  const previous=await input.inputValue();
  await input.fill('321');
  await page.getByRole('button',{name:'단축키',exact:true}).click();
  await page.getByRole('button',{name:'일반',exact:true}).click();
  assert.equal(await input.inputValue(),previous,'Leaving without saving discards changes');
  await input.fill('321');
  await page.getByRole('button',{name:'일반 설정 저장',exact:true}).click();
  await page.waitForFunction(async()=> (await window.chickadee.state()).preferences.maxPages===321);
  await page.getByRole('button',{name:'단축키',exact:true}).click();
  await page.getByRole('button',{name:'일반',exact:true}).click();
  assert.equal(await input.inputValue(),'321');
  await page.getByRole('button',{name:'AI 연결',exact:true}).click();
  const toggle=page.getByRole('button',{name:'모델 및 사용 한도',exact:true});
  await toggle.click();
  await page.getByLabel('모델',{exact:true}).waitFor({state:'visible'});
  await toggle.click();
  await page.getByLabel('모델',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.locator('#grok-advanced').evaluate(el=>el.inert),true);
  console.log('PASS: general settings save/discard and animated advanced panel visibility.');
 } finally {await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
