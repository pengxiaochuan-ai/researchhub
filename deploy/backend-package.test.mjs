import test from'node:test';import assert from'node:assert/strict';import{nativePrismaSchema}from'./backend-package.mjs';
test('Linux package adapts only the private generator target, preserving database model semantics',()=>{
 const source='generator client {\n provider = "prisma-client-js"\n binaryTargets = ["windows","darwin-arm64"]\n}\ndatasource db { provider = "postgresql" }\nmodel Synthetic { id String @id }';
 const result=nativePrismaSchema(source);assert(result.includes('binaryTargets = ["native"]'));assert.equal(result.replace('binaryTargets = ["native"]','binaryTargets = ["windows","darwin-arm64"]'),source);
 assert.throws(()=>nativePrismaSchema('model Synthetic {id String @id}'),/BACKEND_PRISMA_GENERATOR_REJECTED/);
 assert.throws(()=>nativePrismaSchema(source+source),/BACKEND_PRISMA_GENERATOR_REJECTED/);
});
