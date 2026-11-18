export const CONTENT_HUB='lingshu-xinyu';
const idPattern=/^[A-Za-z0-9_-]{1,160}$/;
export function academicHref({id,type='all',phase='all',q='',page=1,management=false,status='all'}={}){
 const p=new URLSearchParams(management?{view:'academic-content'}:{hubKey:CONTENT_HUB,section:'updates'});
 if(id!=null){if(!idPattern.test(id))throw Error('内容链接无效。');p.set('contentId',id);}
 if(type!=='all')p.set('type',type);if(management&&status!=='all')p.set('status',status);if(!management&&phase!=='all')p.set('phase',phase);if(q)p.set('q',q);if(management&&page!==1)p.set('page',String(page));
 const path=management?'/pages/g02/':'/pages/h01/';readAcademicRoute(management?'g02':'h01',p.toString());return path+'?'+p;
}
export function readAcademicRoute(page,search=''){
 const p=new URLSearchParams(search),management=page==='g02';if(!['g02','h01'].includes(page))return null;
 if(management&&p.get('view')!=='academic-content'||!management&&!p.has('section')&&!p.has('contentId'))return null;
 const keys=management?['view','contentId','type','status','q','page']:['section','hubKey','contentId','type','phase','q'];
 if([...p.keys()].some(k=>!keys.includes(k)||p.getAll(k).length!==1)||!management&&(p.get('section')!=='updates'||p.has('hubKey')&&p.get('hubKey')!==CONTENT_HUB))throw Error('内容链接无效，请从领域动态或治理入口重新进入。');
 const id=p.get('contentId'),type=p.get('type')??'all',phase=p.get('phase')??'all',status=p.get('status')??'all',q=p.get('q')??'',number=Number(p.get('page')??1);
 if(id!==null&&!idPattern.test(id)||!['all','news','progress','notice','event'].includes(type)||!['all','upcoming','ongoing','past','cancelled'].includes(phase)||!['all','draft','published','withdrawn'].includes(status)||q.length>200||!Number.isSafeInteger(number)||number<1||number>100000)throw Error('内容筛选链接无效。');
 return{id,type,phase,status,q,page:number,management};
}
export function safeAcademicReturn(value){try{if(typeof value!=='string'||/[\\\r\n]/.test(value))return null;const u=new URL(value,'http://academic.local');if(u.origin!=='http://academic.local'||u.hash)return null;const page=u.pathname==='/pages/h01/'?'h01':u.pathname==='/pages/g02/'?'g02':null,route=readAcademicRoute(page,u.search);return route?academicHref(route):null;}catch{return null;}}
