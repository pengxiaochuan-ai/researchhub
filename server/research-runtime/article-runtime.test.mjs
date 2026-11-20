import test from'node:test';import assert from'node:assert/strict';import{createRuntimeArticle}from'./article-runtime.mjs';
test('article assembly requires its explicit authoritative storage binding before constructing services',()=>{assert.throws(()=>createRuntimeArticle({config:{scope:{defaultTenantId:'tenant'}}}),/ARTICLE_SOURCE_READER_REQUIRED/);});
