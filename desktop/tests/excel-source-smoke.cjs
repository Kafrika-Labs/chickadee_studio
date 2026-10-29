// Real scanner + existing results download button. No external site or paid API.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {launch} = require('./source-ui-harness.cjs');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const data = path.join(root, 'artifacts/excel-ui-' + Date.now());
  const app = await launch({channel:process.platform==='win32'?'msedge':undefined,
    chromiumSandbox:true, env:{...process.env,CHICKADEE_LANGUAGE:'ko',CHICKADEE_TEST_DATA:data}});
  try {
    const page = await app.firstWindow();page.setDefaultTimeout(20000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.getByRole('button',{name:'사용 가이드 닫기',exact:true}).click();
    await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
    await page.evaluate(()=>window.chickadee.start({demo:true,url:'http://127.0.0.1/',max_pages:4,preview:false,settle_ms:0,interval_sec:.1,workflow:{version:1,edges:[]}}));
    let state;const deadline=Date.now()+90000;
    do {
      state=await page.evaluate(()=>window.chickadee.state());
      if(!state.running&&state.history.length)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    } while(Date.now()<deadline);
    assert.ok(state.history.length);
    await page.locator('nav').getByRole('button',{name:/탐지 내역/}).click();
    const rows=page.locator('.results-layout tbody tr');await rows.first().waitFor();
    const exported=path.join(data,'all.xlsx');
    await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({filePath:file});},exported);
    const download=page.getByRole('button',{name:'엑셀 저장',exact:true});
    assert.equal(await download.count(),1);
    await download.click();
    await page.getByText('탐지 내역을 저장했습니다.',{exact:true}).waitFor();
    assert.equal((await fs.readFile(exported)).subarray(0,2).toString(),'PK');
    const read=file=>JSON.parse(execFileSync(path.join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python'),['-c',
      "import json,sys;from openpyxl import load_workbook;b=load_workbook(sys.argv[1]);print(json.dumps(list(b.active.values),ensure_ascii=True));b.close()",file],{encoding:'utf8'}));
    const all=read(exported);assert.ok(all.length>2);
    await rows.first().locator('input[type=checkbox]').check();
    const selected=path.join(data,'selected.xlsx');
    await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({filePath:file});},selected);
    await download.click();
    for(let i=0;i<100;i++){if(await fs.stat(selected).catch(()=>null))break;await new Promise(r=>setTimeout(r,50));}
    const subset=read(selected);
    assert.ok(subset.length>1&&subset.length<all.length);
    assert.equal(new Set(subset.slice(1).map(row=>row[3])).size,1);
    assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(data,'excel-export.png')});
    console.log('PASS: real scan, one existing download button, XLSX file parsed independently, whole-result and selected-page export. '+data);
  } finally {await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
