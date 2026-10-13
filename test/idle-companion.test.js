const {test}=require('node:test'),assert=require('node:assert/strict');const {IdleCompanion}=require('../src/idle-companion');
test('two idle greetings at 10/40 minutes and sleep at 60; no repeats',()=>{
 let time=0;const i=new IdleCompanion({now:()=>time});const tick=()=>i.tick({busy:false,visible:true});
 time=599999;assert.equal(tick(),null);time=600000;assert.equal(tick(),'first');assert.equal(tick(),null);
 time=2400000;assert.equal(tick(),'second');time=3600000;assert.equal(tick(),'sleep');time=7200000;assert.equal(tick(),null);
});
test('activity, hidden pet and approval waits reset idle clock',()=>{
 let time=0;const i=new IdleCompanion({now:()=>time});time=900000;assert.equal(i.tick({busy:true,visible:true}),null);
 time+=599999;assert.equal(i.tick({busy:false,visible:true}),null);i.reset();time+=600000;assert.equal(i.tick({busy:false,visible:false}),null);
 time+=600000;assert.equal(i.tick({busy:false,visible:true}),'first');
});
