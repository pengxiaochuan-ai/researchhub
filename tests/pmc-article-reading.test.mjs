import test,{after} from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';
import {parsePmcReading} from '../server/hub-sources/pmc-reading.mjs';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});after(()=>server.close());
const {default:Reading,PmcReadingTable,readingBacklinks}=await server.ssrLoadModule('/pages/shared/PmcArticleReading.jsx');
const source='<article><front><article-meta><article-id pub-id-type="pmcid">PMC123</article-id></article-meta></front><body><sec id="S1"><title>Original &lt;title&gt;</title><p>Exact 0.03 <xref rid="R1">1</xref>. <bold><inline-formula><math><mfrac><mn>1</mn><mn>2</mn></mfrac></math></inline-formula></bold></p><table-wrap id="T1"><label>Table 1</label><table><thead><tr><th>Value</th></tr></thead><tbody><tr><td>10<sup>−3</sup></td></tr></tbody></table></table-wrap></sec></body><back><ref-list><ref id="R1"><label>1</label><mixed-citation>Source &lt;script&gt;</mixed-citation></ref></ref-list></back></article>';
const article=parsePmcReading(source,'PMC123');
test('real reading JSX renders original headings, real citation anchors, safe text and native scientific math',()=>{
  const html=renderToStaticMarkup(React.createElement(Reading,{article,versionId:'v123'}));
  assert.match(html,/aria-label="文章目录"/);assert.match(html,/<h4>Original &lt;title&gt;<\/h4>/);assert.match(html,/href="#pmc-v123-part-/);
  assert.match(html,/Exact 0.03/);assert.match(html,/<strong><math><mfrac><mn>1<\/mn><mn>2<\/mn><\/mfrac><\/math><\/strong>/);
  assert.ok(!html.includes('<script>'));assert.match(html,/Source &lt;script&gt;/);
});
test('real table JSX has caption, original column header and superscript; return target points into the same article',()=>{
  const html=renderToStaticMarkup(React.createElement(PmcReadingTable,{table:article.tables[0],versionId:'v123',returnId:readingBacklinks(article).T1}));
  assert.match(html,/<caption>Table 1/);assert.match(html,/<th scope="col"/);assert.match(html,/10<sup>−3<\/sup>/);assert.match(html,/返回正文引用位置/);
});
test('citations inside superscript or bold are still clickable and preserve same-article return locations',()=>{
  const r=parsePmcReading(source.replace('<xref rid="R1">1</xref>','<sup><xref rid="R1">1</xref></sup>'),'PMC123');
  const html=renderToStaticMarkup(React.createElement(Reading,{article:r,versionId:'v123'}));
  assert.match(html,/<sup><a href="#pmc-v123-part-[^"]+">1<\/a><\/sup>/);assert.ok(readingBacklinks(r).R1);
});
