'use strict';
const {TYPES,validateDataset,calculate,records}=LotteryCore;
const $=id=>document.getElementById(id);
const CACHE_KEY='lek-lao-dai-glo-v1';
const positionNames=['หลักแสน','หลักหมื่น','หลักพัน','หลักร้อย','หลักสิบ','หลักหน่วย'];
const dateText=date=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(date+'T00:00:00Z'));
let dataset=null,mode='first',loading=false;
function normalize(value){return value.replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-0x0e50)).replace(/\D/g,'');}
function renderData(){
 $('analyzeBtn').disabled=!dataset;
 if(!dataset)return;
 const d=dataset.draws[0];$('dataHeading').textContent='ผลสลากงวด '+dateText(d.date);
 $('latestResults').innerHTML=Object.keys(TYPES).map(key=>`<div class="latest-item"><p>${TYPES[key].label}</p><strong>${Array.isArray(d[key])?d[key].join(' · '):d[key]}</strong></div>`).join('');
 $('checkedAt').textContent='ระบบตรวจแหล่งข้อมูลเมื่อ '+new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(dataset.fetchedAt))+' น. • มีประวัติ '+dataset.draws.length+' งวด';
 renderTop();
}
function status(text,warn=false){$('dataStatus').textContent=text;$('dataStatus').classList.toggle('warn',warn);}
function isNewer(next){return !dataset||next.draws[0].date>dataset.draws[0].date||(next.draws[0].date===dataset.draws[0].date&&next.fetchedAt>=dataset.fetchedAt);}
async function loadData(){
 if(loading)return;
 loading=true;$('refreshBtn').disabled=true;$('refreshBtn').textContent='กำลังอัปเดต…';$('refreshBtn').setAttribute('aria-busy','true');
 status(dataset?'กำลังตรวจข้อมูลใหม่ คุณยังดูสถิติจากข้อมูลที่มีได้':'กำลังโหลดผลสลากจริง กรุณารอสักครู่…');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch('./data/draws.json?t='+Date.now(),{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('HTTP '+response.status);
  const next=validateDataset(await response.json());
  if(isNewer(next)){dataset=next;try{localStorage.setItem(CACHE_KEY,JSON.stringify(dataset));}catch{}}
  renderData();
  const age=(Date.now()-Date.parse(dataset.draws[0].date+'T00:00:00+07:00'))/86400000;
  const checkedAge=(Date.now()-Date.parse(dataset.fetchedAt))/3600000;
  status((age>20||checkedAge>48?'ข้อมูลอาจยังไม่ถึงงวดปัจจุบัน • ':'พร้อมใช้งาน • ')+dataset.draws.length+' งวด จากสำนักงานสลากฯ • ถึง '+dateText(dataset.draws[0].date),age>20||checkedAge>48);
  if(!$('resultSection').classList.contains('hidden'))analyze(false);
 }catch{
  status(dataset?'เชื่อมต่อไม่ได้ แสดงข้อมูลที่บันทึกไว้ถึง '+dateText(dataset.draws[0].date)+' • ลองกดอัปเดตอีกครั้ง':'ยังโหลดผลสลากไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วกดอัปเดตผลหวย',true);
  if(!dataset){$('dataHeading').textContent='ยังไม่มีข้อมูลผลสลาก';$('topNumbers').textContent='เมื่อโหลดข้อมูลสำเร็จ เลขย้อนหลังจะแสดงที่นี่';}
 }finally{clearTimeout(timer);loading=false;$('refreshBtn').disabled=false;$('refreshBtn').textContent='อัปเดตผลหวย';$('refreshBtn').setAttribute('aria-busy','false');}
}
function setMode(key){
 mode=key;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===key)));
 $('inputLabel').textContent=key==='first'?'เลขสลาก 6 หลัก':TYPES[key].label;
 $('numberInput').maxLength=TYPES[key].length;$('numberInput').placeholder=key==='first'?'เช่น 381527':key==='last2'?'เช่น 27':'เช่น 027';
 $('inputHelp').textContent='ใส่เลขได้ครบ '+TYPES[key].length+' หลัก รวมเลข 0 ที่อยู่ด้านหน้า';
 $('numberInput').value='';$('numberInput').removeAttribute('aria-invalid');$('resultSection').classList.add('hidden');$('errorText').classList.add('hidden');renderTop();
}
function summary(key,num,r){return `<article class="card"><h3>${TYPES[key].label}${key==='first'?' (6 หลัก)':''}</h3><div class="number">${num}</div><p class="frequency">เคยออก ${r.freq} จาก ${r.n} งวด</p><small>${r.gap<0?'ยังไม่พบในช่วงข้อมูลนี้':r.gap===0?'พบในงวดล่าสุด':`ห่างจากครั้งล่าสุด ${r.gap} งวด`}</small><div class="score">คะแนนสถิติ ${r.score.toFixed(1)}/100</div><div class="bar"><div class="fill" style="width:${r.score}%"></div></div></article>`;}
function analyze(focus=true){
 const num=normalize($('numberInput').value.trim());$('numberInput').value=num;
 if(!new RegExp(`^\\d{${TYPES[mode].length}}$`).test(num)||!dataset){$('errorText').textContent=dataset?`กรุณากรอกเลขให้ครบ ${TYPES[mode].length} หลัก`:'กรุณารอข้อมูลผลสลาก หรือกดอัปเดตผลหวย';$('errorText').classList.remove('hidden');$('numberInput').setAttribute('aria-invalid','true');$('resultSection').classList.add('hidden');return;}
 $('errorText').classList.add('hidden');$('numberInput').removeAttribute('aria-invalid');
 const parts=mode==='first'?[['first',num],['front3',num.slice(0,3)],['back3',num.slice(-3)],['last2',num.slice(-2)]]:[[mode,num]];
 const results=parts.map(([key,number])=>({key,number,r:calculate(dataset,key,number)}));
 $('resultTitle').textContent='ผลวิเคราะห์เลข '+num;
 $('resultSource').textContent=`จากผลจริง ${dataset.draws.length} งวด • ${dateText(dataset.draws[dataset.draws.length-1].date)} – ${dateText(dataset.draws[0].date)}`;
 $('summaryCards').innerHTML=results.map(x=>summary(x.key,x.number,x.r)).join('');
 $('reasonRows').innerHTML=results.map(({key,r})=>`<tr><td>${TYPES[key].label}</td><td>${r.frequencyScore.toFixed(1)}</td><td>${r.digitScore.toFixed(1)}</td><td>${r.recentScore.toFixed(1)}</td><td>${r.score.toFixed(1)}</td></tr>`).join('');
 const r=results[0].r;$('positionTitle').textContent='ดูทีละหลัก · '+TYPES[mode].label;
 $('positionHelp').textContent=`นับเฉพาะรางวัลประเภทนี้ ${r.total} เลข ใน ${r.n} งวด`;
 $('positionStats').innerHTML=r.positions.map((p,i)=>`<div class="card"><h3>${positionNames[6-num.length+i]} · เลข ${p.digit}</h3><p>พบ ${p.matches} จาก ${p.total} เลข</p><details><summary>ดูความถี่เลข 0–9 ในหลักนี้</summary><div class="digit-list">${p.counts.map((n,d)=>`<span><b>${d}</b>${n} ครั้ง</span>`).join('')}</div></details></div>`).join('');
 $('resultSection').classList.remove('hidden');if(focus)$('resultTitle').focus();
}
function renderTop(){
 $('topHeading').textContent='เลขที่เคยออกใน'+TYPES[mode].label;
 if(!dataset)return;
 const nums=[...new Set(records(dataset,mode).flatMap(r=>r.numbers))];
 $('topNumbers').innerHTML=nums.map(num=>({num,r:calculate(dataset,mode,num)})).sort((a,b)=>b.r.score-a.r.score||a.num.localeCompare(b.num)).slice(0,10).map(({num,r})=>`<button type="button" data-number="${num}">${num}<small>เคยออก ${r.freq} งวด</small></button>`).join('');
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('numberInput').addEventListener('input',()=>{$('numberInput').value=normalize($('numberInput').value).slice(0,TYPES[mode].length);$('resultSection').classList.add('hidden');$('errorText').classList.add('hidden');$('numberInput').removeAttribute('aria-invalid');});
$('clearBtn').addEventListener('click',()=>{$('numberInput').value='';$('numberInput').dispatchEvent(new Event('input'));$('numberInput').focus();});
$('analysisForm').addEventListener('submit',e=>{e.preventDefault();analyze();});
$('topNumbers').addEventListener('click',e=>{const b=e.target.closest('[data-number]');if(b){$('numberInput').value=b.dataset.number;analyze();}});
$('refreshBtn').addEventListener('click',loadData);
try{const saved=localStorage.getItem(CACHE_KEY);if(saved)dataset=validateDataset(JSON.parse(saved));}catch{}
setMode('first');renderData();loadData();