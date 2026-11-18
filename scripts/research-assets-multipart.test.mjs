import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createAssetRegistrationController} from './local-research-assets-registration-controller.mjs';
const oldRequire=createRequire(new URL('../../app/server/package.json',import.meta.url)),platformRequire=createRequire(oldRequire.resolve('@nestjs/platform-express/package.json'));
const express=platformRequire('express'),multer=platformRequire('multer');
test('actual installed multipart parser accepts one file plus one request key and still refuses extra fields/files',async()=>{
 let configured;const no=()=>()=>{};
 const require=name=>name==='@nestjs/platform-express'?{FileInterceptor:(_name,options)=>{configured=options;return()=>{};}}:new Proxy({},{get:()=>no});
 createAssetRegistrationController({root:'/test/',require,registration:{},uploads:{}});
 const app=express();app.post('/upload',multer(configured).single('file'),(req,res)=>res.json({filename:req.file.originalname,requestKey:req.body.requestKey}));app.use((err,_req,res,_next)=>res.status(400).json({code:err.code}));
 const server=createServer(app);server.listen(0,'127.0.0.1');await once(server,'listening');const url='http://127.0.0.1:'+server.address().port+'/upload';
 const make=()=>{const f=new FormData();f.append('file',new File(['原创合成资料'],'synthetic.txt',{type:'text/plain'}));f.append('requestKey','multipart-synthetic-key');return f;};
 try{
  const good=await fetch(url,{method:'POST',body:make()});assert.equal(good.status,200,JSON.stringify(await good.clone().json()));assert.equal((await good.json()).requestKey,'multipart-synthetic-key');
  const extraField=make();extraField.append('another','not-permitted');assert.equal((await fetch(url,{method:'POST',body:extraField})).status,400);
  const extraFile=make();extraFile.append('file',new File(['second'],'second.txt'));assert.equal((await fetch(url,{method:'POST',body:extraFile})).status,400);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
