import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifiedInitialFiles } from './initial-five.mjs';
import { extractRegistryDetails, registryDetailHash, validateRegistryDetails } from './registry-detail-contract.mjs';

for (const source of verifiedInitialFiles().filter(item => item.documentType === 'clinical_registry')) {
  test(`${source.externalKey}: optional registration selection keeps exact dates, lead unit and registration status separate from research progress`,()=>{
    const value=extractRegistryDetails(source.bytes,source,{includeRegistration:true});
    assert.equal(value.schemaVersion,2);
    const [date,unit,status]=value.registration;
    assert.deepEqual(value.registration.map(x=>x.key),['registeredOn','leadInstitution','registrationStatus']);
    assert.equal(date.value,source.externalKey==='ChiCTR2300073486'?'2023-07-12':'2023-11-01');
    assert.equal(unit.value,'中国中医科学院针灸研究所');assert.equal(status.value,'预注册');
    assert.deepEqual([date.source.tableIndex,date.source.rowIndex,date.source.cellIndex,date.source.line,date.source.column],[1,3,2,113,33]);
    assert.deepEqual([unit.source.tableIndex,unit.source.rowIndex,unit.source.cellIndex,unit.source.line],[4,1,2,538]);
    assert.deepEqual([status.source.tableIndex,status.source.rowIndex,status.source.cellIndex,status.source.line],[1,4,2,119]);
    assert.equal(status.source.quote,'预注册');assert(!Object.hasOwn(value,'researchStatus'));
    const legacy=extractRegistryDetails(source.bytes,source);
    assert.equal(legacy.schemaVersion,1);assert(!Object.hasOwn(legacy,'registration'));
    const {registration,...base}=value;assert.deepEqual({...base,schemaVersion:1},legacy);
    const bad=structuredClone(value);bad.registration[0].value='2023-02-30';bad.registration[0].source.quote=bad.registration[0].value;
    assert.throws(()=>validateRegistryDetails(bad,source),/REGISTRY_EXTRACTION_REJECTED/);
    const leak=structuredClone(value);leak.registration.push({...status,key:'recruitmentStatus'});
    assert.throws(()=>validateRegistryDetails(leak,source),/REGISTRY_EXTRACTION_REJECTED/);
  });
  test(`${source.externalKey}: extracts literal design, groups, distinct outcomes and traceable empty cells`, () => {
    const value = extractRegistryDetails(source.bytes, source);
    const first = source.externalKey === 'ChiCTR2300073486';
    assert.equal(value.arms.length, first ? 4 : 2);
    assert.equal(value.outcomes.length, first ? 9 : 11);
    assert.deepEqual(value.arms.map(arm => arm.sampleSize.value), Array(first ? 4 : 2).fill(first ? '112' : '64'));
    assert.equal(value.design.find(field => field.key === 'design').value, '随机平行对照');
    assert.equal(value.design.find(field => field.key === 'protocol').status, 'not_reported');
    assert.equal(value.outcomes[0].name.value, first ? '17项汉密尔顿抑郁量表' : '蒙特利尔认知评估量表');
    assert.equal(value.outcomes[0].type.value, '主要指标');
    assert.ok(value.outcomes.every(item => item.timepoint.value === '' && item.method.value === '' &&
      item.timepoint.status === 'not_reported' && item.timepoint.source.cellIndex === 2 && item.method.source.cellIndex === 4));
    if (first) {
      assert.equal(value.outcomes.filter(item => item.name.value === '17项汉密尔顿抑郁量表').length, 2);
      assert.equal(value.outcomes[1].englishName.value, 'response rate/remission rate');
    }
    assert.deepEqual(value.design.find(field => field.key === 'design').source,
      { tableIndex: 4, rowIndex: 16, cellIndex: 2, line: 777, column: 33, sourceLabel: '研究设计：', quote: '随机平行对照' });
    assert.equal(value.outcomes[0].name.source.tableIndex, first ? 19 : 15);
    assert.equal(value.outcomes[0].englishName.source.rowIndex, 2);
    assert.equal(registryDetailHash(value), registryDetailHash(Object.fromEntries(Object.entries(value).reverse())));
    assert.equal(registryDetailHash(value), registryDetailHash(extractRegistryDetails(source.bytes, source)));
    const changed = structuredClone(value);
    changed.outcomes[0].name.source.quote = 'made-up';
    assert.throws(() => validateRegistryDetails(changed, source), /REGISTRY_EXTRACTION_REJECTED/);
    const leaked = structuredClone(value); leaked.privateContact = 'must not leak';
    assert.throws(() => validateRegistryDetails(leaked, source), /REGISTRY_EXTRACTION_REJECTED/);
    const badPosition = structuredClone(value); badPosition.design[0].source.line = 0;
    assert.throws(() => validateRegistryDetails(badPosition, source), /REGISTRY_EXTRACTION_REJECTED/);
    assert.throws(() => extractRegistryDetails(Buffer.concat([source.bytes, Buffer.from('drift')]), source), /REGISTRY_SOURCE_HASH_MISMATCH/);
  });
}

