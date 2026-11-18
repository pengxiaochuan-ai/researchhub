import {readFileSync} from 'node:fs';

// Fixed, audited instrument content. No arbitrary filename or schema from callers.
const profiles=new Map(['phq9-zh-CN-v1','fang-2023-table5-v1','hamd17-crf-simulation-v1'].map(key=>[key,JSON.parse(readFileSync(new URL(`./source-profiles/${key}.json`,import.meta.url),'utf8'))]));
export function getSourceFormProfile(key){
 if(!profiles.has(key))throw new Error('SOURCE_FORM_UNKNOWN');
 return structuredClone(profiles.get(key));
}
