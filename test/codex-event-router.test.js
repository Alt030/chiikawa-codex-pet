const {test}=require('node:test'),assert=require('node:assert/strict');const {CodexEventRouter}=require('../src/codex-event-router');const {ToolDisplayGate}=require('../src/tool-display-gate');const {classifyTool}=require('../src/tool-status');
function setup(){const output=[],timers=new Map();let serial=0;const gate=new ToolDisplayGate(p=>output.push(p),{setTimer:fn=>{timers.set(++serial,fn);return serial;},clearTimer:id=>timers.delete(id)});const router=new CodexEventRouter(p=>gate.push(p));return {output,router,tick(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}}};}
const hook=(hook_event_name,tool_name,id)=>({source:'codex',session_id:'a',hook_event_name,tool_name,tool_use_id:id});
test('actual hook command wins over generic rollout; auto-approval cannot replace it',()=>{
 const s=setup();s.router.rollout({session_id:'a',event:'tool_start',message:'도구 사용 중'});
 s.router.hook(hook('PreToolUse','Bash','one'));s.router.hook(hook('PermissionRequest','Bash','one'));s.tick();assert.equal(s.output.at(-1).message,'명령 실행 중');
 s.router.rollout({session_id:'a',event:'tool_start',message:'도구 사용 중'});assert.equal(s.output.at(-1).message,'명령 실행 중');
 s.router.hook(hook('PostToolUse','Bash','one'));assert.equal(s.output.at(-1).event,'tool_end');assert.equal(s.output.at(-1).message,'다음 단계 진행 중');
});
test('parallel hooks keep running and filenames until their own result; Stop hook is ignored',()=>{
 const s=setup();s.router.hook({...hook('PreToolUse','Edit','one'),tool_input:{file_path:'src/a.js'}});s.tick();
 s.router.hook({...hook('PreToolUse','Edit','two'),tool_input:{file_path:'src/b.js'}});assert.deepEqual(s.output.at(-1).editingFiles,['a.js','b.js']);
 s.router.hook(hook('PostToolUse','Edit','one'));assert.deepEqual(s.output.at(-1).editingFiles,['b.js']);assert.equal(s.output.at(-1).event,'tool_start');
 s.router.rollout({session_id:'a',event:'tool_end',message:'결과'});assert.equal(s.output.at(-1).event,'tool_start');
 assert.equal(s.router.hook(hook('Stop','Edit','two')),false);s.router.hook(hook('PostToolUse','Edit','two'));assert.equal(s.output.at(-1).event,'tool_end');
});
test('short tools disappear, and duplicate starts do not restart the delay',()=>{
 const s=setup();s.router.hook(hook('PreToolUse','Bash','one'));s.router.hook(hook('PostToolUse','Bash','one'));s.tick();assert.equal(s.output.length,1);assert.equal(s.output[0].event,'tool_activity');
 s.router.rollout({session_id:'a',event:'tool_start',message:'자료 읽는 중'});s.router.hook(hook('PreToolUse','Bash','two'));s.tick();assert.equal(s.output.at(-1).message,'명령 실행 중');
});
test('hook-free packaged app classifies orchestrated operations safely',()=>{
 assert.equal(classifyTool({tool_name:'exec',tool_input:'await tools.exec_command({cmd:"npm test"})'}),'testing');
 assert.equal(classifyTool({tool_name:'exec',tool_input:'await tools.exec_command({cmd:"rg --files"})'}),'reading');
 assert.equal(classifyTool({tool_name:'exec',tool_input:'await tools.exec_command({cmd:"git status"})'}),'executing');
 assert.equal(classifyTool({tool_name:'exec',tool_input:'await tools.web__run({search_query:[{q:"abc"}]})'}),'searching');
});
test('delayed rollout start preserves already received hooks and true start time',()=>{
 const s=setup(),startedAt=Date.now()-500;s.router.hook(hook('PreToolUse','Bash','one'));
 s.router.rollout({session_id:'a',event:'prompt',message:'생각 중',startedAt});s.tick();assert.equal(s.output.at(-1).message,'명령 실행 중');assert.equal(s.output.at(-1).startedAt,startedAt);
});

