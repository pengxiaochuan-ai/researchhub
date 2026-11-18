// A failed current read cancels continuations synchronously, before React effects.
export function createAssetReadBoundary(){
 let revision=0,unavailable=true;const listeners=new Set();
 const refused=()=>Object.assign(new Error('当前资产状态尚未核对，请重新读取后核对原操作。'),{status:503,code:'ASSET_CATALOG_READ_UNAVAILABLE'});
 return{
  ready(){unavailable=false;},blocked:()=>unavailable,
  fail(error){revision++;unavailable=true;const event={authorizationLost:[401,403].includes(error?.status)};for(const listener of listeners)listener(event);},
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  guard(api){return Object.fromEntries(Object.entries(api).map(([name,method])=>[name,typeof method!=='function'?method:async(...args)=>{if(unavailable)throw refused();const token=revision;const result=await method(...args);if(unavailable||token!==revision)throw refused();return result;}]));}
 };
}
