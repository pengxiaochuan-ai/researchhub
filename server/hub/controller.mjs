import { withFixtureTransaction } from '../database/transactions.mjs';
import { getFollow, getHub, listHubs, setFollow } from './repository.mjs';
import { readOverviewSources } from './overview-sources.mjs';
import { readOverviewMetrics } from './metrics.mjs';
import {projectRegistrationStatistics} from './registry-statistics.mjs';
import {listVisibleClinicalRegistrySummaries} from '../hub-sources/external-visible.mjs';
import {createPublicActivityReader} from '../hub-activity/service.mjs';
import {readPublicActivitySources} from '../hub-activity/sources.mjs';
import {readExistingFacts} from '../hub-activity/ledger.mjs';
import {readActiveActivityHub} from '../hub-activity/scope.mjs';

export function createHubController({ env, ids, require, readPublicContent }) {
  const { Controller, Get, Put, Param, Req, Body, Res, SetMetadata,
    BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException, Query } = require('@nestjs/common');
  const transact = operation => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    return operation(db);
  });
  const handle = error => {
    if (error?.message === 'HUB_SCOPE_REJECTED')
      throw new ForbiddenException({ code: 'HUB_SCOPE_REJECTED', message: '当前账号不能访问此 Hub' });
    throw error;
  };
  const activity=createPublicActivityReader({tenantId:ids.tenant,transact,readSources:readPublicActivitySources,readPublicContent,
    findHub:async(db,{tenantId,hubKey})=>{
      await db.$executeRaw`SELECT set_config('app.hub_key',${hubKey},true),set_config('app.account_id','',true),set_config('app.auth_version','',true),set_config('lock_timeout','8s',true)`;
      await db.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${'wp01:tenant:'+tenantId},0))`;
      return readActiveActivityHub(db,{tenantId,hubKey});
    },readFacts:async(db,scope)=>{
      const [state]=await db.$queryRaw`SELECT to_regclass('rh_hub_activity.first_public') IS NOT NULL AS installed`;
      return state?.installed?{status:'ready',facts:await readExistingFacts(db,scope)}:{status:'unavailable',facts:[]};
    }});
  class HubController {
    async publicActivity(hubKey,query,response){
      response.setHeader('Cache-Control','no-store');
      try{return await activity(hubKey,query);}
      catch(error){
        if(error.message==='PUBLIC_ACTIVITY_QUERY_INVALID')throw new BadRequestException({code:'PUBLIC_ACTIVITY_QUERY_INVALID',message:'动态读取参数无效。'});
        if(error.message==='HUB_NOT_FOUND')throw new NotFoundException({code:'HUB_NOT_FOUND',message:'该领域尚未开放。'});
        throw new ServiceUnavailableException({code:'PUBLIC_ACTIVITY_UNAVAILABLE',message:'领域动态暂时无法读取，请稍后重试。'});
      }
    }
    async list(response) {
      response.setHeader('Cache-Control', 'no-store');
      return { items: await transact(db => listHubs({ db, tenantId: ids.tenant })) };
    }
    async detail(hubKey, response) {
      response.setHeader('Cache-Control', 'no-store');
      const item = await transact(db => getHub({ db, tenantId: ids.tenant, hubKey }));
      if (!item) throw new NotFoundException({ code: 'HUB_NOT_FOUND', message: '该领域尚未开放' });
      return { item };
    }
    async overview(hubKey, response) {
      response.setHeader('Cache-Control', 'no-store');
      const result = await transact(async db => {
        // Allow short native authorization transactions to finish; statement (10s) and transaction (20s) limits still bound this read.
        await db.$executeRaw`SELECT set_config('app.hub_key', ${hubKey}, true),set_config('app.account_id','',true),set_config('app.auth_version','',true),set_config('lock_timeout','8s',true)`;
        const metrics=await readOverviewMetrics({db,tenantId:ids.tenant,hubKey});
        if(!metrics)return null;
        const hub = await getHub({ db, tenantId: ids.tenant, hubKey });
        if (!hub) return null;
        const sources = hubKey === 'lingshu-xinyu'
          ? await readOverviewSources({ db, tenantId: ids.tenant, hubKey }) : { items: [], recordCount: 0 };
        const clinicalRegistries=hubKey==='lingshu-xinyu'?await listVisibleClinicalRegistrySummaries({db,tenantId:ids.tenant,hubKey}):[];
        return { hub, sourceScopeStatus: 'candidate_not_screened', reviewedSources: sources.items,
          reviewedSourceRecordCount: sources.recordCount,
          metricsCalculatedAt: new Date().toISOString(), metrics,clinicalRegistries,registrationStatistics:projectRegistrationStatistics(clinicalRegistries) };
      });
      if (!result) throw new NotFoundException({ code: 'HUB_NOT_FOUND', message: '该领域尚未开放' });
      return result;
    }
    async followState(hubKey, request, response) {
      response.setHeader('Cache-Control', 'no-store');
      try { return { followed: await transact(db => getFollow({ db, tenantId: ids.tenant,
        hubKey, principal: request.user })) }; }
      catch (error) { handle(error); }
    }
    async follow(hubKey, request, body, response) {
      response.setHeader('Cache-Control', 'no-store');
      if (typeof body?.followed !== 'boolean' || Object.keys(body).length !== 1)
        throw new BadRequestException({ code: 'HUB_FOLLOW_INVALID', message: '关注状态无效' });
      try { return { followed: await transact(db => setFollow({ db, tenantId: ids.tenant,
        hubKey, principal: request.user, followed: body.followed })) }; }
      catch (error) { handle(error); }
    }
  }
  Controller('hubs')(HubController);
  const method = (verb, path, name) => verb(path)(HubController.prototype, name,
    Object.getOwnPropertyDescriptor(HubController.prototype, name));
  method(Get,':hubKey/public-activity','publicActivity');
  SetMetadata('isPublic',true)(HubController.prototype,'publicActivity',Object.getOwnPropertyDescriptor(HubController.prototype,'publicActivity'));
  Param('hubKey')(HubController.prototype,'publicActivity',0);Query()(HubController.prototype,'publicActivity',1);Res({passthrough:true})(HubController.prototype,'publicActivity',2);
  method(Get, '', 'list'); SetMetadata('isPublic', true)(HubController.prototype, 'list', Object.getOwnPropertyDescriptor(HubController.prototype, 'list'));
  Res({ passthrough: true })(HubController.prototype, 'list', 0);
  method(Get, ':hubKey', 'detail'); SetMetadata('isPublic', true)(HubController.prototype, 'detail', Object.getOwnPropertyDescriptor(HubController.prototype, 'detail'));
  Param('hubKey')(HubController.prototype, 'detail', 0); Res({ passthrough: true })(HubController.prototype, 'detail', 1);
  method(Get, ':hubKey/overview', 'overview'); SetMetadata('isPublic', true)(HubController.prototype, 'overview', Object.getOwnPropertyDescriptor(HubController.prototype, 'overview'));
  Param('hubKey')(HubController.prototype, 'overview', 0); Res({ passthrough: true })(HubController.prototype, 'overview', 1);
  method(Get, ':hubKey/follow', 'followState');
  Param('hubKey')(HubController.prototype, 'followState', 0); Req()(HubController.prototype, 'followState', 1); Res({ passthrough: true })(HubController.prototype, 'followState', 2);
  method(Put, ':hubKey/follow', 'follow');
  Param('hubKey')(HubController.prototype, 'follow', 0); Req()(HubController.prototype, 'follow', 1); Body()(HubController.prototype, 'follow', 2); Res({ passthrough: true })(HubController.prototype, 'follow', 3);
  return HubController;
}
