// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),fs=require('node:fs');
(async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/session'&&req.method==='POST'){res.writeHead(303,{'Set-Cookie':'sid=local-test; Path=/; HttpOnly; SameSite=Lax',Location:'/private'});res.end();return;}
  if(req.url==='/private'&&!req.headers.cookie?.includes('sid=local-test')){res.writeHead(302,{Location:'/login'});res.end();return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end(req.url==='/login'?'<form method="post" action="/session"><label>계정<input name="account"></label><label>비밀번호<input name="password" type="password"></label><button>로그인</button></form>':'<article>도서관 이용 시간 안내</article>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const root=path.resolve(__dirname,'../..'),env={...process.env,CHICKADEE_TEST_DATA:path.join(root,'artifacts/login-native-'+Date.now())};delete env.ELECTRON_RUN_AS_NODE;
 let app;
 try{
  app=await require('./native-app.cjs').launch({executablePath:process.env.CHICKADEE_PACKAGED_EXE || require('electron'),args:process.env.CHICKADEE_PACKAGED_EXE ? [] : [path.join(root,'desktop')],env});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'사용 가이드 닫기',exact:true}).click();
  await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
  await page.locator('.react-flow__node[data-id="target"]').click();
  await page.getByRole('textbox',{name:'검사 대상 URL'}).fill(`http://127.0.0.1:${server.address().port}/private`);
  await page.locator('.header-run-controls button.primary').click();
  const prompt=page.getByRole('dialog',{name:'로그인 필요',exact:true});await prompt.waitFor({timeout:60000});
  assert.equal(await prompt.getByRole('button',{name:'로그인 창 열기',exact:true}).evaluate(el=>el===document.activeElement),true);
  const help=prompt.getByRole('button',{name:'로그인 안내',exact:true});
  assert.equal(await help.getAttribute('aria-expanded'),'false');
  await help.click();
  await page.waitForFunction(()=>document.querySelector('.login-help-panel').getBoundingClientRect().height>50);
  const layout=await prompt.evaluate(el=>{
    const site=el.querySelector('.login-site').getBoundingClientRect();
    const panel=el.querySelector('.login-help-panel').getBoundingClientRect();
    const actions=el.querySelector('.login-actions').getBoundingClientRect();
    // Fractional compositor coordinates can differ by less than one pixel.
    return panel.top+1>=site.bottom && actions.top+1>=panel.bottom;
  });
  assert.equal(layout,true);
  await page.screenshot({path:path.join(root,'artifacts/login-help.png')});
  await help.click();
  const request=(await page.evaluate(()=>window.chickadee.state())).authentication.request_id;
  const nextWindow=app.waitForEvent('window');
  await prompt.getByRole('button',{name:'로그인 창 열기',exact:true}).click();
  const login=await nextWindow;
  await login.getByLabel('계정',{exact:true}).fill('demo');await login.getByLabel('비밀번호',{exact:true}).fill('local-secret');
  await login.getByRole('button',{name:'로그인',exact:true}).click();await login.waitForURL('**/private');
  assert.equal(await login.evaluate(()=>typeof window.chickadee),'undefined');
  await page.screenshot({path:path.join(root,'artifacts/login-prompt.png')});
  await prompt.getByRole('button',{name:'로그인 완료 · 검사 재개',exact:true}).click();await prompt.waitFor({state:'detached'});
  await page.locator('.scan-status strong').filter({hasText:'검사 완료'}).waitFor({timeout:180000});
  const state=await page.evaluate(()=>window.chickadee.state());assert.equal(state.authentication,null);
  await assert.rejects(()=>page.evaluate(id=>window.chickadee.completeLogin(id),request));
  const events=fs.readFileSync(path.join(path.dirname(state.history[0].path),'events.jsonl'),'utf8');
  assert.ok(!events.includes('local-secret'));assert.ok(!events.includes('local-test'));
  console.log(JSON.stringify({status:'passed',nativeLogin:true,isolatedWindow:true,sessionResumed:true,noCredentialsInEvents:true}));
 }finally{if(app)await app.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
