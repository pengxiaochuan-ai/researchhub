import {crfMethodAssetFixture} from './crf-method-assets.mjs';
import {buildCrfMethodAssetSnapshot} from '../../scripts/crf-method-assets-contract.mjs';
import {edcDigest} from '../../scripts/synthetic-edc-contract.mjs';
import {renderCrfMethodReport} from '../../scripts/synthetic-crf-methods-report-contract.mjs';
// Hand-authored software-only input, never used to seed a real AI report.
export function basisFixture(){
 const original=crfMethodAssetFixture();
 original.report.facts.pico={question:'合成配置能否用于软件核对？',p:'合成对象',i:'合成干预',c:'合成对照',o:'合成观察'};
 original.report.factsHash=edcDigest(original.report.facts);original.report.contentMd=renderCrfMethodReport(original.report.facts,original.report.notes);
 const {snapshot,snapshotHash}=buildCrfMethodAssetSnapshot(original);
 return{asset:{id:'asset',version:1,currentVersion:1,sourceStatus:'current',snapshotHash,contentHash:'a'.repeat(64),snapshot},
  target:{id:'target',version:3,currentVersion:3,sourceStatus:'current',stage:'protocol_draft',pico:{question:'合成配置能否用于软件核对？',p:'合成对象',i:'合成干预',c:'合成对照',o:'合成观察'},confirmation:{hash:'b'.repeat(64)},preparationStatus:'current',config:structuredClone(snapshot.reuseRecipe.config)}};
}
