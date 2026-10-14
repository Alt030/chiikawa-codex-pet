const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('planner',{
 get:()=>ipcRenderer.invoke('planner:get'),
 mutate:body=>ipcRenderer.invoke('planner:mutate',body),
 close:()=>ipcRenderer.invoke('planner:close'),
 onChange:callback=>ipcRenderer.on('planner:changed',(_event,data)=>callback(data))
});
