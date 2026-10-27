// These assertions use Korean UI text; English is covered by i18n.test.cjs.
process.env.CHICKADEE_LANGUAGE ??= "ko";
const { test } = require("node:test");
const assert = require("node:assert/strict");
test("OCR outputs follow their destinations without turning back across each other", async () => {
  const {workflowPorts, defaultWorkflow} = await import('../src/workflow.mjs');
  const ports = workflowPorts('ocr', 'out');
  assert.deepEqual(ports.map(p => p.peer), ['techniques', 'candidates']);
  assert.deepEqual(ports.map(p => p.top), [25, 75]);
  for (const port of ports) {
    const edge = defaultWorkflow().edges.find(e => e.source === 'ocr' && e.target === port.peer);
    assert.equal(edge.sourceHandle, port.id);
  }
});
test("collector ports follow destination order so the image path does not cross the text path", async () => {
  const {workflowPorts, defaultWorkflow} = await import('../src/workflow.mjs');
  const ports = workflowPorts('collector', 'out');
  assert.deepEqual(ports.map(p => p.peer), ['techniques', 'ocr', 'candidates']);
  assert.equal(ports.find(p => p.peer === 'ocr').top, 50);
  const image = defaultWorkflow().edges.find(e => e.id === 'collector-ocr');
  assert.equal(image.sourceHandle, ports.find(p => p.peer === 'ocr').id);
});
test("saved disconnected workflows restore the fixed pipeline", async () => {
  const { defaultWorkflow, normalizeWorkflow, branchEnabled } = await import("../src/workflow.mjs");
  const flow = defaultWorkflow();
  flow.edges = [];
  flow.ocr_enabled = false;
  const restored = normalizeWorkflow(flow);
  assert.deepEqual(restored.edges, defaultWorkflow().edges);
  assert.equal(branchEnabled(restored, "techniques"), true);
  assert.equal(branchEnabled(restored, "candidates"), true);
  assert.equal(branchEnabled(restored, "ocr"), false);
});
test("unknown and duplicated nodes or connections cannot become executable workflows", async () => {
  const { defaultWorkflow, normalizeWorkflow } =
    await import("../src/workflow.mjs");
  const bad = defaultWorkflow();
  bad.edges.push({ source: "target", target: "report" });
  assert.throws(() => normalizeWorkflow(bad));
  const duplicate = defaultWorkflow();
  duplicate.nodes[1].id = "target";
  assert.throws(() => normalizeWorkflow(duplicate));
});
test("OCR migrates legacy workflows and follows only its switch", async () => {
  const { defaultWorkflow, normalizeWorkflow, branchEnabled } = await import('../src/workflow.mjs');
  const legacy = defaultWorkflow();
  legacy.version = 1;
  legacy.nodes = legacy.nodes.filter(n => n.id !== "laya");
  legacy.edges = legacy.edges.filter(e => e.source !== "laya" && e.target !== "laya");
  legacy.nodes = legacy.nodes.filter(n => n.id !== "dedup");
  legacy.edges = legacy.edges.filter(e => e.source !== "dedup" && !(e.source === "ocr" && e.target === "techniques")).map(e => e.target === "dedup" ? { ...e, target: "report" } : e);
  legacy.nodes = legacy.nodes.filter(n => n.id !== 'ocr');
  legacy.edges = legacy.edges.filter(e => e.source !== 'ocr' && e.target !== 'ocr');
  delete legacy.ocr_enabled;
  const flow = normalizeWorkflow(legacy);
  assert.equal(flow.nodes.length, 9);
  assert.equal(branchEnabled(flow, 'ocr'), true);
  flow.ocr_enabled = false;
  assert.equal(branchEnabled(normalizeWorkflow(flow), 'ocr'), false);
  flow.ocr_enabled = true;
  flow.edges = flow.edges.filter(e => e.source !== 'ocr');
  assert.equal(branchEnabled(flow, 'ocr'), true);
});
test("v2 layouts retain all user positions and add only the Laya stage", async () => {
  const { defaultWorkflow, normalizeWorkflow } = await import('../src/workflow.mjs');
  const old = defaultWorkflow(); old.version = 2;
  old.nodes = old.nodes.filter(n => n.id !== 'laya');
  old.nodes[0].position = { x: -75, y: 127 };
  old.edges = old.edges.filter(e => e.source !== 'laya' && e.target !== 'laya');
  old.edges.push({source:'candidates',target:'dedup'});
  const restored = normalizeWorkflow(old);
  for (const n of old.nodes) assert.deepEqual(restored.nodes.find(x=>x.id===n.id).position,n.position);
  assert.equal(restored.version,3);
  assert.equal(restored.nodes.filter(n=>n.id==='laya').length,1);
  assert.ok(restored.edges.some(e=>e.source==='ocr'&&e.target==='candidates'));
  assert.ok(restored.edges.some(e=>e.source==='candidates'&&e.target==='laya'));
});
test("old local layout cache cannot hide the new Laya node under dedup", async () => {
  const { defaultWorkflow, restoreWorkflowLayout } = await import('../src/workflow.mjs');
  const nodes=defaultWorkflow().nodes;
  const saved=Object.fromEntries(nodes.filter(n=>n.id!=='laya').map(n=>[n.id,n.position]));
  saved.dedup={x:1100,y:200};saved.report={x:1320,y:200};
  const restored=restoreWorkflowLayout(nodes,saved);
  for(const [id,position] of Object.entries(saved))assert.deepEqual(restored.find(n=>n.id===id).position,position);
  assert.notDeepEqual(restored.find(n=>n.id==='laya').position,saved.dedup);
  assert.deepEqual(restoreWorkflowLayout(restored,null),restored);
  assert.deepEqual(nodes,defaultWorkflow().nodes,'Restoring must not mutate defaults');
});
test("OCR is an image-only branch and no image never becomes completed", async () => {
  const { defaultWorkflow, ocrPresentation }=await import('../src/workflow.mjs');
  const flow=defaultWorkflow();
  assert.equal(flow.edges.find(e=>e.id==='collector-ocr').label,'이미지');
  assert.equal(flow.edges.find(e=>e.id==='collector-candidates').label,'본문');
  assert.deepEqual(ocrPresentation({enabled:true,status:'no_images',completed:0}),{state:'skipped',caption:'이미지 없음'});
  assert.equal(ocrPresentation({enabled:true,status:'completed',completed:2}).state,'done');
  assert.equal(ocrPresentation({enabled:false,status:'disabled'}).state,'disabled');
  assert.equal(ocrPresentation({enabled:true,status:'partial',completed:0,failed:1}).state,'error');
  assert.equal(ocrPresentation({enabled:true,status:'partial',skipped:1}).state,'skipped');
  assert.equal(ocrPresentation({enabled:true,status:'partial',completed:35,unreadable:1}).caption,'35장 처리 · 문자 추출 34장 · 미확인 1장');
  assert.equal(ocrPresentation(undefined),null,'Legacy reports do not invent observations');
});
test("OCR badges require text provenance, including merged evidence; photo classification alone is not OCR", async () => {
  const {hasOCREvidence,ocrPresentation}=await import('../src/workflow.mjs');
  assert.equal(hasOCREvidence({source_kind:'dom_text'}),false);
  assert.equal(hasOCREvidence({source_kind:'image_visual',image_id:'im_1'}),false);
  assert.equal(hasOCREvidence({source_kind:'image_ocr',image_id:'im_2'}),true);
  assert.equal(hasOCREvidence({evidence_sources:[{source_kind:'dom_text'}],_detail:{evidence_sources:[{source_kind:'image_ocr'}]}}),true);
  assert.equal(hasOCREvidence({_detail:{image_id:'im_3'}}),false);
  assert.equal(ocrPresentation({enabled:true,status:'completed',completed:5}).caption,'5장 처리 · 문자 추출 5장');
});
