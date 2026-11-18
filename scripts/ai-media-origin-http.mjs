// Real source perimeter checks; intentionally invalid bodies/IDs, zero media writes.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import pw from '/Users/mac/aisciencesys/app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js';
assert.deepEqual(process.argv.slice(2),['--synthetic-staging','--no-media-writes']);
const runtime=JSON.parse(readFileSync('../.tmp/researchhub-knowledge-local/runtime.json')),old=JSON.parse(readFileSync('.tmp/ai-resumable-2026-11-16/live/checkpoint.json')),base='http://127.0.0.1:19501',api='http://127.0.0.1:19502';assert.equal(runtime.key,'rh-kb-local-b0e2af9d');
const context=await pw.request.newContext(),results=[];
try{
 assert.equal((await context.post(base+'/api/auth/login',{headers:{Origin:base},data:{tenantSlug:runtime.ids.tenant,username:'owner@example.org',password:runtime.password}})).status(),201);
 const path='/api/sessions/'+old.actors.owner.sessionId+'/media-uploads',standard={Origin:'http://127.0.0.1',Referer:base+'/pages/ai01/','Sec-Fetch-Site':'same-origin','Sec-Fetch-Mode':'same-origin','Sec-Fetch-Dest':'empty','X-ResearchHub-Request':'session-media-v1','Content-Type':'application/json','X-Study-Group-Id':runtime.ids.group,'X-Research-Project-Id':runtime.ids.project};
 const cases=[{name:'full-origin',patch:{Origin:base},status:400},{name:'portless-proven',status:400},
  ...[['Origin','null'],['Origin','http://127.0.0.1:80'],['Origin','http://127.0.0.1:19502'],['Origin','http://localhost:19501'],['Origin','https://evil.test'],['Referer','http://127.0.0.1:19502/'],['Sec-Fetch-Site','same-site'],['Sec-Fetch-Site','cross-site'],['Sec-Fetch-Mode','cors'],['Sec-Fetch-Dest','document'],['X-ResearchHub-Request','session-v1'],['Content-Type','text/plain'],['Forwarded',''],['X-Forwarded-Host','127.0.0.1:19501']].map(([k,v])=>({name:'reject-'+k+'-'+v,patch:{[k]:v},status:403})),
  ...['Origin','Referer','Sec-Fetch-Site','Sec-Fetch-Mode','Sec-Fetch-Dest','X-ResearchHub-Request'].map(k=>({name:'missing-'+k,omit:k,status:403})),
  {name:'proved-chunk-reaches-own-missing-ID',suffix:'/12345678-1234-4234-a234-123456789012/chunks/0',patch:{'Content-Type':'application/octet-stream'},body:Buffer.from('synthetic'),status:404},
  {name:'chunk-wrong-type',suffix:'/12345678-1234-4234-a234-123456789012/chunks/0',status:403},
  {name:'proved-complete-reaches-own-missing-ID',suffix:'/12345678-1234-4234-a234-123456789012/complete',status:404}];
 for(const c of cases){const headers={...standard,...c.patch};if(c.omit)delete headers[c.omit];const r=await context.post(api+path+(c.suffix??''),{headers,data:c.body??'{}'}),v=await r.json();results.push({name:c.name,status:r.status(),code:v.code??null});assert.equal(r.status(),c.status,c.name);if(c.status===403)assert.equal(v.code,'MEDIA_ORIGIN_REJECTED',c.name);}
 writeFileSync('.tmp/ai-media-origin-2026-11-16/http.json',JSON.stringify({passed:true,at:new Date().toISOString(),newMediaObjects:0,results},null,2)+'\n');console.log(JSON.stringify({passed:true,cases:results.length,newMediaObjects:0}));
}finally{await context.dispose();}
