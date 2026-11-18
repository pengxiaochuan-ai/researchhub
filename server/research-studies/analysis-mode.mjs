/** The legacy UI remains discoverable even when no simulation factory is installed. */
export function readAnalysisMode({analysis,studies,user,studyId}){
 if(typeof analysis?.configuration==='function')return analysis.configuration(user,studyId);
 return studies.withResearchStudyTransaction(user,studyId,'read',async()=>({studyId,schemaVersion:'t15-synthetic-plan-v1'}));
}
