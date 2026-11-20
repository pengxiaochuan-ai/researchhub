// Only DB contract tests create Session IDs in this reserved namespace.
// Normal SessionsService generates its own IDs. Keep test rows for inspection,
// but never let a standing application worker turn them into paid requests.
export function isolateContractTasks(queue){
 if(typeof queue.scopeWhere!=='function')throw Error('KNOWLEDGE_QUEUE_SCOPE_REQUIRED');
 const original=queue.scopeWhere.bind(queue);
 queue.scopeWhere=(...args)=>({AND:[original(...args),{NOT:{sessionId:{startsWith:'rh-aiq-'}}}]});
 return queue;
}
