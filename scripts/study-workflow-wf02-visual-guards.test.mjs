// Offline only: guards and measurement/observed-link predicates; no browser or target is run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {assertVisualMeasurement,observedGovernanceTargets,runWF02VisualBoundary,runWF02GovernanceReadback} from './study-workflow-wf02-visual.mjs';
function measurement(){return{innerWidth:720,devicePixelRatio:2,visualViewport:{scale:1},documentScrollWidth:720,mainScrollWidth:700,mainClientWidth:700,png:{width:1440},tail:{reachable:true,hitMatches:true},controls:[{tag:'BUTTON',fontSize:'14px',lineHeight:'22px',rect:{left:10,right:200,height:44},scrollWidth:190,clientWidth:190},{tag:'SELECT',fontSize:'14px',lineHeight:'normal',appearance:'auto',authored22:true,rect:{left:10,right:700,height:44}}]};}
test('native 200 and SELECT normal are accepted only with real dimensions and authored typography evidence',()=>{
 assert(assertVisualMeasurement(measurement(),{physical:true}));
 for(const alter of [m=>m.innerWidth=1440,m=>m.png.width=720,m=>m.devicePixelRatio=1,m=>m.visualViewport.scale=2,m=>m.controls[1].authored22=false,m=>m.controls[1].appearance='none',m=>m.controls[1].rect.height=30,m=>m.controls[0].fontSize='12px',m=>m.tail.reachable=false,m=>m.tail.hitMatches=false,m=>m.documentScrollWidth=900,m=>m.controls[0].scrollWidth=500]){const m=measurement();alter(m);assert.throws(()=>assertVisualMeasurement(m,{physical:true}));}
});
test('governance helper selects only visible observed hrefs with exact Study/Protocol and never synthesizes missing links',()=>{
 const origin='http://127.0.0.1:19501',config={origin,studyId:'target',protocolId:'draft'},href='/pages/s07/?formalPreparation=1&studyId=target&protocolId=draft&governanceModule=all&governancePage=1';
 const good={index:4,href,visible:true};assert.deepEqual(observedGovernanceTargets([good],config),[good]);
 for(const link of [{...good,visible:false},{...good,href:'https://other.example'+href},{...good,href:href.replace('protocolId=draft','protocolId=other')},{...good,href:href+'&studyId=other'},{...good,href:'/pages/g01/?reviewTab=pending'}])assert.deepEqual(observedGovernanceTargets([link],config),[]);
 assert.deepEqual(observedGovernanceTargets([],config),[]);
});
test('both exported helpers reject before touching a missing page/context when root window is absent',async()=>{
 await assert.rejects(runWF02VisualBoundary({env:{}}),/ROOT_WF02/);await assert.rejects(runWF02GovernanceReadback({env:{}}),/ROOT_WF02/);
});
