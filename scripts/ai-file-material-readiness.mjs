import assert from 'node:assert/strict';

// Read-only acceptance helper: wait for response bodies, selected base and tree
// rendering, not just a search input that exists before the data arrives.
export async function waitForKnowledgeReady(frame,basesReady,treeReady) {
  const [basesResponse,treeResponse]=await Promise.all([basesReady,treeReady]);
  assert.equal(basesResponse.status(),200);assert.equal(treeResponse.status(),200);
  const [bases,nodes]=await Promise.all([basesResponse.json(),treeResponse.json()]);
  assert(Array.isArray(bases)&&bases.length>0&&/^[A-Za-z0-9_-]+$/.test(bases[0]?.id),'KNOWLEDGE_BASELINE_BASES');
  const kbId=bases[0].id;
  assert.equal(new URL(treeResponse.url()).pathname,'/api/knowledge/bases/'+kbId+'/tree','KNOWLEDGE_BASELINE_TREE_SCOPE');
  assert(Array.isArray(nodes),'KNOWLEDGE_BASELINE_TREE_BODY');
  await frame.locator('select').filter({has:frame.locator('option[value="'+kbId+'"]:checked')}).first().waitFor();
  for(const node of nodes){
    assert(typeof node?.title==='string'&&node.title.length>0,'KNOWLEDGE_BASELINE_NODE');
    await frame.getByText(node.title,{exact:true}).first().waitFor();
  }
  if(!nodes.length)await frame.getByText(/^暂无文档/).waitFor();
  assert.equal(await frame.locator('.knowledge-banner').count(),0,'KNOWLEDGE_BASELINE_LOAD_ERROR');
  return {kbId,rootCount:nodes.length};
}
