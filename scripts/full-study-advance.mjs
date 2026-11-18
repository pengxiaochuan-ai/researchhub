import assert from 'node:assert/strict';import {existsSync} from 'node:fs';import {openHarness,json,save,key,privateDir,evidenceDir} from './full-study-runtime.mjs';
const expectedStage=Number(process.argv[3]);assert(process.argv[2]==='--from-stage'&&process.argv.length===4&&Number.isInteger(expectedStage)&&expectedStage>=0&&expectedStage<3);
const h=await openHarness(),b=json(privateDir+'bootstrap.json'),root='/research-studies/'+b.study.id,path=privateDir+'advance-'+expectedStage+'.json';
const state=existsSync(path)?json(path):{body:{requestKey:key(),expectedStage},pending:true};save(path,state);
if(!state.result){state.result=await h.post(root+'/simulation/advance',state.body);state.pending=false;save(path,state);}
assert.equal(state.result.stageIndex,expectedStage+1);const read=(await h.get(root+'/simulation/context')).simulation;assert.equal(read.stageIndex,expectedStage+1);save(evidenceDir+'advance-'+expectedStage+'.json',{passed:true,at:new Date().toISOString(),studyId:b.study.id,syntheticOnly:true,result:state.result,context:read,network:h.network});console.log(JSON.stringify({passed:true,stageIndex:read.stageIndex,day:read.day}));
