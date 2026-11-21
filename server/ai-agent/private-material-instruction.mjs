import{readFile}from'node:fs/promises';import{join}from'node:path';
import{PRIVATE_MATERIAL_INSTRUCTION}from'./private-material-output.mjs';
export async function loadPrivateMaterialInstruction(root){
 const method=await readFile(join(root,'skill/doubao-medical-literature-interpretation/SKILL.md'),'utf8'),core=method.slice(method.indexOf('## 5.'),method.indexOf('## 6.'));
 if(!core.trim())throw Error('HUB_SKILL_SOURCE_CHANGED');
 return core+'\n【ResearchHub本人资料执行适配，优先于原平台交付要求，不创建外部文档】\n'+PRIVATE_MATERIAL_INSTRUCTION;
}
