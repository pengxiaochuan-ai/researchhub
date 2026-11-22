import test from'node:test';import assert from'node:assert/strict';import{createRuntimeDocExtractor}from'./knowledge-parser.mjs';
function fixture({configured=false,pages=[{num:1,text:'原创合成题名\n正文'}]}={}){const calls=[];class Native{async extract(){calls.push('native');return{extractor:'native'};}}class Parser{async getText(){calls.push('parse');return{pages,total:pages.length};}async destroy(){calls.push('destroy');}}return{calls,extractor:createRuntimeDocExtractor({Native,PDFParse:Parser,resolveMetadata:({contentMd})=>({title:contentMd.split('\n')[0]}),parserConfigured:configured})};}
test('existing local text PDF parser retains actual page locators and always closes its worker',async()=>{const h=fixture(),r=await h.extractor.extract('test.pdf',Buffer.from('synthetic'));assert.match(r.contentMd,/^# 第1页/);assert.match(r.contentMd,/原创合成题名/);assert.equal(r.title,'原创合成题名');assert.equal(r.pageCount,1);assert.equal(r.usedOcr,false);assert.deepEqual(h.calls,['parse','destroy']);});
test('an explicitly configured parser is never bypassed',async()=>{const h=fixture({configured:true});assert.equal((await h.extractor.extract('test.pdf',Buffer.from('x'))).extractor,'native');assert.deepEqual(h.calls,['native']);});
test('empty text does not pretend OCR succeeded, and malformed page positions reject',async()=>{for(const pages of [[{num:1,text:''}],[{num:99,text:'body'}]]){const h=fixture({pages});await assert.rejects(h.extractor.extract('test.pdf',Buffer.from('x')));assert.equal(h.calls.at(-1),'destroy');}});

test('configured PDF parser assembles ranges in original order and preserves warnings', async (t) => {
  const ranges = [
    {startPage:1,endPage:2,pageCount:3,contentMd:'## 第 1 页\n\n正文\n\n## 第 2 页',title:'原始题名',warnings:['第 2 页无可用文字']},
    {startPage:3,endPage:3,pageCount:3,contentMd:'## 第 3 页\n\n末页正文',usedOcr:true},
  ];
  const requested = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requested.push(Number(new URL(url).searchParams.get('start')));
    assert.equal(options.body.get('file').name,'document.pdf');
    return Response.json(ranges.shift());
  });
  const extractor = createRuntimeDocExtractor({
    Native:class {},parserUrl:'http://parser:8200',resolveMetadata:({preferredTitle})=>({title:preferredTitle}),
  });
  const result = await extractor.extract('original.pdf',Buffer.from('fixture'));
  assert.deepEqual(requested,[1,3]);
  assert.equal(result.title,'原始题名');
  assert.equal(result.pageCount,3);
  assert.equal(result.usedOcr,true);
  assert.match(result.contentMd,/第 2 页\n\n## 第 3 页/);
  assert.deepEqual(result.warnings,['第 2 页无可用文字']);
});

test('configured PDF parser rejects a missing range or textless document', async (t) => {
  let endPage=0;
  t.mock.method(globalThis,'fetch',async()=>Response.json({
    startPage:1,endPage,pageCount:1,contentMd:'## 第 1 页',
  }));
  const extractor=createRuntimeDocExtractor({Native:class {},parserUrl:'http://parser:8200',resolveMetadata:()=>({})});
  await assert.rejects(extractor.extract('file.pdf',Buffer.from('fixture')), /页码不一致/);
  endPage=1;
  await assert.rejects(extractor.extract('file.pdf',Buffer.from('fixture')), /未提取到可用文本/);
});
