const {BrowserWindow, ipcMain, globalShortcut, screen}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {constrainBounds}=require('./screen-bounds');

function dateKey(date=new Date()){
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function validDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T12:00:00');return !Number.isNaN(d.getTime())&&dateKey(d)===value;
}
function installPlanner({userData,getPetWindow,onNotice,getRegistrationSpeech,getCompletionSpeech,getReminderSpeech,clock=()=>new Date()}){
 const file=path.join(userData,'planner.json');
 let data={tasks:[],morningTime:'09:00',morningEnabled:true,lastMorning:'',notifications:{}};
 if(fs.existsSync(file)){
  // A broken file is kept intact rather than overwritten with an empty list.
  const saved=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(saved.tasks))throw Error('일정 파일을 읽을 수 없어요.');
  data={...data,...saved};
  data.notifications ||= {};
  for(const task of data.tasks)if(data.notifications[task.id]===true)data.notifications[task.id]=task.date+'T'+task.time;
 }
 let panel=null,timer=null,notice='';
 function save(){fs.mkdirSync(userData,{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2),'utf8');fs.renameSync(file+'.tmp',file);}
 function snapshot(){return {tasks:data.tasks,morningTime:data.morningTime,morningEnabled:data.morningEnabled,today:dateKey(clock()),notice,shortcut:shortcutRegistered?'Ctrl + Shift + T':'트레이 → 오늘 일정'};}
 function publish(){if(panel&&!panel.isDestroyed())panel.webContents.send('planner:changed',snapshot());}
 function position(){
  const pet=getPetWindow();const base=pet&&!pet.isDestroyed()?pet.getBounds():{...screen.getPrimaryDisplay().workArea,width:240,height:286};
  const area=screen.getDisplayMatching(base).workArea;
  panel.setBounds(constrainBounds({x:base.x+base.width+12,y:base.y+base.height-560,width:390,height:560},area));
 }
 function open(){
  if(panel&&!panel.isDestroyed()){if(!panel.isVisible())position();panel.show();panel.focus();return;}
  panel=new BrowserWindow({width:390,height:560,minWidth:340,minHeight:430,frame:false,show:false,alwaysOnTop:true,skipTaskbar:true,resizable:true,backgroundColor:'#faf8f3',webPreferences:{preload:path.join(__dirname,'planner-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  panel.setMenuBarVisibility(false);position();
  panel.loadFile(path.join(__dirname,'renderer','planner.html'));
  panel.once('ready-to-show',()=>{panel.show();panel.focus();});
  panel.on('close',event=>{event.preventDefault();panel.hide();});
  panel.on('move',()=>{if(panel&&!panel.isDestroyed()){const bounds=panel.getBounds();const safe=constrainBounds(bounds,screen.getDisplayMatching(bounds).workArea);if(bounds.x!==safe.x||bounds.y!==safe.y)panel.setBounds(safe);}});
 }
 function toggle(){if(panel?.isVisible())panel.hide();else open();}
 const shortcutRegistered=globalShortcut.register('CommandOrControl+Shift+T',toggle);
 ipcMain.handle('planner:toggle',()=>{toggle();return true;});
 ipcMain.handle('planner:get',event=>{if(event.sender!==panel?.webContents)throw Error('Invalid planner window');return snapshot();});
 ipcMain.handle('planner:close',event=>{if(event.sender===panel?.webContents)panel.hide();});
 ipcMain.handle('planner:mutate',(event,body)=>{
  if(event.sender!==panel?.webContents)return {ok:false,error:'Invalid planner window'};
  // Roll back in memory if persistence fails; UI gets an explicit error.
  const previous=JSON.stringify(data);
  try{
   const action=body?.action;
   if(action==='add'||action==='edit'){
    const title=String(body.title||'').trim();const date=String(body.date||'');const time=String(body.time||'');
    if(!title||title.length>240)throw Error('제목은 1~240자로 입력해주세요.');
    if(!validDate(date))throw Error('날짜를 확인해주세요.');
    if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('시간을 확인해주세요.');
    const task=action==='edit'?data.tasks.find(t=>t.id===body.id):{id:randomUUID(),createdAt:clock().toISOString(),doneAt:null};
    if(!task)throw Error('일정을 찾을 수 없어요.');
    Object.assign(task,{title,date,time});if(action==='add')data.tasks.push(task);
   }else if(action==='complete'){
    const task=data.tasks.find(t=>t.id===body.id);if(!task)throw Error('일정을 찾을 수 없어요.');
    task.doneAt=task.doneAt?null:clock().toISOString();
   }else if(action==='delete'){
    data.tasks=data.tasks.filter(t=>t.id!==body.id);
   }else if(action==='restore'){
    const task=body.task;if(!task||!validDate(task.date)||typeof task.title!=='string'||!task.title.trim()||task.title.length>240||typeof task.id!=='string'||(task.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(task.time)))throw Error('복원할 일정을 확인해주세요.');
    if(!data.tasks.some(t=>t.id===task.id))data.tasks.push({id:task.id,title:task.title,date:task.date,time:task.time||'',doneAt:task.doneAt||null,createdAt:task.createdAt});
   }else if(action==='settings'){
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.morningTime||''))throw Error('알림 시간을 확인해주세요.');
    data.morningTime=body.morningTime;data.morningEnabled=Boolean(body.morningEnabled);
   }else throw Error('Unknown action');
   save();
   if(action==='add'){
    const task=data.tasks.at(-1);
    let speech='일정을 등록했어요.';
    try{speech=getRegistrationSpeech?.()||speech;}catch(error){console.warn('일정 등록 대사 조회 실패:',error.message);}
    const summary=task.date+(task.time?' '+task.time:'')+' · '+task.title;
    notice=speech+'\n'+summary;
    // Registration already succeeded even if the transient bubble cannot open.
    try{onNotice?.(summary,{kind:'added',speech});}catch(error){console.warn('일정 등록 반응 표시 실패:',error.message);}
   }
   if(action==='complete'){
    const task=data.tasks.find(t=>t.id===body.id);
    if(task.doneAt){
     const today=dateKey(clock());
     const remaining=data.tasks.filter(t=>!t.doneAt&&t.date===today).length;
     const overdue=data.tasks.filter(t=>!t.doneAt&&t.date<today).length;
     const allDone=remaining===0&&data.tasks.some(t=>t.date===today);
     let speech='일정을 완료했어요!';
     try{speech=getCompletionSpeech?.({remaining,overdue,allDone,task})||speech;}catch(error){console.warn('일정 완료 대사 조회 실패:',error.message);}
     const summary=task.title+' · 완료\n'+(remaining?'오늘 일정 '+remaining+'개 남았어요.':'오늘 남은 일정은 없어요.')+(overdue?'\n지난 미완료 일정 '+overdue+'개도 있어요.':'');
     notice=speech+'\n'+summary;
     try{onNotice?.(summary,{kind:'completed',speech,remaining,overdue,allDone});}catch(error){console.warn('일정 완료 반응 표시 실패:',error.message);}
    }
   }
   publish();return {ok:true,...snapshot()};
  }catch(error){data=JSON.parse(previous);return {ok:false,error:error.message};}
 });
 function notify(message){
  let speech='일정 확인할 시간이에요!';
  try{speech=getReminderSpeech?.()||speech;}catch(error){console.warn('일정 알림 대사 조회 실패:',error.message);}
  notice=speech+'\n'+message;publish();
  try{onNotice?.(message,{kind:'reminder',speech});}catch(error){console.warn('일정 알림 말풍선 표시 실패:',error.message);}
 }
 function tick(){
  const previous=JSON.stringify(data);
  const now=clock(),today=dateKey(now);const timeNow=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const pending=data.tasks.filter(t=>!t.doneAt);const due=pending.filter(t=>t.date<=today);
  const messages=[];
  if(data.morningEnabled&&timeNow>=data.morningTime&&data.lastMorning!==today){
   data.lastMorning=today;
   if(due.length){const overdue=due.filter(t=>t.date<today).length;messages.push('오늘 일정 '+due.filter(t=>t.date===today).length+'개'+(overdue?' · 지난 일정 '+overdue+'개':'')+'\n'+due.slice(0,3).map(t=>(t.time?t.time+' ':'')+t.title).join('\n'));}
  }
  for(const task of pending){
   if(!task.time)continue;const at=new Date(task.date+'T'+task.time+':00').getTime();
   const reminderKey=task.date+'T'+task.time;
   if(now.getTime()>=at&&now.getTime()-at<=86400000&&data.notifications[task.id]!==true&&data.notifications[task.id]!==reminderKey){
    data.notifications[task.id]=reminderKey;messages.push(task.time+' · '+task.title);
   }
  }
  try{if(JSON.stringify(data)!==previous)save();}catch(error){data=JSON.parse(previous);console.warn('Planner persistence failed:',error.message);return;}
  if(messages.length)notify(messages.join('\n\n'));else publish();
 }
 function start(){timer=setInterval(tick,30000);timer.unref?.();tick();}
 function stop(){clearInterval(timer);if(shortcutRegistered)globalShortcut.unregister('CommandOrControl+Shift+T');if(panel&&!panel.isDestroyed())panel.destroy();for(const channel of ['planner:toggle','planner:get','planner:close','planner:mutate'])ipcMain.removeHandler(channel);}
 async function capture(){if(!panel||panel.isDestroyed())throw Error('먼저 일정창을 열어주세요.');return (await panel.webContents.capturePage()).toPNG();}
 return {open,toggle,start,stop,capture,checkNow:tick};
}
module.exports={installPlanner};
