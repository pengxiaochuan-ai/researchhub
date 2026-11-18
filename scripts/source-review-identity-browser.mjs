import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
assert.equal(process.argv[2],'--mode');assert.equal(process.argv[3],'local-synthetic');
const root='/Users/mac/aisciencesys/',base='http://127.0.0.1:19501';
const runtime=JSON.parse(readFileSync(root+'.tmp/researchhub-knowledge-local/runtime.json','utf8'));
const fixtureName=process.argv[4];assert.match(fixtureName,/^review-ux-[a-f0-9]{8}$/);
const fixture=JSON.parse(readFileSync(root+'researchhub/docs/testing/evidence/'+fixtureName+'/fixture.json','utf8'));
const out=root+'researchhub/docs/testing/evidence/review-identity-'+randomUUID().slice(0,8)+'/';mkdirSync(out+'video',{recursive:true});
const pw=await import(root+'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const browser=await (pw.chromium??pw.default.chromium).launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const admin=await browser.newContext(),owner=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'video'}});
const checks=[],errors=[];let page;
async function login(context,actor){assert.equal((await context.request.post(base+'/api/auth/login',{data:{tenantSlug:runtime.ids.tenant,username:actor+'@example.org',password:runtime.password}})).status(),201);}
async function decide(visibility){const query=new URLSearchParams({batchId:fixture.batchId,sourceRegistryId:fixture.rows[0].sourceRegistryId,sourceRecordId:fixture.rows[0].id});
  const r=await admin.request.get(base+'/api/hub-sources/review-workbook?'+query);assert.equal(r.status(),200);
  const body=await r.json();if(body.scope.state.status===visibility)return;
  const response=await admin.request.post(base+'/api/hub-sources/object-reviews',{data:{kind:'workbook',batchId:fixture.batchId,
    sourceRegistryId:fixture.rows[0].sourceRegistryId,sourceRecordId:fixture.rows[0].id,visibility,
    operationId:randomUUID(),expectedFingerprint:body.scope.fingerprint}});assert.equal(response.status(),201);
}
async function logout(p){await p.locator('[data-user-trigger][data-authenticated="true"]').click();await p.getByRole('button',{name:'退出当前浏览器会话',exact:true}).click();
  await p.getByText('已退出当前浏览器会话，不代表撤销其他设备。',{exact:true}).waitFor();await p.getByRole('button',{name:'关闭',exact:true}).click();}
try{await login(admin,'admin');await decide('tenant');
  for(const type of ['e01','e02']){
    await login(owner,'owner');page=await owner.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
    const target=base+'/pages/'+type+'/'+(type==='e02'?'?recordId='+fixture.rows[0].id:'');
    await page.goto(target);await page.locator('[data-user-trigger][data-authenticated="true"]').waitFor();
    if(type==='e01'){
      await page.getByLabel('检索标题、作者、期刊或 DOI').fill(fixture.marker);await page.getByRole('button',{name:'应用筛选',exact:true}).click();
      await page.getByRole('button',{name:fixture.rows[0].title,exact:true}).waitFor();
    }else await page.getByRole('heading',{name:fixture.rows[0].title,exact:true}).waitFor();
    let release,captured;const delayed=new Promise(ok=>{release=ok;}),received=new Promise(ok=>{captured=ok;});
    await page.route(type==='e01'?'**/api/hub-sources/member/publications?*':'**/api/hub-sources/member/publications/'+fixture.rows[0].id,async route=>{
      const response=await route.fetch();assert.equal(response.status(),200);captured();await delayed;
      await route.fulfill({response}).catch(()=>{});
    },{times:1});
    if(type==='e01'){
      await page.getByLabel('检索标题、作者、期刊或 DOI').fill(fixture.marker+' 合成');await page.getByRole('button',{name:'应用筛选',exact:true}).click();
    }else await page.reload({waitUntil:'domcontentloaded'});
    let timeout;
    try {await Promise.race([received,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('STALE_RESPONSE_CAPTURE_TIMEOUT')),12000);})]);}
    finally {clearTimeout(timeout);}
    await logout(page);release();
    if(type==='e01')await page.getByRole('heading',{name:'暂无已获准文献',exact:true}).waitFor();
    else await page.getByRole('heading',{name:'暂不可查看此文献',exact:true}).waitFor();
    assert.equal(await page.getByText(fixture.rows[0].title,{exact:true}).count(),0);
    await page.screenshot({path:out+type+'-logout-stale-response.png'});checks.push(type+':真实租户读取、实际退出、已取得的迟到200不回填、匿名不可见');await page.close();
  }
  assert.deepEqual(errors,[]);writeFileSync(out+'result.json',JSON.stringify({passed:true,checks,errors,fixture:fixtureName,modelCalls:0},null,2));console.log(JSON.stringify({passed:true,evidence:out,checks:checks.length}));
}catch(error){await page?.screenshot({path:out+'failure.png'}).catch(()=>{});writeFileSync(out+'failure.json',JSON.stringify({error:error.message,checks,errors},null,2));console.error(JSON.stringify({passed:false,error:error.message,evidence:out}));process.exitCode=1;
}finally{await decide('withheld').catch(error=>{console.error('FIXTURE_WITHDRAWAL_FAILED:'+error.message);process.exitCode=1;});await owner.close();await admin.close();await browser.close();}
