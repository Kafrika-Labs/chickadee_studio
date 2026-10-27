const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { Updates, selectRelease, newer } = require('../electron/updates.cjs');
const name = 'Chickadee-Studio-0.9.0-win-x64.zip';
const base = 'https://github.com/Kafrika-Labs/chickadee_studio/releases/download/v0.9.0/';
const body = Buffer.from('archive-test');
const release = { tag_name: 'v0.9.0', prerelease: true, assets: [{ name, browser_download_url: base + name, size: body.length }, { name: name + '.sha256', browser_download_url: base + name + '.sha256' }] };
test('release selection handles numeric versions, drafts, unsupported platforms and untrusted assets', () => {
  assert.equal(newer('v0.10.0', '0.9.0'), true);
  assert.equal(newer('v0.9.0', '0.10.0'), false);
  assert.equal(selectRelease([release], '0.9.0', 'win32', 'x64'), null);
  assert.equal(selectRelease([{ ...release, draft: true }], '0.8.0', 'win32', 'x64'), null);
  assert.equal(selectRelease([release], '0.8.0', 'darwin', 'arm64').asset, null);
  assert.equal(selectRelease([release], '0.8.0', 'win32', 'x64').prerelease, true);
  assert.equal(selectRelease([{ ...release, assets: [{ ...release.assets[0], browser_download_url: 'https://evil.invalid/app.zip' }] }], '0.8.0', 'win32', 'x64').asset, null);
});
test('downloads only verified assets and deletes failed partial files', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chickadee-updates-'));
  let bad = false, revealed;
  const hash = createHash('sha256').update(body).digest('hex');
  const updater = new Updates({ current: '0.8.0', directory, platform: 'win32', arch: 'x64', reveal: file => { revealed = file; }, fetcher: async url => {
    if (url.includes('api.github.com')) return Response.json([release]);
    if (url.endsWith('.sha256')) return new Response(`${bad ? '0'.repeat(64) : hash}  ${name}\n`);
    return new Response(body);
  } });
  try {
    assert.equal((await updater.check()).status, 'available');
    assert.equal((await updater.download()).status, 'downloaded');
    updater.showFile(); assert.equal(revealed, path.join(directory, name));
    assert.deepEqual(await fs.readFile(revealed), body);
    bad = true;
    assert.equal((await updater.download()).status, 'error');
    assert.throws(() => updater.showFile());
    await assert.rejects(fs.access(path.join(directory, name + '.part')), { code: 'ENOENT' });
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
