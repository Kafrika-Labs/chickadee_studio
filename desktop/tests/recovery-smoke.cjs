// Drop the real completion event to verify renderer recovery from durable history.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const {launch}=require('./source-ui-harness.cjs');
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../..');let app;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<article>도서관 이용 시간을 안내합니다.</article>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  app=await launch({env:{...process.env,CHICKADEE_TEST_DATA:path.join(root,'artifacts/recovery-'+Date.now()),CHICKADEE_TEST_DROP_DONE:'1'}});
  const p=await app.firstWindow();p.setDefaultTimeout(45000);
  await p.getByRole('button',{name:'사용 가이드 닫기',exact:true}).click();
  await p.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
  await p.locator('.react-flow__node[data-id="target"]').click();
  await p.getByRole('textbox',{name:'검사 대상 URL'}).fill(`http://127.0.0.1:${server.address().port}/`);
  await p.getByRole('button',{name:'단계 설정 닫기',exact:true}).click();
  await p.getByRole('button',{name:'검사 실행',exact:true}).click();
  await p.getByRole('heading',{name:'탐지 내역',exact:true}).waitFor();
  const state=await p.evaluate(()=>window.chickadee.state());
  assert.equal(state.running,false);assert.equal(state.history.length,1);
  assert.equal(await p.getByText('분석 진행',{exact:true}).count(),0);
  await p.screenshot({path:path.join(root,'artifacts/recovery-smoke.png')});
  const report=JSON.parse(await fs.readFile(path.join(path.dirname(state.history[0].path),'scan-report.json'),'utf8'));
  assert.equal(report.ocr_summary.status,'no_images');
  console.log(JSON.stringify({status:'passed',missed_done_recovered:true,results_view_restored:true,text_only_ocr_skipped:true}));
 }finally{if(app)await app.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
