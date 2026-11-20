import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
test('root entry replaces history with a fixed portal path while preserving query and anchor',()=>{
 for(const [search,hash] of [['',''],['?source=home','#process'],['?returnTo=https%3A%2F%2Fexample.invalid%2F','#join']]){
  const calls=[];runInNewContext(script,{window:{location:{search,hash,replace:target=>calls.push(target)}}});
  assert.deepEqual(calls,['/pages/p002/'+search+hash]);
 }
});
test('root provides a fixed no-JavaScript portal fallback',()=>{
 assert.match(html,/<noscript><meta http-equiv="refresh" content="0; url=\/pages\/p002\/" \/><\/noscript>/);
 assert.doesNotMatch(html,/pages\/p00\//);
});
