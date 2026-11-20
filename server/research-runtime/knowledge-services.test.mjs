import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeServices} from './knowledge-services.mjs';
test('both launchers share one native upload/retrieval/service assembly',()=>{
 const classes=new Map();const load=(_path,name)=>{if(name==='resolveLiteratureMetadata')return()=>({});if(!classes.has(name))classes.set(name,class{constructor(...args){this.args=args;}});return classes.get(name);};
 const prisma={},storage={},scope={};const require=()=>({PDFParse:class{}});
 const services=createKnowledgeServices({load,require,prisma,storage,scope,embeddingMode:'service',parserConfigured:true});
 assert.deepEqual(services.retrieval.args,[prisma,services.embedding]);assert.deepEqual(services.ingestion.args,[prisma,services.embedding]);
 assert.deepEqual(services.grounding.args,[services.retrieval]);assert.deepEqual(services.queue.args,[prisma,storage,services.extract,services.ingestion,scope]);
 assert.deepEqual(services.knowledge.args,[prisma,services.ingestion,services.grounding,services.extract,services.queue,storage]);
 assert.deepEqual(services.tools.args,[services.knowledge,storage]);
});
