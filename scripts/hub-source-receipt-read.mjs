import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadFixtureInput} from '../../app/server/scripts/wp01/local-config.mjs';
import {assertFixtureTarget,withFixtureTransaction} from '../../app/server/scripts/wp01/fixture-guard.mjs';
import {installReceiptRead} from '../server/hub-sources/review-receipt-schema.mjs';
const root=new URL('../../',import.meta.url);
export async function applyReceiptRead(){
 const {env}=loadFixtureInput(fileURLToPath(new URL('.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json',root)));
 const target=await assertFixtureTarget(env);if(target.databaseName!=='wp01_test_full_baseline')throw Error('HUB_SOURCE_TARGET_REJECTED');
 const {ids}=JSON.parse(readFileSync(new URL('.tmp/researchhub-knowledge-local/runtime.json',root),'utf8'));
 return withFixtureTransaction(env,'direct',db=>installReceiptRead(db,{tenantId:ids.tenant,reviewerAccountId:ids.admin}));
}
if(fileURLToPath(import.meta.url)===process.argv[1]){
 if(process.argv.length!==3||process.argv[2]!=='--apply'){console.error('Usage: node scripts/hub-source-receipt-read.mjs --apply');process.exitCode=2;}
 else applyReceiptRead().then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
}
