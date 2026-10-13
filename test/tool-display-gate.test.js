const {test}=require('node:test'),assert=require('node:assert/strict');const {ToolDisplayGate}=require('../src/tool-display-gate');const {mapRecord}=require('../src/codex-observer');
function setup(){const output=[],timers=new Map();let n=0;const gate=new ToolDisplayGate(e=>output.push(e),{setTimer:fn=>{timers.set(++n,fn);return n;},clearTimer:id=>timers.delete(id)});return {gate,output,tick:()=>{for(const [id,fn]of [...timers]){timers.delete(id);fn();}}};}
test('short tools do not change bubble; long tools finish immediately; completion cancels pending',()=>{
 const {gate,output,tick}=setup();const e=event=>({event,session_id:'a'});
 gate.push(e('tool_start'));gate.push(e('tool_end'));tick();assert.equal(output.length,1);assert.equal(output[0].event,'tool_activity');
 gate.push(e('tool_start'));tick();assert.equal(output[1].event,'tool_start');gate.push(e('tool_end'));assert.equal(output[2].event,'tool_end');
 gate.push(e('tool_start'));gate.push(e('done'));tick();assert.equal(output.at(-1).event,'done');assert.equal(output.length,4);
});
test('parallel tool output clears only completed file names',()=>{
 const t={id:'a',active:true};const row=(type,call_id,input)=>({type:'response_item',payload:{type,call_id,name:'apply_patch',input}});
 mapRecord(row('custom_tool_call','a','*** Update File: src/a.js'),t);mapRecord(row('custom_tool_call','b','*** Update File: src/b.js'),t);
 assert.deepEqual(mapRecord(row('custom_tool_call_output','a'),t).editingFiles,['b.js']);
 const end=mapRecord(row('custom_tool_call_output','b'),t);assert.equal(end.event,'tool_end');assert.deepEqual(end.editingFiles,[]);
});

