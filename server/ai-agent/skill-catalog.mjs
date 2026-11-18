import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const pubmedTools = [
  'pubmed_convert_ids', 'pubmed_europepmc_fetch', 'pubmed_europepmc_search',
  'pubmed_fetch_articles', 'pubmed_fetch_fulltext', 'pubmed_find_related',
  'pubmed_format_citations', 'pubmed_lookup_citation', 'pubmed_lookup_mesh',
  'pubmed_search_articles', 'pubmed_spell_check',
];
const definition = (key, name, positive, negative, requiredTools, adaptation) => ({
  key, name, taskExamples: { positive, negative }, requiredTools, adaptation,
});

// A reviewed inventory, not an assignment or executable tool registration.
export const SKILL_DEFINITIONS = [
  definition('doubao-medical-literature-search', '医学文献检索',
    ['查找针灸辅助治疗抑郁的随机试验', '比较某主题的研究证据'],
    ['翻译这篇摘要', '患者现在应如何治疗'],
    ['hub_source_search', 'pubmed_search_articles', 'pubmed_fetch_articles'],
    ['replace-legacy-search-tools', 'hub-chat-and-draft-delivery']),
  definition('doubao-medical-literature-interpretation', '医学文献解读',
    ['这篇文章的随机方法可靠吗', '比较我选择的三篇论文'],
    ['寻找其他相关文章', '只翻译原文不要解释'],
    ['hub_article_evidence'], ['no-forced-whiteboards', 'closed-source-boundary']),
  definition('doubao-medical-literature-translation', '医学文献翻译',
    ['翻译这段摘要', '全文翻译包括表格和图注'],
    ['概括这篇文章的结论', '按目标期刊重写论证'],
    ['hub_article_evidence'], ['persistent-long-text', 'coverage-ledger', 'no-feishu-default']),
  definition('doubao-medical-protocol-design', '医学科研助手',
    ['根据这些证据完善当前PICO和研究方案', '审阅这篇稿件的方法部分'],
    ['仅列出相关论文', '给患者调整药物'],
    ['hub_source_search', 'research_draft'], ['load-references-by-task', 'no-external-export-default']),
  definition('pubmed-medical-literature', 'PubMed文献工具',
    ['用PubMed查找研究', '根据DOI核对PMID与题录'],
    ['把私有病例上传PubMed', '直接发布检索结果到公共Hub'],
    pubmedTools, ['live-mcp-required', 'public-query-only']),
  definition('doubao-medical-literature-monitoring', '医学进展跟踪',
    ['查最近的研究进展', '订阅每两周的针灸抑郁研究进展'],
    ['只翻译当前文章', '未确认就创建周期推送'],
    ['pubmed_search_articles', 'pubmed_fetch_articles', 'hub_subscription'],
    ['durable-scheduler', 'explicit-subscription', 'no-feishu-default']),
  definition('doubao-clinical-decision-support', '专业临床辅助决策',
    ['比较这个虚构病例的治疗证据和适用条件', '为专业病例讨论核对指南依据'],
    ['单纯查找论文清单', '家属只想通俗理解健康问题'],
    ['hub_source_search', 'pubmed_search_articles'], ['professional-context', 'verified-guidelines-needed']),
  definition('doubao-medical-report', '医学检查报告解读',
    ['解释这份合成检验报告的异常指标', '比较两次检查的可靠指标变化'],
    ['生成本研究的统计分析报告', '解读一篇随机试验论文'],
    ['authorized_document_read', 'deterministic_calculation'],
    ['evidence-first', 'no-feishu-default', 'no-automatic-image-generation']),
  definition('doubao-answer-with-medical-evidence', '患者及家属循证咨询',
    ['作为家属如何理解这个健康问题', '我想通俗了解失眠的相关证据'],
    ['专业医生要求病例治疗决策', '设计一项临床试验'],
    ['hub_source_search', 'pubmed_search_articles'], ['audience-by-task', 'no-patient-portal-grant']),
];

const hash = value => createHash('sha256').update(value).digest('hex');
const rootPath = value => resolve(value instanceof URL ? fileURLToPath(value) : value);

async function resourcesAt(directory, prefix = '') {
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('SKILL_SOURCE_SYMLINK');
  const resources = [];
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name), item = await lstat(path);
    if (item.isSymbolicLink()) throw new Error('SKILL_SOURCE_SYMLINK');
    if (item.isDirectory()) resources.push(...await resourcesAt(path, prefix + name + '/'));
    else if (item.isFile()) {
      if (item.size > 8 * 1024 * 1024) throw new Error('SKILL_RESOURCE_TOO_LARGE');
      const bytes = await readFile(path);
      resources.push({ path: prefix + name, bytes: bytes.length, sha256: hash(bytes) });
    } else throw new Error('SKILL_SOURCE_FILE_TYPE');
  }
  return resources;
}

export async function loadSkillCatalog(root, definitions = SKILL_DEFINITIONS) {
  const hubRoot = rootPath(root), skills = [];
  const sourceRoot = join(hubRoot, 'skill');
  if ((await lstat(sourceRoot)).isSymbolicLink()) throw new Error('SKILL_SOURCE_SYMLINK');
  for (const entry of definitions) {
    if (!/^[a-z][a-z0-9-]+$/.test(entry.key)) throw new Error('SKILL_KEY_INVALID');
    const directory = join(sourceRoot, entry.key);
    const resources = await resourcesAt(directory);
    const instruction = await readFile(join(directory, 'SKILL.md'), 'utf8');
    const frontmatter = instruction.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    if (frontmatter?.match(/^name:\s*["']?([a-z0-9-]+)["']?\s*$/m)?.[1] !== entry.key) {
      throw new Error('SKILL_SOURCE_IDENTITY');
    }
    skills.push({ ...entry, sourcePath: relative(hubRoot, directory),
      snapshotHash: hash(JSON.stringify({ entry, resources })), resources,
      runtimeState: 'not-equipped',
      rights: { status: 'unverified', evidence: resources.filter(r => /(?:^|\/)(?:LICENSE|COPYING)(?:\.|$)/i.test(r.path)).map(r => r.path) },
      legacyDependencies: [...new Set(instruction.match(/\b(?:lark-doc|lark-ppt|seed_medical_search|scholar_search|general_search|MedicalSearch|calculator|image_generation|operate_saved_memory)\b/g) ?? [])].sort(),
    });
  }
  return { schema: 'hub-skill-source-catalog.v1', skills };
}

export async function verifySkillSnapshot(root, snapshot) {
  const definition = SKILL_DEFINITIONS.find(s => s.key === snapshot.key);
  if (!definition) return false;
  const { skills: [current] } = await loadSkillCatalog(root, [definition]);
  return current.snapshotHash === snapshot.snapshotHash;
}
