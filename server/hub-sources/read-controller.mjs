import { withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getVisible, listVisible, visibleCounts, assertHubMember } from './visible-repository.mjs';
import { listVisibleExternal, listVisibleClinicalRegistries, getVisibleClinicalRegistry, listVisibleGuidanceDocuments, getVisibleGuidanceDocument } from './external-visible.mjs';
import { getVisiblePmc, listVisiblePmc, getDownloadablePmcAsset } from './pmc-visible.mjs';
import { getReviewablePmcImage } from './pmc-review-service.mjs';
import { imageMimeFromBytes } from './pmc-image.mjs';
import {prepareHubQuery,publicationCursor,matchesHubQuery,publicationRank} from './search-projection.mjs';
import {normalizePublicationFilters,matchesPublicationFilters,publicationFacets} from '../../src/publication-filters.js';

const pmcObjectRoot = fileURLToPath(new URL('../../.tmp/researchhub-pmc-local/', import.meta.url));

export function createHubSourceReadController({ env, ids, require, secret }) {
  const { Controller, Get, Query, Param, Req, Res, SetMetadata, BadRequestException, NotFoundException,
    ForbiddenException, ServiceUnavailableException } = require('@nestjs/common');
  const transact = operation => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    return operation(db);
  });
  const scope = { tenantId: ids.tenant, hubKey: 'lingshu-xinyu', principal: null };
  const cursorCodec=publicationCursor(secret);
  const queryError=error=>{if(error?.status===400)throw new BadRequestException({code:error.code,message:error.message});throw error;};
  async function publicationPage(db,{principal=null,audience='public',q='',cursor=null,limit=20,filters}){
    const plan=prepareHubQuery(q??''),size=limit==null?20:Number(limit);
    const appliedFilters=normalizePublicationFilters(filters),filterYear=new Date().getUTCFullYear();
    if(!['string','number'].includes(typeof limit)||!Number.isSafeInteger(size)||size<1||size>20)throw Object.assign(Error('每页条数必须为1–20'),{status:400,code:'HUB_QUERY_LIMIT'});
    if(cursor!=null&&typeof cursor!=='string')throw Object.assign(Error('翻页参数无效'),{status:400,code:'HUB_QUERY_CURSOR_INVALID'});
    const args={...scope,principal,audience,plan,filters:appliedFilters,filterYear};let after=null;
    if(cursor){if(/^(rhsr-[a-f0-9]{40})$/.test(cursor)&&(!plan||plan.mode==='literal')&&JSON.stringify(appliedFilters)===JSON.stringify(normalizePublicationFilters()))after={id:cursor,rank:0};else after=cursorCodec.decode(args,cursor);}
    const pub=await listVisiblePmc({db,...scope,principal,audience:'public'});
    const tenant=audience==='member'?await listVisiblePmc({db,...scope,principal,audience:'tenant'}):[];
    const filter=item=>matchesHubQuery(plan,[item.id,item.title,item.authors,item.journal,item.doi,item.abstract,item.body,JSON.stringify(item.tables||[])],[item.id.slice(4),item.doi]);
    const compare=(a,b)=>a.searchRank-b.searchRank||(a.id<b.id?-1:a.id>b.id?1:0);
    const eligiblePmc=[...pub,...tenant].filter(filter);
    const pmc=eligiblePmc.filter(item=>matchesPublicationFilters(item,appliedFilters,filterYear)).map(item=>({...item,searchRank:publicationRank(plan,[item.id,item.title,item.authors,item.journal,item.doi,item.abstract,item.body,JSON.stringify(item.tables||[])])})).sort(compare);
    const remainingPmc=pmc.filter(item=>!after||compare(item,{id:after.id,searchRank:after.rank})>0);
    const workbook=await listVisible({db,...scope,principal,audience,queryPlan:plan,filters:{q},cursor:after?.id.startsWith('rhsr-')?after.id:null,afterRank:after?.rank??0,limit:size,publicationFilters:appliedFilters,includeFacets:true});
    const available=[...remainingPmc,...workbook.items].sort(compare),items=available.slice(0,size);
    const more=available.length>size||Boolean(workbook.nextCursor);
    const [staged]=await db.$queryRaw`SELECT count(*)::integer AS count FROM rh_source.pmc_candidate WHERE tenant_id=${ids.tenant} AND hub_key='lingshu-xinyu' AND campaign_key='pmc-first-2026-10-31'`;
    const pmcFacets=publicationFacets(eligiblePmc,appliedFilters,filterYear);
    const facets=Object.fromEntries(Object.entries(pmcFacets).map(([key,values])=>[key,Object.fromEntries(Object.entries(values).map(([value,count])=>[value,count+(workbook.facets?.[key]?.[value]??0)]))]));
    return {items:items.map(({searchRank,...item})=>item),nextCursor:more&&items.length?cursorCodec.encode(args,items.at(-1).id,items.at(-1).searchRank):null,queryPlan:plan,appliedFilters,filterYear,facets,
      counts:{...await visibleCounts({db,...scope}),pmcStagedCandidates:staged.count,pmcApprovedDisplayRecords:pub.length,pmcTenantDisplayRecords:tenant.filter(item=>filter(item)&&matchesPublicationFilters(item,appliedFilters,filterYear)).length,matchedRecords:pmc.length+workbook.matchedRecords}};
  }
  class HubSourceReadController {
    async memberCollection(req, collection, q, cursor, limit, response, filters) {
      response.setHeader('Cache-Control','no-store');
      try { return await transact(async db=>{
        const member={db,...scope,principal:req.user,audience:'member'};
        await assertHubMember(member);
        if(collection==='external-documents') return {items:await listVisibleExternal(member)};
        if(collection==='clinical-registries') return {items:await listVisibleClinicalRegistries(member)};
        if(collection==='guidance-documents') return {items:await listVisibleGuidanceDocuments(member)};
        if(collection!=='publications') throw new NotFoundException();
        return publicationPage(db,{principal:req.user,audience:'member',q,cursor,limit,filters});
      }); } catch(error) {
        if(error?.message==='HUB_SOURCE_SCOPE_REJECTED') throw new ForbiddenException({code:error.message});
        queryError(error);
      }
    }
    async memberItem(req,collection,recordId,response) {
      response.setHeader('Cache-Control','no-store');
      try { const item=await transact(async db=>{
        const member={db,...scope,principal:req.user,audience:'member'};
        await assertHubMember(member);
        if(collection==='clinical-registries') return getVisibleClinicalRegistry({...member,documentId:recordId});
        if(collection==='guidance-documents') return getVisibleGuidanceDocument({...member,documentId:recordId});
        if(collection!=='publications') throw new NotFoundException();
        if(!recordId?.startsWith('pmc-')) return getVisible({...member,recordId});
        return (await getVisiblePmc({...member,recordId,audience:'tenant'})) || getVisiblePmc({...member,recordId,audience:'public'});
      });
      if(!item) throw new NotFoundException({code:'HUB_SOURCE_NOT_APPROVED',message:'该资料未获准展示或已撤回'});
      return {item};
      } catch(error) {
        if(error?.message==='HUB_SOURCE_SCOPE_REJECTED') throw new ForbiddenException({code:error.message});
        throw error;
      }
    }
    async externalDocuments(response) {
      response.setHeader('Cache-Control', 'no-store');
      return transact(async db => ({ items: await listVisibleExternal({ db, ...scope }) }));
    }
    async clinicalRegistries(response) {
      response.setHeader('Cache-Control', 'no-store');
      return transact(async db => ({ items: await listVisibleClinicalRegistries({ db, ...scope }) }));
    }
    async clinicalRegistry(documentId, response) {
      response.setHeader('Cache-Control', 'no-store');
      const item = await transact(db => getVisibleClinicalRegistry({ db, ...scope, documentId }));
      if (!item) throw new NotFoundException({ code: 'HUB_REGISTRY_NOT_APPROVED', message: '该注册来源未获准展示或已撤回' });
      return { item };
    }
    async guidanceDocuments(response) {
      response.setHeader('Cache-Control', 'no-store');
      return transact(async db => ({ items: await listVisibleGuidanceDocuments({ db, ...scope }) }));
    }
    async guidanceDocument(documentId, response) {
      response.setHeader('Cache-Control', 'no-store');
      const item = await transact(db => getVisibleGuidanceDocument({ db, ...scope, documentId }));
      if (!item) throw new NotFoundException({ code: 'HUB_GUIDANCE_NOT_APPROVED', message: '该指南或标准未获准展示或已撤回' });
      return { item };
    }
    async publications(q, cursor, limit, response, filters) {
      try {
        response.setHeader('Cache-Control', 'no-store');
        return await transact(db=>publicationPage(db,{q,cursor,limit,filters}));
      } catch (error) {
        if (error?.message === 'HUB_SOURCE_SCOPE_REJECTED')
          throw new BadRequestException({ code: error.message, message: '筛选条件无效' });
        queryError(error);
      }
    }
    async publication(recordId, response) {
      response.setHeader('Cache-Control', 'no-store');
      const item = await transact(db => recordId?.startsWith('pmc-')
        ? getVisiblePmc({ db, ...scope, recordId })
        : getVisible({ db, ...scope, recordId }));
      if (!item) throw new NotFoundException({ code: 'HUB_SOURCE_NOT_APPROVED', message: '该资料未获准展示或已撤回' });
      return { item };
    }
    async tenantPmcPublications(req, q, response) {
      response.setHeader('Cache-Control', 'no-store');
      try { return { items: await transact(db => listVisiblePmc({ db, ...scope,
        principal: req.user, audience: 'tenant', query: q })) }; }
      catch (error) {
        if (error?.message === 'HUB_SOURCE_SCOPE_REJECTED')
          throw new ForbiddenException({ code: error.message });
        throw error;
      }
    }
    async tenantPmcPublication(req, recordId, response) {
      response.setHeader('Cache-Control', 'no-store');
      try {
        const item = await transact(db => getVisiblePmc({ db, ...scope,
          principal: req.user, audience: 'tenant', recordId }));
        if (!item) throw new NotFoundException({ code: 'HUB_SOURCE_NOT_APPROVED' });
        return { item };
      } catch (error) {
        if (error?.message === 'HUB_SOURCE_SCOPE_REJECTED')
          throw new ForbiddenException({ code: error.message });
        throw error;
      }
    }
    async sendPmcAsset(assetId, response, mode, principal = null) {
      response.setHeader('Cache-Control', 'no-store');
      try {
        await withFixtureTransaction(env, 'direct', async db => {
          await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
          if (mode === 'review') {
            await db.$queryRaw`SELECT rh_source.hold_review_grants_for_commit()`;
            await db.$queryRaw`SELECT a.id FROM account a JOIN tenant t ON t.id=a."tenantId"
              WHERE a.id=${principal?.accountId || ''} AND a."tenantId"=${ids.tenant}
              FOR SHARE OF a, t`;
          }
          const [locked] = await db.$queryRaw`
            SELECT c.id AS "candidateId", v.id AS "versionId"
            FROM rh_source.pmc_asset a
            JOIN rh_source.pmc_candidate_version v ON v.id=a.version_id
              AND v.tenant_id=a.tenant_id AND v.hub_key=a.hub_key
            JOIN rh_source.pmc_candidate c ON c.id=v.candidate_id
              AND c.tenant_id=v.tenant_id AND c.hub_key=v.hub_key
            WHERE a.id=${assetId} AND a.tenant_id=${ids.tenant}
              AND a.hub_key='lingshu-xinyu' FOR UPDATE OF c`;
          if (!locked) throw new NotFoundException({ code: 'HUB_PMC_ASSET_NOT_APPROVED' });
          await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(
            ${ids.tenant + ':lingshu-xinyu:' + locked.versionId}, 0))`;
          const asset = mode === 'review'
            ? await getReviewablePmcImage({ db, ...scope, principal,
              reviewerAccountId: ids.admin, assetId })
            : await getDownloadablePmcAsset({ db, ...scope, principal,
              audience: mode.startsWith('tenant-') ? 'tenant' : 'public', assetId });
          if (!asset) throw new NotFoundException({ code: 'HUB_PMC_ASSET_NOT_APPROVED' });
          if (mode.endsWith('inline') && asset.assetKind !== 'image')
            throw new NotFoundException({ code: 'HUB_PMC_IMAGE_UNSUPPORTED' });
          let raw;
          try { raw = readFileSync(pmcObjectRoot + asset.localObjectKey); }
          catch { throw new ServiceUnavailableException({ code: 'HUB_PMC_ASSET_UNAVAILABLE' }); }
          if (raw.length !== asset.byteCount ||
              createHash('sha256').update(raw).digest('hex') !== asset.sha256)
            throw new ServiceUnavailableException({ code: 'HUB_PMC_ASSET_HASH_MISMATCH' });
          const isDownload = mode.endsWith('download');
          const imageMime = isDownload ? null : imageMimeFromBytes(raw);
          if (!isDownload && !imageMime)
            throw new NotFoundException({ code: 'HUB_PMC_IMAGE_UNSUPPORTED' });
          response.setHeader('Content-Type', imageMime || 'application/octet-stream');
          response.setHeader('X-Content-Type-Options', 'nosniff');
          response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
          response.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="pmc-asset-${assetId}"`);
          response.setHeader('Content-Length', String(raw.length));
          await new Promise((resolve, reject) => {
            response.once('finish', resolve);
            response.once('close', () => { if (!response.writableFinished) reject(new Error('PMC_CLIENT_CLOSED')); });
            response.end(raw);
          });
        });
      } catch (error) {
        if (response.headersSent) { response.destroy(); return; }
        if (error?.message === 'HUB_SOURCE_REVIEW_AUTH_REQUIRED')
          throw new ForbiddenException({ code: error.message });
        if (error?.message === 'HUB_SOURCE_SCOPE_REJECTED')
          throw new ForbiddenException({ code: error.message });
        throw error;
      }
    }
    async pmcAsset(assetId, response) { return this.sendPmcAsset(assetId, response, 'download'); }
    async pmcImage(assetId, response) { return this.sendPmcAsset(assetId, response, 'inline'); }
    async tenantPmcAsset(req, assetId, response) { return this.sendPmcAsset(assetId, response, 'tenant-download', req.user); }
    async tenantPmcImage(req, assetId, response) { return this.sendPmcAsset(assetId, response, 'tenant-inline', req.user); }
    async pmcReviewImage(req, assetId, response) {
      return this.sendPmcAsset(assetId, response, 'review', req.user);
    }
  }
  Controller('hub-sources')(HubSourceReadController);
  Get('member/:collection')(HubSourceReadController.prototype,'memberCollection',Object.getOwnPropertyDescriptor(HubSourceReadController.prototype,'memberCollection'));
  Req()(HubSourceReadController.prototype,'memberCollection',0); Param('collection')(HubSourceReadController.prototype,'memberCollection',1);
  Query('q')(HubSourceReadController.prototype,'memberCollection',2); Query('cursor')(HubSourceReadController.prototype,'memberCollection',3);
  Query('limit')(HubSourceReadController.prototype,'memberCollection',4); Res({passthrough:true})(HubSourceReadController.prototype,'memberCollection',5);
  Query('filters')(HubSourceReadController.prototype,'memberCollection',6);
  Get('member/:collection/:recordId')(HubSourceReadController.prototype,'memberItem',Object.getOwnPropertyDescriptor(HubSourceReadController.prototype,'memberItem'));
  Req()(HubSourceReadController.prototype,'memberItem',0); Param('collection')(HubSourceReadController.prototype,'memberItem',1);
  Param('recordId')(HubSourceReadController.prototype,'memberItem',2); Res({passthrough:true})(HubSourceReadController.prototype,'memberItem',3);
  Get('external-documents')(HubSourceReadController.prototype, 'externalDocuments', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'externalDocuments'));
  SetMetadata('isPublic', true)(HubSourceReadController.prototype, 'externalDocuments', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'externalDocuments'));
  Res({ passthrough: true })(HubSourceReadController.prototype, 'externalDocuments', 0);
  Get('clinical-registries')(HubSourceReadController.prototype, 'clinicalRegistries', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'clinicalRegistries'));
  SetMetadata('isPublic', true)(HubSourceReadController.prototype, 'clinicalRegistries', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'clinicalRegistries'));
  Res({ passthrough: true })(HubSourceReadController.prototype, 'clinicalRegistries', 0);
  Get('clinical-registries/:documentId')(HubSourceReadController.prototype, 'clinicalRegistry', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'clinicalRegistry'));
  SetMetadata('isPublic', true)(HubSourceReadController.prototype, 'clinicalRegistry', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'clinicalRegistry'));
  Param('documentId')(HubSourceReadController.prototype, 'clinicalRegistry', 0);
  Res({ passthrough: true })(HubSourceReadController.prototype, 'clinicalRegistry', 1);
  Get('guidance-documents')(HubSourceReadController.prototype, 'guidanceDocuments', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'guidanceDocuments'));
  Get('guidance-documents/:documentId')(HubSourceReadController.prototype, 'guidanceDocument', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'guidanceDocument'));
  SetMetadata('isPublic', true)(HubSourceReadController.prototype, 'guidanceDocument', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'guidanceDocument'));
  Param('documentId')(HubSourceReadController.prototype, 'guidanceDocument', 0);
  Res({ passthrough: true })(HubSourceReadController.prototype, 'guidanceDocument', 1);
  SetMetadata('isPublic', true)(HubSourceReadController.prototype, 'guidanceDocuments', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'guidanceDocuments'));
  Res({ passthrough: true })(HubSourceReadController.prototype, 'guidanceDocuments', 0);
  Get('publications')(HubSourceReadController.prototype, 'publications', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'publications'));
  SetMetadata('isPublic', true)(HubSourceReadController.prototype, 'publications', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'publications'));
  Query('q')(HubSourceReadController.prototype, 'publications', 0);
  Query('cursor')(HubSourceReadController.prototype, 'publications', 1);
  Query('limit')(HubSourceReadController.prototype, 'publications', 2);
  Res({ passthrough: true })(HubSourceReadController.prototype, 'publications', 3);
  Query('filters')(HubSourceReadController.prototype, 'publications', 4);
  Get('publications/:recordId')(HubSourceReadController.prototype, 'publication', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'publication'));
  SetMetadata('isPublic', true)(HubSourceReadController.prototype, 'publication', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'publication'));
  Param('recordId')(HubSourceReadController.prototype, 'publication', 0);
  Res({ passthrough: true })(HubSourceReadController.prototype, 'publication', 1);
  Get('tenant-pmc-publications')(HubSourceReadController.prototype, 'tenantPmcPublications', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'tenantPmcPublications'));
  Req()(HubSourceReadController.prototype, 'tenantPmcPublications', 0);
  Query('q')(HubSourceReadController.prototype, 'tenantPmcPublications', 1);
  Res({ passthrough: true })(HubSourceReadController.prototype, 'tenantPmcPublications', 2);
  Get('tenant-pmc-publications/:recordId')(HubSourceReadController.prototype, 'tenantPmcPublication', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'tenantPmcPublication'));
  Req()(HubSourceReadController.prototype, 'tenantPmcPublication', 0);
  Param('recordId')(HubSourceReadController.prototype, 'tenantPmcPublication', 1);
  Res({ passthrough: true })(HubSourceReadController.prototype, 'tenantPmcPublication', 2);
  Get('pmc-assets/:assetId')(HubSourceReadController.prototype, 'pmcAsset', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'pmcAsset'));
  SetMetadata('isPublic', true)(HubSourceReadController.prototype, 'pmcAsset', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'pmcAsset'));
  Param('assetId')(HubSourceReadController.prototype, 'pmcAsset', 0);
  Res()(HubSourceReadController.prototype, 'pmcAsset', 1);
  Get('pmc-images/:assetId')(HubSourceReadController.prototype, 'pmcImage', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'pmcImage'));
  SetMetadata('isPublic', true)(HubSourceReadController.prototype, 'pmcImage', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'pmcImage'));
  Param('assetId')(HubSourceReadController.prototype, 'pmcImage', 0);
  Res()(HubSourceReadController.prototype, 'pmcImage', 1);
  Get('tenant-pmc-assets/:assetId')(HubSourceReadController.prototype, 'tenantPmcAsset', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'tenantPmcAsset'));
  Req()(HubSourceReadController.prototype, 'tenantPmcAsset', 0);
  Param('assetId')(HubSourceReadController.prototype, 'tenantPmcAsset', 1);
  Res()(HubSourceReadController.prototype, 'tenantPmcAsset', 2);
  Get('tenant-pmc-images/:assetId')(HubSourceReadController.prototype, 'tenantPmcImage', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'tenantPmcImage'));
  Req()(HubSourceReadController.prototype, 'tenantPmcImage', 0);
  Param('assetId')(HubSourceReadController.prototype, 'tenantPmcImage', 1);
  Res()(HubSourceReadController.prototype, 'tenantPmcImage', 2);
  Get('pmc-review-images/:assetId')(HubSourceReadController.prototype, 'pmcReviewImage', Object.getOwnPropertyDescriptor(HubSourceReadController.prototype, 'pmcReviewImage'));
  Req()(HubSourceReadController.prototype, 'pmcReviewImage', 0);
  Param('assetId')(HubSourceReadController.prototype, 'pmcReviewImage', 1);
  Res()(HubSourceReadController.prototype, 'pmcReviewImage', 2);
  return HubSourceReadController;
}
