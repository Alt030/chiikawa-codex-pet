const {test}=require('node:test'),assert=require('node:assert/strict');const {editingFiles}=require('../src/editing-files');
test('extracts patch filenames including nested orchestrator calls',()=>{
 const patch='*** Begin Patch\n*** Update File: C:/project/bubble.js\n@@\n-a\n+b\n*** Add File: src/card.js\n*** End Patch';
 assert.deepEqual(editingFiles('apply_patch',patch),['bubble.js','card.js']);
 assert.deepEqual(editingFiles('functions.exec','await tools.apply_patch('+JSON.stringify(patch)+')'),['bubble.js','card.js']);
 assert.deepEqual(editingFiles('Edit',{file_path:'C:\\project\\한글.js'}),['한글.js']);
 assert.deepEqual(editingFiles('read_file',{path:'src/a.js'}),[]);
});
