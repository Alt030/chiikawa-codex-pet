function registrationSpeech(pet){return pet==='kurimanju'?'흠...':'샤부님~ 일정 적어뒀어요! (기억하는 시사)';}
function completionSpeech(pet,{remaining,allDone}){
 if(pet==='kurimanju')return '캬하~!';
 if(allDone)return '샤부님~ 오늘 일정 다 끝냈어요! (뿌듯한 시사)';
 return remaining?'샤부님~ 하나 끝냈어요! 잘하셨어요! (응원하는 시사)':'샤부님~ 잘하셨어요! (기뻐하는 시사)';
}
function reminderSpeech(pet){return pet==='kurimanju'?'흠...':'샤부님~ 일정 확인할 시간이에요! (알려주는 시사)';}
module.exports={registrationSpeech,completionSpeech,reminderSpeech};
