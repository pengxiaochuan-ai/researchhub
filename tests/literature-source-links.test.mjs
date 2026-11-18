import test from 'node:test';import assert from 'node:assert/strict';import * as links from '../src/literature-source-links.js';
test('trusted source area renders canonical live PubMed and appropriate Hub links, not model markdown URLs',()=>{
 const sources=links.literatureSourceLinks({selected:[{id:'P1',kind:'pubmed-live',pmid:'35168522',title:'Public',sourceUrl:'https://evil.example'},{id:'H1',kind:'hub-reviewed',externalDocumentId:'rhed-a',title:'Guideline',sourceUrl:'https://example.org/guideline'},{id:'H2',kind:'hub-reviewed',pmcRecordId:'pmc-PMC123',title:'Hub'}]});
 assert.equal(sources[0].href,'https://pubmed.ncbi.nlm.nih.gov/35168522/');assert.equal(sources[1].href,'https://example.org/guideline');assert.equal(sources[2].href,'/pages/e02/?recordId=pmc-PMC123');
 assert.equal(links.literatureSourceLinks({selected:[{id:'x',kind:'pubmed-live',pmid:'javascript:bad',title:'Bad'}]})[0].href,null);
});
