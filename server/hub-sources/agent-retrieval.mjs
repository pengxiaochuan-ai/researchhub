import { withFixtureTransaction } from '../database/transactions.mjs';
import { createHash } from 'node:crypto';
import { retrieveForAi, getCurrentAiHit } from './visible-repository.mjs';
import { retrieveExternalForAi, getCurrentExternalAiHit } from './external-visible.mjs';
import { retrievePmcForAi, getCurrentPmcAiHit } from './pmc-visible.mjs';
import {prepareAgentHubQuery} from './search-projection.mjs';
import {agentQuestionError} from '../../src/agent-question.js';

const snippetHash = text => createHash('sha256').update(text).digest('hex');

// A saved citation is evidence only while the same current field and review
// versions remain authorized. Recheck it before synthesis, publication and read.
export async function assertCurrentAiSources({ db, principal, tenantId, hubKey, sources }) {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > 20 ||
      new Set(sources.map(source => source?.externalDocumentId || source?.pmcRecordId || source?.sourceRecordId)).size !== sources.length)
    throw new Error('HUB_SOURCE_CHANGED');
  for (const source of sources) {
    if (source.pmcRecordId) {
      if (source.sourceRecordId || source.externalDocumentId || !/^pmc-PMC[1-9][0-9]{0,10}$/.test(source.pmcRecordId))
        throw new Error('HUB_SOURCE_CHANGED');
      const current = await getCurrentPmcAiHit({ db, principal, tenantId, hubKey,
        recordId: source.pmcRecordId });
      const snippet = source.snippetField === 'abstract' ? current?.abstract
        : source.snippetField === 'body' ? current?.body
        : source.snippetField === 'table' ? JSON.stringify(current?.tables || [])
        : current?.title;
      if (!current || !snippet || !['title','abstract','body','table'].includes(source.snippetField) ||
          !Number.isSafeInteger(source.snippetOffset) ||
          source.snippetOffset < 0 || source.snippetOffset > String(snippet).length ||
          current.rawSha256 !== source.rawSha256 ||
          current.articleVersion !== source.articleVersion ||
          current.reviewVersion !== source.reviewVersion ||
          current.aiReviewVersion !== source.aiReviewVersion ||
          current.abstractDisplayVersion !== source.abstractDisplayVersion ||
          current.abstractAiReviewVersion !== source.abstractAiReviewVersion ||
          current.bodyDisplayVersion !== source.bodyDisplayVersion ||
          current.bodyAiReviewVersion !== source.bodyAiReviewVersion ||
          current.tableDisplayVersion !== source.tableDisplayVersion ||
          current.tableAiReviewVersion !== source.tableAiReviewVersion ||
          current.title !== source.title || current.doi !== source.doi ||
          current.sourceUrl !== source.sourceUrl ||
          snippetHash(String(snippet).replace(/\s+/g, ' ').slice(source.snippetOffset, source.snippetOffset + 1200)) !== source.snippetHash)
        throw new Error('HUB_SOURCE_CHANGED');
      continue;
    }
    if (source.externalDocumentId) {
      if (source.sourceRecordId || !/^rhed-[a-f0-9]{40}$/.test(source.externalDocumentId))
        throw new Error('HUB_SOURCE_CHANGED');
      const current = await getCurrentExternalAiHit({ db, principal, tenantId, hubKey,
        documentId: source.externalDocumentId });
      if (!current || current.versionId !== source.versionId ||
          current.versionNumber !== source.versionNumber ||
          current.contentSha256 !== source.contentSha256 ||
          current.reviewVersion !== source.reviewVersion ||
          current.aiReviewVersion !== source.aiReviewVersion ||
          current.snippetField !== source.snippetField ||
          ['documentType', 'externalKey', 'title', 'sourceTargetCondition', 'hubTopic',
            'sourceName', 'sourceUrl'].some(field => current[field] !== source[field]) ||
          snippetHash(current.snippet) !== source.snippetHash)
        throw new Error('HUB_SOURCE_CHANGED');
      continue;
    }
    const current = await getCurrentAiHit({ db, principal, tenantId, hubKey,
      recordId: source.sourceRecordId });
    if (!current || current.rowSha256 !== source.rowSha256 ||
        current.canonicalVersion !== source.canonicalVersion ||
        current.reviewVersion !== source.reviewVersion ||
        current.aiReviewVersion !== source.aiReviewVersion ||
        current.abstractDisplayVersion !== source.abstractDisplayVersion ||
        current.abstractAiReviewVersion !== source.abstractAiReviewVersion ||
        current.snippetField !== source.snippetField ||
        ['title', 'doi', 'sourceUrl', 'sourceName', 'fileName', 'sheetName',
          'rowNumber', 'batchId'].some(field => current[field] !== source[field]) ||
        snippetHash(current.snippet) !== source.snippetHash)
      throw new Error('HUB_SOURCE_CHANGED');
  }
}

