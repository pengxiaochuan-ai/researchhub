import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export function stableCatalogDigest(rows){
 const compare=(a,b)=>a<b?-1:a>b?1:0;
 const sorted=rows.map(canonical).sort((a,b)=>compare(a.kind,b.kind)||compare(a.name,b.name));
 if(new Set(sorted.map(r=>JSON.stringify([r.kind,r.name]))).size!==sorted.length)throw Error('CATALOG_FULL_IDENTITY_REQUIRED');
 return sha(sorted);
}
export function proveLegacyCatalogOrder(input,expected){
 const rows=input.map(r=>({...r})),groups=[];let bound=1;
 for(let i=0;i<rows.length;){let j=i+1;while(j<rows.length&&rows[j].kind===rows[i].kind&&rows[j].name===rows[i].name)j++;
  if(j-i>1){let factorial=1;for(let k=2;k<=j-i;k++){factorial*=k;if(factorial>4096)throw Error('CATALOG_PROOF_BOUND');}bound*=factorial;if(bound>4096)throw Error('CATALOG_PROOF_BOUND');groups.push({start:i,size:j-i});}i=j;
 }
 const permutations=a=>a.length<2?[a]:a.flatMap((v,i)=>permutations(a.filter((_,k)=>i!==k)).map(p=>[v,...p]));
 const choices=groups.map(g=>permutations(rows.slice(g.start,g.start+g.size)));let attempts=0,matched=false;
 function walk(n){if(matched)return;if(n===groups.length){attempts++;matched=sha(rows)===expected;return;}const g=groups[n];for(const p of choices[n]){rows.splice(g.start,g.size,...p);walk(n+1);if(matched)return;}}
 walk(0);return{matched,attempts,maxPermutations:bound,tiedGroups:groups.length,rows:rows.length};
}
