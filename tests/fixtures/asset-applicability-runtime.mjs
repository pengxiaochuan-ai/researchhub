// Real original services; explicit synthetic catalog guard lives in the reused harness.
import {readFileSync} from 'node:fs';
import {assetApplicabilityServicesRuntime} from './asset-applicability-services-runtime.mjs';
import {createCrfMethodAssets} from '../../scripts/local-crf-method-assets.mjs';
export async function assetApplicabilityRuntime(options={}){
 const rt=await assetApplicabilityServicesRuntime(options);
 const assets=createCrfMethodAssets({...rt,storage:{},scope:rt.dir+'wp08-scope.json'});
 const prior=JSON.parse(readFileSync(rt.root+'.tmp/researchhub-wp08-crf-method-assets/api-fixtures.json'));
 return {...rt,assets,prior};
}
