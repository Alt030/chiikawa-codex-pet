const {test}=require('node:test'),assert=require('node:assert/strict');const {SessionManager}=require('../src/session-manager');const {buildDecision}=require('../src/agent-events');const {elapsedText}=require('../src/renderer/reaction-policy');
test('turn start survives tool changes and permission checks, resets on next prompt',()=>{
 let now=1000;const s=new SessionManager({now:()=>now});const d=event=>buildDecision({source:'codex',session_id:'a',event});
 const prompt=d('prompt');prompt.startedAt=500;s.apply(prompt);now=91000;assert.equal(s.apply(d('tool_start')).display.startedAt,500);
 now=181000;assert.equal(s.apply(d('waiting')).display.startedAt,500);assert.equal(s.apply(d('tool_start')).display.startedAt,500);
 assert.equal(s.apply(d('done')).display.startedAt,null);now=200000;assert.equal(s.apply(d('prompt')).display.startedAt,200000);
});
test('elapsed label handles minute boundaries and absent timestamps',()=>{
 assert.equal(elapsedText(1000,60999),'작업 중 · 1분 미만');assert.equal(elapsedText(1000,61000),'작업 중 · 1분 경과');assert.equal(elapsedText(1000,181000),'작업 중 · 3분 경과');assert.equal(elapsedText(null),'');
});
