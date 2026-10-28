import React, { useEffect, useState } from 'react';
import { KeyRound, Copy, Check, Clock3, ChevronDown } from 'lucide-react';
import { t } from './i18n.mjs';

export default function SiteAccessSettings({ disabled }) {
  const [sites, setSites] = useState([]), [origin, setOrigin] = useState('');
  const [path, setPath] = useState('/'), [token, setToken] = useState('');
  const [hours, setHours] = useState(1), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [tokenMessage, setTokenMessage] = useState('');
  const [checkUrl, setCheckUrl] = useState(''), [marker, setMarker] = useState('');
  async function preflight(rule = false) {
    setBusy(true); setMessage('');
    try {
      const result = await window.chickadee.accessPreflight({url: checkUrl, marker, rule});
      if (rule) { await window.chickadee.copy(result.rule); setMessage('서버 만료 시각을 포함한 규칙을 복사했습니다. WAF에서 토큰을 직접 입력하세요.'); }
      else setMessage(({verified:'인증 헤더가 있는 요청에서만 확인 문구를 찾았습니다.', public:'인증 없이도 같은 문구가 표시됩니다. 인증 적용 여부는 확인되지 않았습니다.', blocked:'접근이 거부됐습니다.', rate_limited:'요청 제한으로 확인을 중단했습니다.', expired:'등록한 인증이 만료됐습니다.', unconfirmed:'확인 문구를 찾지 못했습니다. 로그인과 차단 상태를 확인하세요.'})[result.status]);
    } catch(error) { setMessage(error.message); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!tokenMessage) return;
    const timer = setTimeout(() => setTokenMessage(''), 3000);
    return () => clearTimeout(timer);
  }, [tokenMessage]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    window.chickadee.siteAccess().then(value => setSites(value.sites)).catch(error => setMessage(error.message));
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  async function apply(value) {
    setBusy(true); setMessage(''); setTokenMessage('');
    try {
      const result = await window.chickadee.siteAccess(value);
      setSites(result.sites); setToken(''); setMessage(t('검사기 인증 설정을 적용했습니다.'));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section className="site-access-settings" aria-label={t('검사기 인증')}>
    <div className="site-access-fields">
      <label>{t('사이트 주소 (HTTPS)')}<input type="url" value={origin} placeholder="https://example.com" disabled={disabled || busy} onChange={e => setOrigin(e.target.value)} /></label>
      <label>{t('허용 경로')}<input value={path} placeholder="/boards" disabled={disabled || busy} onChange={e => setPath(e.target.value)} /></label>
      <div className="site-access-token-field"><div className="site-access-token-label"><label htmlFor="site-access-token">{t('검사 인증 토큰')}</label><span key={tokenMessage} role="status">{tokenMessage}</span></div><div className="site-access-token-input"><input id="site-access-token" type="password" autoComplete="new-password" spellCheck={false} value={token} disabled={disabled || busy} onChange={e => { setToken(e.target.value); setTokenMessage(''); }} />
        <button type="button" aria-label={t('토큰 생성')} title={t('토큰 생성')} disabled={disabled || busy} onClick={() => { setToken(Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('')); setMessage(''); setTokenMessage(t('토큰을 생성했습니다.')); }}><KeyRound size={15} aria-hidden="true" /></button>
        <button type="button" aria-label={t('토큰 복사')} title={t('토큰 복사')} disabled={disabled || busy || !token} onClick={async () => { setTokenMessage(''); setMessage(''); try { await window.chickadee.copy(token); setTokenMessage(t('토큰을 복사했습니다.')); } catch (error) { setMessage(error.message); } }}><Copy size={15} aria-hidden="true" /></button>
      </div></div>
      <label>{t('유효 시간')}<select value={hours} disabled={disabled || busy} onChange={e => setHours(Number(e.target.value))}>{[1, 4, 8, 24].map(n => <option key={n} value={n}>{t('{hours}시간', { hours: n })}</option>)}</select></label>
    </div>
    <div className="site-access-actions">
      <span className="site-access-session"><Clock3 size={14} aria-hidden="true" /><small>{t('앱 종료 시 인증 해제')}</small></span>
      <button className="site-access-apply" type="button" disabled={disabled || busy || !origin || !token} onClick={() => apply({ origin, path_prefix: path, token, hours })}><Check size={14} aria-hidden="true" />{t('인증 적용')}</button>
    </div>
    {message && <p key={message} role="status">{message}</p>}
    <ul>{sites.map(site => <li key={site.origin}><div><strong>{site.origin}{site.path_prefix}</strong><span>{site.expires_at * 1000 > now ? t('등록됨 · WAF 허용 여부는 검사 시 확인') : t('만료됨')} · {new Date(site.expires_at * 1000).toLocaleString()}</span></div><button type="button" disabled={disabled || busy} aria-label={t('{site} 인증 해제', { site: site.origin })} onClick={() => apply({ remove: site.origin })}>{t('해제')}</button></li>)}</ul>
    <details className="site-access-guide"><summary><div><strong>{t('WAF 허용 규칙 안내')}</strong></div><ChevronDown size={16} aria-hidden="true" /></summary><div className="site-access-guide-body">
      <div className="site-access-fields"><label>인증 확인 URL<input type="url" value={checkUrl} onChange={e => setCheckUrl(e.target.value)} placeholder="https://example.com/boards/private" /></label><label>로그인 상태 확인 문구<input value={marker} onChange={e => setMarker(e.target.value)} placeholder="보호된 페이지에만 있는 문구" /></label></div>
      <div className="site-access-actions"><button disabled={disabled || busy || !checkUrl || !marker} onClick={() => preflight()}>접근 확인</button><button disabled={disabled || busy || !checkUrl} onClick={() => preflight(true)}>서버 규칙 복사</button></div>
      <p>{t('운영자가 허용한 사이트에만 전용 인증 헤더를 보냅니다. 사이트 WAF에도 같은 토큰의 허용 규칙을 등록하세요.')}</p>
      <p>{t('토큰은 이번 앱 실행 동안만 보관됩니다. 재시작하면 다시 등록하세요.')}</p>
      <div className="site-access-header-name"><span>{t('인증 헤더')}</span><code>X-Chickadee-Token</code><span>GET / HEAD</span></div>
      <ol>
        <li><span className="site-access-step">1</span><div><h4>{t('사이트에 허용 규칙 등록')}</h4><p>{t('HTTPS 호스트·경로·GET/HEAD·인증 토큰을 함께 확인하고 가능하면 검사기의 고정 IP도 제한하세요. 봇 확인에 필요한 예외만 적용하고 로그인 권한과 요청량 제한은 유지하세요.')}</p></div></li>
        <li><span className="site-access-step">2</span><div><h4>{t('보안 제품의 지원 범위 확인')}</h4><p>{t('이 설정은 사이트의 허용 규칙을 자동으로 만들지 않습니다. Cloudflare Bot Fight Mode는 사용자 지정 Skip 규칙을 지원하지 않으므로 운영자가 사용하는 보안 제품을 확인해야 합니다.')}</p></div></li>
        <li><span className="site-access-step">3</span><div><h4>{t('검사 후 서버 권한 해제')}</h4><p>{t('앱에서 인증을 해제해도 WAF의 토큰은 폐기되지 않습니다. 검사 종료 후 서버의 허용 규칙도 해제하거나 토큰을 교체하세요.')}</p></div></li>
      </ol>
    </div></details>
  </section>;
}
