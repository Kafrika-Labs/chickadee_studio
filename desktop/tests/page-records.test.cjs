// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const {test} = require('node:test');
const assert = require('node:assert/strict');

test('generic headings are not labelled as post titles in older evidence', async () => {
  const {evidenceRole} = await import('../src/page-records.mjs');
  assert.equal(evidenceRole({source_role:'title',location:'div:nth-of-type(1) > h3:nth-of-type(1)'}),'소제목');
  assert.equal(evidenceRole({source_role:'title',location:'h3.post-title'}),'제목');
  assert.equal(evidenceRole({source_role:'heading',location:'h2'}),'소제목');
  assert.equal(evidenceRole({source_role:'comment',location:'h3'}),'댓글');
});

test('one page contains title, body, comments and OCR with individual captures', async () => {
  const {groupPageRecords, expandPageIds, pageReview} = await import('../src/page-records.mjs');
  const rows = ['title', 'body', 'comment', 'image'].map((role,index) => ({
    id:`c_${index}`, url:'https://example.invalid/view?id=1', category:index===2?'GAMBLING':'COMMERCIAL',
    source_role:role, source_kind:role==='image'?'image_ocr':'dom_text', image_id:role==='image'?'im_1':undefined,
    location:`#${role}`, evidence_text:`${role}의 서로 다른 광고 문구`, screenshot_id:`capture_${role}`,
  }));
  const before = JSON.stringify(rows);
  const groups = groupPageRecords(rows);
  assert.equal(groups.length,1);
  const group = groups[0];
  assert.equal(group.category,'GAMBLING');
  assert.deepEqual(new Set(group.categories),new Set(['GAMBLING','COMMERCIAL']));
  assert.equal(group.evidence_sources.length,4);
  for (const row of rows) {
    assert.ok(group.evidence_text.includes(row.evidence_text));
    const source = group.evidence_sources.find(source => source.location===row.location);
    assert.equal(source.screenshot_id,row.screenshot_id);
    assert.equal(source.text,row.evidence_text);
  }
  assert.deepEqual(expandPageIds([group.id],groups),rows.map(row=>row.id));
  assert.equal(pageReview(group,Object.fromEntries(rows.map(row=>[row.id,{status:'confirmed'}]))).status,'confirmed');
  assert.equal(pageReview(group,{[group.id]:{status:'confirmed'}}).status,'unreviewed');
  assert.equal(JSON.stringify(rows),before);
});

test('different post queries stay separate and technique details are retained', async () => {
  const {groupPageRecords} = await import('../src/page-records.mjs');
  const rows = [
    {id:'f_1',url:'https://example.invalid/view?id=1',technique:'HOMOGLYPH',location:'#title',evidence_text:'caѕino 가입'},
    {id:'f_2',url:'https://example.invalid/view?id=1',technique:'TRANSPARENT',location:'#comment',evidence_text:'카지노 가입'},
    {id:'c_1',url:'https://example.invalid/view?id=2',category:'COMMERCIAL',location:'img',evidence_text:'20% 할인'},
  ];
  const groups = groupPageRecords(rows, {f_1:{source_role:'title',analysis:{matches:[]},screenshot_id:'title_capture'}});
  assert.equal(groups.length,2);
  assert.deepEqual(groups[0].techniques,['HOMOGLYPH','TRANSPARENT']);
  assert.equal(groups[0].page_evidence[0].screenshot_id,'title_capture');
  assert.equal(groups[0].evidence_sources[0].source_role,'title');
});
