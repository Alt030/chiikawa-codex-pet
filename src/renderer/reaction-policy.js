(function(root){
const phrases={
  "shisa": {
    "idle": [],
    "review": [
      "샤부님~ 한번 살펴볼게요! (곰곰이 생각하는 시사)",
      "잠깐만요~ 하나씩 보고 있어요! (집중하는 시사)"
    ],
    "running": [
      "샤부님~ 열심히 하고 있어요! (열심인 시사)",
      "차근차근 해볼게요~! (의욕 있는 시사)"
    ],
    "waiting": [
      "샤부님~ 여기 한번 봐주세요! (기다리는 시사)",
      "이건 어떻게 할까요~? (살짝 고민하는 시사)"
    ],
    "waving": [
      "샤부님~ 새 소식 왔어요! (알려주는 시사)"
    ],
    "jumping": [
      "샤부님~ 여기까지 했어요! (뭔가 끝낸 시사)",
      "샤부님~ 답변 정리했어요! (뿌듯한 시사)",
      "다 정리했어요~ 확인해 주세요! (행복한 시사)"
    ],
    "failed": [
      "앗… 샤부님~ 여기서 막혔어요. (조금 당황한 시사)",
      "샤부님~ 같이 한번 봐주실래요? (도움이 필요한 시사)"
    ]
  },
  "kurimanju": {
    "idle": [],
    "review": [
      "흠....(곰곰이 생각하는 쿠리만쥬)"
    ],
    "running": [
      "흠....(열심히 일하는 쿠리만쥬)"
    ],
    "waiting": [],
    "waving": [],
    "jumping": [
      "캬아!!!(뭔가 끝낸 듯한 쿠리만쥬)",
      "캬아...(열심히 일하고 맥주마시는 쿠리만쥬)"
    ],
    "failed": []
  }
};
const shisaStatusPhrases={
  "권한 확인 중": ["샤부님~ 실행할 수 있는지 확인하고 있어요! (확인하는 시사)"],
  "다음 단계 진행 중": ["샤부님~ 다음 단계도 이어서 할게요! (일하는 시사)"],
  "웹 검색 중": [
    "샤부님~ 찾아보고 있어요! (열심히 찾는 시사)",
    "어디 있을까요~? 더 찾아볼게요! (두리번거리는 시사)"
  ],
  "웹 도구 사용 중": [
    "샤부님~ 페이지 보고 있어요! (살펴보는 시사)"
  ],
  "자료 읽는 중": [
    "샤부님~ 꼼꼼히 읽어볼게요! (공부하는 시사)",
    "이것도 한번 봐둘게요~! (배우는 시사)"
  ],
  "코드 수정 중": [
    "샤부님~ 여기 고치고 있어요! (뭔가 고치는 시사)",
    "조금만요~ 차근차근 고쳐볼게요! (열심인 시사)"
  ],
  "테스트 실행 중": [
    "잘 되는지 확인해볼게요~! (진지한 시사)",
    "샤부님~ 검사하고 있어요! (꼼꼼한 시사)"
  ],
  "명령 실행 중": [
    "샤부님~ 실행해보고 있어요! (일하는 시사)"
  ],
  "결과 정리 중": [
    "샤부님~ 결과 정리하고 있어요! (정리하는 시사)",
    "놓친 건 없나 한번 더 볼게요~! (꼼꼼한 시사)"
  ]
};
const reactionPools={
  "shisa": {
    "prompt": [
      "shisa-license-user.png",
      "shisa-gifs/05.gif",
      "shisa-gifs/03.gif"
    ],
    "done": [
      "shisa-coffee-user.png",
      "shisa-gifs/01.gif",
      "shisa-gifs/02.gif",
      "shisa-gifs/06.gif",
      "shisa-gifs/07.gif"
    ],
    "waiting": [
      "shisa-gifs/04.gif"
    ],
    "failed": [
      "shisa-gifs/04.gif"
    ],
    "tool_failed": [
      "shisa-gifs/04.gif"
    ]
  },
  "kurimanju": {
    "prompt": [
      "kurimanju-start-user.png",
      "kurimanju-suit-user.jpeg",
      "kurimanju-gifs/07.gif",
      "kurimanju-gifs/05.gif"
    ],
    "done": [
      "kurimanju-complete-user.png",
      "kurimanju-gifs/01.gif",
      "kurimanju-gifs/02.gif",
      "kurimanju-gifs/03.gif",
      "kurimanju-gifs/04.gif",
      "kurimanju-gifs/06.gif",
      "kurimanju-gifs/08.gif",
      "kurimanju-gifs/09.gif",
      "kurimanju-gifs/10.gif"
    ],
    "waiting": [
      "kurimanju-gifs/05.gif",
      "kurimanju-gifs/07.gif"
    ],
    "failed": [
      "kurimanju-error-user.png"
    ],
    "tool_failed": [
      "kurimanju-error-user.png"
    ]
  }
};
const reactionCounters={};
function reactionAsset(id,event,random=Math.random,message=""){
 if(event==='idle_chatter_second')return id==='kurimanju'?'kurimanju-gifs/06.gif':'shisa-license-user.png';
 const sharedThinking=['prompt','thinking','review'].includes(event);
 const sharedWorking=event==='tool_start'&&['웹 검색 중','웹 도구 사용 중','자료 읽는 중','코드 수정 중','테스트 실행 중'].includes(message);
 if(event==='done'&&random()<.25)return 'shared-complete-user.jpeg';
 if(sharedThinking&&random()<.35)return 'shared-thinking-user.jpeg';
 if(sharedWorking&&random()<.35)return 'shared-working-user.jpeg';
 const list=reactionPools[id]?.[event]||[];if(!list.length)return null;const key=id+':'+event;let n=reactionCounters[key]||0;try{n=Number(localStorage.getItem('reaction-rotation:'+key))||n;}catch{}const chosen=list[n%list.length];reactionCounters[key]=n+1;try{localStorage.setItem('reaction-rotation:'+key,String(n+1));}catch{}return chosen;}

function pickPhrase(id,state,random=Math.random,message=""){const options=(id==="shisa"&&state!=="failed"&&shisaStatusPhrases[message])||phrases[id]?.[state]||[];if(!options.length)return "";return options[Math.min(options.length-1,Math.floor(random()*options.length))];}
function phraseState(event,state){
 if(event==='done')return 'jumping';
 if(event==='waiting')return 'waiting';
 if(event==='tool_start'||event==='tool_end')return 'running';
 if(state==='jumping')return 'idle';
 if(state==='waiting')return 'running';
 return state||'idle';
}
function elapsedText(startedAt,now=Date.now()){
 if(!Number.isFinite(startedAt))return '';
 const minutes=Math.floor(Math.max(0,now-startedAt)/60000);
 return '작업 중 · '+(minutes<1?'1분 미만':minutes+'분 경과');
}
const api={reactionAsset,pickPhrase,reactionPools,phraseState,elapsedText};if(typeof module==='object'&&module.exports)module.exports=api;else root.PetReactionPolicy=api;
})(globalThis);
