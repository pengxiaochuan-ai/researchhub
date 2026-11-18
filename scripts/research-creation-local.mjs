// Compatibility entry: one public local site, existing accounts and runtime.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

export function resolveLocalResearchLaunch(args){
 if(args.length)assert.deepEqual(args,['--mode','local-synthetic'],'Use the shared19501 runtime; separate fixture instances are retired.');
 return{script:fileURLToPath(new URL('./local-knowledge.mjs',import.meta.url)),url:'http://127.0.0.1:19501/pages/q02/'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const launch=resolveLocalResearchLaunch(process.argv.slice(2));
 execFileSync(process.execPath,[launch.script,'start'],{stdio:'inherit'});
 console.log('ResearchHub：'+launch.url);
}
