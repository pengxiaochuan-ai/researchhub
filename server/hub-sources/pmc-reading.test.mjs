import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePmcReading} from './pmc-reading.mjs';

const xml=`<article><front><article-meta><article-id pub-id-type="pmcid">PMC123</article-id></article-meta></front>
<body><sec id="intro"><title>1. Introduction</title><p>First <bold>exact</bold> paragraph, 0.03 &#177; 0.01.</p>
<sec id="methods"><title>1.1. Methods</title><p>See <xref rid="F1" ref-type="fig">Figure 1</xref> and <xref rid="R1 R2" ref-type="bibr">1,2</xref>.</p>
<fig id="F1"><label>Figure 1</label><caption><p>Original caption</p></caption><graphic xlink:href="figure.webp"/></fig>
<table-wrap id="T1"><label>Table 1</label><caption><p>Original table</p></caption><table><thead><tr><th>Group</th><th>Value</th></tr></thead><tbody><tr><td rowspan="2">A</td><td>1.20</td></tr><tr><td>0.03</td></tr></tbody></table></table-wrap>
<list list-type="order"><list-item><p>Original item</p></list-item></list></sec></sec></body>
<back><ref-list><ref id="R1"><label>1</label><mixed-citation>Exact citation <pub-id pub-id-type="doi">10.1000/example</pub-id></mixed-citation></ref><ref id="R2"><label>2</label><mixed-citation>Another citation</mixed-citation></ref></ref-list></back></article>`;

test('JATS preserves nested sections, paragraph boundaries, exact values and citation targets',()=>{
  const r=parsePmcReading(xml,'PMC123');
  assert.equal(r.blocks[0].type,'section');assert.equal(r.blocks[0].title,'1. Introduction');
  assert.equal(r.blocks[0].children[0].content.map(x=>x.text).join(''),'First exact paragraph, 0.03 ± 0.01.');
  const sec=r.blocks[0].children[1];assert.equal(sec.title,'1.1. Methods');
  const citations=sec.children[0].content.filter(x=>x.type==='xref');
  assert.deepEqual(citations[1].rids,['R1','R2']);assert.ok(r.targets.F1);assert.ok(r.targets.R2);
  assert.equal(r.references[0].url,'https://doi.org/10.1000/example');
  assert.ok(r.references[1].text.includes('Another citation'));
});

test('tables retain actual header/cell type, span and original text; figures retain source identity',()=>{
  const r=parsePmcReading(xml,'PMC123'),table=r.tables[0];
  assert.equal(table.refId,'T1');assert.equal(table.rows[0][0].kind,'th');assert.equal(table.rows[0][0].scope,'col');
  assert.equal(table.rows[1][0].rowSpan,2);assert.equal(table.rows[1][1].text,'1.20');
  assert.equal(r.media[0].refId,'F1');assert.equal(r.media[0].href,'figure.webp');
  assert.equal(r.blocks[0].children[1].children.at(-1).type,'list');
});

test('only safe text/inline nodes and HTTPS reference links escape the untrusted source boundary',()=>{
  const r=parsePmcReading(xml.replace('First <bold>exact</bold>','First <script>alert(1)</script><ext-link xlink:href="javascript:alert(1)">exact</ext-link>'),'PMC123');
  const content=r.blocks[0].children[0].content;
  assert.ok(!JSON.stringify(content).includes('alert(1)'));assert.equal(content.map(x=>x.text).join('').includes('exact'),true);
  assert.throws(()=>parsePmcReading('<!DOCTYPE x [<!ENTITY a "boom">]>'+xml,'PMC123'),/PMC_READING_INVALID/);
  assert.throws(()=>parsePmcReading(xml,'PMC999'),/PMC_READING_INVALID/);
  assert.throws(()=>parsePmcReading('<article><body><p>bad</body>','PMC123'),/PMC_READING_INVALID/);
});

test('missing body is explicit, IDs are deterministic and duplicated IDs cannot silently misdirect a citation',()=>{
  const r=parsePmcReading(xml.replace(/<body>[\s\S]*<\/body>/,''),'PMC123');assert.deepEqual(r.blocks,[]);
  assert.deepEqual(parsePmcReading(xml,'PMC123').targets,parsePmcReading(xml,'PMC123').targets);
  assert.throws(()=>parsePmcReading(xml.replace('id="methods"','id="intro"'),'PMC123'),/PMC_READING_INVALID/);
});

test('scientific fractions retain MathML structure, TeX fallback is explicit and preformatted data is not dropped',()=>{
  const r=parsePmcReading(xml.replace('<p>First <bold>exact</bold> paragraph, 0.03 &#177; 0.01.</p>',
    '<p>Fraction <inline-formula><mml:math><mml:mfrac><mml:mn>1</mml:mn><mml:mn>2</mml:mn></mml:mfrac></mml:math></inline-formula>.</p><preformat>sequence\nAAA\nTTT</preformat><unknown-block>Original direct text</unknown-block><disp-formula><tex-math>x^2</tex-math></disp-formula>'),'PMC123');
  const children=r.blocks[0].children,math=children[0].content.find(x=>x.type==='math');
  assert.equal(math.node.children[0].tag,'mfrac');assert.equal(math.node.children[0].children[0].children[0].text,'1');
  assert.equal(children[1].text,'sequence\nAAA\nTTT');assert.equal(children[2].content[0].text,'Original direct text');
  assert.equal(children[3].content[0].type,'formula-source');assert.equal(children[3].content[0].text,'x^2');
});
test('nested styled formula and table powers retain their scientific structure instead of numeric concatenation',()=>{
  const source=xml.replace('First <bold>exact</bold>','First <bold><inline-formula><math><mfrac><mn>1</mn><mn>2</mn></mfrac></math></inline-formula></bold>')
    .replace('<td>1.20</td>','<td>10<sup>−3</sup></td>');
  const r=parsePmcReading(source,'PMC123'),bold=r.blocks[0].children[0].content.find(x=>x.type==='bold');
  assert.equal(bold.content[0].node.children[0].tag,'mfrac');assert.ok(!bold.text.includes('12'));
  const cell=r.tables[0].rows[1][1];assert.equal(cell.content[1].type,'sup');assert.equal(cell.content[1].text,'−3');assert.equal(cell.text,'10^(−3)');
});
test('structured reference names and identifiers retain readable boundaries rather than being concatenated',()=>{
  const citation='<element-citation><person-group>\n  <name><surname>Doe</surname><given-names>J</given-names></name>\n  <name><surname>Li</surname><given-names>Q</given-names></name>\n</person-group><article-title>Original title</article-title><source>Original journal</source><year>2024</year><pub-id pub-id-type="doi">10.1000/example</pub-id><pub-id pub-id-type="pmcid">PMC456</pub-id></element-citation>';
  const r=parsePmcReading(xml.replace('<mixed-citation>Exact citation <pub-id pub-id-type="doi">10.1000/example</pub-id></mixed-citation>',citation),'PMC123');
  assert.match(r.references[0].text,/Doe J, Li Q/);assert.match(r.references[0].text,/Original title Original journal 2024/);
  assert.match(r.references[0].text,/10\.1000\/example PMC456/);assert.equal(r.references[0].url,'https://doi.org/10.1000/example');
});
