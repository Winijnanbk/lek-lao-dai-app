'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {validateDataset,parseGLO,today}=require('./lottery-core.js');
const ENDPOINT='https://www.glo.or.th/api/checking/getLotteryResult';
async function getJSON(url,options={}){
 for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}
  catch(e){if(attempt===2)throw e;await new Promise(r=>setTimeout(r,500*(attempt+1)));}
 }
}
async function main(){
 const target=path.join(__dirname,'data','draws.json');let previous;
 if(fs.existsSync(target))previous=validateDataset(JSON.parse(fs.readFileSync(target,'utf8')));
 let dates;
 if(previous && (Date.now()-Date.parse(previous.fetchedAt))/86400000<2)dates=previous.draws.map(d=>d.date);
 else{
  // This index supplies draw dates only. ALL prize numbers come from GLO.
  const index=await getJSON('https://api.github.com/repos/vicha-w/thai-lotto-archive/contents/lottonumbers');
  if(!Array.isArray(index))throw Error('Invalid date index');
  dates=index.map(x=>x.name?.match(/^(\d{4}-\d{2}-\d{2})\.txt$/)?.[1]).filter(x=>x&&x<=today()).sort().reverse().slice(0,60);
  if(dates.length<60)throw Error('Insufficient historical draw dates');
 }
 // Probe every calendar day after the newest known draw, including shifted draws.
 const start=new Date(dates[0]+'T00:00:00Z');const end=new Date(today()+'T00:00:00Z');
 if((end-start)/86400000>90)throw Error('Snapshot older than 90 days: bootstrap again from the date index');
 for(let d=new Date(start.getTime()+86400000);d<=end;d.setUTCDate(d.getUTCDate()+1))dates.push(d.toISOString().slice(0,10));
 const required=new Set(dates.filter(d=>d<=dates[0]));
 const rows=[];let cursor=0;
 await Promise.all(Array.from({length:3},async()=>{
  while(cursor<dates.length){const date=dates[cursor++];const [year,month,day]=date.split('-');
   const body=await getJSON(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:day,month,year})});
      let row=parseGLO(body,date);
   if(!row&&required.has(date)){
    for(const offset of [1,-1,2,-2]){
     const shifted=new Date(Date.parse(date)+offset*86400000).toISOString().slice(0,10);
     if(shifted>today())continue;
     const [sy,sm,sd]=shifted.split('-');
     row=parseGLO(await getJSON(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:sd,month:sm,year:sy})}),shifted);
     if(row){console.log('Official draw date: '+date+' -> '+shifted);break;}
    }
   }
   if(row)rows.push(row);else if(required.has(date))throw Error('Missing GLO result for '+date);
  }
 }));
 const dataset=validateDataset({schemaVersion:1,fetchedAt:new Date().toISOString(),draws:rows.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,60)});
 if(dataset.draws.length<60)throw Error('Incomplete history');
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target+'.tmp',JSON.stringify(dataset,null,2)+'\n');fs.renameSync(target+'.tmp',target);
 console.log('GLO: '+dataset.draws.length+' verified-shape draws; latest '+dataset.draws[0].date+'; first prize '+dataset.draws[0].first);
}
main().catch(e=>{console.error(e);process.exitCode=1;});