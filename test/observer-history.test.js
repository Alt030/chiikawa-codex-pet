const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {CodexObserver}=require('../src/codex-observer');
const old=new Date(Date.now()-86400000).toISOString();
function row(type,payload,timestamp=old){return JSON.stringify({type,payload,timestamp})+'\n';}
function fixture(run){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pet-history-'));try{const file=path.join(dir,'old-session.jsonl'),events=[],observer=new CodexObserver(dir,e=>events.push(e));run({file,events,observer});}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('opening an old unfinished transcript does not restore it as working',()=>fixture(({file,events,observer})=>{
 fs.writeFileSync(file,row('event_msg',{type:'task_started'})+row('response_item',{type:'function_call',name:'exec_command',call_id:'old',arguments:'{}'}));
 observer.tail(file);assert.equal(events.length,0);assert.equal(observer.files.get(file).active,false);
}));
test('old tool output without a start cannot create an active session',()=>fixture(({file,events,observer})=>{
 fs.writeFileSync(file,row('response_item',{type:'function_call_output',call_id:'old',output:'old'}));observer.tail(file);assert.equal(events.length,0);assert.equal(observer.files.get(file).active,false);
}));
test('a newly discovered copy of history does not replay historical lifecycle events',()=>fixture(({file,events,observer})=>{
 observer.initialScanComplete=true;observer.watchStartedAt=Date.now()-1000;
 fs.writeFileSync(file,row('event_msg',{type:'task_started'})+row('event_msg',{type:'task_complete',last_agent_message:'historical final'}));observer.tail(file);assert.deepEqual(events,[]);
}));
test('historical records appended on resume are not live events',()=>fixture(({file,events,observer})=>{
 fs.writeFileSync(file,row('session_meta',{id:'old'}));observer.tail(file);
 fs.appendFileSync(file,row('event_msg',{type:'task_started'})+row('response_item',{type:'function_call',name:'exec_command',call_id:'old',arguments:'{}'}));observer.tail(file);assert.deepEqual(events,[]);
}));
test('a real new turn in an old file is still detected',()=>fixture(({file,events,observer})=>{
 fs.writeFileSync(file,row('event_msg',{type:'task_started'}));observer.tail(file);events.length=0;
 fs.appendFileSync(file,row('event_msg',{type:'task_started',turn_id:'new'},new Date().toISOString()));observer.tail(file);assert.equal(events[0].event,'prompt');assert.equal(observer.files.get(file).active,true);
}));
test('startup can restore explicit recent ongoing work',()=>fixture(({file,events,observer})=>{
 fs.writeFileSync(file,row('event_msg',{type:'task_started'},new Date().toISOString()));observer.tail(file);assert.equal(events[0]?.event,'prompt');
}));
test('fresh metadata on an old transcript does not prove current activity',()=>fixture(({file,events,observer})=>{
 fs.writeFileSync(file,row('event_msg',{type:'task_started'})+row('session_meta',{id:'old'},new Date().toISOString()));observer.tail(file);assert.equal(events.length,0);
}));
