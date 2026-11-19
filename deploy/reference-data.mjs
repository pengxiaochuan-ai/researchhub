import {REFERENCE_ROWS,DATASET_VERSION,SOURCE_URL,SOURCE_SHA256,referenceHash} from '../server/reference/divisions.mjs';

const quote=value=>value===null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
export const referenceDataReceipt=Object.freeze({version:DATASET_VERSION,rows:REFERENCE_ROWS.length,sourceUrl:SOURCE_URL,sourceSha256:SOURCE_SHA256,rowsSha256:referenceHash(REFERENCE_ROWS)});

// Explicit operator operation, never a runtime-start hook. Caller must first
// verify the target identity/marker just as for a migration. Existing complete
// data is idempotent; partial, extra or changed data is an error, not a repair.
export function referenceDataSql(){
 const expected=REFERENCE_ROWS.map(r=>'('+[DATASET_VERSION,r.code,r.name,r.sourceName,r.parentCode,r.level,SOURCE_URL,SOURCE_SHA256].map(quote).join(',')+')').join(',\n');
 return `BEGIN;
LOCK TABLE rh_reference.administrative_division IN EXCLUSIVE MODE;
CREATE TEMP TABLE rh_expected_division (LIKE rh_reference.administrative_division INCLUDING DEFAULTS) ON COMMIT DROP;
INSERT INTO rh_expected_division(dataset_version,code,name,source_name,parent_code,level,source_url,source_sha256) VALUES ${expected};
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM rh_reference.administrative_division) AND (
  EXISTS((SELECT dataset_version,code,name,source_name,parent_code,level,source_url,source_sha256 FROM rh_reference.administrative_division) EXCEPT (SELECT dataset_version,code,name,source_name,parent_code,level,source_url,source_sha256 FROM rh_expected_division)) OR
  EXISTS((SELECT dataset_version,code,name,source_name,parent_code,level,source_url,source_sha256 FROM rh_expected_division) EXCEPT (SELECT dataset_version,code,name,source_name,parent_code,level,source_url,source_sha256 FROM rh_reference.administrative_division))
 ) THEN RAISE EXCEPTION 'REFERENCE_DATA_MISMATCH'; END IF;
END $$;
INSERT INTO rh_reference.administrative_division(dataset_version,code,name,source_name,parent_code,level,source_url,source_sha256)
SELECT dataset_version,code,name,source_name,parent_code,level,source_url,source_sha256 FROM rh_expected_division
WHERE NOT EXISTS(SELECT 1 FROM rh_reference.administrative_division);
COMMIT;`;
}
