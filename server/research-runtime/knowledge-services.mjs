import {createRuntimeDocExtractor} from './knowledge-parser.mjs';
import {disabledEmbeddings} from './worker-lifecycle.mjs';

// The same native graph owns KB creation, upload, parsing, review and retrieval
// in the existing local process and the deployed API. Only endpoints differ.
export function createKnowledgeServices({load,require,prisma,storage,scope,embeddingMode,parserConfigured}){
 if(!['service','keyword-only'].includes(embeddingMode))throw Error('KNOWLEDGE_EMBEDDING_CONFIGURATION_REQUIRED');
 const Native=(path,name)=>load('knowledge/'+path,name);
 const embedding=embeddingMode==='service'?new(Native('embedding.service','EmbeddingService'))():disabledEmbeddings();
 const ingestion=new(Native('ingestion.service','IngestionService'))(prisma,embedding);
 const retrieval=new(Native('retrieval.service','RetrievalService'))(prisma,embedding);
 const grounding=new(Native('grounding.service','GroundingService'))(retrieval);
 const extract=createRuntimeDocExtractor({Native:Native('doc-extract.service','DocExtractService'),PDFParse:require('pdf-parse').PDFParse,resolveMetadata:Native('knowledge-literature-metadata','resolveLiteratureMetadata'),parserConfigured});
 const queue=new(Native('knowledge-import.service','KnowledgeImportService'))(prisma,storage,extract,ingestion,scope);
 const knowledge=new(Native('knowledge.service','KnowledgeService'))(prisma,ingestion,grounding,extract,queue,storage);
 const tools=new(Native('kb-tools.service','KbToolsService'))(knowledge,storage);
 return{embedding,ingestion,retrieval,grounding,extract,queue,knowledge,tools};
}
