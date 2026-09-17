'use strict';
const TYPES = {
  first: {label:'รางวัลที่ 1 (6 หลัก)',length:6,count:1},
  front3: {label:'เลขหน้า 3 ตัว',length:3,count:2},
  back3: {label:'เลขท้าย 3 ตัว',length:3,count:2},
  last2: {label:'เลขท้าย 2 ตัว',length:2,count:1}
};
// Entire dataset is fictional. Never mix these records with imported results.
const DEMO = {source:'ข้อมูลจำลองสำหรับทดลอง ไม่ใช่ผลสลากจริง',demo:true,draws:[
 ['2025-06-16','381527',['381','004'],['527','009'],'27'],
 ['2025-06-01','004128',['105','832'],['027','128'],'06'],
 ['2025-05-16','725381',['381','267'],['527','910'],'94'],
 ['2025-05-01','918207',['009','521'],['207','613'],'51'],
 ['2025-04-16','350047',['350','047'],['381','004'],'27'],
 ['2025-04-01','682519',['682','108'],['519','527'],'87'],
 ['2025-03-16','103826',['381','826'],['103','042'],'79'],
 ['2025-03-01','497230',['497','230'],['128','901'],'61'],
 ['2025-02-16','831005',['831','005'],['005','381'],'32'],
 ['2025-02-01','260719',['260','719'],['719','027'],'09'],
 ['2025-01-16','571382',['571','382'],['382','004'],'90'],
 ['2025-01-02','009641',['009','641'],['641','527'],'21']
].map(([date,first,front3,back3,last2])=>({date,first,front3,back3,last2}))};
function validateDataset(value) {
 if(!value || typeof value.source!=='string' || !value.source.trim() || value.source.length>200 || !Array.isArray(value.draws) || !value.draws.length || value.draws.length>10000) throw Error('ระบุ source และ draws จำนวน 1–10,000 งวด');
 const seen=new Set();
 const draws=value.draws.map((row,i)=>{
  if(!row || typeof row.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw Error(`งวดที่ ${i+1}: วันที่ต้องเป็น YYYY-MM-DD`);
  const d=new Date(row.date+'T00:00:00Z');
  if(!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==row.date || row.date>new Date().toISOString().slice(0,10) || seen.has(row.date)) throw Error(`งวดที่ ${i+1}: วันที่ไม่ถูกต้อง เป็นอนาคต หรือซ้ำกัน`);
  seen.add(row.date);const clean={date:row.date};
  for(const [key,type] of Object.entries(TYPES)) {
   if(row[key]===undefined) continue;
   const nums=type.count===1?[row[key]]:row[key];
   if(!Array.isArray(nums) || nums.length!==type.count || !nums.every(n=>typeof n==='string' && new RegExp(`^\\d{${type.length}}$`).test(n))) throw Error(`งวดที่ ${i+1}: ${type.label} ต้องมี ${type.count} เลข เป็นข้อความยาว ${type.length} หลัก`);
   clean[key]=type.count===1?nums[0]:[...nums];
  }
  if(Object.keys(clean).length===1) throw Error(`งวดที่ ${i+1}: ไม่มีข้อมูลรางวัล`);
  return clean;
 }).sort((a,b)=>b.date.localeCompare(a.date));
 return {source:value.source.trim(),demo:false,draws};
}
function records(dataset,key) {
 return dataset.draws.filter(d=>d[key]!==undefined).map(d=>({date:d.date,numbers:Array.isArray(d[key])?d[key]:[d[key]]}));
}
function calculate(dataset,key,num) {
 const rows=records(dataset,key),n=rows.length;
 if(!n)return null;
 const numbers=rows.flatMap(r=>r.numbers),freq=rows.filter(r=>r.numbers.includes(num)).length,gap=rows.findIndex(r=>r.numbers.includes(num));
 const positions=[...num].map((digit,i)=>({digit,counts:Array.from({length:10},(_,v)=>numbers.filter(x=>x[i]===String(v)).length),matches:numbers.filter(x=>x[i]===digit).length,total:numbers.length}));
 const recent=rows.slice(0,10),recentHits=recent.filter(r=>r.numbers.includes(num)).length;
 const frequencyScore=freq/n*40,digitScore=positions.reduce((sum,p)=>sum+p.matches/p.total,0)/num.length*40,recentScore=recentHits/recent.length*20;
 return {n,total:numbers.length,freq,gap,positions,recentN:recent.length,recentHits,frequencyScore,digitScore,recentScore,score:Math.round((frequencyScore+digitScore+recentScore)*10)/10,latest:rows[0].date};
}
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const positionNames=['หลักแสน','หลักหมื่น','หลักพัน','หลักร้อย','หลักสิบ','หลักหน่วย'];
let dataset=DEMO,mode='first';
function renderStatus(){
 $('dataStatus').textContent=(dataset.demo?'โหมดทดลอง • ':'ข้อมูลนำเข้า • ')+dataset.source+'\n'+dataset.draws.length+' งวด • ล่าสุดในชุดข้อมูล '+dataset.draws[0].date+(dataset.demo?'':' • ยังไม่ได้ยืนยันความถูกต้องกับแหล่งทางการ');
}
function setMode(key){
 mode=key;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===key)));
 $('inputLabel').textContent=key==='first'?'เลขสลาก 6 หลัก':TYPES[key].label;
 $('numberInput').maxLength=TYPES[key].length;$('numberInput').placeholder=key==='first'?'เช่น 381527':key==='last2'?'เช่น 27':'เช่น 027';
 $('numberInput').value='';$('resultSection').classList.add('hidden');$('errorText').classList.add('hidden');renderTop();
}
function summary(key,num,r){
 return `<article class="card"><h3>${TYPES[key].label}</h3><div class="number">${num}</div>${r?`<div class="score">${r.score.toFixed(1)} / 100</div><div class="bar"><div class="fill" style="width:${r.score}%"></div></div><p>พบใน ${r.freq} / ${r.n} งวด</p><small>${r.gap<0?'ไม่พบในชุดข้อมูล':r.gap===0?'พบในงวดล่าสุดของประเภทนี้':`ห่าง ${r.gap} งวดที่มีข้อมูล`}<br>มี ${r.total} เลข • ล่าสุด ${r.latest}</small>`:'<p>ยังไม่มีข้อมูลย้อนหลังของรางวัลประเภทนี้</p>'}</article>`;
}
function analyze(){
 const num=$('numberInput').value.trim();
 if(!new RegExp(`^\\d{${TYPES[mode].length}}$`).test(num)){$('errorText').textContent=`กรุณากรอกตัวเลขให้ครบ ${TYPES[mode].length} หลัก`;$('errorText').classList.remove('hidden');$('resultSection').classList.add('hidden');return;}
 $('errorText').classList.add('hidden');
 const selections=mode==='first'?[['first',num],['front3',num.slice(0,3)],['back3',num.slice(-3)],['last2',num.slice(-2)]]:[[mode,num]];
 const results=selections.map(([key,number])=>({key,number,r:calculate(dataset,key,number)}));
 $('resultTitle').textContent='ผลวิเคราะห์เลขของคุณ: '+num;
 $('resultSource').textContent=dataset.source;
 $('summaryCards').innerHTML=results.map(x=>summary(x.key,x.number,x.r)).join('');
 $('reasonRows').innerHTML=results.map(({key,r})=>`<tr><td>${TYPES[key].label}</td>${r?`<td>${r.frequencyScore.toFixed(1)}</td><td>${r.digitScore.toFixed(1)}</td><td>${r.recentScore.toFixed(1)} (${r.recentHits}/${r.recentN} งวด)</td><td>${r.score.toFixed(1)}</td>`:'<td colspan="4">ไม่มีข้อมูล — ไม่คำนวณคะแนน</td>'}</tr>`).join('');
 const selected=results[0].r;
 $('positionTitle').textContent='รูปแบบรายหลัก • '+TYPES[mode].label;
 $('positionHelp').textContent=selected?`นับจาก ${selected.total} เลข ใน ${selected.n} งวดของรางวัลประเภทนี้เท่านั้น สัดส่วนต่อเลขรางวัล ไม่ใช่โอกาสออกงวดหน้า`:'ยังไม่มีข้อมูลสำหรับวิเคราะห์รายหลัก';
 $('positionStats').innerHTML=selected?selected.positions.map((p,i)=>`<div class="card"><h3>${positionNames[6-num.length+i]}: ${p.digit}</h3><p>พบ ${p.matches}/${p.total} เลข (${(p.matches/p.total*100).toFixed(1)}%)</p><details><summary>ความถี่ 0–9 ในหลักนี้</summary><table><thead><tr><th>เลข</th><th>ครั้ง</th></tr></thead><tbody>${p.counts.map((count,d)=>`<tr><td>${d}</td><td>${count}</td></tr>`).join('')}</tbody></table></details></div>`).join(''):'';
 $('resultSection').classList.remove('hidden');
}
function renderTop(){
 const nums=[...new Set(records(dataset,mode).flatMap(r=>r.numbers))];
 const ranked=nums.map(num=>({num,score:calculate(dataset,mode,num).score})).sort((a,b)=>b.score-a.score||a.num.localeCompare(b.num)).slice(0,10);
 $('topNumbers').innerHTML=ranked.length?ranked.map(r=>`<button type="button" data-number="${r.num}">${r.num}<br><small>${r.score.toFixed(1)} / 100</small></button>`).join(''):'<p>ยังไม่มีข้อมูลรางวัลประเภทนี้ กรุณานำเข้าข้อมูลย้อนหลัง</p>';
}
function importData(text){
 try {const next=validateDataset(JSON.parse(text));dataset=next;renderStatus();renderTop();$('resultSection').classList.add('hidden');$('errorText').classList.add('hidden');$('importStatus').textContent='นำเข้าสำเร็จ '+dataset.draws.length+' งวด';}
 catch(e){$('importStatus').textContent='นำเข้าไม่สำเร็จ: '+e.message;}
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('numberInput').addEventListener('input',()=>{$('numberInput').value=$('numberInput').value.replace(/\D/g,'').slice(0,TYPES[mode].length);$('resultSection').classList.add('hidden');});
$('analysisForm').addEventListener('submit',e=>{e.preventDefault();analyze();});
$('topNumbers').addEventListener('click',e=>{const b=e.target.closest('[data-number]');if(b){$('numberInput').value=b.dataset.number;analyze();$('resultSection').scrollIntoView({behavior:'smooth',block:'start'});}});
$('importBtn').addEventListener('click',()=>importData($('dataInput').value));
$('dataFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>5000000){$('importStatus').textContent='ไฟล์ต้องไม่เกิน 5 MB';return;}try{$('dataInput').value=await file.text();$('importStatus').textContent='อ่านไฟล์แล้ว กดนำเข้าข้อมูลเพื่อใช้งาน';}catch{$('importStatus').textContent='อ่านไฟล์ไม่สำเร็จ';}});
$('demoBtn').addEventListener('click',()=>{dataset=DEMO;renderStatus();setMode(mode);$('importStatus').textContent='กลับไปใช้ข้อมูลจำลองแล้ว';});
renderStatus();setMode('first');