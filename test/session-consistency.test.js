const {test}=require('node:test'),assert=require('node:assert/strict');const {SessionManager}=require('../src/session-manager');const {buildDecision}=require('../src/agent-events');
function decision(id,event,message){return buildDecision({source:'codex',session_id:id,event,message});}
test('background completion cannot overwrite another running session',()=>{
 const s=new SessionManager();s.apply(decision('a','prompt','생각 중'));const run=decision('b','tool_start','코드 수정 중');run.editingFiles=['app.js'];s.apply(run);
 const r=s.apply(decision('a','done','작업 완료'));assert.equal(r.display.state,'running');assert.equal(r.display.agentEvent,'tool_start');assert.equal(r.display.message,'코드 수정 중');assert.deepEqual(r.display.editingFiles,['app.js']);assert.equal(r.display.durationMs,0);
});
test('approval in one session does not mix its text with another running session',()=>{
 const s=new SessionManager();s.apply(decision('a','tool_start','웹 검색 중'));const r=s.apply(decision('b','waiting','확인 필요'));
 assert.equal(r.display.state,'running');assert.equal(r.display.message,'웹 검색 중');assert.equal(r.display.agentEvent,'tool_start');assert.equal(r.display.sessionId,'codex:a');
});
test('resuming the same session clears wait; completion requires no other activity',()=>{
 const s=new SessionManager();s.apply(decision('a','waiting','확인 필요'));const r=s.apply(decision('a','tool_start','도구 사용 중'));assert.equal(r.display.state,'running');assert.equal(r.display.agentEvent,'tool_start');
 assert.equal(s.apply(decision('a','done','작업 완료')).display.agentEvent,'done');
});
