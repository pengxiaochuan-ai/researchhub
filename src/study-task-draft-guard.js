// A read may replace form state only if no editing occurred after it began.
export function canApplyTaskRead({startedRevision,currentRevision,startedSelection,currentSelection}){
 return startedRevision===currentRevision&&startedSelection===currentSelection;
}
export function rebaseTaskSubmission(pending,latest){
 if(!latest||pending.taskId!==latest.id||!Number.isSafeInteger(latest.version))throw new Error('请先重新核对当前任务版本');
 // Called ONLY by the user's explicit conflict confirmation, never by polling.
 return {...pending,input:{...pending.input,requestKey:crypto.randomUUID(),expectedVersion:latest.version}};
}
