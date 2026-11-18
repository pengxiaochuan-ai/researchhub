import {catalogError} from './research-assets-catalog-contract.mjs';
export function assetDetailAiBusinessError(error){
 const code=error?.message;
 if(['A02_AI_SOURCE_FORBIDDEN','A02_AI_NAMED_CASE_REQUIRED','A02_AI_SESSION_CHANGED'].includes(code))return catalogError('AI_PERMISSION_CHANGED',403,'AI 使用许可已变化，请重新核对当前固定版本。');
 if(['A02_AI_SOURCE_CHANGED','A02_AI_TARGET_CHANGED','A02_AI_RESULT_CHANGED','A02_AI_OPINION_VERSION_CHANGED','A02_AI_JOB_CHANGED','ASSET_DETAIL_AI_SOURCE_EXPIRED'].includes(code))return catalogError('AI_BASIS_CHANGED',409,'来源、目标或意见版本已变化，请保留输入并重新核对。');
 if(code==='A02_AI_INPUT_INVALID')return catalogError('INPUT_INVALID',400,'意见内容或提交参数无法核对。');
 return null;
}
export function assetDetailAiProvenance(result,tools){return{runtime:'hub-native-sessions',mode:'fixed-asset-adapter',assetDetailResult:result,assetDetailTools:tools.map(t=>({...t,executor:'adapter',modelRequested:false}))};}
export function assertAssetDetailProviderEvidence(turn,response){if(turn.assetProviderKnown!==true||turn.providerFailure||!response?.usage)throw Error('A02_AI_REAL_PROVIDER_REQUIRED');}
