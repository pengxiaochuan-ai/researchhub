import { withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { listReviewBatches, listReviewHistory, listBatchSources, listReviewRows, reviewSource } from './review-service.mjs';
import { listExternalReviewItems } from './external-preview.mjs';
import { submitExternalReview } from './external-review.mjs';
import { listPmcReviewItems, submitPmcReview, submitPmcArticleReview } from './pmc-review-service.mjs';
import { listObjectReviewQueue, getWorkbookReviewDetail, submitObjectReview } from './object-review.mjs';
import {getPmcReviewArticle} from './pmc-reading-service.mjs';
import {submitWithReviewReceipt,readReviewReceipt} from './review-receipt.mjs';

const messages = {
  HUB_SOURCE_REVIEW_AUTH_REQUIRED: '当前账号没有此 Hub 的来源审核授权',
  HUB_SOURCE_EVIDENCE_REQUIRED: '请提供可核验的 HTTPS 用途权利依据链接',
  HUB_SOURCE_COUNT_MISMATCH: '确认数量与当前有效来源记录不一致，请刷新后重试',
  HUB_SOURCE_VERSION_CONFLICT: '审核状态已变化，请刷新后重试',
  HUB_SOURCE_DISPLAY_AI_REVIEW_REQUIRED: '该来源已有AI用途批准，当前内容需要重新核对；本次未修改任何审核决定',
  HUB_SOURCE_ARTICLE_DECISION_REQUIRED: '本篇已采用按篇审核，请使用按篇范围操作；撤回请选择暂不放行',
  HUB_SOURCE_OBJECT_DECISION_REQUIRED: '当前对象已采用一次决定，请在来源审核队列中选择可见范围',
  HUB_SOURCE_SCOPE_REJECTED: '来源或批次不存在于当前 Hub',
  HUB_SOURCE_REVIEW_INPUT_REJECTED: '请逐项确认审核对象、字段和用途',
  HUB_SOURCE_REVOKE_REJECTED: '当前字段与用途没有可撤回的批准决定',
  HUB_SOURCE_PMC_READING_INVALID:'原文完整性或结构校验未通过，不能交付正文，请重新核对原件',
  HUB_SOURCE_PMC_READING_UNAVAILABLE:'本机原文暂不可读取，请重试或核对原件',
};

export function createHubSourceReviewController({ env, ids, require }) {
  const { Controller, Get, Post, Req, Res, Body, Param, Query, ForbiddenException,
    BadRequestException, ConflictException, NotFoundException,ServiceUnavailableException } = require('@nestjs/common');
  const transact = operation => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    await db.$executeRaw`SELECT set_config('app.research_project_id','',true)`;
    return operation(db);
  });
  const mapError = error => {
    const code = error?.message;
    if (code === 'HUB_SOURCE_REVIEW_AUTH_REQUIRED') throw new ForbiddenException({ code, message: messages[code] });
    if (code === 'HUB_SOURCE_REQUEST_KEY_CONFLICT' || code === 'HUB_SOURCE_VERSION_CONFLICT' || code === 'HUB_SOURCE_ARTICLE_DECISION_REQUIRED' || code === 'HUB_SOURCE_OBJECT_DECISION_REQUIRED' || code === 'HUB_SOURCE_DISPLAY_AI_REVIEW_REQUIRED')
      throw new ConflictException({ code, message: messages[code] });
    if (code === 'HUB_SOURCE_SCOPE_REJECTED' || code === 'HUB_SOURCE_RECEIPT_NOT_FOUND') throw new NotFoundException({ code, message: messages[code]||'尚未找到本次操作结果，请稍后重新核对。' });
    if (['HUB_SOURCE_PMC_READING_INVALID','HUB_SOURCE_PMC_READING_UNAVAILABLE'].includes(code))
      throw new ServiceUnavailableException({code,message:messages[code]});
    if (typeof code === 'string' && code.startsWith('HUB_SOURCE_'))
      throw new BadRequestException({ code, message: messages[code] || '审核请求无效' });
    throw error;
  };
  class HubSourceReviewController {
    async receipt(req,operationId,response){
      response.setHeader('Cache-Control','no-store');
      try{return{receipt:await transact(db=>readReviewReceipt({db,principal:req.user,tenantId:ids.tenant,hubKey:'lingshu-xinyu',reviewerAccountId:ids.admin,operationId}))};}
      catch(error){mapError(error);}
    }
    async pmcArticle(req,versionId,response) {
      response.setHeader('Cache-Control','no-store');
      try{return {article:await transact(db=>getPmcReviewArticle({db,principal:req.user,tenantId:ids.tenant,hubKey:'lingshu-xinyu',reviewerAccountId:ids.admin,versionId}))};}
      catch(error){mapError(error);}
    }
    async queue(req, response) {
      response.setHeader('Cache-Control','no-store');
      try { return { items: await transact(db => listObjectReviewQueue({db, principal:req.user,
        tenantId:ids.tenant,hubKey:'lingshu-xinyu',reviewerAccountId:ids.admin})) }; }
      catch(error) { mapError(error); }
    }
    async workbook(req, query, response) {
      response.setHeader('Cache-Control','no-store');
      try { return await transact(db => getWorkbookReviewDetail({db,principal:req.user,
        tenantId:ids.tenant,hubKey:'lingshu-xinyu',reviewerAccountId:ids.admin,
        batchId:query.batchId,sourceRegistryId:query.sourceRegistryId,sourceRecordId:query.sourceRecordId || null,cursor:query.cursor ?? 0})); }
      catch(error) { mapError(error); }
    }
    async objectSubmit(req, body, response) {
      response.setHeader('Cache-Control','no-store');
      try { return { review: await withFixtureTransaction(env,'direct',async db=>{
        await db.$executeRaw`SELECT set_config('app.tenant_id',${ids.tenant},true)`;
        const args={db,principal:req.user,tenantId:ids.tenant,hubKey:'lingshu-xinyu',reviewerAccountId:ids.admin,input:body,kind:body?.kind};
        return submitWithReviewReceipt(args,()=>submitObjectReview(args));
      }) }; }
      catch(error) { mapError(error); }
    }
    async pmcItems(req, response) {
      response.setHeader('Cache-Control', 'no-store');
      try { return { items: await transact(db => listPmcReviewItems({ db, principal: req.user,
        tenantId: ids.tenant, hubKey: 'lingshu-xinyu', reviewerAccountId: ids.admin })) }; }
      catch (error) { mapError(error); }
    }
    async pmcSubmit(req, body, response) {
      response.setHeader('Cache-Control', 'no-store');
      try { return { review: await transact(db => {
        const args={db,principal:req.user,tenantId:ids.tenant,hubKey:'lingshu-xinyu',reviewerAccountId:ids.admin,input:body,kind:'pmc'};
        return Object.hasOwn(body||{},'visibility')?submitWithReviewReceipt(args,()=>submitPmcArticleReview(args)):submitPmcReview(args);
      }) }; }
      catch (error) { mapError(error); }
    }
    async externalItems(req, response) {
      response.setHeader('Cache-Control', 'no-store');
      try { return { items: await transact(db => listExternalReviewItems({ db, principal: req.user,
        tenantId: ids.tenant, hubKey: 'lingshu-xinyu', reviewerAccountId: ids.admin })) }; }
      catch (error) { mapError(error); }
    }
    async externalSubmit(req, body, response) {
      response.setHeader('Cache-Control', 'no-store');
      try { return { review: await transact(db => submitExternalReview({ db, principal: req.user,
        tenantId: ids.tenant, hubKey: 'lingshu-xinyu', reviewerAccountId: ids.admin, input: body })) }; }
      catch (error) { mapError(error); }
    }
    async batches(req) {
      try { return { batches: await transact(db => listReviewBatches({ db, principal: req.user,
        tenantId: ids.tenant, hubKey: 'lingshu-xinyu' })) }; }
      catch (error) { mapError(error); }
    }
    async history(req, sourceRegistryId, batchId) {
      try { return { history: await transact(db => listReviewHistory({ db, principal: req.user,
        tenantId: ids.tenant, hubKey: 'lingshu-xinyu', sourceRegistryId, batchId })) }; }
      catch (error) { mapError(error); }
    }
    async sources(req, batchId) {
      try { return { sources: await transact(db => listBatchSources({ db, principal: req.user,
        tenantId: ids.tenant, hubKey: 'lingshu-xinyu', batchId })) }; }
      catch (error) { mapError(error); }
    }
    async rows(req, batchId, sourceRegistryId, cursor) {
      try { return await transact(db => listReviewRows({ db, principal: req.user,
        tenantId: ids.tenant, hubKey: 'lingshu-xinyu', batchId, sourceRegistryId, cursor: cursor ?? 0 })); }
      catch (error) { mapError(error); }
    }
    async submit(req, body) {
      try { return { review: await transact(db => reviewSource({ db, principal: req.user,
        tenantId: ids.tenant, hubKey: 'lingshu-xinyu', input: body })) }; }
      catch (error) { mapError(error); }
    }
  }
  Controller('hub-sources')(HubSourceReviewController);
  Get('review-receipts/:operationId')(HubSourceReviewController.prototype,'receipt',Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype,'receipt'));
  Req()(HubSourceReviewController.prototype,'receipt',0);Param('operationId')(HubSourceReviewController.prototype,'receipt',1);Res({passthrough:true})(HubSourceReviewController.prototype,'receipt',2);
  Get('pmc-review-articles/:versionId')(HubSourceReviewController.prototype,'pmcArticle',Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype,'pmcArticle'));
  Req()(HubSourceReviewController.prototype,'pmcArticle',0);Param('versionId')(HubSourceReviewController.prototype,'pmcArticle',1);Res({passthrough:true})(HubSourceReviewController.prototype,'pmcArticle',2);
  for (const [name,path] of [['queue','review-queue'],['workbook','review-workbook']]) {
    Get(path)(HubSourceReviewController.prototype,name,Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype,name));
    Req()(HubSourceReviewController.prototype,name,0);
  }
  Res({passthrough:true})(HubSourceReviewController.prototype,'queue',1);
  Query()(HubSourceReviewController.prototype,'workbook',1);
  Res({passthrough:true})(HubSourceReviewController.prototype,'workbook',2);
  Post('object-reviews')(HubSourceReviewController.prototype,'objectSubmit',Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype,'objectSubmit'));
  Req()(HubSourceReviewController.prototype,'objectSubmit',0); Body()(HubSourceReviewController.prototype,'objectSubmit',1);
  Res({passthrough:true})(HubSourceReviewController.prototype,'objectSubmit',2);
  Get('pmc-review-items')(HubSourceReviewController.prototype, 'pmcItems', Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype, 'pmcItems'));
  Req()(HubSourceReviewController.prototype, 'pmcItems', 0);
  Res({ passthrough: true })(HubSourceReviewController.prototype, 'pmcItems', 1);
  Post('pmc-reviews')(HubSourceReviewController.prototype, 'pmcSubmit', Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype, 'pmcSubmit'));
  Req()(HubSourceReviewController.prototype, 'pmcSubmit', 0);
  Body()(HubSourceReviewController.prototype, 'pmcSubmit', 1);
  Res({ passthrough: true })(HubSourceReviewController.prototype, 'pmcSubmit', 2);
  Get('external-review-items')(HubSourceReviewController.prototype, 'externalItems', Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype, 'externalItems'));
  Req()(HubSourceReviewController.prototype, 'externalItems', 0);
  Res({ passthrough: true })(HubSourceReviewController.prototype, 'externalItems', 1);
  Post('external-reviews')(HubSourceReviewController.prototype, 'externalSubmit', Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype, 'externalSubmit'));
  Req()(HubSourceReviewController.prototype, 'externalSubmit', 0);
  Body()(HubSourceReviewController.prototype, 'externalSubmit', 1);
  Res({ passthrough: true })(HubSourceReviewController.prototype, 'externalSubmit', 2);
  Get('review-batches')(HubSourceReviewController.prototype, 'batches', Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype, 'batches'));
  Req()(HubSourceReviewController.prototype, 'batches', 0);
  Get('review-history/:sourceRegistryId')(HubSourceReviewController.prototype, 'history', Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype, 'history'));
  Req()(HubSourceReviewController.prototype, 'history', 0);
  Param('sourceRegistryId')(HubSourceReviewController.prototype, 'history', 1);
  Query('batchId')(HubSourceReviewController.prototype,'history',2);
  Get('review-batches/:batchId/sources')(HubSourceReviewController.prototype, 'sources', Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype, 'sources'));
  Req()(HubSourceReviewController.prototype, 'sources', 0);
  Param('batchId')(HubSourceReviewController.prototype, 'sources', 1);
  Get('review-batches/:batchId/sources/:sourceRegistryId/rows')(HubSourceReviewController.prototype, 'rows', Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype, 'rows'));
  Req()(HubSourceReviewController.prototype, 'rows', 0);
  Param('batchId')(HubSourceReviewController.prototype, 'rows', 1);
  Param('sourceRegistryId')(HubSourceReviewController.prototype, 'rows', 2);
  Query('cursor')(HubSourceReviewController.prototype, 'rows', 3);
  Post('reviews')(HubSourceReviewController.prototype, 'submit', Object.getOwnPropertyDescriptor(HubSourceReviewController.prototype, 'submit'));
  Req()(HubSourceReviewController.prototype, 'submit', 0);
  Body()(HubSourceReviewController.prototype, 'submit', 1);
  return HubSourceReviewController;
}
