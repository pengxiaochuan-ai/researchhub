import test from 'node:test';import assert from 'node:assert/strict';
import{whenSectionNear}from'../pages/p002/section-images.js';
test('offscreen section defers all source assignments until its visible container approaches',async()=>{
 let receive,observed=0,loads=0,unobserved=0;globalThis.IntersectionObserver=class{constructor(cb){receive=cb;}observe(){observed++;}unobserve(){unobserved++;}};
 const section={id:'audience'},frame={closest:()=>section};whenSectionNear(frame,()=>loads++);whenSectionNear(frame,()=>loads++);await Promise.resolve();assert.equal(loads,0);assert.equal(observed,2);receive([{target:section,isIntersecting:false}]);assert.equal(loads,0);receive([{target:section,isIntersecting:true}]);assert.equal(loads,2);assert.equal(unobserved,1);delete globalThis.IntersectionObserver;
});
test('hero and browsers without IntersectionObserver get usable originals immediately',async()=>{
 let loads=0;whenSectionNear({closest:()=>({id:'home'})},()=>loads++);whenSectionNear({},()=>loads++);await Promise.resolve();assert.equal(loads,2);
});
