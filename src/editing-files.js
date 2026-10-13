const path=require('node:path');
function editingFiles(name,input){
 const text=typeof input==='string'?input:JSON.stringify(input||{});
 const paths=[];const add=value=>{if(typeof value==='string'&&value.trim())paths.push(path.win32.basename(value.trim().replace(/\//g,'\\')));};
 let data=input;if(typeof data==='string')try{data=JSON.parse(data);}catch{}
 if(/edit|write|patch/i.test(name)&&data&&typeof data==='object'){
  for(const key of ['file_path','filePath','path','filename'])add(data[key]);
 }
 // Direct patch inputs and JSON-quoted patch strings inside functions.exec.
 let patches=[text];for(const match of text.matchAll(/"(?:[^"\\]|\\.)*"/g))try{const value=JSON.parse(match[0]);if(value.includes('*** Begin Patch'))patches.push(value);}catch{}
 for(const patch of patches)for(const match of patch.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm))add(match[1]);
 return [...new Set(paths)].slice(0,8);
}
module.exports={editingFiles};
