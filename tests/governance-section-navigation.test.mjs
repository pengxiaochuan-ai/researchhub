import test from 'node:test';
import assert from 'node:assert/strict';
import * as route from '../src/member-invitation-route.js';
import {invitationLocationHref} from '../src/invitation-location.js';

test('only the existing bare S11 entry and validated governance invitation deep links use the governance header',()=>{
 assert.equal(typeof route.isGovernanceInvitationEntry,'function');
 assert.equal(route.isGovernanceInvitationEntry(''),true);
 const href=invitationLocationHref('group','study','invite-123',{module:'access',page:2});
 assert.equal(route.isGovernanceInvitationEntry(href.split('?')[1]),true);
 for(const search of ['members=1&studyGroupId=group&researchProjectId=study','studyGroupId=group&researchProjectId=study','members=1','from=governance','overviewModule=access',invitationLocationHref('group','study','invite-123').split('?')[1],href.split('?')[1]+'&token=secret'])assert.equal(route.isGovernanceInvitationEntry(search),false,search);
});
