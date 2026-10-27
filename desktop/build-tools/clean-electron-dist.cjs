// Match electron-builder's normal archive cleanup when using an installed
// official distribution. Otherwise its demo ASAR becomes a second app archive.
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = async ({ appOutDir, electronPlatformName }) => {
  if (electronPlatformName !== 'win32') throw new Error('Expected a Windows distribution');
  const output = path.resolve(appOutDir);
  const artifacts = path.resolve(__dirname, '../../artifacts');
  if (!output.startsWith(artifacts + path.sep)) throw new Error('Build output must be inside artifacts');
  await fs.rm(path.join(output, 'resources/default_app.asar'), { force: true });
  await fs.rm(path.join(output, 'version'), { force: true });
};
