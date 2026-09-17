(function(root){
'use strict';
const TYPES={first:{label:'รางวัลที่ 1',length:6,count:1},front3:{label:'เลขหน้า 3 ตัว',length:3,count:2},back3:{label:'เลขท้าย 3 ตัว',length:3,count:2},last2:{label:'เลขท้าย 2 ตัว',length:2,count:1}};
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function validateDataset(value){
 if(!value||value.schemaVersion!==1||!Array.isArray(value.draws)||!value.draws.length||value.draws.length>120||!Number.isFinite(Date.parse(value.fetchedAt)))throw Error('Invalid dataset');
 const seen=new Set();
 const draws=value.draws.map(row=>{
  if(!row||!validDate(row.date)||row.date>today()||seen.has(row.date)||row.source!=='GLO')throw Error('Invalid draw date/source');
  seen.add(row.date);const clean={date:row.date,source:'GLO'};
  for(const [key,type] of Object.entries(TYPES)){
   const nums=type.count===1?[row[key]]:row[key];
   if(!Array.isArray(nums)||nums.length!==type.count||!nums.every(n=>typeof n==='string'&&new RegExp(`^\\d{${type.length}}$`).test(n)))throw Error('Incomplete prize: '+key);
   clean[key]=type.count===1?nums[0]:[...nums];
  }
  return clean;
 }).sort((a,b)=>b.date.localeCompare(a.date));
 return {schemaVersion:1,fetchedAt:new Date(value.fetchedAt).toISOString(),draws};
}
function parseGLO(body,date){
 const result=body?.response?.result;
 if(body?.status!==true)throw Error('GLO reported an unsuccessful response');
 if(!result)return null;
 if(!result.data?.first?.number?.length)throw Error('GLO returned an incomplete draw');
 if(result.date!==date||result.status!==1)throw Error('Unexpected or unfinished GLO draw: '+date);
 const data=result.data;
 const row={date,source:'GLO',first:data.first.number[0]?.value,last2:data.last2?.number?.[0]?.value,front3:data.last3f?.number?.map(n=>n.value),back3:data.last3b?.number?.map(n=>n.value)};
 return validateDataset({schemaVersion:1,fetchedAt:new Date().toISOString(),draws:[row]}).draws[0];
}
function records(dataset,key){return (dataset?.draws||[]).map(d=>({date:d.date,numbers:Array.isArray(d[key])?d[key]:[d[key]]}));}
function calculate(dataset,key,num){
 const rows=records(dataset,key),n=rows.length;if(!n)return null;
 const numbers=rows.flatMap(r=>r.numbers),freq=rows.filter(r=>r.numbers.includes(num)).length,gap=rows.findIndex(r=>r.numbers.includes(num));
 const positions=[...num].map((digit,i)=>({digit,counts:Array.from({length:10},(_,v)=>numbers.filter(x=>x[i]===String(v)).length),matches:numbers.filter(x=>x[i]===digit).length,total:numbers.length}));
 const recent=rows.slice(0,10),recentHits=recent.filter(r=>r.numbers.includes(num)).length;
 const frequencyScore=freq/n*40,digitScore=positions.reduce((sum,p)=>sum+p.matches/p.total,0)/num.length*40,recentScore=recentHits/recent.length*20;
 return {n,total:numbers.length,freq,gap,positions,recentN:recent.length,recentHits,frequencyScore,digitScore,recentScore,score:Math.round((frequencyScore+digitScore+recentScore)*10)/10,latest:rows[0].date};
}
const api={TYPES,validDate,today,validateDataset,parseGLO,records,calculate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LotteryCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);