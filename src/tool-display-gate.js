// Delay routine tool notifications; lifecycle, approvals and errors remain immediate.
class ToolDisplayGate {
 constructor(emit,{delayMs=1500,setTimer=setTimeout,clearTimer=clearTimeout}={}){this.emit=emit;this.delayMs=delayMs;this.setTimer=setTimer;this.clearTimer=clearTimer;this.pending=new Map();this.visible=new Set();}
 push(body){const id=body.session_id;const queued=this.pending.get(id);
  if(queued&&body.event==='tool_start'){queued.body=body;return;}
  if(queued){this.clearTimer(queued.timer);this.pending.delete(id);}
  if(body.event==='tool_start'){
   if(this.visible.has(id)){this.emit(body);return;}
   const pending={body};pending.timer=this.setTimer(()=>{this.pending.delete(id);this.visible.add(id);this.emit(pending.body);},this.delayMs);
   this.pending.set(id,pending);return;
  }
  if(body.event==='tool_end'){
   if(this.visible.delete(id))this.emit(body);
   return;
  }
  this.visible.delete(id);this.emit(body);
 }
 stop(){for(const p of this.pending.values())this.clearTimer(p.timer);this.pending.clear();this.visible.clear();}
}
module.exports={ToolDisplayGate};