// Called only inside the already-authorized, elevated final publication
// transaction. Its SET LOCAL context makes the same source projection valid
// at the final commit boundary without changing the old worker transaction.
export async function assertHubPublicationSources(args) {
  if (args.principal?.tenantId !== args.tenantId) throw new Error('HUB_SOURCE_SCOPE_REJECTED');
  if (!Array.isArray(args.sources) || !args.sources.length || args.sources.length > 20 ||
      args.sources.some(source => source?.pmcRecordId
        ? !/^pmc-PMC[1-9][0-9]{0,10}$/.test(source.pmcRecordId) ||
          source.sourceRecordId || source.externalDocumentId
        : source?.externalDocumentId
          ? !/^rhed-[a-f0-9]{40}$/.test(source.externalDocumentId) || source.sourceRecordId
          : !/^rhsr-[a-f0-9]{40}$/.test(source?.sourceRecordId ?? '')))
    throw new Error('HUB_SOURCE_CHANGED');
  await args.db.$executeRaw`SELECT set_config('app.tenant_id', ${args.tenantId}, true)`;
  // Review appends hold FOR UPDATE on this source row. A shared lock here
  // serializes revocation with the assistant INSERT and final transaction COMMIT.
  for (const sourceRecordId of [...new Set(args.sources.map(s => s.sourceRecordId).filter(Boolean))].sort()) {
    const locked = await args.db.$queryRaw`
      SELECT s.id FROM rh_source.source_registry s
      JOIN rh_source.source_record r ON r.source_registry_id = s.id
      WHERE r.id = ${sourceRecordId} AND r.tenant_id = ${args.tenantId}
        AND r.hub_key = ${args.hubKey} AND s.tenant_id = ${args.tenantId}
        AND s.hub_key = ${args.hubKey} FOR SHARE OF s`;
    if (locked.length !== 1) throw new Error('HUB_SOURCE_CHANGED');
  }
  // External review append and version import use this exact document lock.
  // Hold it through assistant publication, so a concurrent revoke cannot land
  // between the final current-decision check and COMMIT.
  for (const documentId of [...new Set(args.sources.map(s => s.externalDocumentId).filter(Boolean))].sort()) {
    await args.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(
      ${args.tenantId + ':' + args.hubKey + ':' + documentId}, 0))`;
  }
  for (const pmcRecordId of [...new Set(args.sources.map(s => s.pmcRecordId).filter(Boolean))].sort()) {
    const rows = await args.db.$queryRaw`
      SELECT c.id AS "candidateId", v.id AS "versionId"
      FROM rh_source.pmc_candidate c
      JOIN LATERAL (SELECT id FROM rh_source.pmc_candidate_version v
        WHERE v.candidate_id=c.id AND v.tenant_id=c.tenant_id AND v.hub_key=c.hub_key
        ORDER BY v.staged_at DESC, v.id DESC LIMIT 1) v ON true
      WHERE c.tenant_id=${args.tenantId} AND c.hub_key=${args.hubKey}
        AND c.pmcid=${pmcRecordId.slice(4)} FOR UPDATE OF c`;
    if (rows.length !== 1) throw new Error('HUB_SOURCE_CHANGED');
    await args.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(
      ${args.tenantId + ':' + args.hubKey + ':' + rows[0].versionId}, 0))`;
  }
  await assertCurrentAiSources(args);
}

