// Installation starts only after electron-updater has verified the download.
function attachImmediateInstall(updater,install){
 let installing=false;
 updater.on('update-downloaded',()=>{if(installing)return;installing=true;install();});
}
function updateMenuLabel(status){
 if(status.status==='checking')return '업데이트 확인 중…';
 if(status.status==='downloading')return `업데이트 다운로드 중 · ${Math.round(status.progress||0)}%`;
 if(status.status==='installing'||status.status==='ready')return '업데이트 설치 중…';
 return '업데이트 확인';
}
module.exports={attachImmediateInstall,updateMenuLabel};
