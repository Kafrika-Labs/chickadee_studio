// Shared by Electron and the local integration driver.
exports.exportResults = async ({ dialog, window, backend }, options = {}) => {
  const state = await backend.request('state');
  if (state.running || !state.run_id || options.run_id !== state.run_id)
    throw new Error('검사가 끝난 뒤 현재 내역을 다시 확인하세요.');
  const selected = await dialog.showSaveDialog(window, {
    defaultPath: options.ids?.length ? 'chickadee-selected.xlsx' : 'chickadee-results.xlsx',
    filters: [
      { name: 'Excel', extensions: ['xlsx'] },
      { name: 'CSV', extensions: ['csv'] },
    ],
  });
  if (selected.canceled) return null;
  return backend.request('export', {
    path: selected.filePath,
    run_id: state.run_id,
    ...(options.ids ? { ids: options.ids } : {}),
  });
};
