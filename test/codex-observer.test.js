const {test}=require('node:test');const assert=require('node:assert/strict');
const {mapRecord}=require('../src/codex-observer');const {formatQuota}=require('../src/codex-quota');
test('rollout lifecycle and nested tools classify without fake result preparation',()=>{
 const t={id:'test'};const ev=type=>mapRecord({type:'event_msg',payload:{type}},t);
 assert.equal(ev('task_started').event,'prompt');
 assert.equal(mapRecord({type:'response_item',payload:{type:'function_call',name:'apply_patch',arguments:'{}'}},t).message,'코드 수정 중');
 assert.equal(mapRecord({type:'response_item',payload:{type:'reasoning'}},t),undefined);
 assert.equal(ev('task_complete').event,'done');assert.equal(t.active,false);
});
test('quota shows remaining percent with unavailable fallback',()=>{
 assert.equal(formatQuota({primary:{usedPercent:27,windowDurationMins:300},secondary:{usedPercent:61,windowDurationMins:10080}}),'5시간 73% 남음 · 주간 39% 남음');
 assert.match(formatQuota(null),/확인할 수 없/);
});
test('incremental observer does not replay startup and waits for a complete line',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {CodexObserver}=require('../src/codex-observer');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-observer-'));const file=path.join(dir,'rollout.jsonl');const events=[];
 const line=type=>JSON.stringify({type:'event_msg',payload:{type}})+'\n';
 try{fs.writeFileSync(file,line('task_started')+line('task_complete'));const o=new CodexObserver(dir,e=>events.push(e));o.tail(file);assert.equal(events.length,0);
 fs.appendFileSync(file,line('task_started'));o.tail(file);assert.equal(events[0].event,'prompt');
 const end=line('task_complete');fs.appendFileSync(file,end.slice(0,-1));o.tail(file);assert.equal(events.length,1);fs.appendFileSync(file,'\n');o.tail(file);assert.equal(events[1].event,'done');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
