const id=value=>/^[A-Za-z0-9_-]{1,160}$/.test(value??'');
export function safeHubAssetReturn(value){
 if(typeof value!=='string'||!value.startsWith('/pages/')||/[\\\r\n]/.test(value))return null;
 let u;try{u=new URL(value,'http://hub-assets.local');}catch{return null;}
 if(u.origin!=='http://hub-assets.local'||u.hash)return null;
 const p=u.searchParams;
 if(u.pathname==='/pages/h01/'&&p.get('section')==='assets'){
  if([...p.keys()].some(k=>!['section','hubKey','assetEntry','copyId'].includes(k)||p.getAll(k).length!==1)||p.has('hubKey')&&p.get('hubKey')!=='lingshu-xinyu'||['assetEntry','copyId'].some(k=>p.has(k)&&!id(p.get(k))))return null;
  return u.pathname+u.search;
 }
 if(u.pathname==='/pages/g02/'&&p.get('view')==='hub-assets'&&p.size===1)return u.pathname+u.search;
 return null;
}
