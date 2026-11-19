import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
export function assertRdsDemoTransport(metadata){
 if(metadata?.tlsStrict?.connected!==true||metadata.tlsStrict.ssl!==true||metadata.tlsStrict.certificateMode!=='strict')throw Error('RDS_TLS_NOT_ADMITTED');
}
export function rdsDemoCapacity(raw,expected){
 const rows=raw?.Items?.DBInstanceAttribute,row=rows?.[0];
 if(!/^pgm-[a-z0-9]+$/.test(expected??'')||!Array.isArray(rows)||rows.length!==1||row?.DBInstanceId!==expected||row.Engine!=='PostgreSQL'||row.DBInstanceStatus!=='Running')throw Error('RDS_CAPACITY_TARGET_UNVERIFIED');
 if(row.DBInstanceDiskUsed==null||row.DBInstanceDiskUsed===''||row.DBInstanceStorage==null)throw Error('RDS_CAPACITY_UNAVAILABLE');
 const totalGiB=Number(row.DBInstanceStorage),used=Number(row.DBInstanceDiskUsed),gib=1024**3,reserve=2*gib;
 if(!Number.isFinite(totalGiB)||totalGiB<=0||!Number.isSafeInteger(used)||used<=0||used>=totalGiB*gib)throw Error('RDS_CAPACITY_UNAVAILABLE');
 const free=totalGiB*gib-used,admitted=free-reserve>=2*gib&&(used+reserve)/(totalGiB*gib)<=0.8;
 return{schema:'hub-rds-capacity.v1',checkedAt:new Date().toISOString(),totalGiB,usedBytes:used,freeBytes:free,reserveBytes:reserve,admitted,changes:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const result=rdsDemoCapacity(JSON.parse(readFileSync(process.argv[2])),process.argv[3]);console.log(JSON.stringify(result));if(!result.admitted)process.exitCode=1;else{assertRdsDemoTransport(JSON.parse(readFileSync(process.argv[4])));}}
 catch(e){console.error(/^RDS_[A-Z_]+$/.test(e.message??'')?e.message:'RDS_CAPACITY_UNAVAILABLE');process.exitCode=1;}
}
