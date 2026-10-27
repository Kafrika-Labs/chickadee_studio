// Refresh documentation from the actual desktop app and its bundled demo.
// Uses isolated test data; does not call external AI or notification services.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const {launch} = require(process.argv.includes('--source') ? './source-ui-harness.cjs' : './native-app.cjs');
const path = require('node:path');
const fs = require('node:fs/promises');
(async () => {
 const root=path.resolve(__dirname,'../..');
 const guide=path.join(root,'desktop/assets/guide'), docs=path.join(root,'docs/assets/screenshots');
 await fs.mkdir(docs,{recursive:true});
 const app=await launch({args:[path.join(root,'desktop')],env:{...process.env,CHICKADEE_TEST_DATA:path.join(root,'artifacts','capture-docs-'+Date.now())}});
 try {
  const page=await app.firstWindow(); page.setDefaultTimeout(20000);
  await page.setViewportSize({width:1440,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  const button=name=>page.getByRole('button',{name,exact:true});
  const capture=async(name,directory=guide)=>{
   await page.evaluate(()=>document.fonts.ready);
   await page.waitForTimeout(450);
   await page.screenshot({path:path.join(directory,name+'.png'),scale:'css'});
   console.log('Captured '+name);
  };
  await button('사용 가이드 닫기').click();
  await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
  await page.locator('.react-flow__node[data-id="target"]').click();
  await page.getByRole('textbox',{name:'검사 대상 URL'}).fill('https://example.go.kr');
  await capture('start');
  await button('단계 설정 닫기').click();
  await page.locator('.react-flow__node[data-id="ocr"]').click();
  await capture('ocr'); await button('단계 설정 닫기').click();
  await button('검사 옵션').click(); await page.getByRole('menuitem',{name:'데모 검사',exact:true}).click();
  await page.locator('.scan-status strong').filter({hasText:'검사 완료'}).waitFor({timeout:90000});
  await capture('workflow',docs);
  await page.getByRole('button',{name:/^탐지 내역/}).click();
  await page.locator('tbody tr').first().click();
  await capture('review');
  await button('검사 분석').click(); await page.getByRole('tab',{name:'탐색 그래프',exact:true}).click();
  await page.locator('.react-flow__controls-fitview').click();
  await capture('analysis');
  await page.getByRole('tab',{name:'AI 검토',exact:true}).click();
  await capture('ai-review');
  await capture('ai-review',docs);
  await button('탐색 경로').click(); await capture('navigation',docs);
  await button('진행 기록').click(); await button('HTTP 통신').click();
  await capture('http',docs);
  await button('검사 기록').click(); await capture('history');
  await button('설정').click();
  await button('일반').click(); await capture('general');
  await button('AI 연결').click(); await capture('ai');
  await button('알림').click(); await page.setViewportSize({width:1440,height:1300}); await capture('notifications'); await page.setViewportSize({width:1440,height:900});
  await button('예약 검사').click(); await button('예약 추가').click();
  await page.getByLabel('예약 이름',{exact:true}).fill('매일 아침 점검');
  await capture('schedules');
  await button('업데이트').click(); await capture('updates');
  await button('단축키').click(); await page.setViewportSize({width:1440,height:1100}); await capture('shortcuts',docs);
 } finally {await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
