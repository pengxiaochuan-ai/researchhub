// JSONB key order is not a user edit. Arrays still keep their meaningful order.
export function sameTeamDraft(a,b){
 const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 return canonical(a)===canonical(b);
}
