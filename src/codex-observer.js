// Adapted architecture/event mapping from AgentPaw and LLMPET (MIT).
// Read-only incremental tail; never persist conversation or tool payloads.
const fs=require('node:fs'),path=require('node:path');
const {StringDecoder}=require('node:string_decoder');
const {classifyTool,labels}=require('./tool-status');
const {editingFiles}=require('./editing-files');
function parseInput(value){try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return {};}}
function turnStartedAt(p,row){const value=p.started_at;return typeof value==='number'&&Number.isFinite(value)?(value<1e12?value*1000:value):Date.parse(value||row.timestamp)||Date.now();}
function mapRecord(row,t){
 const p=row.payload||{};if(row.type==='session_meta'){t.id=p.id||t.id;t.ignored=Boolean(p.source?.subagent);return;}
 if(t.ignored)return;
 const event=(name,message,extra={})=>({source:'codex',event:name,session_id:t.id,message,startedAt:t.startedAt,...extra});
 if(row.type==='event_msg'){
  if(p.type==='task_started'){t.active=true;t.work=false;t.finalSeen=false;t.turnId=p.turn_id;t.startedAt=turnStartedAt(p,row);t.calls=new Map();return event('prompt','생각 중');}
  if(p.type==='task_complete'){
   if(!t.active)return;
   if(t.turnId&&p.turn_id&&t.turnId!==p.turn_id)return;
   if(t.calls?.size)return;
   if(!t.finalSeen&&!(typeof p.last_agent_message==='string'&&p.last_agent_message.trim()))return;
   t.active=false;return event('done','작업 완료');
  }
  if(p.type==='turn_aborted'){t.active=false;return event('session_end','작업 중단');}
  if(p.type==='error'||p.type==='stream_error')return event('tool_failed','오류 발생');
  if(/approval_request$/.test(p.type||''))return;
  if(p.type==='request_user_input')return event('waiting','사용자 입력 대기');
 }
 if(row.type!=='response_item'||!t.active)return;
 if(['function_call','custom_tool_call','web_search_call'].includes(p.type)){
  t.work=true;const tool=p.type==='web_search_call'?'web_search':p.name;
  const raw=p.arguments||p.input;const input=parseInput(raw);const files=editingFiles(tool,raw);
  if(/(?:^|[._])request_user_input$/.test(tool))return event('waiting','사용자 입력 대기');
  const message=files.length?'코드 수정 중':labels[classifyTool({tool_name:tool,tool_input:typeof raw==='string'&&Object.keys(input).length===0?raw:input})];
  t.calls ||= new Map();if(p.type!=='web_search_call')t.calls.set(p.call_id||p.id||tool,{files,message,tool});
  return event('tool_start',message,{tool_name:tool,tool_input:input,editingFiles:files});
 }
 if(['function_call_output','custom_tool_call_output'].includes(p.type)){
  t.calls?.delete(p.call_id||p.id);
  if(t.calls?.size){const remaining=[...t.calls.values()];return event('tool_start',remaining.at(-1).message,{editingFiles:[...new Set(remaining.flatMap(c=>c.files))]});}
  return event('tool_end','다음 단계 진행 중',{editingFiles:[]});
 }
 if(p.type==='reasoning'&&!t.work)return event('thinking','생각 중');
 // A saved final answer is evidence of answer output, not of future preparation.
 if(p.type==='message'&&p.phase==='final_answer'){t.finalSeen=true;return event('review','답변 작성 중');}
}
class CodexObserver{
 constructor(root,onEvent,onLimits){this.root=root;this.onEvent=onEvent;this.onLimits=onLimits;this.files=new Map();this.watchStartedAt=Date.now();this.initialScanComplete=false;}
 start(){this.scan();this.initialScanComplete=true;this.timer=setInterval(()=>this.scan(),1000);this.timer.unref?.();}
 stop(){clearInterval(this.timer);}
 scan(){
  const visited=new Set();
  const tail=file=>{if(!visited.has(file)){visited.add(file);this.tail(file);}};
  // Keep following known sessions even after their creation date ages out.
  for(const file of this.files.keys())tail(file);
  const visit=(dir,depth=0,older=false)=>{if(depth>4)return;let entries;try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return;}
   for(const e of entries){const file=path.join(dir,e.name);if(e.isDirectory())visit(file,depth+1,older);else if(e.name.endsWith('.jsonl')){
    if(older&&!this.files.has(file)){try{if(fs.statSync(file).mtimeMs<this.watchStartedAt-300000)continue;}catch{continue;}}
    tail(file);
   }}};
  // Fast discovery for new sessions; periodically find resumed older files.
  for(let n=0;n<2;n++){const d=new Date(Date.now()-n*86400000);visit(path.join(this.root,String(d.getFullYear()),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')));}
  if(!this.lastFullScanAt||Date.now()-this.lastFullScanAt>=10000){this.lastFullScanAt=Date.now();visit(this.root,0,true);}
 }
 tail(file){try{
  const stat=fs.statSync(file);let t=this.files.get(file);
  if(!t){t={id:path.basename(file).match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/i)?.[0]||file,offset:stat.size,pending:'',active:false,work:false};this.files.set(file,t);
   // Metadata is at the beginning, outside the tail of a long session.
   const metaFd=fs.openSync(file,'r');try{const header=Buffer.alloc(Math.min(stat.size,65536));fs.readSync(metaFd,header,0,header.length,0);const line=header.toString('utf8').split('\n')[0];try{const row=JSON.parse(line);if(row.type==='session_meta')mapRecord(row,t);}catch{}}finally{fs.closeSync(metaFd);}
   // Bootstrap metadata/quota only; never replay old notifications.
   const newlyCreated=this.initialScanComplete&&stat.birthtimeMs>=this.watchStartedAt;
   this.read(file,t,newlyCreated?0:Math.max(0,stat.size-262144),stat.size,!newlyCreated);
   // Opening/touching a transcript is not evidence that its old turn is alive.
   // Only restore recent explicit work at startup, or a turn started since watching.
   const restore=t.active&&!t.ignored&&Number.isFinite(t.lastWorkAt)&&t.lastWorkAt>=this.watchStartedAt-15000&&(!this.initialScanComplete||t.startedAt>=this.watchStartedAt);
   if(!newlyCreated&&restore){const calls=[...(t.calls?.values()||[])];this.onEvent({source:'codex',session_id:t.id,event:calls.length||t.work?'tool_start':'prompt',message:calls.at(-1)?.message||(t.work?'작업 진행 중':'생각 중'),editingFiles:calls.flatMap(c=>c.files),startedAt:t.startedAt});}
   else if(!newlyCreated){t.active=false;t.work=false;t.calls?.clear();t.startedAt=null;t.turnId=null;t.finalSeen=false;}
   return;}
  if(stat.size<t.offset){t.offset=0;t.pending='';t.decoder=new StringDecoder('utf8');t.active=false;t.work=false;}
  if(stat.size>t.offset)this.read(file,t,t.offset,stat.size,false);
 }catch{}}
 read(file,t,start,end,bootstrap){const fd=fs.openSync(file,'r');try{
  // Bound each read, retain offset for the next tick rather than skipping bytes.
  const count=Math.min(end-start,1048576);const b=Buffer.alloc(count);fs.readSync(fd,b,0,count,start);t.offset=start+count;
  t.decoder ||= new StringDecoder('utf8');let text=t.pending+t.decoder.write(b);if(bootstrap&&start>0)text=text.slice(text.indexOf('\n')+1);
  const lines=text.split('\n');t.pending=lines.pop();
  for(const line of lines){let row;try{row=JSON.parse(line);}catch{continue;}
   const recordedAt=Date.parse(row.timestamp);
   // Resume/copy can append old rows to a new or existing file. Do not replay them.
   if(!bootstrap&&Number.isFinite(recordedAt)&&recordedAt<this.watchStartedAt&&row.type!=='session_meta')continue;
   // A fresh tool call proves resumed activity even when the original turn start
   // is outside the bounded tail. An old tool output never proves activity.
   if(!bootstrap&&!t.active&&row.type==='response_item'&&['function_call','custom_tool_call','web_search_call'].includes(row.payload?.type)){
    t.active=true;t.work=true;t.startedAt=Number.isFinite(recordedAt)?recordedAt:Date.now();t.calls=new Map();
   }
   const limits=row.payload?.rate_limits;if(limits)this.onLimits?.(limits);
   const ev=mapRecord(row,t);
   if(ev&&Number.isFinite(recordedAt)&&['prompt','tool_start','tool_end','thinking','review','waiting'].includes(ev.event))t.lastWorkAt=recordedAt;
   if(ev&&!bootstrap)this.onEvent(ev);
  }
 }finally{fs.closeSync(fd);}}
}
module.exports={CodexObserver,mapRecord};
