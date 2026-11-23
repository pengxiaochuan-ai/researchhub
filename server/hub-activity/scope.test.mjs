import test from 'node:test';
import assert from 'node:assert/strict';
import {readActiveActivityHub} from './scope.mjs';
test('inactive tenant or Hub never reaches the old Hub-only projection',async()=>{
 let queries=0;
 const db={$queryRaw:async(strings,...args)=>{queries++;assert.match(strings.join('?'),/t.status='active'/);assert.deepEqual(args,['tenant','hub']);return[];}};
 assert.equal(await readActiveActivityHub(db,{tenantId:'tenant',hubKey:'hub'}),null);assert.equal(queries,1);
});
