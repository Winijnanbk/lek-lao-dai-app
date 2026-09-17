'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const root=__dirname;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lottery-real-browser-'));
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 let name=url.pathname.replace(/^\/lek-lao-dai-app\//,'')||'index.html';
 if(!['index.html','styles.css','app.js','lottery-core.js','data/draws.json'].includes(name)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':'text/html; charset=utf-8');
 let data=fs.readFileSync(path.join(root,name));
 if(name==='index.html'&&url.searchParams.has('empty'))data=Buffer.from(data.toString().replace('<head>','<head><script>localStorage.clear();window.fetch=async()=>{throw Error("offline")}</script>'));
 if(name==='index.html'&&url.searchParams.has('broken'))data=Buffer.from(data.toString().replace(/<script src="app\.js[^\"]*" defer><\/script>/,'<script src="missing-app.js" defer></script>'));
 res.end(data);
});
let chrome,ws;const errors=[];let checks=0;
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const browser=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
 chrome=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+path.join(dir,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Chrome startup timed out')),15000);chrome.once('error',reject);chrome.stderr.on('data',chunk=>{text+=chunk;const m=text.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const debugPort=new URL(endpoint).port;
 const targets=await (await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();
 ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let seq=0;const pending=new Map();
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>reject(Error('CDP timeout: '+method)),20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 async function wait(expression){for(let n=0;n<150;n++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Page readiness timeout');}
 function check(value,label){checks++;assert(value,label);}
 await send('Runtime.enable');await send('Page.enable');
 for(const width of [320,390,768,1280]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<768});
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/lek-lao-dai-app/index.html'});
  await wait('typeof dataset!=="undefined" && !!dataset && !loading');
  check(await evaluate('dataset.draws.length===60'),'real snapshot loaded');
  check(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'no horizontal overflow '+width);
  for(const [mode,num] of [['first','730640'],['front3','060'],['back3','041'],['last2','04'],['first','004128']]){
   await evaluate(`document.querySelector('[data-mode="${mode}"]').click();document.getElementById('numberInput').focus()`);
   for(const digit of num)await send('Input.insertText',{text:digit});
   check(await evaluate(`document.getElementById('numberInput').value==='${num}'`),'real typing '+mode+' '+width);
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   check(await evaluate(`!document.getElementById('resultSection').classList.contains('hidden') && document.querySelector('#summaryCards .number').textContent==='${num}'`),'Enter analysis '+mode);
   check(await evaluate(`document.querySelectorAll('#summaryCards .card').length===${mode==='first'?4:1}`),'correct breakdown');
   check(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'result fits '+width);
  }
  const report=await evaluate(`(()=>{let n=0;function ok(v){n++;if(!v)throw Error('DOM check '+n)}const input=document.getElementById('numberInput');document.getElementById('clearBtn').click();ok(input.value==='');document.getElementById('analysisForm').requestSubmit();ok(!document.getElementById('errorText').classList.contains('hidden'));input.value='x004128';input.dispatchEvent(new Event('input'));ok(input.value==='004128');document.getElementById('analysisForm').requestSubmit();ok(document.querySelector('#summaryCards .number').textContent==='004128');input.value='\u0e50\u0e50\u0e54\u0e51\u0e52\u0e58';input.dispatchEvent(new Event('input'));ok(input.value==='004128');document.querySelector('#topNumbers button small').click();ok(!document.getElementById('resultSection').classList.contains('hidden'));ok(document.querySelectorAll('[id]').length===new Set([...document.querySelectorAll('[id]')].map(x=>x.id)).size);ok(!document.querySelector('textarea'));return n})()`);checks+=report;
  if(width===390||width===1280){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(dir,'screen-'+width+'.png'),Buffer.from(shot.data,'base64'));}
 }
 check(await evaluate(`(async()=>{const original=window.fetch;const first=dataset.draws[0].first;window.fetch=async()=>{throw Error('offline')};await loadData();const ok=dataset.draws[0].first===first&&!document.getElementById('analyzeBtn').disabled&&document.getElementById('dataStatus').classList.contains('warn');window.fetch=original;return ok})()`),'offline retains real data');
 check(await evaluate(`(async()=>{const original=window.fetch;const old=dataset;window.fetch=async()=>({ok:true,json:async()=>({schemaVersion:1,draws:[]})});await loadData();const ok=dataset===old;window.fetch=original;return ok})()`),'invalid snapshot preserves data');
 check(await evaluate(`(async()=>{const original=window.fetch;let calls=0;window.fetch=async(...args)=>{calls++;return original(...args)};await Promise.all([loadData(),loadData()]);window.fetch=original;return calls===1})()`),'concurrent refresh deduplicated');
 check(await evaluate(`(async()=>{const original=window.fetch,oldSet=window.setTimeout;window.setTimeout=(fn,ms)=>oldSet(fn,ms===12000?20:ms);window.fetch=(_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))));await loadData();window.fetch=original;window.setTimeout=oldSet;return !loading&&!document.getElementById('refreshBtn').disabled&&!!dataset})()`),'timeout recovers');
 await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/lek-lao-dai-app/index.html?empty=1'});
 await wait('typeof loading!=="undefined" && !loading');
 check(await evaluate('dataset===null && document.getElementById("analyzeBtn").disabled'),'no data does not fabricate results');
 check(await evaluate('document.getElementById("dataStatus").classList.contains("warn")'),'no-data error visible');
 await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/lek-lao-dai-app/index.html?broken=1'});
 await wait('document.getElementById("dataStatus")?.classList.contains("warn")');
 check(await evaluate('!window.lotteryAppStarted && !document.getElementById("refreshBtn").disabled'),'missing application script offers recovery instead of indefinite loading');
 check(errors.length===0,'no uncaught browser exceptions: '+errors.join(','));
 console.log('PASS '+checks+' Chrome checks: 320/390/768/1280px, real typing and Enter, leading zeros, Thai digits, clear, rank selection, API snapshot, offline, invalid response, timeout, concurrent refresh and empty state.');
 console.log('Screenshots: '+dir);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{if(ws)ws.close();if(chrome)chrome.kill();server.close();});