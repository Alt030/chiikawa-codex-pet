const fs=require('node:fs'),path=require('node:path');
function classifyTool(p){const name=String(p.tool_name||p.toolName||'').toLowerCase();const input=p.tool_input||{};const command=String(input.command||input.cmd||'');
 if(/web|search|browse/.test(name)){if(input.search_query||input.image_query||/search/.test(name))return 'searching';if(input.open||input.click||input.find||input.screenshot)return 'reading';return 'browsing';}
 if(/apply_patch|edit|write/.test(name))return 'editing';
 if(/view_image|read|fetch|get_file/.test(name))return 'reading';
 if(/bash|shell|terminal|exec_command/.test(name)){if(/(?:^|[\s;&|])(npm|pnpm|yarn)\s+(?:run\s+)?test\b|\b(pytest|vitest|jest)\b|\b(cargo|go)\s+test\b/.test(command))return 'testing';if(/\b(rg|Get-Content|Get-ChildItem|cat|type)\b/.test(command))return 'reading';return 'executing';}
 return 'working';}
function failed(response){if(!response||typeof response!=='object')return false;if(response.isError===true||response.is_error===true)return true;if(typeof response.exit_code==='number'&&response.exit_code!==0)return true;const sc=response.structuredContent;if(sc&&failed(sc))return true;for(const c of response.content||[]){if(c.type==='text')try{if(failed(JSON.parse(c.text)))return true;}catch{}}return false;}
const labels={searching:'웹 검색 중',browsing:'웹 도구 사용 중',reading:'자료 읽는 중',editing:'코드 수정 중',testing:'테스트 실행 중',executing:'명령 실행 중',working:'도구 사용 중'};
function normalizeToolEvent(p){if(!['PreToolUse','PostToolUse'].includes(p.hook_event_name))return p;const category=classifyTool(p);const error=p.hook_event_name==='PostToolUse'&&failed(p.tool_response);const out={...p,message:error?'도구 실행에서 오류가 발생했어요.':p.hook_event_name==='PreToolUse'?labels[category]:'결과 정리 중'};if(error)out.event='tool_failed';return out;}
module.exports={classifyTool,failed,normalizeToolEvent,labels};
