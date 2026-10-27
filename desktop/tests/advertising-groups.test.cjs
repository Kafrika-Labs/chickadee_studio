// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('advertising groups separate review topics without treating every loan as illegal', async () => {
  const { advertisingGroup } = await import('../src/advertising-groups.mjs');
  for (const category of ['COMMERCIAL', 'AI_CONTEXT', 'LOAN', 'INVESTMENT']) {
    assert.equal(advertisingGroup({ category, evidence_text: '상담 신청 안내' }), 'general_ads');
  }
  for (const category of ['GAMBLING', 'ADULT', 'DRUGS', 'ACCOUNT_TRADE']) {
    assert.equal(advertisingGroup({ category }), 'illegal_suspected');
  }
  assert.equal(advertisingGroup({ category: 'INVESTMENT', evidence_text: '원금 보장 고수익 투자 모집' }), 'illegal_suspected');
  assert.equal(advertisingGroup({ category: 'LOAN', evidence_text: '신용 확인 없이 즉시 입금' }), 'illegal_suspected');
  assert.equal(advertisingGroup({ technique: 'HOMOGLYPH' }), 'required');
  assert.equal(advertisingGroup({category:'GAMBLING', source_kind:'image_visual'}), 'image_review');
  assert.equal(advertisingGroup({category:'IMAGE_REVIEW'}), 'image_review');
});

test('historical photo signals are neutral and repeated images are collapsed', async () => {
  const { normalizeVisualCandidates, advertisingGroup } = await import('../src/advertising-groups.mjs');
  const signal = {id:'c_1', category:'GAMBLING', source_kind:'image_visual', evidence_text:'도박 이미지',
    url:'https://example.invalid/1', image_id:'im_1', local_ai:{content_visual:{image_sha256:'a'.repeat(64), scores:{gambling:.753}}}};
  const text = {id:'c_3', category:'GAMBLING', source_kind:'image_ocr', evidence_text:'카지노 가입 보너스'};
  const before = JSON.stringify(signal);
  const rows = normalizeVisualCandidates([signal, {...signal,id:'c_2',url:'https://example.invalid/2'}, text]);
  assert.equal(rows.length,2);
  assert.equal(rows[0].category,'IMAGE_REVIEW');
  assert.equal(advertisingGroup(rows[0]),'image_review');
  assert.equal(advertisingGroup(rows[1]),'illegal_suspected');
  assert.doesNotMatch(rows[0].evidence_text,/도박 이미지/);
  assert.equal(rows[0].local_ai.content_visual.scores.gambling,.753);
  assert.equal(JSON.stringify(signal),before);
  assert.deepEqual(normalizeVisualCandidates(rows),rows);
});

test('information and interface assets are excluded independently of site URLs', async () => {
  const {normalizeCandidates, commercialSupport} = await import('../src/advertising-groups.mjs');
  const information = ['인기 검색어 #누리과정 #놀이', '지역사회 놀이 공모전 수상작 발표',
    '정서 행동 발달 분야 특별 할인 안내 작성자 2026.10.22 답변대기', '시민 과학 체험 행사 결과 발표'];
  assert.deepEqual(normalizeCandidates(information.map((text,index)=>({id:`c_${index}`,url:'https://unrelated.example/',
    category:'AI_CONTEXT',evidence_text:text,local_ai:{laya:{score:.99}}}))),[]);
  for(const text of ['상품 할인 혜택 지금 주문하세요','정기 청소 서비스 첫 예약 할인 지금 신청하세요',
    '새로 나온 청소기를 사용해보세요! 먼지 걱정을 줄여드립니다.']) assert.ok(commercialSupport(text));
  const row = {id:'c_logo',category:'GAMBLING',source_kind:'image_visual',image_id:'im_1',url:'https://unrelated.example/',
    local_ai:{content_visual:{image_sha256:'a'.repeat(64)}}};
  assert.deepEqual(normalizeCandidates([row],[{id:'im_1',interface_image:true}]),[]);
  assert.deepEqual(normalizeCandidates([row],Array.from({length:3},(_,i)=>({id:`im_${i}`,image_sha256:'a'.repeat(64),url:`https://unrelated.example/${i}`}))),[]);
});
