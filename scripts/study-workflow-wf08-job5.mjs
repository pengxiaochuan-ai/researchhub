// Dedicated Job5 entry; only the two named root-negative cases share the fixed actual runner.
import {pathToFileURL} from 'node:url';
import {runNegativeMain} from './study-workflow-wf08-job4.mjs';
export const main=(args=process.argv.slice(2),env=process.env)=>runNegativeMain('Job5',args,env);
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)main().catch(error=>{console.error(JSON.stringify({passed:false,code:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:null}));process.exitCode=1;});
