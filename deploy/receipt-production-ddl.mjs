import {readFileSync} from 'node:fs';
const source=name=>readFileSync(new URL('../server/'+name,import.meta.url),'utf8');
const exact=(sql,old,value)=>{if(sql.split(old).length!==2)throw Error('RECEIPT_PRODUCTION_SCHEMA_DRIFT');return sql.replace(old,value);};
export function receiptProductionStatements(){
 let account=source('governance-users/account-receipt.sql');
 account=exact(account,"p_tenant IS NULL OR p_tenant <> '__TENANT__'","p_tenant IS NULL");
 account=exact(account,'JOIN public.tenant t ON t.id=a."tenantId"','JOIN public.tenant t ON t.id=a."tenantId" JOIN rh_hub.hub h ON h.tenant_id=t.id AND h.hub_key=\'lingshu-xinyu\' AND h.status=\'active\'');
 account=exact(account,'FOR SHARE OF a,t;','FOR SHARE OF a,t,h;');
 let review=source('hub-sources/review-receipt-read.sql');
 review=exact(review,"IF p_tenant IS DISTINCT FROM current_setting('app.tenant_id',true)\n     OR p_tenant <> '__TENANT__' OR p_hub <> 'lingshu-xinyu'\n     OR p_account <> '__REVIEWER__' OR p_account IS NULL OR p_auth_version IS NULL",`IF p_tenant IS NULL OR p_tenant IS DISTINCT FROM current_setting('app.tenant_id',true)
     OR p_hub IS NULL OR p_hub <> 'lingshu-xinyu'
     OR p_account IS NULL OR p_account IS DISTINCT FROM current_setting('app.account_id',true)
     OR p_auth_version IS NULL OR p_auth_version<0 OR p_auth_version::text IS DISTINCT FROM current_setting('app.auth_version',true)`);
 review=exact(review,'JOIN public.tenant t ON t.id=a."tenantId"','JOIN public.tenant t ON t.id=a."tenantId" JOIN rh_hub.hub h ON h.tenant_id=t.id AND h.hub_key=p_hub AND h.status=\'active\'');
 review=exact(review,'FOR SHARE OF a,t;','FOR SHARE OF a,t,h;');
 return [account.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'),review.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'),
  'ALTER FUNCTION public.researchhub_read_account_receipt(text,text,integer,text) OWNER TO aisci_owner',
  'ALTER FUNCTION rh_source.read_review_receipt(text,text,text,integer,text,text) OWNER TO aisci_owner',
  'REVOKE ALL ON FUNCTION public.researchhub_read_account_receipt(text,text,integer,text) FROM PUBLIC',
  'REVOKE ALL ON FUNCTION rh_source.read_review_receipt(text,text,text,integer,text,text) FROM PUBLIC',
  'GRANT EXECUTE ON FUNCTION public.researchhub_read_account_receipt(text,text,integer,text) TO aisci_app',
  'GRANT EXECUTE ON FUNCTION rh_source.read_review_receipt(text,text,text,integer,text,text) TO aisci_app'];
}
