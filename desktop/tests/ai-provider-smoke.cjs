const assert = require('node:assert/strict');
const path = require('node:path');
const {launch} = require('./native-app.cjs');
(async () => {
  const app = await launch({executablePath:process.env.CHICKADEE_PACKAGED_EXE || require('electron'),args:process.env.CHICKADEE_PACKAGED_EXE ? [] : [path.resolve(__dirname,'..')],env:{...process.env,CHICKADEE_LANGUAGE:'ko',CHICKADEE_TEST_DATA:path.resolve(__dirname,'../../artifacts/provider-ui-'+Date.now())}});
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    await page.locator('.tutorial-close').click();
    await page.getByRole('button',{name:'설정',exact:true}).click();
    await page.getByRole('button',{name:'AI 연결',exact:true}).click();
    for (const provider of ['openai','anthropic','groq']) {
      await page.getByRole('button',{name:'AI 제공자',exact:true}).click();
      await page.getByRole('menuitemradio',{name:({groq:'Groq',openai:'OpenAI (GPT)',anthropic:'Anthropic (Claude)'})[provider],exact:true}).click();
      await page.getByText('미등록',{exact:true}).waitFor();
      assert.equal(await page.getByLabel('API 키',{exact:true}).inputValue(),'');
      await page.getByLabel('API 키',{exact:true}).fill('fixture_'+provider+'_not_real');
      await page.getByRole('button',{name:'설정 적용',exact:true}).click();
      await page.getByText('등록됨',{exact:true}).waitFor();
      const status = await page.evaluate(async () => {
        const state = await window.chickadee.state();
        return (await window.chickadee.inspection({run_id:state.run_id})).agent;
      });
      assert.equal(status.provider,provider);
      assert.equal(status.running,false);
      assert.ok(!JSON.stringify(status).includes('fixture_'));
      await page.waitForFunction(() => {
        const image = document.querySelector('.ai-provider-brand img');
        return image?.complete && image.naturalWidth > 0;
      });
      assert.ok(await page.locator('.ai-provider-brand img').evaluate(img => img.complete && img.naturalWidth > 0));
    }
    assert.equal(await page.locator('.topbar-right').getByRole('button',{name:'결과 폴더',exact:true}).count(),0);
    await page.screenshot({path:path.resolve(__dirname,'../../artifacts/ai-provider-settings.png')});
    console.log('PASS: provider selection, logos, key clearing, session registration and result-folder removal; no paid requests.');
  } finally {await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
