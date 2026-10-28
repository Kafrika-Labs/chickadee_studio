// Actual renderer, Python engine, Korean OCR and report exports. Local fixture only.
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),fs=require('node:fs/promises');
const {launch}=require('./source-ui-harness.cjs');
(async()=>{
 const root=path.resolve(__dirname,'../..'),data=path.join(root,'artifacts/operational-ui-'+Date.now());
 const pixels=await fs.readFile(path.join(root,'tests/fixtures/ocr/promotion.png'));
 const server=http.createServer((req,res)=>{
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  if(req.url==='/restricted.png'){res.writeHead(403);res.end();return;}
  res.writeHead(200,{'Content-Type':req.url==='/banner.png'?'image/png':'text/html; charset=utf-8'});
  res.end(req.url==='/banner.png'?pixels:'<article><p>caѕino 가입 보너스 지급</p><img src="/banner.png"><img src="/restricted.png"></article>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let app;
 try {
  app=await launch({channel:process.platform==='win32'?'msedge':undefined,chromiumSandbox:true,
   env:{...process.env,CHICKADEE_LANGUAGE:'ko',CHICKADEE_TEST_DATA:data}});
  const page=await app.firstWindow();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'사용 가이드 닫기',exact:true}).click();
  await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
  await page.locator('.react-flow__node[data-id="target"]').click();
  await page.getByRole('textbox',{name:'검사 대상 URL'}).fill(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('.header-run-controls button.primary').click();
  let state;const deadline=Date.now()+120000;
  do{state=await page.evaluate(()=>window.chickadee.state());if(!state.running&&state.history.length===1)break;
   await new Promise(resolve=>setTimeout(resolve,100));}while(Date.now()<deadline);
  assert.equal(state.history.length,1,JSON.stringify(state));
  const report=JSON.parse(await fs.readFile(path.join(path.dirname(state.history[0].path),'scan-report.json'),'utf8'));
  assert.equal(report.ocr_summary.completed,1,JSON.stringify(report.errors));
  assert.ok(report.ocr_summary.reasons.some(r=>r.code==='auth_required'&&r.count===1));
  await page.locator('nav').getByRole('button',{name:/검사 분석/}).click();
  await page.locator('[role="tab"]').nth(1).click();
  await page.getByLabel('이미지 처리 사유').waitFor();
  for(const shared of [false,true]){
   const file=path.join(data,shared?'shared.html':'original.html');
   await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
   await page.getByRole('button',{name:'리포트 저장',exact:true}).click();
   await page.getByRole('menuitem',{name:shared?'공유용 리포트':'원본 리포트',exact:true}).click();
   await page.getByText('리포트를 저장했습니다.',{exact:true}).waitFor();
   const html=await fs.readFile(file,'utf8');assert.ok(html.includes('카지노'));
   assert.equal(html.includes('data:image'),!shared);
  }
  await page.screenshot({path:path.join(data,'inspection.png')});assert.deepEqual(errors,[]);
  console.log('PASS: real Korean OCR, image access diagnosis, original report with screenshots, optional redacted sharing copy; no paid calls.');
 }finally{if(app)await app.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
