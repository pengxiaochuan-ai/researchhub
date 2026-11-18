import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {MATERIAL_MULTIPART_LIMITS} from '../../scripts/local-session-materials.mjs';
const require=createRequire(new URL('../../../app/server/package.json',import.meta.url));
const multer=require('multer');

test('native multipart accepts one request key and one file without allowing additional fields or files',async()=>{
  const upload=multer({storage:multer.memoryStorage(),limits:MATERIAL_MULTIPART_LIMITS}).single('file');
  const server=createServer((req,res)=>upload(req,res,error=>{
    res.writeHead(error?400:201,{'Content-Type':'application/json'});
    res.end(JSON.stringify(error?{code:error.code}:{key:req.body.requestKey,bytes:req.file.size}));
  }));
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    for(const [extra,status] of [[null,201],['field',400],['file',400]]){
      const form=new FormData();form.append('requestKey','synthetic-multipart-key');
      form.append('file',new Blob(['synthetic only']), 'material.txt');
      if(extra==='field')form.append('extra','unexpected');
      if(extra==='file')form.append('file',new Blob(['another']), 'another.txt');
      const response=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',body:form});
      const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));
      if(!extra)assert.deepEqual(body,{key:'synthetic-multipart-key',bytes:14});
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
});
