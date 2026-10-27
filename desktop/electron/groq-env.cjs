// Only an explicitly selected file is read. No global key discovery or API calls.
const fs = require('node:fs/promises');
const path = require('node:path');
const { t } = require('./i18n.cjs');
async function startupGroqConfig(argv, readFile = async file => {
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 16384) throw new Error('Invalid env file');
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}) {
  const flags = argv.flatMap((value, i) => value === '--groq-env-file' ? [i] : []);
  if (!flags.length) return null;
  if (flags.length !== 1 || !argv[flags[0]+1] || argv[flags[0]+1].startsWith('--'))
    throw new Error(t("Groq 설정 파일 경로가 필요합니다."));
  let text;
  try { text = await readFile(path.resolve(argv[flags[0]+1])); }
  catch { throw new Error(t("Groq 설정 파일을 읽을 수 없습니다.")); }
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 16384)
    throw new Error(t("Groq 설정 파일 크기를 확인하세요."));
  let keys=[];
  for (const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)) {
    const m=line.match(/^\s*(?:export\s+)?GROQ_API_KEY\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let key=m[1];
    if (/^(['"]).*\1$/.test(key)) key=key.slice(1,-1);
    if (!/^[A-Za-z0-9_-]{10,512}$/.test(key)) throw new Error(t("GROQ_API_KEY 값을 확인하세요."));
    keys.push(key);
  }
  if (keys.length !== 1) throw new Error(t("GROQ_API_KEY를 한 번만 지정하세요."));
  return {api_key: keys[0]};
}
module.exports = {startupGroqConfig};
