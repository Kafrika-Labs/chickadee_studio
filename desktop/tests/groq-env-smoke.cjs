// Native packaged startup reads an explicitly supplied inert fixture key. Never runs an agent.
// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const {launch}=require('./native-app.cjs');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const data=path.join(root,'artifacts','groq-env-'+Date.now());await fs.mkdir(data,{recursive:true});
 const file=path.join(data,'.env');const key='gsk_test_fixture_0123456789';
 await fs.writeFile(file,'GROQ_API_KEY='+key+'\n','utf8');
 const app=await launch({executablePath:process.env.CHICKADEE_PACKAGED_EXE||require('electron'),
  args:[...(process.env.CHICKADEE_PACKAGED_EXE?[]:[path.join(root,'desktop')]),'--groq-env-file',file],
  env:{...process.env,CHICKADEE_TEST_DATA:data}});
 try{
  const page=await app.firstWindow();page.setDefaultTimeout(30000);
  await page.getByRole('button',{name:'사용 가이드 닫기',exact:true}).click();
  await page.locator('.header-run-controls button.primary:not(:disabled)').waitFor();
  let state;const deadline=Date.now()+30000;
  do{
   state=await page.evaluate(async()=>{
    const current=await window.chickadee.state();
    return window.chickadee.inspection({run_id:current.run_id});
   });
   if(state.agent.configured)break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }while(Date.now()<deadline);
  assert.equal(state.agent.configured,true);
  assert.equal(state.agent.running,false);
  assert.equal(state.agent.assessments.length,0);
  assert.ok(!JSON.stringify(state).includes(key));
  await page.keyboard.press('Control+,');
  await page.getByRole('button',{name:'AI 연결',exact:true}).click();
  await page.getByText('등록됨',{exact:true}).waitFor();
  await page.getByRole('button',{name:'API 키 등록',exact:true}).click();
  assert.equal(await page.getByLabel('API 키',{exact:true}).getAttribute('type'),'password');
  assert.equal(await page.getByLabel('API 키',{exact:true}).inputValue(),'');
  console.log(JSON.stringify({status:'passed',external_file_read:true,key_not_in_renderer:true,paid_calls:0}));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
