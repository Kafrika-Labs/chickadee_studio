process.env.CHICKADEE_LANGUAGE = 'ko';
const assert = require('node:assert/strict');
const path = require('node:path');
const { launch } = require('./native-app.cjs');
(async () => {
  const root = path.resolve(__dirname, '../..');
  const app = await launch({args:[path.join(root,'desktop')],env:{...process.env,CHICKADEE_TEST_DATA:path.join(root,'artifacts/failure-ui-'+Date.now())}});
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.getByRole('button',{name:'사용 가이드 닫기',exact:true}).click();
    await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
    await app.evaluate(({ipcMain,BrowserWindow}) => {
      const history = [{id:'failed',url:'https://example.test/blocked',status:'failed',pages:0,findings:0,candidates:0,finished_at:new Date().toISOString()}, {id:'empty',url:'https://example.test/unknown',status:'failed',pages:0,findings:0,candidates:0,finished_at:new Date().toISOString()}];
      const report = {status:'failed',pages_scanned:[],page_diagnostics:[{url:history[0].url,status:'error',http_status:403,error:'HTTP 403',title:'Just a moment...'}],errors:[{url:'https://example.test/script',message:'Resource blocked'}]};
      ipcMain.removeHandler('desktop:history');
      ipcMain.handle('desktop:history',(_,id)=>({report:id==='failed'?report:{status:'failed'}}));
      BrowserWindow.getAllWindows()[0].webContents.send('desktop:event',{kind:'done',result:{findings:[],meta:{entry_url:history[0].url}},report,history});
    });
    await page.getByRole('button',{name:'검사 기록',exact:true}).click();
    await page.locator('tbody tr').filter({hasText:'example.test/blocked'}).click();
    const dialog = page.getByRole('dialog',{name:'실패 이유'});
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /HTTP 403/);
    assert.match(await dialog.innerText(), /Just a moment/);
    assert.match(await dialog.innerText(), /Resource blocked/);
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'detached'});
    await page.locator('tbody tr').filter({hasText:'example.test/unknown'}).click();
    await dialog.getByText('이 기록에는 자세한 실패 원인이 저장되어 있지 않습니다.').waitFor();
    await dialog.getByRole('button',{name:'닫기',exact:true}).last().click();
    console.log('PASS: failed history opens saved HTTP and resource errors; Escape, close and missing-reason fallback work.');
  } finally { await app.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
