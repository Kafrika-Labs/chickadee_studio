const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { t } = require('./i18n.cjs');
const REPO = 'Kafrika-Labs/chickadee_studio';
const RELEASES = `https://github.com/${REPO}/releases`;
function version(value) { return /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number); }
function newer(a, b) { const x = version(a), y = version(b); if (!x || !y) return false; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; }
function trustedAsset(value) { try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'github.com' && !u.username && !u.password && u.pathname.startsWith(`/${REPO}/releases/download/`); } catch { return false; } }
function selectRelease(releases, current, platform, arch) {
  const candidates = releases.filter(r => !r.draft && version(r.tag_name) && newer(r.tag_name, current)).sort((a, b) => newer(a.tag_name, b.tag_name) ? -1 : 1);
  const release = candidates[0];
  if (!release) return null;
  const v = release.tag_name.replace(/^v/, '');
  const suffix = platform === 'win32' ? `win-${arch}.zip` : platform === 'darwin' ? `mac-${arch}.zip` : null;
  const name = `Chickadee-Studio-${v}-${suffix}`;
  const asset = suffix && release.assets?.find(a => a.name === name && trustedAsset(a.browser_download_url));
  const checksum = release.assets?.find(a => a.name === `${name}.sha256` && trustedAsset(a.browser_download_url));
  return { version: v, prerelease: Boolean(release.prerelease), url: `${RELEASES}/tag/${encodeURIComponent(release.tag_name)}`, asset: asset || null, checksum: checksum || null };
}
class Updates {
  constructor({ current, directory, platform = process.platform, arch = process.arch, fetcher = fetch, reveal }) {
    Object.assign(this, { current, directory, platform, arch, fetcher, reveal });
    this.state = { current, status: 'idle', progress: 0 }; this.release = null; this.busy = false; this.file = null;
  }
  getState() { return { ...this.state }; }
  async request(url, timeout = 20000) {
    const response = await this.fetcher(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Chickadee' }, signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? t("업데이트 요청이 많습니다. 잠시 후 다시 확인해 주세요.") : t("릴리스 파일을 가져오지 못했습니다. 다시 시도해 주세요."));
    return response;
  }
  async check() {
    if (this.busy) return this.getState();
    this.busy = true; this.state = { current: this.current, status: 'checking', progress: 0 }; this.file = null;
    try {
      const releases = await (await this.request(`https://api.github.com/repos/${REPO}/releases?per_page=100`)).json();
      if (!Array.isArray(releases)) throw new Error(t("릴리스 정보를 확인할 수 없습니다."));
      this.release = selectRelease(releases, this.current, this.platform, this.arch);
      const r = this.release;
      this.state = { current: this.current, status: !r ? 'current' : r.asset && r.checksum ? 'available' : 'unsupported', version: r?.version, prerelease: r?.prerelease, progress: 0 };
    } catch (error) { this.state = { ...this.state, status: 'error', message: error.message }; }
    finally { this.busy = false; }
    return this.getState();
  }
  async download() {
    if (this.busy) return this.getState();
    const r = this.release;
    if (!r?.asset || !r.checksum) throw new Error(t("이 운영체제에 맞는 업데이트 파일이 없습니다."));
    this.busy = true; this.state = { ...this.state, status: 'downloading', progress: 0 }; this.file = null;
    const target = path.join(this.directory, r.asset.name), partial = target + '.part';
    try {
      const checksumResponse = await this.request(r.checksum.browser_download_url);
      const checksumText = await checksumResponse.text();
      const expected = /^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$/.exec(checksumText);
      if (!expected || expected[2] !== r.asset.name) throw new Error(t("체크섬 파일을 확인할 수 없습니다."));
      await fs.mkdir(this.directory, { recursive: true });
      const response = await this.request(r.asset.browser_download_url, 600000);
      if (!response.body) throw new Error(t("다운로드 응답이 비어 있습니다."));
      const handle = await fs.open(partial, 'w', 0o600);
      const hash = createHash('sha256'); let bytes = 0;
      try {
        for await (const chunk of response.body) {
          bytes += chunk.length;
          if (bytes > 4 * 1024 ** 3 || (r.asset.size && bytes > r.asset.size)) throw new Error(t("업데이트 파일 크기가 올바르지 않습니다."));
          hash.update(chunk); await handle.writeFile(chunk);
          this.state.progress = r.asset.size ? Math.min(99, Math.floor(bytes / r.asset.size * 100)) : 0;
        }
      } finally { await handle.close(); }
      if ((r.asset.size && bytes !== r.asset.size) || hash.digest('hex') !== expected[1].toLowerCase()) throw new Error(t("파일 검증에 실패했습니다. 다시 다운로드해 주세요."));
      await fs.rename(partial, target); this.file = target;
      this.state = { ...this.state, status: 'downloaded', progress: 100 };
    } catch (error) { await fs.rm(partial, { force: true }).catch(() => {}); this.state = { ...this.state, status: 'error', message: error.message }; }
    finally { this.busy = false; }
    return this.getState();
  }
  showFile() { if (!this.file || this.state.status !== 'downloaded') throw new Error(t("먼저 업데이트를 다운로드하세요.")); this.reveal(this.file); }
  notesURL() { return this.release?.url || RELEASES; }
}
module.exports = { Updates, selectRelease, newer, trustedAsset };
