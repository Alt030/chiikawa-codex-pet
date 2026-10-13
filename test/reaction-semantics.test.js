const {test}=require('node:test'),assert=require('node:assert/strict');const {mapRecord}=require('../src/codex-observer');const {buildDecision}=require('../src/agent-events');const {phraseState,pickPhrase}=require('../src/renderer/reaction-policy');
test('tool output and result review never celebrate or ask the user',()=>{
 const t={id:'a',active:true,calls:new Map()};const out=mapRecord({type:'response_item',payload:{type:'custom_tool_call_output',call_id:'a'}},t);
 assert.equal(out.event,'tool_end');assert.equal(phraseState(out.event,'jumping'),'running');assert.equal(phraseState(out.event,'waiting'),'running');
 assert.doesNotMatch(pickPhrase('shisa',phraseState(out.event,'jumping'),()=>0,out.message),/끝냈|끝낸|다했|확인해|어떻게 할/);
});
test('completion needs final answer evidence and no pending tool calls',()=>{
 const t={id:'a',active:true,turnId:'turn-a',calls:new Map([['call-a',{}]])};const complete={type:'event_msg',payload:{type:'task_complete',turn_id:'turn-a',last_agent_message:'답변'}};
 assert.equal(mapRecord(complete,t),undefined);t.calls.clear();assert.equal(mapRecord({...complete,payload:{type:'task_complete',turn_id:'turn-a'}},t),undefined);
 assert.equal(mapRecord({...complete,payload:{...complete.payload,turn_id:'turn-b'}},t),undefined);
 assert.equal(mapRecord(complete,t).event,'done');
});
test('permission checks differ from real user input requests',()=>{
 const d=buildDecision({source:'codex',hook_event_name:'PermissionRequest',session_id:'a'});assert.equal(d,null);
 assert.equal(mapRecord({type:'event_msg',payload:{type:'request_user_input'}},{id:'a',active:true}).event,'waiting');
 assert.equal(phraseState('click','jumping'),'idle');assert.equal(phraseState('done','jumping'),'jumping');
});
