const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
function findCodex(){if(process.env.CODEX_CLI_PATH)return process.env.CODEX_CLI_PATH;
 const root=path.join(process.env.LOCALAPPDATA||'', 'OpenAI','Codex','bin');
 try{return fs.readdirSync(root).map(n=>path.join(root,n,'codex.exe')).filter(p=>fs.existsSync(p)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];}catch{return null;}}
function formatQuota(limits){
 if(!limits)return '남은 사용량을 확인할 수 없어요.';
 const parts=[];for(const [key,label] of [['primary','5시간'],['secondary','주간']]){
  const w=limits[key];if(!w||!Number.isFinite(w.usedPercent??w.used_percent))continue;
  const mins=w.windowDurationMins??w.window_minutes;const title=mins===10080?'주간':mins===300?'5시간':mins?`${mins}분`:label;
  parts.push(`${title} ${Math.max(0,Math.min(100,100-(w.usedPercent??w.used_percent))).toFixed(0)}% 남음`);
 }return parts.length?parts.join(' · '):'남은 사용량을 확인할 수 없어요.';
}
class CodexQuota{
 constructor(exe,onChange){this.exe=exe;this.onChange=onChange;this.limits=null;this.updatedAt=0;this.sequence=0;this.pending=new Map();}
 update(limits){if(!limits)return;this.limits=limits;this.updatedAt=Date.now();this.onChange?.();}
 text(){return formatQuota(Date.now()-this.updatedAt<15*60000?this.limits:null);}
 async refresh(){if(this.refreshing)return this.refreshing;this.refreshing=this.fetch().catch(()=>{}).finally(()=>{this.refreshing=null;});return this.refreshing;}
 async fetch(){
  if(!this.exe)return;
  const child=spawn(this.exe,['app-server','--listen','stdio://'],{windowsHide:true,stdio:['pipe','pipe','ignore']});this.child=child;
  let buffer='';child.stdout.on('data',data=>{buffer+=data;const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){try{const r=JSON.parse(line);const wait=this.pending.get(r.id);if(wait){this.pending.delete(r.id);r.error?wait.reject(Error('RPC failed')):wait.resolve(r.result);}}catch{}}});
  child.on('error',()=>{for(const wait of this.pending.values())wait.reject(Error('Codex unavailable'));this.pending.clear();});
  const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=++this.sequence;const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('RPC timeout'));},8000);this.pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});child.stdin.write(JSON.stringify({id,method,params})+'\n',err=>{if(err){clearTimeout(timer);this.pending.delete(id);reject(err);}});});
  try{await rpc('initialize',{clientInfo:{name:'chiikawa_notifier',version:'0.1.1'},capabilities:{}});child.stdin.write(JSON.stringify({method:'initialized'})+'\n');const r=await rpc('account/rateLimits/read',{});const all=r.rateLimitsByLimitId;this.update(all?.codex||r.rateLimits||Object.values(all||{})[0]);}
  finally{child.stdin.end();child.kill();this.child=null;}
 }
 stop(){this.child?.kill();}
}
module.exports={CodexQuota,formatQuota,findCodex};
