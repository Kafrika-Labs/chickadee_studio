const test = require('node:test');
const assert = require('node:assert/strict');
const { exportResults } = require('../electron/result-export.cjs');

test('one save dialog offers XLSX and CSV and forwards selected evidence with the captured run', async () => {
  const requests = [];
  const backend = { request: async (method, args) => {
    requests.push([method, args]);
    return method === 'state' ? {run_id:'r1', running:false} : {path:args.path, count:2};
  }};
  const dialog = {showSaveDialog: async (_window, options) => {
    assert.equal(options.defaultPath, 'chickadee-selected.xlsx');
    assert.deepEqual(options.filters.map(f => f.extensions), [['xlsx'], ['csv']]);
    return {filePath:'C:/selected.xlsx'};
  }};
  const saved = await exportResults({dialog, backend}, {run_id:'r1', ids:['a','b']});
  assert.equal(saved.count, 2);
  assert.deepEqual(requests[1], ['export', {path:'C:/selected.xlsx', run_id:'r1', ids:['a','b']}]);
});

test('cancel sends no export, running or changed results never open the dialog', async () => {
  let dialogs = 0, exports = 0;
  const dialog = {showSaveDialog: async () => {dialogs++;return {canceled:true};}};
  const backend = {request: async method => {
    if(method === 'state') return {run_id:'new',running:false};
    exports++;
  }};
  assert.equal(await exportResults({dialog,backend}, {run_id:'new'}), null);
  await assert.rejects(exportResults({dialog,backend}, {run_id:'old'}));
  assert.equal(dialogs,1);assert.equal(exports,0);
});
