import {catalogError} from './research-assets-catalog-contract.mjs';
const invalid=()=>{throw catalogError('INPUT_INVALID',400,'资产请求格式无效，请核对后重试。');};
/** Native parse validates grammar; a bounded walk detects duplicate normalized keys. */
export function parseAssetJson(bytes){
 if(!Buffer.isBuffer(bytes))invalid();if(bytes.length>512*1024)throw catalogError('REQUEST_TOO_LARGE',413,'内容超过请求上限，请改用文件上传；原输入请保留。');
 let text,value;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);value=JSON.parse(text);}catch{invalid();}
 if(!value||typeof value!=='object'||Array.isArray(value))invalid();
 let i=0;
 const space=()=>{while(i<text.length&&/\s/.test(text[i]))i++;};
 function string(){const start=i++;while(i<text.length){if(text[i]==='\\')i+=2;else if(text[i++]==='"')return JSON.parse(text.slice(start,i));}invalid();}
 function walk(depth){
  if(depth>32)invalid();space();
  if(text[i]==='"'){string();return;}
  if(text[i]==='{'){
   i++;space();if(text[i]==='}'){i++;return;}const names=new Set();
   while(i<text.length){space();const name=string();if(names.has(name))invalid();names.add(name);space();i++;walk(depth+1);space();if(text[i++]==='}')return;}
  }else if(text[i]==='['){
   i++;space();if(text[i]===']'){i++;return;}
   while(i<text.length){walk(depth+1);space();if(text[i++]===']')return;}
  }else{while(i<text.length&&!/[\s,}\]]/.test(text[i]))i++;return;}
 }
 walk(0);return value;
}
