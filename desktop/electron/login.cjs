const { randomUUID } = require('node:crypto');
const { t } = require('./i18n.cjs');

function webURL(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error(t("웹 로그인 주소만 열 수 있습니다."));
  return url;
}
function playwrightCookie(cookie) {
  return { name:cookie.name, value:cookie.value, domain:cookie.domain, path:cookie.path,
    httpOnly:cookie.httpOnly, secure:cookie.secure,
    ...(cookie.expirationDate ? {expires:cookie.expirationDate} : {}),
    sameSite:({strict:'Strict',lax:'Lax',no_restriction:'None'})[cookie.sameSite] || 'Lax' };
}
class LoginWindow {
  constructor({BrowserWindow, session, backend, owner}) { Object.assign(this,{BrowserWindow,session,backend,owner}); this.current=null; }
  async open(requestId) {
    const pending=await this.backend.request('login-session',{request_id:requestId});
    const target=webURL(pending.url);
    if(this.current?.requestId===requestId) { this.current.window.show(); this.current.window.focus(); return; }
    await this.close();
    const isolated=this.session.fromPartition('chickadee-login-'+randomUUID(),{cache:false});
    isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    isolated.setPermissionCheckHandler(()=>false);
    isolated.on('will-download',event=>event.preventDefault());
    for(const cookie of pending.cookies) {
      const host=cookie.domain.replace(/^\./,'');
      if(![target.hostname,webURL(pending.requested_url).hostname].some(name=>name===host||name.endsWith('.'+host))) continue;
      await isolated.cookies.set({url:(cookie.secure?'https://':'http://')+host+(cookie.path||'/'),
        name:cookie.name,value:cookie.value,domain:cookie.domain,path:cookie.path,secure:cookie.secure,httpOnly:cookie.httpOnly,
        ...(cookie.expires>0?{expirationDate:cookie.expires}:{}),sameSite:({Strict:'strict',Lax:'lax',None:'no_restriction'})[cookie.sameSite]||'lax'});
    }
    const win=new this.BrowserWindow({width:1000,height:780,title:t("사이트 로그인 · 완료 후 Chickadee에서 검사 재개"),
      parent:this.owner(),autoHideMenuBar:true,webPreferences:{session:isolated,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
    this.current={requestId,window:win,session:isolated,target};
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',(event,url)=>{try{webURL(url);}catch{event.preventDefault();}});
    win.webContents.on('will-redirect',(event,url)=>{try{webURL(url);}catch{event.preventDefault();}});
    win.webContents.on('page-title-updated',event=>event.preventDefault());
    // Closing the login window never silently resumes the scanner.
    win.on('close',event=>{if(this.current?.window===win){event.preventDefault();win.hide();this.owner()?.show();this.owner()?.focus();}});
    try { await win.loadURL(target.href); }
    catch { throw new Error(t("로그인 페이지를 열지 못했습니다. 로그인 창에서 연결 상태를 확인하세요.")); }
  }
  async complete(requestId, skip=false) {
    const pending=await this.backend.request('login-session',{request_id:requestId});
    if(skip) { await this.backend.request('login-complete',{request_id:requestId,skip:true}); await this.close(requestId); return; }
    const current=this.current;
    if(!current || current.requestId!==requestId) throw new Error(t("먼저 로그인 창을 열어 로그인해 주세요."));
    const hostname=webURL(pending.requested_url).hostname;
    const cookies=(await current.session.cookies.get({})).filter(c=>{const domain=c.domain.replace(/^\./,'');return hostname===domain||hostname.endsWith('.'+domain);}).map(playwrightCookie);
    await this.backend.request('login-complete',{request_id:requestId,cookies});
    await this.close(requestId);
  }
  async close(requestId) {
    if(requestId && this.current?.requestId!==requestId) return;
    const previous=this.current; this.current=null;
    if(!previous) return;
    if(!previous.window.isDestroyed()) previous.window.destroy();
    await previous.session.clearStorageData();
    await previous.session.clearCache();
  }
}
module.exports={LoginWindow,webURL,playwrightCookie};
