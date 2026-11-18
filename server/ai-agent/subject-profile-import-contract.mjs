import { materialDigest } from './session-material-contract.mjs';

// Shape and native field types only. Parsing, clinical ranges and authorization
// remain with the existing native services; no value is inferred or repaired.
export const PROFILE_FIELD_LABELS = Object.freeze({onsetAge:'首发年龄',episodeCount:'发作次数',currentEpisodeMonths:'本次病程（月）',totalEpisodeMonths:'总病程（月）',hospitalizationCount:'住院次数',familyHistory:'家族史',familyHistoryNote:'家族史说明',onMedication:'是否服药',medication:'目前服药',onsetTrigger:'发病诱因',illnessFeature:'病情特点',economicStatus:'经济状况',education:'教育程度',occupation:'职业',ethnicity:'民族',residence:'居住地',maritalStatus:'婚姻状况',collectionDate:'采集日期',dataDate:'数据日期'});
const numeric=new Set(['onsetAge','episodeCount','currentEpisodeMonths','totalEpisodeMonths','hospitalizationCount']);
const integer=new Set(['onsetAge','episodeCount','hospitalizationCount']);
const boolean=new Set(['familyHistory','onMedication']);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(x);
const code=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;
const fail=()=>{throw Object.assign(Error('档案对应或来源已变化，请重新核对。'),{code:'PROFILE_IMPORT_SNAPSHOT_INVALID',status:400});};
const only=(x,keys)=>{if(!x||Array.isArray(x)||![Object.prototype,null].includes(Object.getPrototypeOf(x))||Object.keys(x).some(k=>!keys.includes(k)))fail();};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};

export function compileSubjectProfileConfirmation(input){
 only(input,['source','target','parserRevision','recordBindings','rows','qualityWarnings']);
 const {source,target,parserRevision,recordBindings,rows,qualityWarnings}=input;
 only(source,['tenantId','accountId','authVersion','sessionId','studyGroupId','researchProjectId','preflightId','preflightVersion','previewHash','refs','sheetName']);
 if(['tenantId','accountId','sessionId','studyGroupId','researchProjectId','preflightId'].some(k=>!id(source[k]))||!Number.isSafeInteger(source.authVersion)||source.authVersion<0||!positive(source.preflightVersion)||!hash(source.previewHash)||!Array.isArray(source.refs)||source.refs.length!==1||typeof source.sheetName!=='string'||!source.sheetName.trim()||source.sheetName.length>128)fail();
 for(const ref of source.refs){only(ref,['id','version','sha256']);if(!id(ref.id)||!positive(ref.version)||!hash(ref.sha256))fail();}
 only(target,['studyId','studyGroupId','researchProjectId']);if(Object.keys(target).length!==3||Object.values(target).some(x=>!id(x))||!hash(parserRevision))fail();
 if(!Array.isArray(rows)||!rows.length||rows.length>500)fail();
 const ids=new Set(),codes=new Set();
 for(const row of rows){
  only(row,['subjectId','subjectCode','profileHash','enrollmentHash','values']);
  if(!id(row.subjectId)||!code(row.subjectCode)||ids.has(row.subjectId)||codes.has(row.subjectCode)||!hash(row.profileHash)||!hash(row.enrollmentHash))fail();
  ids.add(row.subjectId);codes.add(row.subjectCode);
  only(row.values,Object.keys(PROFILE_FIELD_LABELS));if(!Object.keys(row.values).length)fail();
  for(const [key,value] of Object.entries(row.values)){
   if(numeric.has(key)){if(typeof value!=='number'||!Number.isFinite(value)||integer.has(key)&&(!Number.isSafeInteger(value)||value< -2147483648||value>2147483647))fail();}
   else if(boolean.has(key)){if(typeof value!=='boolean')fail();}
   else if(typeof value!=='string'||!value.trim()||value.length>10000)fail();
  }
 }
 // Persist record ordinals and pseudonyms only. Raw identity strings are read
 // from the verified workbook when building native options, never stored here.
 if(!Array.isArray(recordBindings)||recordBindings.length>500||recordBindings.length&&recordBindings.length!==rows.length)fail();
 const records=new Set(),destinations=new Set();
 for(const item of recordBindings){only(item,['recordNumber','subjectCode']);if(!positive(item.recordNumber)||item.recordNumber>rows.length||rows[item.recordNumber-1].subjectCode!==item.subjectCode||records.has(item.recordNumber)||destinations.has(item.subjectCode))fail();records.add(item.recordNumber);destinations.add(item.subjectCode);}
 if(!Array.isArray(qualityWarnings)||qualityWarnings.length>20||qualityWarnings.some(x=>typeof x!=='string'||!x.trim()||x.length>500))fail();
 const value=structuredClone({schema:'hub-subject-profile-confirmation.v1',source,target,parserRevision,recordBindings,rows,qualityWarnings});
 if(Buffer.byteLength(JSON.stringify(value))>1024*1024)throw Object.assign(Error('本次档案内容过多，请分批核对；原件仍保留。'),{code:'PROFILE_IMPORT_CAPACITY',status:413});
 return freeze({...value,hash:materialDigest(value)});
}