test('offline MIME parser rejects changed origin, ambiguous labels, missing registration and invalid UTF-8 without loading resources', () => {
  const row = (a, b, c, d) => `<tr><td>${a}：</td><td>${b}</td>${c ? `<td>${c}：</td><td>${d}</td>` : ''}</tr>`;
  const html = `<table>${row('注册号', 'SYN-ONLY-001')}${['研究类型', '研究所处阶段', '研究设计', '研究目的', '随机方法', '盲法', '药物成份或治疗方案详述'].map(label => row(label, label === '研究目的' ? '<script>forbiddenSecret</script>合成原文' : '')).join('')}</table>` +
    `<table>${row('组别', '合成组', '样本量', '原字符串')}${row('干预措施', '<img src="https://example.invalid/never-load">合成措施')}</table>` +
    `<table>${row('指标中文名', '合成结局', '指标类型', '主要指标')}${row('Outcome', 'Synthetic')}${row('测量时间点', '', '测量方法', '')}</table>`;
  const sourceUrl = 'https://example.invalid/synthetic-registry';
  const bytesFor = (body, location = sourceUrl) => Buffer.from(`MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="synthetic"\r\nSnapshot-Content-Location: ${location}\r\nDate: Fri, 30 Oct 2026 08:16:32 GMT\r\n\r\n--synthetic\r\nContent-Type: text/html\r\nContent-Transfer-Encoding: 8bit\r\nContent-Location: ${sourceUrl}\r\n\r\n${body}\r\n--synthetic--\r\n`, 'utf8');
  const parse = bytes => extractRegistryDetails(bytes, { sourceUrl, externalKey: 'SYN-ONLY-001',
    expectedSha256: createHash('sha256').update(bytes).digest('hex') });
  const result = parse(bytesFor(html));
  assert.equal(result.design.find(value => value.key === 'objective').value, '合成原文');
  assert.equal(result.arms[0].intervention.value, '合成措施');
  assert.throws(() => parse(bytesFor(html, 'https://example.invalid/wrong')), /REGISTRY_MIME_SOURCE_REJECTED/);
  assert.throws(() => parse(bytesFor(html.replace('SYN-ONLY-001', 'other'))), /REGISTRY_ID_MISMATCH/);
  assert.throws(() => parse(bytesFor(html.replace('</table>', row('研究设计', '重复') + '</table>'))), /REGISTRY_LABEL_AMBIGUOUS_OR_MISSING/);
  assert.throws(() => parse(bytesFor(html.replace('研究目的：', '缺失标签：'))), /REGISTRY_LABEL_AMBIGUOUS_OR_MISSING/);
  const invalid = Buffer.concat([bytesFor(html).subarray(0, -20), Buffer.from([0xff]), bytesFor(html).subarray(-20)]);
  assert.throws(() => parse(invalid), /REGISTRY_PARSE_FAILED/);
});
