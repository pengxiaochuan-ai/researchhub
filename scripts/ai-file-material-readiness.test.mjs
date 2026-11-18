import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForKnowledgeReady} from './ai-file-material-readiness.mjs';
const pw=await import('/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const response=(data,url='http://127.0.0.1/api/knowledge/bases/base_a/tree')=>({status:()=>200,url:()=>url,json:()=>data});

test('visible search field cannot finish a baseline while bases or tree content is still unavailable',async()=>{
  const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const bases=deferred(),tree=deferred();let complete=false;
  try{
    const page=await browser.newPage();await page.setContent('<select></select><input placeholder="搜索当前知识库内容…"><div id="nodes"></div>');
    const done=waitForKnowledgeReady(page,Promise.resolve(response(bases.promise)),Promise.resolve(response(tree.promise))).then(result=>{complete=true;return result;});
    try{
      await Promise.race([done,new Promise(r=>setTimeout(r,200))]);
      assert.equal(complete,false,'initial search field is not proof of loaded data');
      bases.resolve([{id:'base_a'}]);
      await page.locator('select').evaluate(el=>{const option=document.createElement('option');option.value='base_a';option.textContent='Loaded base';el.append(option);el.value='base_a';});
      await Promise.race([done,new Promise(r=>setTimeout(r,200))]);assert.equal(complete,false,'tree response is still withheld');
      tree.resolve([{id:'doc_a',title:'Actual root document'}]);
      await page.locator('#nodes').evaluate(el=>{el.textContent='Actual root document';});
      assert.deepEqual(await done,{kbId:'base_a',rootCount:1});
    }finally{bases.resolve([{id:'base_a'}]);tree.resolve([]);await done.catch(()=>{});}
  }finally{await browser.close();}
});
test('tree for a different base cannot qualify the selected base as loaded',async()=>{
  const browser=await(pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try{
    const page=await browser.newPage();await page.setContent('<select><option value="base_a">Loaded base</option></select><input placeholder="搜索当前知识库内容…">');
    await assert.rejects(waitForKnowledgeReady(page,Promise.resolve(response([{id:'base_a'}])),
      Promise.resolve(response([],'http://127.0.0.1/api/knowledge/bases/other/tree'))),/KNOWLEDGE_BASELINE_TREE_SCOPE/);
  }finally{await browser.close();}
});
