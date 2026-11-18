import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// User-supplied, hash-pinned pilot files. Selection for internal development is
// not a rights grant or a named Hub administrator review decision.
export const initialFive = Object.freeze([
  {
    fileName: '200293.mhtml', expectedSha256: 'da7543e86b589dff40234b47441639d3332231c386e3db4855c4ae62de05d8c4',
    mimeType: 'multipart/related', sourceKey: 'chictr', sourceName: '中国临床试验注册中心',
    sourceRegistryUrl: 'https://www.chictr.org.cn',
    documentType: 'clinical_registry', externalKey: 'ChiCTR2300073486',
    title: '经皮耳迷走神经电刺激和艾司西酞普兰治疗抑郁症:一项双盲、析因设计、随机、对照临床试验',
    sourceTargetCondition: '抑郁症', hubTopic: '情志病相关', selectionStatus: 'accepted_for_initial_dataset',
    sourceUrl: 'https://www.chictr.org.cn/showproj.html?proj=200293',
    sourceUpdatedOn: '2023-09-10',
    metadata: { registrationNumber: 'ChiCTR2300073486', registeredOn: '2023-07-12',
      sourceLastRefreshedOn: '2023-09-10', originalTargetDisease: '抑郁症',
      snapshotCapturedAt: '2026-10-30T08:16:32Z' },
  },
  {
    fileName: '202558.mhtml', expectedSha256: '91d7745dd42f31832dd074cd7c2b243f8ab95562207e565eb932437cd7387b8d',
    mimeType: 'multipart/related', sourceKey: 'chictr', sourceName: '中国临床试验注册中心',
    sourceRegistryUrl: 'https://www.chictr.org.cn',
    documentType: 'clinical_registry', externalKey: 'ChiCTR2300077209',
    title: '外耳-宗脉电针治疗轻度认知障碍的随机、双盲对照、多中心临床研究',
    sourceTargetCondition: '轻度认知障碍', hubTopic: '情志病相关', selectionStatus: 'accepted_for_initial_dataset',
    sourceUrl: 'https://www.chictr.org.cn/showproj.html?proj=202558',
    sourceUpdatedOn: '2024-05-14',
    metadata: { registrationNumber: 'ChiCTR2300077209', registeredOn: '2023-11-01',
      sourceLastRefreshedOn: '2024-05-14', originalTargetDisease: '轻度认知障碍',
      snapshotCapturedAt: '2026-10-30T08:18:09Z', inclusionBasis: 'user-confirmed-2026-10-30' },
  },
  {
    fileName: '202307101606411075.pdf', expectedSha256: 'b9502dabb58c2b5113e4927592a13858a0310c332babad75d26b2b769cd654f2',
    mimeType: 'application/pdf', sourceKey: 'caam-standards', sourceName: '中国针灸学会团体标准',
    sourceRegistryUrl: null,
    documentType: 'research_standard', externalKey: 'T/CAAM 0010-2020',
    title: '真实世界针灸临床研究中仪器设备使用的记录数据规范',
    sourceTargetCondition: null, hubTopic: '针灸研究方法', selectionStatus: 'accepted_for_initial_dataset',
    sourceUrl: null, sourceUpdatedOn: null,
    metadata: { standardNumber: 'T/CAAM 0010-2020', issuingBody: '中国针灸学会',
      publishedOn: '2020-11-02', effectiveOn: '2020-12-31', pages: 11 },
  },
  {
    fileName: '202307101613006689.pdf', expectedSha256: '56ff2c7725b0771c7c49061940fd92f4265d59ca9f30c9e8210a5a60a8b240c6',
    mimeType: 'application/pdf', sourceKey: 'caam-standards', sourceName: '中国针灸学会团体标准',
    sourceRegistryUrl: null,
    documentType: 'research_standard', externalKey: 'T/CAAM 0012-2020',
    title: '真实世界针灸临床研究信息采集规范',
    sourceTargetCondition: null, hubTopic: '针灸研究方法', selectionStatus: 'accepted_for_initial_dataset',
    sourceUrl: null, sourceUpdatedOn: null,
    metadata: { standardNumber: 'T/CAAM 0012-2020', issuingBody: '中国针灸学会',
      publishedOn: '2020-11-02', effectiveOn: '2020-12-31', pages: 51 },
  },
  {
    fileName: '20230619192229553.pdf', expectedSha256: '5a9c421e74dd4cd493514db48dc5449db6016197afee27aac79ea2a6fce1611e',
    mimeType: 'application/pdf', sourceKey: 'caam-guidelines', sourceName: '中国针灸学会临床实践指南',
    sourceRegistryUrl: null,
    documentType: 'clinical_guideline', externalKey: 'ZJ/T E003-2014',
    title: '循证针灸临床实践指南：抑郁症（修订版）',
    sourceTargetCondition: '抑郁症', hubTopic: '情志病相关', selectionStatus: 'accepted_for_initial_dataset',
    sourceUrl: null, sourceUpdatedOn: null,
    metadata: { guidelineNumber: 'ZJ/T E003-2014', issuingBody: '中国针灸学会',
      publisher: '中国中医药出版社', publishedOn: '2014-05-31', effectiveOn: '2014-12-31',
      isbn: '978-7-5132-2213-6', pages: 61, rightsNotice: '版权专有，侵权必究' },
  },
]);

export const initialDocumentId = (tenantId, hubKey, item) => 'rhed-' + createHash('sha256')
  .update([tenantId, hubKey, item.documentType, item.externalKey].join('\n'))
  .digest('hex').slice(0, 40);
export const isInitialExternalDocument = ({ id, documentType, externalKey }, tenantId, hubKey) =>
  initialFive.some(item => item.documentType === documentType && item.externalKey === externalKey &&
    id === initialDocumentId(tenantId, hubKey, item));
export const initialExternalKeys = initialFive.map(item => item.externalKey);

export function verifiedInitialFiles() {
  return initialFive.map(item => {
    const bytes = readFileSync(new URL(`../../docs/${item.fileName}`, import.meta.url));
    if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) throw new Error('HUB_INITIAL_FILE_SIZE_REJECTED');
    const expectedMagic = item.mimeType === 'application/pdf' ? '%PDF' : 'From: <Saved by Blink>';
    if (!bytes.subarray(0, 64).toString('utf8').startsWith(expectedMagic))
      throw new Error('HUB_INITIAL_FILE_TYPE_REJECTED');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== item.expectedSha256) throw new Error(`HUB_INITIAL_FILE_HASH_MISMATCH:${item.fileName}`);
    return { ...item, bytes, sha256 };
  });
}
