import { withFixtureTransaction } from '../../../app/server/scripts/wp01/fixture-guard.mjs';
import { getFollow, getHub, listHubs, setFollow } from './repository.mjs';
import { readOverviewSources } from './overview-sources.mjs';
import { readOverviewMetrics } from './metrics.mjs';
import {listVisibleClinicalRegistrySummaries} from '../hub-sources/external-visible.mjs';

export function createHubController({ env, ids, require }) {
  const { Controller, Get, Put, Param, Req, Body, Res, SetMetadata,
    BadRequestException, ForbiddenException, NotFoundException } = require('@nestjs/common');
  const transact = operation => withFixtureTransaction(env, 'app', async db => {
    await db.$executeRaw`SELECT set_config('app.tenant_id', ${ids.tenant}, true)`;
    return operation(db);
  });
  const handle = error => {
    if (error?.message === 'HUB_SCOPE_REJECTED')
      throw new ForbiddenException({ code: 'HUB_SCOPE_REJECTED', message: '当前账号不能访问此 Hub' });
    throw error;
  };
  class HubController {
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
        await db.$executeRaw`SELECT set_config('app.hub_key', ${hubKey}, true),set_config('app.account_id','',true),set_config('app.auth_version','',true),set_config('lock_timeout','2s',true)`;
        const metrics=await readOverviewMetrics({db,tenantId:ids.tenant,hubKey});
        if(!metrics)return null;
        const hub = await getHub({ db, tenantId: ids.tenant, hubKey });
        if (!hub) return null;
        const sources = hubKey === 'lingshu-xinyu'
          ? await readOverviewSources({ db, tenantId: ids.tenant, hubKey }) : { items: [], recordCount: 0 };
        const clinicalRegistries=hubKey==='lingshu-xinyu'?await listVisibleClinicalRegistrySummaries({db,tenantId:ids.tenant,hubKey}):[];
        return { hub, sourceScopeStatus: 'candidate_not_screened', reviewedSources: sources.items,
          reviewedSourceRecordCount: sources.recordCount,
          metricsCalculatedAt: new Date().toISOString(), metrics,clinicalRegistries };
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
