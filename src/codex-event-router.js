const {normalizeToolEvent}=require('./tool-status');
const {editingFiles}=require('./editing-files');
// Hooks enrich tool status; rollout alone owns turn lifecycle. PermissionRequest
// is deliberately not a UI state: it also fires for automatic policy checks.
class CodexEventRouter {
 constructor(emit){this.emit=emit;this.sessions=new Map();this.serial=0;}
 session(id){if(!this.sessions.has(id))this.sessions.set(id,{tools:new Map()});return this.sessions.get(id);}
 hook(p){
  const type=p.hook_event_name;const id=String(p.session_id||p.sessionId||p.conversationId||'default');
  if(!['PreToolUse','PostToolUse'].includes(type))return false;
  const s=this.session(id),key=p.tool_use_id||p.call_id||p.tool_call_id;
  const tool=p.tool_name||p.toolName||'tool';
  if(type==='PreToolUse'){
   const normalized=normalizeToolEvent(p);const files=editingFiles(tool,p.tool_input||p.toolInput);
   s.tools.set(key||'hook-'+(++this.serial),{tool,message:normalized.message,files,receivedAt:Date.now()});
   this.active(id,s);return true;
  }
  if(key)s.tools.delete(key);
  else {const candidates=[...s.tools].filter(([,v])=>v.tool===tool);if(candidates.length)s.tools.delete(candidates.at(-1)[0]);}
  const normalized=normalizeToolEvent(p);
  if(normalized.event==='tool_failed')this.emit({source:'codex',session_id:id,event:'tool_failed',message:normalized.message,startedAt:s.startedAt});
  else if(s.tools.size)this.active(id,s);
  else this.emit({source:'codex',session_id:id,event:'tool_end',message:'다음 단계 진행 중',editingFiles:[],startedAt:s.startedAt});
  return true;
 }
 active(id,s){const latest=[...s.tools.values()].at(-1);this.emit({source:'codex',session_id:id,event:'tool_start',message:latest.message,editingFiles:[...new Set([...s.tools.values()].flatMap(t=>t.files))],startedAt:s.startedAt});}
 rollout(body){const id=String(body.session_id),s=this.session(id);
  if(Number.isFinite(body.startedAt))s.startedAt=body.startedAt;
  if(body.event==='prompt')for(const [key,t]of s.tools)if(!Number.isFinite(body.startedAt)||t.receivedAt<body.startedAt)s.tools.delete(key);
  if(['done','session_end'].includes(body.event))this.sessions.delete(id);
  if(['tool_start','tool_end'].includes(body.event)&&s.tools.size)return;
  this.emit(body);
  if(body.event==='prompt'&&s.tools.size)this.active(id,s);
 }
}
module.exports={CodexEventRouter};
