const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
assert(!/^(<<<<<<<|=======|>>>>>>>)/m.test(html), 'Unresolved merge conflict');
assert(!/\bV2\b/.test(html), 'Legacy V2 remains');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'Duplicate IDs');
assert.equal((html.match(/<script\b/g)||[]).length, 1, 'Expected one application script');
assert(/<script src="app.js" defer><\/script>/.test(html));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lottery-v3-test-'));
const checks = `
const failures=[];let checks=0;
function check(value,label){checks++;if(!value)failures.push(label);}
const input=document.getElementById('numberInput');
const form=document.getElementById('analysisForm');
const result=document.getElementById('resultSection');
const err=document.getElementById('errorText');
function type(value){input.value='';for(const char of value){if(input.value.length<input.maxLength){input.value+=char;input.dispatchEvent(new Event('input',{bubbles:true}));}}}
function submit(){form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
check(input.maxLength===6,'default six digits');
for(const [key,num] of [['first','381527'],['front3','004'],['back3','009'],['last2','06'],['first','004128'],['front3','381'],['last2','27'],['back3','527'],['first','000001']]){
 document.querySelector('[data-mode="'+key+'"]').click();
 check(input.maxLength===num.length,key+' maxLength');
 check(document.querySelectorAll('[data-mode][aria-pressed="true"]').length===1,'one selected mode');
 type(num);check(input.value===num,key+' typed digits preserved');submit();
 check(!result.classList.contains('hidden'),key+' submit works');
 check(err.classList.contains('hidden'),key+' no validation error');
 check(document.querySelector('#summaryCards .number').textContent===num,key+' result preserves leading zeros');
 check(document.querySelectorAll('#summaryCards .card').length===(key==='first'?4:1),key+' card count');
 check(document.querySelectorAll('#positionStats .card').length===num.length,key+' position count');
 if(key==='first'){check([...document.querySelectorAll('#summaryCards .number')].map(x=>x.textContent).join(',')===[num,num.slice(0,3),num.slice(-3),num.slice(-2)].join(','),'six digit breakdown');}
 input.value='1';input.dispatchEvent(new Event('input'));submit();check(!err.classList.contains('hidden'),'short number rejected');
 input.value='';submit();check(result.classList.contains('hidden'),'empty input rejected');
 type(num+'9');check(input.value===num,'excess digit limited');
 document.querySelector('#topNumbers button small').click();check(!result.classList.contains('hidden'),'ranked number child click');
}
document.querySelector('[data-mode="first"]').click();
input.value='x00a4128';input.dispatchEvent(new Event('input'));check(input.value==='004128','pasted input sanitized');
submit();check(!result.classList.contains('hidden'),'sanitized number analyzed');
document.getElementById('dataInput').value=JSON.stringify({source:'test',draws:[{date:'2025-01-01',last2:'01'}]});
document.getElementById('importBtn').click();type('000001');submit();check(document.querySelectorAll('#summaryCards .score').length===1,'missing categories not filled with demo');
document.getElementById('demoBtn').click();type('381527');submit();check(document.querySelectorAll('#summaryCards .score').length===4,'demo reset');
const report=document.createElement('pre');report.id='test-report';report.textContent=JSON.stringify({checks,failures});document.body.append(report);
`;
// Keep defer loading and the relative asset path, as on GitHub Pages.
fs.writeFileSync(path.join(dir,'app.js'), app);
fs.writeFileSync(path.join(dir,'test.html'), html.replace('</body>', '<script>window.addEventListener("load",()=>{'+checks+'});</script></body>'));
const browser = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const run = spawnSync(browser, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--user-data-dir='+path.join(dir,'profile'),'--dump-dom',pathToFileURL(path.join(dir,'test.html')).href], {encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,windowsHide:true});
if(run.error)throw run.error;
const report=run.stdout.match(/<pre id="test-report">(.*?)<\/pre>/);
assert(report, 'Browser checks did not complete: '+run.stderr.slice(-1000));
const result=JSON.parse(report[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
assert.deepEqual(result.failures,[]);
console.log('PASS: '+result.checks+' Chrome DOM/event checks; no merge markers, duplicate IDs, or V2 scripts.');
console.log('Browser test artifacts: '+dir);