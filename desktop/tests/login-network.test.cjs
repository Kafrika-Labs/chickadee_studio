const test = require('node:test');
const assert = require('node:assert/strict');
const {LoginWindow} = require('../electron/login.cjs');

test('isolated login configures the protected proxy before navigation and releases it on close', async () => {
  const actions=[];
  const isolated={setProxy:async value=>actions.push(['proxy',value]),setPermissionRequestHandler(){},setPermissionCheckHandler(){},on(){},
    cookies:{set:async()=>{},get:async()=>[]},clearStorageData:async()=>{},clearCache:async()=>{}};
  class Window {
    constructor() { this.webContents={setWebRTCIPHandlingPolicy:value=>actions.push(['webrtc',value]),setWindowOpenHandler(){},on(){}}; }
    on(){} isDestroyed(){return false;}destroy(){}show(){}focus(){}
    async loadURL(url){actions.push(['navigate',url]);}
  }
  const backend={request:async (method)=>{
    actions.push(['backend',method]);
    if(method==='login-session')return {url:'https://example.test/login',requested_url:'https://example.test/private',cookies:[]};
    if(method==='login-network')return {proxy:'socks5://127.0.0.1:12345'};
    return {};
  }};
  const login=new LoginWindow({BrowserWindow:Window,session:{fromPartition:()=>isolated},backend,owner:()=>null});
  await login.open('r1');
  assert.deepEqual(actions.find(x=>x[0]==='proxy')[1],{proxyRules:'socks5://127.0.0.1:12345',proxyBypassRules:'<-loopback>'});
  assert.ok(actions.findIndex(x=>x[0]==='proxy')<actions.findIndex(x=>x[0]==='navigate'));
  assert.deepEqual(actions.find(x=>x[0]==='webrtc'),['webrtc','disable_non_proxied_udp']);
  await login.close();
  assert.ok(actions.some(x=>x[1]==='login-network-close'));
});
