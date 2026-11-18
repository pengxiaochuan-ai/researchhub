import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePublicationFilters,matchesPublicationFilters,publicationFacets} from '../src/publication-filters.js';
const sample=(id,values,year=2026)=>({id,year,classification:{values},body:null});
test('same group OR, across groups AND; unclassified is separately selectable',()=>{
 const filters=normalizePublicationFilters({types:['review','original'],designs:['rct']});
 assert(matchesPublicationFilters(sample('a',{types:['original'],designs:['rct']}),filters));
 assert(!matchesPublicationFilters(sample('b',{types:['original'],designs:[]}),filters));
 assert(matchesPublicationFilters(sample('c',{}),normalizePublicationFilters({types:['unknown']})));
});
test('facets count full eligible universe excluding own group, not just returned page',()=>{
 const rows=[sample('a',{types:['original'],designs:['rct']}),sample('b',{types:['review'],designs:[]}),sample('c',{types:['original'],designs:[]})];
 const f=publicationFacets(rows,normalizePublicationFilters({types:['original']}));
 assert.equal(f.types.review,1);assert.equal(f.types.original,2);assert.equal(f.designs.rct,1);assert.equal(f.designs.unknown,1);
});
test('year ranges, real date validation, partial date precision and strict bounds',()=>{
 assert(matchesPublicationFilters(sample('a',{},2024),normalizePublicationFilters({year:'3'}),2026));
 assert(!matchesPublicationFilters(sample('a',{},2023),normalizePublicationFilters({year:'3'}),2026));
 const f=normalizePublicationFilters({year:'custom',from:'2026-06-01',to:'2026-12-31'});
 assert(!matchesPublicationFilters(sample('yearOnly',{}),f,2026));
 assert(matchesPublicationFilters({...sample('date',{}),classification:{values:{},publicationDate:'2026-07-01'}},f,2026));
 for(const value of [{year:'custom',from:'2026-02-30'},{year:'custom',from:'2026-12-01',to:'2026-01-01'},{types:['invented']},{extra:true},{types:'original'}])assert.throws(()=>normalizePublicationFilters(value),e=>e.status===400);
});
