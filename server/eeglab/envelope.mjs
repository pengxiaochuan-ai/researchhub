import {open} from 'node:fs/promises';import {createReadStream} from 'node:fs';import {createHash} from 'node:crypto';
export const EEGLAB_MAX_BYTES=500*1024*1024,EEGLAB_SET_MAX_BYTES=100*1024*1024;
const invalid=()=>{throw Object.assign(Error('EEGLAB_ENVELOPE_INVALID'),{code:'EEGLAB_ENVELOPE_INVALID'});};
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function updateCrc32(crc,bytes){for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return crc>>>0;}
export const crc32=bytes=>(updateCrc32(0xffffffff,bytes)^0xffffffff)>>>0;
export function validEeglabName(name){return typeof name==='string'&&Buffer.byteLength(name,'utf8')<=200&&name.length>4&&name===name.trim()&&!/[\x00-\x1f\x7f/\\:"<>|?*]/u.test(name)&&!name.includes('..')&&!/^[. ]|[. ]$/.test(name)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)&&!/[\ud800-\udfff]/u.test(name)&&!/[\x00-\x1f\x7f/\\:]/u.test(name.normalize('NFKC'))&&/\.(set|fdt)$/i.test(name);}
const decoder=new TextDecoder('utf-8',{fatal:true});
async function exact(fd,size,position){const b=Buffer.alloc(size);const {bytesRead}=await fd.read(b,0,size,position);if(bytesRead!==size)invalid();return b;}
export async function inspectEeglabEnvelope(path){
 const fd=await open(path,'r');
 try{
  const stat=await fd.stat(),size=stat.size;if(!stat.isFile()||size<22||size>EEGLAB_MAX_BYTES)invalid();
  const end=await exact(fd,22,size-22);if(end.readUInt32LE(0)!==0x06054b50||end.readUInt16LE(4)!==0||end.readUInt16LE(6)!==0||end.readUInt16LE(20)!==0)invalid();
  const count=end.readUInt16LE(10),centralSize=end.readUInt32LE(12),centralOffset=end.readUInt32LE(16);if(count<1||count>2||end.readUInt16LE(8)!==count||centralOffset+centralSize!==size-22||centralSize>1024)invalid();
  const central=await exact(fd,centralSize,centralOffset),entries=[];let pos=0,localEnd=0;
  for(let i=0;i<count;i++){
   if(pos+46>central.length||central.readUInt32LE(pos)!==0x02014b50||central.readUInt16LE(pos+4)!==20||central.readUInt16LE(pos+6)!==20||central.readUInt16LE(pos+8)!==0x800||central.readUInt16LE(pos+10)!==0||central.readUInt16LE(pos+12)!==0||central.readUInt16LE(pos+14)!==33||central.readUInt16LE(pos+30)!==0||central.readUInt16LE(pos+32)!==0||central.readUInt16LE(pos+34)!==0||central.readUInt16LE(pos+36)!==0||central.readUInt32LE(pos+38)!==0)invalid();
   const crc=central.readUInt32LE(pos+16),bytes=central.readUInt32LE(pos+24),nameSize=central.readUInt16LE(pos+28),offset=central.readUInt32LE(pos+42);if(central.readUInt32LE(pos+20)!==bytes||bytes<1||nameSize<1||nameSize>200||pos+46+nameSize>central.length||offset!==localEnd)invalid();
   const nameBytes=central.subarray(pos+46,pos+46+nameSize);let name;try{name=decoder.decode(nameBytes);}catch{invalid();}if(!validEeglabName(name))invalid();
   const extension=name.slice(name.lastIndexOf('.')+1).toLowerCase();if(extension!==(i===0?'set':'fdt')||extension==='set'&&bytes>EEGLAB_SET_MAX_BYTES)invalid();
   const local=await exact(fd,30,offset);if(local.readUInt32LE(0)!==0x04034b50||local.readUInt16LE(4)!==20||local.readUInt16LE(6)!==0x800||local.readUInt16LE(8)!==0||local.readUInt16LE(10)!==0||local.readUInt16LE(12)!==33||local.readUInt32LE(14)!==crc||local.readUInt32LE(18)!==bytes||local.readUInt32LE(22)!==bytes||local.readUInt16LE(26)!==nameSize||local.readUInt16LE(28)!==0)invalid();
   if(!(await exact(fd,nameSize,offset+30)).equals(nameBytes))invalid();
   const dataOffset=offset+30+nameSize;localEnd=dataOffset+bytes;if(localEnd>centralOffset)invalid();entries.push({name,extension,size:bytes,crc,offset:dataOffset});pos+=46+nameSize;
  }
  if(pos!==central.length||localEnd!==centralOffset||new Set(entries.map(x=>x.name.normalize('NFKC').toLowerCase())).size!==entries.length)invalid();
  const members=[];for(const entry of entries){const sha=createHash('sha256');let crc=0xffffffff,read=0;for await(const b of createReadStream(path,{start:entry.offset,end:entry.offset+entry.size-1,highWaterMark:1024*1024})){sha.update(b);crc=updateCrc32(crc,b);read+=b.length;}if(read!==entry.size||((crc^0xffffffff)>>>0)!==entry.crc)invalid();members.push({name:entry.name,extension:entry.extension,size:entry.size,sha256:sha.digest('hex')});}
  const sha=createHash('sha256');for await(const b of createReadStream(path,{highWaterMark:1024*1024}))sha.update(b);
  return{members,entries,sha256:sha.digest('hex'),byteSize:size};
 }finally{await fd.close();}
}
