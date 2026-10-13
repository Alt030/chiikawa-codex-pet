const {test}=require('node:test'),assert=require('node:assert/strict');const {constrainBounds}=require('../src/screen-bounds');
test('excludes taskbar and clamps all four edges while preserving legal positions',()=>{
 const area={x:0,y:0,width:1920,height:1040};const b={x:1800,y:1020,width:240,height:286};assert.deepEqual(constrainBounds(b,area),{x:1680,y:754,width:240,height:286});assert.deepEqual(constrainBounds({...b,x:-300,y:-200},area),{x:0,y:0,width:240,height:286});
 assert.deepEqual(constrainBounds({...b,x:50,y:200},area),{x:50,y:200,width:240,height:286});
});
test('handles left/top taskbars, negative-coordinate monitors and disconnected saved locations',()=>{
 const area={x:-1880,y:-100,width:1880,height:1080};const safe=constrainBounds({x:-2000,y:1200,width:240,height:286},area);assert.deepEqual(safe,{x:-1880,y:694,width:240,height:286});
 assert.deepEqual(constrainBounds({x:4000,y:2000,width:240,height:286},{x:40,y:30,width:1240,height:650}),{x:1040,y:394,width:240,height:286});
});
test('oversized windows still fit within the visible work area',()=>{
 assert.deepEqual(constrainBounds({x:900,y:500,width:700,height:900},{x:0,y:0,width:640,height:480}),{x:0,y:0,width:640,height:480});
});
