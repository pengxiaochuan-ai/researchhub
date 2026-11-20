// One deterministic, uncompressed source. Original members are never rewritten.
const encoder=new TextEncoder(),MAX=500*1024*1024,SET_MAX=100*1024*1024;
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export const isEeglabSelection=files=>files.some(f=>/\.(set|fdt)$/i.test(f.name??''));
export function validEeglabName(name){
 return typeof name==='string'&&encoder.encode(name).length<=200&&!/[\x00-\x1f\x7f/\\:"<>|?*]/u.test(name)&&!name.includes('..')&&name===name.trim()&&!/^[. ]|[. ]$/.test(name)&&! /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)&&!/[\ud800-\udfff]/u.test(name)&&!/[\x00-\x1f\x7f/\\:]/u.test(name.normalize('NFKC'))&&/\.(set|fdt)$/i.test(name);
}
function header(size){const bytes=new Uint8Array(size);return{bytes,view:new DataView(bytes.buffer)};}
export async function createEeglabEnvelope(files,{current=async()=>true,onChecking=()=>{}}={}){
 const check=async()=>{if(!await current())throw Error('会话或上传权限已变化，请重新核对后选择原文件组。');};
 await check();
 const selected=[...files].sort((a,b)=>Number(/\.fdt$/i.test(a.name))-Number(/\.fdt$/i.test(b.name)));
 if(selected.length<1||selected.length>2||!selected.every(f=>validEeglabName(f.name)&&Number.isSafeInteger(f.size)&&f.size>0)||! /\.set$/i.test(selected[0].name)||selected.length===2&&! /\.fdt$/i.test(selected[1].name))throw Error('请一次选择一份SET，以及它需要的配套FDT；不接受其他文件、重复SET或路径文件名。');
 const names=selected.map(f=>encoder.encode(f.name));
 if(selected[0].size>SET_MAX||selected.reduce((n,f,i)=>n+f.size+76+2*names[i].length,22)>MAX)throw Error('SET不超过100MiB，完整EEGLAB文件组不超过500MiB，请在EEGLAB核对后重新导出。');
 onChecking();const local=[],central=[];let offset=0;
 for(const [i,file]of selected.entries()){
  let crc=0xffffffff;
  for(let at=0;at<file.size;at+=1024*1024){await check();const bytes=new Uint8Array(await file.slice(at,at+1024*1024).arrayBuffer());for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);}
  await check();crc=(crc^0xffffffff)>>>0;const name=names[i],l=header(30),c=header(46);
  l.view.setUint32(0,0x04034b50,true);l.view.setUint16(4,20,true);l.view.setUint16(6,0x800,true);l.view.setUint16(12,33,true);l.view.setUint32(14,crc,true);l.view.setUint32(18,file.size,true);l.view.setUint32(22,file.size,true);l.view.setUint16(26,name.length,true);
  c.view.setUint32(0,0x02014b50,true);c.view.setUint16(4,20,true);c.view.setUint16(6,20,true);c.view.setUint16(8,0x800,true);c.view.setUint16(14,33,true);c.view.setUint32(16,crc,true);c.view.setUint32(20,file.size,true);c.view.setUint32(24,file.size,true);c.view.setUint16(28,name.length,true);c.view.setUint32(42,offset,true);
  local.push(l.bytes,name,file);central.push(c.bytes,name);offset+=30+name.length+file.size;
 }
 const end=header(22),centralSize=central.reduce((n,b)=>n+b.length,0);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,selected.length,true);end.view.setUint16(10,selected.length,true);end.view.setUint32(12,centralSize,true);end.view.setUint32(16,offset,true);
 await check();return new File([...local,...central,end.bytes],'eeglab-originals.eeglab',{type:'application/zip',lastModified:0});
}
