// Real renderer + backend. Text bypasses OCR; a real image takes the OCR branch.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const packaged = Boolean(process.env.CHICKADEE_PACKAGED_EXE);
const { launch } = require(packaged ? './native-app.cjs' : './source-ui-harness.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const {defaultWorkflow}=await import(pathToFileURL(path.join(root,'desktop/src/workflow.mjs')));
 const banner=await fs.readFile(path.join(root,'tests/fixtures/ocr/promotion.png'));
 const server=http.createServer((req,res)=>{
  if(req.url==='/image.png'){res.writeHead(200,{'Content-Type':'image/png'});res.end(banner);return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end('<!doctype html><meta charset="utf-8"><article>'+(req.url==='/image'?'<img src="/image.png">':'도서관 이용 시간을 안내합니다.')+'</article>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let app;
 try{
  app=await launch({env:{...process.env,CHICKADEE_TEST_DATA:path.join(root,'artifacts','conditional-ocr-'+Date.now())},
   ...(packaged ? {executablePath:process.env.CHICKADEE_PACKAGED_EXE,args:[]} : {})});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);
  await page.getByRole('button',{name:'사용 가이드 닫기',exact:true}).click();
  await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
  await page.evaluate(()=>window.chickadee.configureRuntime({mode:'standard'}));
  async function run(route,count){
   await page.evaluate(options=>window.chickadee.start(options),{url:`http://127.0.0.1:${server.address().port}/${route}`,workflow:defaultWorkflow(),max_pages:1,settle_ms:0,interval_sec:0,preview:false});
   const until=Date.now()+180000;let state;
   do{
    state=await page.evaluate(()=>window.chickadee.state());
    if(!state.running&&state.history.length===count)break;
    await new Promise(r=>setTimeout(r,100));
   }while(Date.now()<until);
   assert.equal(state.running,false);assert.equal(state.history.length,count);
   return JSON.parse(await fs.readFile(path.join(path.dirname(state.history[0].path),'scan-report.json'),'utf8'));
  }
  const text=await run('text',1);
  assert.equal(text.ocr_summary.status,'no_images');assert.equal(text.ocr_summary.images,0);
  await page.getByRole('button',{name:'검사 구성',exact:true}).click();
  await page.locator('.react-flow__node[data-id="ocr"] .flow-node.skipped').waitFor();
  assert.equal(await page.locator('.react-flow__node[data-id="ocr"] .node-caption').innerText(),'이미지 없음');
  assert.equal(await page.locator('.react-flow__node[data-id="ocr"] .flow-node.done').count(),0);
  await page.screenshot({path:path.join(root,'artifacts/pipeline-text-only.png')});
  const image=await run('image',2);
  assert.equal(image.ocr_summary.images,1);assert.equal(image.ocr_summary.completed,1);
  assert.ok(image.evidence_packets.some(p=>p.source_kind==='image_ocr'&&p.text.includes('카지노')));
  const state=await page.evaluate(()=>window.chickadee.state());
  const resultFolder=path.dirname(state.history[0].path);
  const extra=JSON.parse(await fs.readFile(path.join(resultFolder,'result_extra.json'),'utf8'));
  assert.ok(extra.findings.some(r=>r.technique==='ETC'&&r.evidence_text.includes('카지노')&&r.is_violation===false));
  await page.getByRole('button',{name:'검사 구성',exact:true}).click();
  await page.locator('.react-flow__node[data-id="ocr"] .flow-node.done').waitFor();
  assert.equal(await page.locator('.react-flow__node[data-id="ocr"] .node-caption').innerText(),'1장 처리 · 문자 추출 1장');
  await page.screenshot({path:path.join(root,'artifacts/pipeline-image-only.png')});
  console.log(JSON.stringify({status:'passed',packaged,text_bypasses_ocr:true,image_uses_real_ocr:true,extra_result_created:true,skipped_never_completed:true,paidCalls:0}));
 }finally{
  if(app)await app.close();server.closeAllConnections();await new Promise(r=>server.close(r));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
