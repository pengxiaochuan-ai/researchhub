export function acceptResearchDataAnalysis(p,{sessionId,planId,studyId}={}){
 const invalid=()=>{throw Error('数据概览无法核对，请重新获取当前结果。');},count=n=>Number.isSafeInteger(n)&&n>=0;
 if(p?.schema!=='hub-data-overview.v1'||!/^[a-f0-9]{64}$/.test(p.packHash??'')||!p.binding||!p.import||sessionId&&p.binding.sessionId!==sessionId||planId&&p.import.id!==planId||studyId&&p.binding.studyId!==studyId||!p.counts||!Object.values(p.counts).every(count)||!Array.isArray(p.fields)||!Array.isArray(p.sources)||!['checks-passed','needs-review','not-evaluated'].includes(p.quality?.status)||!Array.isArray(p.quality?.notEvaluated))invalid();
 for(const f of p.fields){if(typeof f.key!=='string'||typeof f.label!=='string'||!count(f.total)||!count(f.missing)||!count(f.invalid)||f.numeric&&Object.values(f.numeric).some(n=>n!==null&&(typeof n!=='number'||!Number.isFinite(n)))||f.boolean&&!Object.values(f.boolean).every(count))invalid();}
 return p;
}
