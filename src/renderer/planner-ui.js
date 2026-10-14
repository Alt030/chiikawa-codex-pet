const $=id=>document.getElementById(id);
let state=null,tab='today',editingId=null,deletedTask=null,saving=false,settingsDirty=false;
function localDate(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function shortDate(date){return new Intl.DateTimeFormat('ko-KR',{month:'numeric',day:'numeric',weekday:'short'}).format(new Date(date+'T12:00:00'));}
function error(message=''){$('error').textContent=message;$('error').hidden=!message;}
function resetForm(){editingId=null;$('title').value='';$('date').value=state.today;$('time').value='';$('editing').hidden=true;$('submit').textContent='+';$('submit').setAttribute('aria-label','일정 추가');$('title').focus();}
function render(next){
 const previousToday=state?.today;
 state=next;$('dateLabel').textContent=shortDate(state.today);$('todayCount').textContent=state.tasks.filter(t=>!t.doneAt&&t.date<=state.today).length;
 if(previousToday&&previousToday!==state.today&&!editingId&&!$('title').value.trim()&&$('date').value===previousToday)$('date').value=state.today;
 $('notice').hidden=!state.notice;$('notice').textContent=state.notice||'';
 if(!settingsDirty){$('morningEnabled').checked=state.morningEnabled;$('morningTime').value=state.morningTime;}
 $('shortcut').textContent='바로 열기 · '+state.shortcut;
 const todayTasks=state.tasks.filter(t=>t.date===state.today);const count=todayTasks.filter(t=>t.doneAt).length;
 $('progress').textContent=todayTasks.length?'오늘 '+count+' / '+todayTasks.length+'개 완료':'오늘의 할 일을 추가해보세요';
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('selected',b.dataset.tab===tab);b.setAttribute('aria-pressed',String(b.dataset.tab===tab));});
 const tasks=state.tasks.filter(t=>tab==='done'?t.doneAt:tab==='today'?(t.date===state.today||(!t.doneAt&&t.date<state.today)):!t.doneAt&&t.date>state.today);
 tasks.sort((a,b)=>tab==='done'?(b.doneAt||'').localeCompare(a.doneAt||''):Number(Boolean(a.doneAt))-Number(Boolean(b.doneAt))||a.date.localeCompare(b.date)||(a.time||'99:99').localeCompare(b.time||'99:99')||(a.createdAt||'').localeCompare(b.createdAt||''));
 $('list').replaceChildren();let lastGroup='';
 if(!tasks.length){const empty=document.createElement('div');empty.className='empty';const title=document.createElement('strong');title.textContent=tab==='today'?'오늘은 여유롭게':tab==='upcoming'?'예정된 일정이 없어요':'완료한 일정이 여기에 모여요';const hint=document.createElement('p');hint.textContent=tab==='today'?'할 일을 하나 적어볼까요?':tab==='upcoming'?'날짜를 내일 이후로 선택해 추가하세요':'일정 왼쪽의 동그라미를 눌러 체크하세요';empty.append(title,hint);$('list').append(empty);}
 for(const task of tasks){
  const group=tab==='done'?localDate(new Date(task.doneAt)):task.date;
  const groupKey=tab==='today'&&task.doneAt?'done':group;
  if(groupKey!==lastGroup){lastGroup=groupKey;const label=document.createElement('div');label.className='group-label';label.textContent=groupKey==='done'?'완료':group<state.today&&tab==='today'?'지난 일정 · '+shortDate(group):shortDate(group);$('list').append(label);}
  const row=document.createElement('div');row.className='task'+(task.doneAt?' done':'');
  const check=document.createElement('button');check.className='check';check.textContent=task.doneAt?'✓':'';check.setAttribute('aria-label',task.title+(task.doneAt?' 완료 취소':' 완료'));check.addEventListener('click',()=>mutate({action:'complete',id:task.id}));
  const copy=document.createElement('div');copy.className='task-copy';const title=document.createElement('button');title.className='task-title';title.textContent=task.title;title.title='눌러서 수정';title.addEventListener('click',()=>{editingId=task.id;$('title').value=task.title;$('date').value=task.date;$('time').value=task.time;$('editing').hidden=false;$('submit').textContent='✓';$('submit').setAttribute('aria-label','수정 저장');$('title').focus();});
  const meta=document.createElement('div');meta.className='task-meta'+(task.date<state.today&&!task.doneAt?' overdue':'');meta.textContent=(task.time||'시간 미정')+(task.doneAt?' · 완료':task.date<state.today?' · 미완료':'');copy.append(title,meta);
  const remove=document.createElement('button');remove.className='remove';remove.textContent='×';remove.setAttribute('aria-label',task.title+' 삭제');remove.addEventListener('click',async()=>{if(await mutate({action:'delete',id:task.id})){deletedTask={...task};$('undo').hidden=false;}});
  row.append(check,copy,remove);$('list').append(row);
 }
}
async function mutate(body){
 if(saving)return false;saving=true;error();
 try{const result=await window.planner.mutate(body);if(!result.ok){error(result.error);return false;}render(result);return true;}catch(e){error(e.message);return false;}finally{saving=false;}
}
$('taskForm').addEventListener('submit',async event=>{event.preventDefault();if(await mutate({action:editingId?'edit':'add',id:editingId,title:$('title').value,date:$('date').value,time:$('time').value}))resetForm();});
$('today').addEventListener('click',()=>{$('date').value=state.today;});
$('tomorrow').addEventListener('click',()=>{const d=new Date(state.today+'T12:00:00');d.setDate(d.getDate()+1);$('date').value=localDate(d);});
$('clearTime').addEventListener('click',()=>{$('time').value='';});
$('cancelEdit').addEventListener('click',resetForm);
$('close').addEventListener('click',()=>window.planner.close());
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(editingId)resetForm();else window.planner.close();}});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render(state);}));
$('settingsToggle').addEventListener('click',()=>{$('settings').hidden=!$('settings').hidden;$('settingsToggle').setAttribute('aria-expanded',String(!$('settings').hidden));});
for(const id of ['morningEnabled','morningTime'])$(id).addEventListener('input',()=>{settingsDirty=true;});
$('saveSettings').addEventListener('click',async()=>{if(await mutate({action:'settings',morningEnabled:$('morningEnabled').checked,morningTime:$('morningTime').value})){settingsDirty=false;$('settings').hidden=true;$('settingsToggle').setAttribute('aria-expanded','false');}});
$('undoDelete').addEventListener('click',async()=>{if(deletedTask&&await mutate({action:'restore',task:deletedTask})){deletedTask=null;$('undo').hidden=true;}});
window.planner.onChange(render);
window.planner.get().then(data=>{render(data);resetForm();}).catch(e=>error(e.message));
