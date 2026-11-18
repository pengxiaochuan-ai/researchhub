// Each category remains atomic, but an unrelated slow category cannot hold it back.
export async function loadGovernanceResults({kinds,load,onUpdate,signal}){
 let result=Object.fromEntries(kinds.map(kind=>[kind,{state:'loading',items:[]}]));
 onUpdate(result);
 await Promise.all(kinds.map(async kind=>{
  let value;
  try{signal?.throwIfAborted();const items=await load(kind);signal?.throwIfAborted();value={state:'ready',items};}
  catch(error){value={state:[401,403].includes(error.status)?'denied':'error',items:[]};}
  result={...result,[kind]:value};onUpdate(result);
 }));
 return result;
}
