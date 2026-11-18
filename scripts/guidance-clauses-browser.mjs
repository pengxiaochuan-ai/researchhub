import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { initialDocumentId, verifiedInitialFiles } from '../server/hub-sources/initial-five.mjs';
import { guidancePayload, guidanceHash } from '../server/hub-sources/guidance-clause-contract.mjs';

const root = '/Users/mac/aisciencesys/', base = 'http://127.0.0.1:19501';
const runtime = JSON.parse(readFileSync(root + '.tmp/researchhub-knowledge-local/runtime.json', 'utf8'));
const action = process.argv[2]; assert.ok(['approve', 'verify'].includes(action), 'Use approve|verify');
const evidenceRef = 'https://app.notion.com/p/40a56479ab58819e8eefc65d94e220d0?pvs=204';
const sources = verifiedInitialFiles().filter(s => s.mimeType === 'application/pdf').map(s => ({ ...s,
  documentId: initialDocumentId(runtime.ids.tenant, 'lingshu-xinyu', s), payload: guidancePayload(s.externalKey) }));
const out = root + 'docs/test/evidence/2026-10-31-guidance-clauses/' + action + '-' + randomUUID().slice(0, 8) + '/';
mkdirSync(out + 'video', { recursive: true, mode: 0o700 });
const pw = await import(root + 'app/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.js');
const chromium = pw.chromium ?? pw.default.chromium;
const options = { headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' };
const browser = await chromium.launch(options), checks = [], errors = [], warnings = [], network = [], metrics = [], decisions = [];
async function login(context, actor) {
  const r = await context.request.post(base + '/api/auth/login', { data: { tenantSlug: runtime.ids.tenant,
    username: actor + '@example.org', password: runtime.password } }); assert.equal(r.status(), 201);
}
async function preview(context) {
  const r = await context.request.get(base + '/api/hub-sources/external-review-items'); assert.equal(r.status(), 200);
  assert.equal(r.headers()['cache-control'], 'no-store'); const data = await r.json(); assert.equal(data.items.length, 5); return data.items;
}
function watch(page, name) {
  page.on('pageerror', e => errors.push({ name, message: e.message }));
  page.on('console', m => { if (m.type() === 'warning') warnings.push({ name, message: m.text() }); });
  page.on('response', r => { const path = new URL(r.url()).pathname;
    if (path.startsWith('/api/hub-sources/')) network.push({ name, path, status: r.status() }); });
}
async function shot(page, name) {
  if (name.includes('native200')) {
    const cdp = await page.context().newCDPSession(page);
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
    writeFileSync(out + name + '.png', Buffer.from(r.data, 'base64')); await cdp.detach();
  } else await page.screenshot({ path: out + name + '.png' });
}
async function measure(page, name) {
  const m = await page.evaluate(() => {
    const main = document.querySelector('.platform-main'), quote = document.querySelector('.guidance-clauses__quote');
    return { width: innerWidth, docWidth: document.documentElement.scrollWidth, mainWidth: main.clientWidth, mainScroll: main.scrollWidth,
      font: quote && getComputedStyle(quote).fontSize, lineHeight: quote && getComputedStyle(quote).lineHeight,
      clips: [...document.querySelectorAll('.guidance-clauses p,.guidance-clauses blockquote,.guidance-clauses h4')]
        .filter(el => el.checkVisibility()).flatMap(el => {
          const range = document.createRange(); range.selectNodeContents(el); const a=range.getBoundingClientRect(), b=el.getBoundingClientRect();
          return a.width && (a.left < b.left-1 || a.right > b.right+1) ? [el.textContent.slice(0,60)] : [];
        }) };
  });
  metrics.push({ name, ...m }); assert.ok(m.docWidth <= m.width+1 && m.mainScroll <= m.mainWidth+1, name+JSON.stringify(m));
  if (m.font) { assert.equal(m.font, '16px'); assert.equal(m.lineHeight, '28px'); } assert.deepEqual(m.clips, [], name);
}
async function checkCard(page, source, name) {
  const card = page.locator('.real-registry__card').filter({ has: page.getByRole('heading', { name: source.title, exact: true }) });
  const reply = page.waitForResponse(r => new URL(r.url()).pathname === '/api/hub-sources/guidance-documents/' + source.documentId);
  const toggle = card.locator('.guidance-excerpt-loader > summary');
  await toggle.focus(); await page.keyboard.press('Enter');
  const r = await reply; assert.equal(r.status(), 200); assert.equal(r.headers()['cache-control'], 'no-store');
  const { item } = await r.json(); assert.equal(item.clausesStatus, 'approved');
  const { extractionId, extractionVersion, fileName, sourceSha256, payloadSha256, reviewVersion, ...payload } = item.clauseDetails;
  assert.deepEqual(payload, source.payload); assert.equal(sourceSha256, source.expectedSha256);
  assert.equal(payloadSha256, guidanceHash(source.payload)); assert.ok(extractionId && extractionVersion === 1 && reviewVersion && fileName === source.fileName);
  await card.getByRole('region', { name: '关键条款与原始页码', exact: true }).waitFor();
  assert.equal(await card.locator('.guidance-clauses__list > li').count(), 4);
  assert.ok(await toggle.evaluate(el => el.getBoundingClientRect().height >= 44));
  await card.locator('.guidance-clauses__list > li').first().scrollIntoViewIfNeeded();
  await measure(page, name+'-first'); await shot(page, name+'-first');
  const last = card.locator('.guidance-clauses__list > li').last();
  const locator = last.locator('summary'); await locator.scrollIntoViewIfNeeded();
  assert.ok(await locator.evaluate(el => { const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit===el||el.contains(hit); }), name+': last source obscured');
  await locator.focus(); await page.keyboard.press('Enter');
  assert.ok(await last.getByText(`原文位置：${source.payload.clauses[3].anchor}`, { exact: true }).isVisible());
  assert.ok(await last.getByText(`原文件：${source.fileName}`, { exact: true }).isVisible());
  await measure(page, name+'-last'); await shot(page, name+'-last');
  if (source.documentType === 'clinical_guideline') assert.ok(await card.getByText(source.payload.editionNotice, { exact: true }).count());
  checks.push(name+': actual DB/API/hash, four excerpts, page distinction, keyboard, typography and last-source hit');
}
let zoom;
try {
  if (action === 'approve') {
    const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: out+'video' } });
    await login(c, 'admin'); const before = await preview(c), p = await c.newPage(); watch(p,'admin-approve');
    await p.goto(base+'/pages/g02/'); await p.locator('.hub-external-item').first().waitFor();
    for (const source of sources) {
      const item = (await preview(c)).find(x => x.id === source.documentId), e = item.guidanceExtraction;
      assert.equal(e.payloadSha256, guidanceHash(source.payload));
      if (e.review?.decision === 'approve') {
        assert.equal(e.review.evidenceRef, evidenceRef); assert.equal(e.review.reviewerId, runtime.ids.admin);
        decisions.push({ documentId:item.id,action:'already-approved',version:e.review.version }); continue;
      }
      assert.equal(e.review, null, 'Unexpected prior excerpt review must be discussed');
      const pending = (await (await c.request.get(base+'/api/hub-sources/guidance-documents/'+item.id)).json()).item;
      assert.equal(pending.clausesStatus,'pending_review'); assert.ok(!pending.clauseDetails);
      const card = p.locator('.hub-external-item').filter({ has:p.getByRole('heading',{name:source.title,exact:true}) });
      await card.locator('.hub-external-guidance-preview > summary').click();
      assert.equal(await card.locator('.guidance-clauses__list > li').count(),4);
      await measure(p,'admin-before-'+source.externalKey.replaceAll('/','-'));
      await card.getByLabel('核验字段').selectOption('guidance_clauses');
      assert.ok(await card.getByLabel('允许用途').isDisabled()); assert.equal(await card.getByLabel('允许用途').inputValue(),'display');
      await card.getByLabel('权利与内容审核依据').fill(evidenceRef); await card.getByRole('checkbox').check();
      const saved = p.waitForResponse(r=>r.url().endsWith('/api/hub-sources/external-reviews')&&r.request().method()==='POST');
      await card.getByRole('button',{name:'记录本项批准',exact:true}).click(); const r=await saved; assert.equal(r.status(),201);
      decisions.push((await r.json()).review); await p.getByText('审核决定已保存，当前状态已刷新。',{exact:true}).waitFor();
    }
    const after=await preview(c);
    for(const item of after) assert.deepEqual(item.decisions.filter(x=>x.fieldKind!=='guidance_clauses'),
      before.find(x=>x.id===item.id).decisions.filter(x=>x.fieldKind!=='guidance_clauses'));
    await shot(p,'admin-approved'); assert.deepEqual(errors,[]);
    writeFileSync(out+'receipt.json',JSON.stringify({action,evidenceRef,decisions,before,after,errors,warnings,metrics},null,2)); await c.close();
  } else {
    const audit=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out+'video'}});
    await login(audit,'admin'); const previewItems=await preview(audit);
    for(const source of sources) { const e=previewItems.find(x=>x.id===source.documentId).guidanceExtraction;
      assert.equal(e.review?.decision,'approve');assert.equal(e.review.evidenceRef,evidenceRef); }
    const p=await audit.newPage();watch(p,'admin-preview');
    for(const width of [1440,390]) {
      await p.setViewportSize({width,height:width===1440?1000:844});await p.goto(base+'/pages/g02/');
      const card=p.locator('.hub-external-item').filter({has:p.getByRole('heading',{name:sources[2].title,exact:true})});
      await card.locator('.hub-external-guidance-preview > summary').click();await card.getByLabel('核验字段').selectOption('guidance_clauses');
      assert.ok(await card.locator('.hub-external-current').filter({hasText:'已批准'}).count());
      await card.locator('.guidance-clauses__list > li').last().scrollIntoViewIfNeeded();await measure(p,'admin-'+width);await shot(p,'admin-'+width);
      checks.push('G02/'+width+': real current approved excerpt preview');
    }await audit.close();
    for(const actor of ['owner','admin']) for(const [name,width,height]of[['desktop',1440,1000],['mobile390',390,844],['mobile320',320,700]]) {
      const c=await browser.newContext({viewport:{width,height},recordVideo:{dir:out+'video'}});await login(c,actor);
      const p=await c.newPage();watch(p,name+'-'+actor);await p.goto(base+'/pages/h06/');await p.locator('.real-registry__card').first().waitFor();
      await p.waitForFunction(()=>document.querySelector('[data-user-name]')?.textContent?.includes('合成'));
      assert.equal(await p.locator('.real-registry__card').count(),3);
      await p.getByRole('searchbox').fill('T/CAAM 0012');assert.equal(await p.locator('.real-registry__card').count(),1);await p.getByRole('searchbox').fill('');
      for(const s of sources) await checkCard(p,s,name+'-'+actor+'-'+s.externalKey.replaceAll('/','-'));
      await c.close();
    }
    zoom=await chromium.launchPersistentContext(mkdtempSync(root+'.tmp/guidance-clauses-zoom-'),{...options,viewport:null,args:['--window-size=1440,1000'],recordVideo:{dir:out+'video',size:{width:1440,height:1000}}});
    await zoom.pages()[0].goto('chrome://settings/appearance');await zoom.pages()[0].locator('#zoomLevel').selectOption('2');
    const zp=await zoom.newPage();watch(zp,'native200');
    for(const actor of ['owner','admin']) {
      await login(zoom,actor);await zp.goto(base+'/pages/h06/');await zp.locator('.real-registry__card').first().waitFor();
      await zp.waitForFunction(()=>document.querySelector('[data-user-name]')?.textContent?.includes('合成'));
      for(const s of sources)await checkCard(zp,s,'native200-'+actor+'-'+s.externalKey.replaceAll('/','-'));
      assert.equal(await zp.evaluate(()=>devicePixelRatio),2);
    }await zoom.close();zoom=null;
    const c=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir:out+'video'}});await login(c,'owner');const cp=await c.newPage();
    let fail=true;await c.route('**/api/hub-sources/guidance-documents/'+sources[0].documentId,route=>fail?(fail=false,route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'合成契约故障'})})):route.continue());
    await cp.goto(base+'/pages/h06/');const card=cp.locator('.real-registry__card').filter({has:cp.getByRole('heading',{name:sources[0].title,exact:true})});
    await card.locator('.guidance-excerpt-loader > summary').click();await card.getByRole('alert').waitFor();assert.equal(await card.locator('.guidance-clauses').count(),0);
    await card.getByRole('button',{name:'重试读取条款',exact:true}).click();await card.locator('.guidance-clauses').waitFor();
    await c.unroute('**/api/hub-sources/guidance-documents/'+sources[0].documentId);
    await c.route('**/api/hub-sources/guidance-documents/'+sources[0].documentId,async route=>{const r=await route.fetch(),body=await r.json();delete body.item.clauseDetails;body.item.clausesStatus='pending_review';await route.fulfill({response:r,json:body});});
    await card.locator('.guidance-excerpt-loader > summary').click();await card.locator('.guidance-excerpt-loader > summary').click();
    await card.getByText('关键条款当前未获准展示、已撤回或提取版本变化；不从示例补齐正文。',{exact:true}).waitFor();assert.equal(await card.locator('.guidance-clauses').count(),0);
    await shot(cp,'contract-only-closed-excerpt');await c.close();checks.push('UI-only: failed read clears/retries to real API, pending-review response removes excerpt');
    assert.deepEqual(errors,[]);assert.ok(network.every(n=>n.status===200));
    writeFileSync(out+'result.json',JSON.stringify({checks,errors,warnings,network,metrics},null,2));
  }
  console.log(JSON.stringify({action,evidence:out,checks:checks.length,decisions:decisions.length,warnings:warnings.length}));
}catch(error){writeFileSync(out+'failure.json',JSON.stringify({message:error.message,stack:error.stack,checks,errors,warnings,network,metrics,decisions},null,2));throw error;}
finally{await zoom?.close().catch(()=>{});await browser.close();}
