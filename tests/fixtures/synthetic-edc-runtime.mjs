import {createRequire} from 'node:module';
import {syntheticEdcConfig} from './synthetic-edc.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));require('ts-node').register({project:new URL('../../../app/server/tsconfig.json',import.meta.url).pathname,transpileOnly:true});
export const {normalizeAndValidateAnswers:validate}=require(new URL('../../../app/server/src/study-operations/study-forms-policy.ts',import.meta.url).pathname);
export const packet=()=>({config:syntheticEdcConfig(),dataRevision:0,records:[{recordId:'record',syntheticSubjectKey:'SIM_01',visitKey:'baseline',formKey:'crf',status:'draft',responseRevision:0,answers:Object.fromEntries(syntheticEdcConfig().form.schema.fields.map(f=>[f.key,{state:'missing'}])),updatedBy:'owner',updatedAt:'old',recordedBy:null,recordedAt:null}]});
