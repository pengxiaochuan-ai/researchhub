import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLocalScope, assertOwnProcess, allowedFetchUrl, stopOwnedChildren, guardViteSignalOwnership } from './local-knowledge-config.mjs';
import {EventEmitter} from 'node:events';

test('Vite initial load and configuration restarts retain only the runtime shutdown owner',async()=>{
 const signals=new EventEmitter(),owner=()=>{},foreign=()=>{},owned=new Set([owner]);signals.on('SIGTERM',owner);signals.on('SIGTERM',foreign);
 let restarted=0;const vite={restart:async value=>{restarted++;signals.on('SIGTERM',foreign);return value;}};
 guardViteSignalOwnership(vite,owned,signals);assert.deepEqual(signals.listeners('SIGTERM'),[owner]);assert.equal(await vite.restart('result'),'result');assert.equal(restarted,1);assert.deepEqual(signals.listeners('SIGTERM'),[owner]);
});
test('signal ownership survives Vite replacing its restart implementation',async()=>{
 const signals=new EventEmitter(),owner=()=>{},foreign=()=>{};signals.on('SIGTERM',owner);
 const vite={async restart(){signals.on('SIGTERM',foreign);this.restart=async()=>signals.on('SIGTERM',foreign);}};
 guardViteSignalOwnership(vite,new Set([owner]),signals);await vite.restart();await vite.restart();assert.deepEqual(signals.listeners('SIGTERM'),[owner]);
});
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const ids = { tenant:'rh-kb-local-abcdef12-tenant', group:'rh-kb-local-abcdef12-group', project:'rh-kb-local-abcdef12-project' };
test('accepts only own tenant and optional real group/project', () => {
  assert.doesNotThrow(()=>assertLocalScope(ids,ids.tenant));
  assert.doesNotThrow(()=>assertLocalScope(ids,ids.tenant,ids.group,ids.project));
  for(const args of [['clinical'],[ids.tenant,'other'],[ids.tenant,ids.group,'other']]) assert.throws(()=>assertLocalScope(ids,...args));
});
test('stop refuses missing, reused or unrelated PID identities', () => {
  const state={pid:123,started:'Thu Oct 22 10:00:00 2026',key:'rh-kb-local-abcdef12'};
  const command='/usr/local/bin/node /repo/local-knowledge.mjs serve '+state.key;
  assert.doesNotThrow(()=>assertOwnProcess(state,{pid:123,started:state.started,command}));
  for(const observed of [null,{pid:456,started:state.started,command},{pid:123,started:'different',command},{pid:123,started:state.started,command:'old-server'}]) assert.throws(()=>assertOwnProcess(state,observed));
});
test('fetch allowlist excludes cloud, redirects, metadata and old service ports', () => {
  assert.equal(allowedFetchUrl('http://127.0.0.1:19503/extract'),true);
  assert.equal(allowedFetchUrl('http://127.0.0.1:19504/embed'),true);
  assert.equal(allowedFetchUrl('http://127.0.0.1:19505/v1/execute'),true);
  for(const url of ['https://api.deepseek.com','http://127.0.0.1:8200/extract','http://169.254.169.254/','http://127.0.0.1:19503/extract?url=cloud','http://127.0.0.1:19504/other','http://127.0.0.1:19505/v1/execute?url=cloud','http://127.0.0.1:8210/v1/execute']) assert.equal(allowedFetchUrl(url),false);
});
test('shutdown waits for actual child exit, escalating only a still-owned child', async () => {
  const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)"],{stdio:['ignore','pipe','ignore']});
  await once(child.stdout,'data');
  try{await stopOwnedChildren([child],100);assert.ok(child.exitCode!==null||child.signalCode!==null);assert.throws(()=>process.kill(child.pid,0));}
  finally{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
});
