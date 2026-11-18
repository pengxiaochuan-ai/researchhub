// Read-only bridge to the original D01 hash, not a replacement baseline or a migration.
import {readCatalogDefinitionRows} from './research-assets-catalog-schema.mjs';
import {proveLegacyCatalogOrder,stableCatalogDigest} from './research-assets-fingerprint-proof.mjs';
import {installAccountReceipt} from '../server/governance-users/account-receipt-schema.mjs';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const approvedMarker='researchhub-account-receipt-v1:017be0745d00603d0c7923e2eb8503235f1d86d63c093c20c4a51717968ba278';
export function approvedReceiptDefinition(tenantId){
 const sql=readFileSync(new URL('../server/governance-users/account-receipt.sql',import.meta.url),'utf8').replaceAll('__TENANT__',tenantId);
 if('researchhub-account-receipt-v1:'+createHash('sha256').update(sql).digest('hex')!==approvedMarker)throw Error('CATALOG_ADDITION_SOURCE_DRIFT');
 return 'CREATE OR REPLACE FUNCTION public.researchhub_read_account_receipt(p_tenant text, p_actor text, p_auth_version integer, p_request_key text)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO \'pg_catalog\'\nAS $function$'+sql.split('$$')[1]+'$function$\n';
}
export function assertApprovedReceiptRow(row,tenantId){
 const allowed=['aisci_app=X/aisci_owner','aisci_owner=X/aisci_owner'];
 if(row?.definition?.sql!==approvedReceiptDefinition(tenantId)||typeof row.definition.acl!=='string'||JSON.stringify(row.definition.acl.slice(1,-1).split(',').sort())!==JSON.stringify(allowed))throw Error('CATALOG_ADDITION_ROW_DRIFT');
}
export async function verifyAssetPublicBaseline(tx,{tenantId,expectedHash}){
 // Reuse the existing exact verifier, but make its install branch impossible even outside READ ONLY.
 const readOnly=new Proxy(tx,{get(t,key){if(typeof key==='string'&&/^\$execute/.test(key))return()=>{throw Error('CATALOG_BASELINE_NO_DDL');};return t[key];}});
 const receipt=await installAccountReceipt(readOnly,{tenantId});
 if(receipt.applied!==false||receipt.marker!==approvedMarker)throw Error('CATALOG_ADDITION_NOT_APPROVED');
 const legacy=await readCatalogDefinitionRows(tx,'public'),extra=legacy.filter(r=>r.kind==='function'&&r.name.startsWith('researchhub_read_account_receipt('));
 if(extra.length!==1)throw Error('CATALOG_ADDITION_IDENTITY_INVALID');
 assertApprovedReceiptRow(extra[0],tenantId);
 const proof=proveLegacyCatalogOrder(legacy.filter(r=>r!==extra[0]),expectedHash);
 if(!proof.matched)throw Error('CATALOG_PUBLIC_CONTENT_DRIFT');
 const full=await readCatalogDefinitionRows(tx,'public',{fullNames:true});
 return{schemaVersion:'rh-asset-public-baseline-proof.v2',legacyHash:expectedHash,proof,approvedAddition:{signature:receipt.signature,marker:receipt.marker},fullDefinitionHash:stableCatalogDigest(full),fullRows:full.length,noDdl:true};
}
