const bubble=document.getElementById('bubble');
let lastKey='',lastPhrase='',lastAsset=null;
let elapsedElement=null,workStartedAt=null,activeSessionCount=0;
function updateElapsed(){if(!elapsedElement)return;const text=PetReactionPolicy.elapsedText(workStartedAt)+(activeSessionCount>0?' · 세션 '+activeSessionCount+'개':'');if(elapsedElement.textContent!==text){elapsedElement.textContent=text;measure();}}
setInterval(updateElapsed,1000);
function measure(){const r=bubble.getBoundingClientRect();window.desktopPet.measureBubble({width:Math.ceil(r.width),height:Math.ceil(r.height)});}
window.desktopPet.onBubbleMessage(p=>{
 bubble.replaceChildren();document.documentElement.style.setProperty('--bubble-scale',String(p.bubbleScale||1));
 elapsedElement=null;workStartedAt=null;activeSessionCount=Number(p.activeSessionCount)||0;
 const id=p.pet?.id==='kurimanju'?'kurimanju':'shisa';const state=PetReactionPolicy.phraseState(p.event,p.state);
 const key=[id,state,p.event,p.message].join('|');if(key!==lastKey){lastPhrase=PetReactionPolicy.pickPhrase(id,state,Math.random,p.message);lastAsset=PetReactionPolicy.reactionAsset(id,p.event,Math.random,p.message);lastKey=key;}
 const idleChatter=String(p.event||'').startsWith('idle_chatter_');if(idleChatter)lastPhrase=p.message||'';
 const asset=lastAsset;
 if(asset){const image=document.createElement('img');image.className='reaction-card';image.alt=(id==='shisa'?'시사':'쿠리만쥬')+' 상황 반응';image.onload=measure;image.onerror=()=>{image.remove();measure();};image.src='../assets/reactions/'+asset;bubble.append(image);}

 if(lastPhrase){const phrase=document.createElement('div');const files=p.event==='tool_start'&&Array.isArray(p.editingFiles)?p.editingFiles:[];phrase.textContent=lastPhrase+(files.length?' · '+files.join(', '):'');bubble.append(phrase);}
 const message=String(idleChatter?'':p.event==='done'?(p.quotaText||'남은 사용량을 확인할 수 없어요.'):p.message||'');if(message&&!/^[A-Za-z ]* [\u4e00-\u9fff]/.test(message)&&message!=='Ready'){const detail=document.createElement('div');detail.className='detail';detail.textContent=message;bubble.append(detail);}
 requestAnimationFrame(measure);
 if(p.event!=='done'&&Number.isFinite(p.startedAt)){
  workStartedAt=p.startedAt;elapsedElement=document.createElement('div');elapsedElement.className='detail';bubble.append(elapsedElement);updateElapsed();
 }
});
window.desktopPet.onBubbleScaleChange(p=>{document.documentElement.style.setProperty('--bubble-scale',String(p.bubbleScale||1));requestAnimationFrame(measure);});

