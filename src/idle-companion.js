class IdleCompanion{
 constructor({now=Date.now}={}){this.now=now;this.reset();}
 reset(){this.since=this.now();this.stage=0;}
 tick({busy,visible}){
  if(busy||!visible){this.reset();return null;}
  const elapsed=this.now()-this.since;
  if(elapsed>=3600000&&this.stage<3){this.stage=3;return 'sleep';}
  if(elapsed>=2400000&&this.stage<2){this.stage=2;return 'second';}
  if(elapsed>=600000&&this.stage<1){this.stage=1;return 'first';}
  return null;
 }
}
module.exports={IdleCompanion};
