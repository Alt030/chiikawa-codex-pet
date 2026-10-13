const {test}=require('node:test');const assert=require('node:assert/strict');
const {mapRecord}=require('../src/codex-observer');const {formatQuota}=require('../src/codex-quota');
test('rollout lifecycle and nested tools classify without fake result preparation',()=>{
 const t={id:'test'};const ev=type=>mapRecord({type:'event_msg',payload:{type,last_agent_message:type==='task_complete'?'최종 답변':undefined}},t);
 assert.equal(ev('task_started').event,'prompt');
 assert.equal(mapRecord({type:'response_item',payload:{type:'function_call',name:'apply_patch',arguments:'{}'}},t).message,'코드 수정 중');
 assert.equal(mapRecord({type:'response_item',payload:{type:'reasoning'}},t),undefined);
 mapRecord({type:'response_item',payload:{type:'function_call_output',call_id:'apply_patch'}},t);
 assert.equal(ev('task_complete').event,'done');assert.equal(t.active,false);
});
test('quota shows remaining percent with unavailable fallback',()=>{
 assert.equal(formatQuota({primary:{usedPercent:27,windowDurationMins:300},secondary:{usedPercent:61,windowDurationMins:10080}}),'5시간 73% 남음 · 주간 39% 남음');
 assert.match(formatQuota(null),/확인할 수 없/);
});
test('incremental observer does not replay startup and waits for a complete line',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {CodexObserver}=require('../src/codex-observer');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-observer-'));const file=path.join(dir,'rollout.jsonl');const events=[];
 const line=type=>JSON.stringify({type:'event_msg',payload:{type,last_agent_message:type==='task_complete'?'최종 답변':undefined}})+'\n';
 try{fs.writeFileSync(file,line('task_started')+line('task_complete'));const o=new CodexObserver(dir,e=>events.push(e));o.tail(file);assert.equal(events.length,0);
 fs.appendFileSync(file,line('task_started'));o.tail(file);assert.equal(events[0].event,'prompt');
 const end=line('task_complete');fs.appendFileSync(file,end.slice(0,-1));o.tail(file);assert.equal(events.length,1);fs.appendFileSync(file,'\n');o.tail(file);assert.equal(events[1].event,'done');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('UTF-8 filename survives a read boundary inside a Korean character',()=>{
 const fs=require('fs'),os=require('os'),path=require('path');const {CodexObserver}=require('../src/codex-observer');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-utf8-'));const file=path.join(dir,'rollout.jsonl'),events=[];
 try{fs.writeFileSync(file,JSON.stringify({type:'event_msg',payload:{type:'task_started'}})+'\n');const o=new CodexObserver(dir,e=>events.push(e));o.tail(file);
 const b=Buffer.from(JSON.stringify({type:'response_item',payload:{type:'custom_tool_call',name:'apply_patch',call_id:'a',input:'*** Update File: src/한글.js'}})+'\n');const split=b.indexOf(Buffer.from('한'))+1;
 fs.appendFileSync(file,b.subarray(0,split));o.tail(file);assert.equal(events.length,0);fs.appendFileSync(file,b.subarray(split));o.tail(file);assert.deepEqual(events[0].editingFiles,['한글.js']);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