// Same read-only {result,mutated,meta} contract as the existing KbTools service.
// It deliberately does not invoke a model or accept user-supplied tenant/Hub.
export async function runHubSourceSearch({ db, principal, tenantId, hubKey, query, limit = 6, compiledPlan }) {
  if (agentQuestionError(query)) throw new Error('HUB_SOURCE_SCOPE_REJECTED');
  const queryPlan=compiledPlan??prepareAgentHubQuery(query);
  const args={db,principal,tenantId,hubKey,query,queryPlan,limit};
  const hits=await retrieveForAi(args),external=await retrieveExternalForAi(args),pmc=await retrievePmcForAi(args);
  const selected = [...pmc.map(hit => ({ kind: 'pmc', hit })),
    ...hits.map(hit => ({ kind: 'publication', hit })),
    ...external.map(hit => ({ kind: 'external', hit }))].sort((a,b)=>(a.hit.searchRank??0)-(b.hit.searchRank??0)).slice(0, Math.min(20, limit));
  const sources = selected.map(({ kind, hit }, index) => kind === 'pmc' ? ({
    index: index + 1, pmcRecordId: hit.id, rawSha256: hit.rawSha256,
    articleVersion: hit.articleVersion, reviewVersion: hit.reviewVersion,
    aiReviewVersion: hit.aiReviewVersion,
    abstractDisplayVersion: hit.abstractDisplayVersion,
    abstractAiReviewVersion: hit.abstractAiReviewVersion,
    bodyDisplayVersion: hit.bodyDisplayVersion, bodyAiReviewVersion: hit.bodyAiReviewVersion,
    tableDisplayVersion: hit.tableDisplayVersion, tableAiReviewVersion: hit.tableAiReviewVersion,
    snippetField: hit.snippetField, snippetOffset: hit.snippetOffset,
    snippetHash: snippetHash(hit.snippet),
    title: hit.title, doi: hit.doi, sourceUrl: hit.sourceUrl, sourceName: hit.sourceName,
  }) : kind === 'external' ? ({
    index: index + 1, externalDocumentId: hit.documentId,
    versionId: hit.versionId, versionNumber: hit.versionNumber,
    contentSha256: hit.contentSha256, reviewVersion: hit.reviewVersion,
    aiReviewVersion: hit.aiReviewVersion, snippetField: hit.snippetField,
    snippetHash: snippetHash(hit.snippet), documentType: hit.documentType,
    externalKey: hit.externalKey, title: hit.title,
    sourceTargetCondition: hit.sourceTargetCondition, hubTopic: hit.hubTopic,
    sourceUrl: hit.sourceUrl, sourceName: hit.sourceName,
  }) : ({
    index: index + 1, sourceRecordId: hit.sourceRecordId, rowSha256: hit.rowSha256,
    canonicalVersion: hit.canonicalVersion, reviewVersion: hit.reviewVersion,
    aiReviewVersion: hit.aiReviewVersion, snippetField: hit.snippetField,
    abstractDisplayVersion: hit.abstractDisplayVersion,
    abstractAiReviewVersion: hit.abstractAiReviewVersion,
    snippetHash: snippetHash(hit.snippet),
    rowNumber: hit.rowNumber, batchId: hit.batchId, fileName: hit.fileName,
    sheetName: hit.sheetName, title: hit.title, doi: hit.doi,
    sourceUrl: hit.sourceUrl, sourceName: hit.sourceName,
  }));
  const result = selected.length ? selected.map(({ kind, hit }, index) => kind === 'pmc'
    ? `[${index + 1}] 《${hit.title}》｜pmcRecordId=${hit.id}` +
      `｜字段=${hit.snippetField}｜文章版本=${hit.articleVersion}｜原文SHA256=${hit.rawSha256}` +
      `｜来源=PubMed Central：${hit.snippet}`
    : kind === 'external'
    ? `[${index + 1}] 《${hit.title}》｜externalDocumentId=${hit.documentId}` +
      `｜类型=${hit.documentType}｜字段=书目元数据｜版本SHA256=${hit.contentSha256}` +
      `｜来源=${hit.sourceName}：${hit.snippet}`
    : `[${index + 1}] 《${hit.title}》｜sourceRecordId=${hit.sourceRecordId}` +
    `｜字段=${hit.snippetField}｜行SHA256=${hit.rowSha256}` +
    `｜来源=${hit.sourceName}${hit.doi ? `｜DOI=${hit.doi}` : ''}` +
    `：${String(hit.snippet).replace(/\s+/g, ' ').slice(0, 1200)}`
  ).join('\n') : '（当前没有已获准且允许 AI 检索的来源；未调用模型。）';
  if (sources.length) await assertCurrentAiSources({ db, principal, tenantId, hubKey, sources });
  return { result, mutated: false, meta: {
    toolName: 'hub_source_search', actualRetrieval: 'ResearchHub-current-reviewed-PG',
    at: new Date().toISOString(), sources,queryPlan,sourceTexts:selected.map(({hit})=>hit.snippet),
  } };
}

export function createHubSourceAgentController({ env, ids, require }) {
  const { Controller, Get, Req, Query, ForbiddenException, BadRequestException } = require('@nestjs/common');
  class HubSourceAgentController {
    async search(req, query) {
      try {
        return await withFixtureTransaction(env, 'app', async db => {
          await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
          return runHubSourceSearch({ db, principal: req.user,
            tenantId: ids.tenant, hubKey: 'lingshu-xinyu', query });
        });
      } catch (error) {
        if(error?.status===400)throw new BadRequestException({code:error.code,message:error.message});
        if (error?.message === 'HUB_SOURCE_SCOPE_REJECTED')
          throw new ForbiddenException({ code: error.message, message: '当前账号或查询不允许检索此 Hub 来源' });
        if (error?.message?.startsWith('HUB_SOURCE_'))
          throw new BadRequestException({ code: error.message, message: '来源检索参数无效' });
        throw error;
      }
    }
  }
  Controller('hub-sources')(HubSourceAgentController);
  Get('agent-retrieval')(HubSourceAgentController.prototype, 'search', Object.getOwnPropertyDescriptor(HubSourceAgentController.prototype, 'search'));
  Req()(HubSourceAgentController.prototype, 'search', 0);
  Query('query')(HubSourceAgentController.prototype, 'search', 1);
  return HubSourceAgentController;
}
