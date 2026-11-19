import test from 'node:test';
import assert from 'node:assert/strict';
import {academicHref,publicAcademicHref,readPublicAcademicRoute} from '../src/academic-content-route.js';

test('public list and detail URLs retain filters without entering the workspace',()=>{
 assert.equal(publicAcademicHref(),'/pages/p011/');
 const href=publicAcademicHref({id:'event-one',type:'event',phase:'past',q:'情志 讲座'});
 assert.equal(href.split('?')[0],'/pages/p011/');
 const value=readPublicAcademicRoute(href.split('?')[1]);
 assert.equal(value.id,'event-one');assert.equal(value.type,'event');assert.equal(value.phase,'past');assert.equal(value.q,'情志 讲座');
 assert.equal(publicAcademicHref({...value,id:undefined}),'/pages/p011/?type=event&phase=past&q=%E6%83%85%E5%BF%97+%E8%AE%B2%E5%BA%A7');
});
test('public URLs reject duplicate, credential and workspace parameters',()=>{
 for(const value of ['contentId=a&contentId=b','type=event&type=news','token=secret','returnTo=https://other.example','hubKey=other','section=updates','status=draft','page=2','q='+('x'.repeat(201)),'contentId=../private'])assert.throws(()=>readPublicAcademicRoute(value),value);
 for(const value of [{id:'../one'},{type:'private'},{phase:'invalid'}])assert.throws(()=>publicAcademicHref(value));
});
test('public helpers do not change existing member or management URLs',()=>{
 assert.ok(academicHref({id:'member-one'}).startsWith('/pages/h01/?'));
 assert.ok(academicHref({management:true,id:'draft-one'}).startsWith('/pages/g02/?view=academic-content'));
 assert.equal(readPublicAcademicRoute('').id,null);
 assert.equal(readPublicAcademicRoute('').type,'all');
});
