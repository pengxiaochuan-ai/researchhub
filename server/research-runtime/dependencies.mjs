import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const serverRoot=fileURLToPath(new URL('../../../app/server/',import.meta.url));
const require=createRequire(serverRoot+'package.json');
let initialized=false;
export function runtimeDependencies(){
 if(!initialized){
  require('ts-node').register({project:serverRoot+'tsconfig.json',transpileOnly:true});
  require('reflect-metadata');
  initialized=true;
 }
 return {require,load:(path,name)=>require(serverRoot+'src/'+path+'.ts')[name]};
}
