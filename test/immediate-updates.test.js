const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');const {attachImmediateInstall,updateMenuLabel}=require('../src/immediate-updates');
test('installs exactly once only after verified download, not on discovery or errors',()=>{
 const updater=new EventEmitter();let count=0;updater.on('error',()=>{});attachImmediateInstall(updater,()=>count++);
 updater.emit('update-available');updater.emit('download-progress',{percent:50});updater.emit('error',Error('network'));assert.equal(count,0);
 updater.emit('update-downloaded');assert.equal(count,1);updater.emit('update-downloaded');assert.equal(count,1);
});
test('tray shows progress and returns to manual check on failure/latest',()=>{
 assert.equal(updateMenuLabel({status:'checking'}),'업데이트 확인 중…');assert.equal(updateMenuLabel({status:'downloading',progress:62.2}),'업데이트 다운로드 중 · 62%');assert.equal(updateMenuLabel({status:'error'}),'업데이트 확인');assert.equal(updateMenuLabel({status:'latest'}),'업데이트 확인');
});
