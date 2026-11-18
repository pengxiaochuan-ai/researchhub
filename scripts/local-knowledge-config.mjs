import assert from 'node:assert/strict';

export function assertLocalScope(ids, tenant, group, project) {
  assert.ok(tenant === ids.tenant && (!group || group === ids.group) && (!project || project === ids.project), 'LOCAL_SCOPE_REJECTED');
}

export function assertOwnProcess(state, observed) {
  assert.ok(state?.pid > 1 && observed?.pid === state.pid && observed.started === state.started && observed.command.includes('local-knowledge.mjs serve ' + state.key), 'LOCAL_PROCESS_IDENTITY_REJECTED');
}

export function allowedFetchUrl(url) {
  return ['http://127.0.0.1:19503/extract', 'http://127.0.0.1:19504/embed', 'http://127.0.0.1:19505/v1/execute'].includes(String(url));
}

export async function stopOwnedChildren(children, graceMs = 5000) {
  await Promise.all(children.map(async child => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, graceMs);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.kill('SIGTERM');
    });
  }));
}

export function guardViteSignalOwnership(vite, owners, processImpl=process){
 const clean=()=>{for(const handler of processImpl.listeners('SIGTERM'))if(!owners.has(handler))processImpl.off('SIGTERM',handler);};
 clean();
 let restart=vite.restart.bind(vite);
 const guarded=async(...args)=>{try{return await restart(...args);}finally{if(vite.restart!==guarded)restart=vite.restart.bind(vite);vite.restart=guarded;clean();}};
 vite.restart=guarded;
}
