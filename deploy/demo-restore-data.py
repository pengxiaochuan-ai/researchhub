"""Frozen synthetic snapshot integrity; Python 3.6+, no database connections."""
import decimal
import hashlib
import json
import pathlib
import re

SOURCE_SHA='5508da1d4094fc398cdb118a622b500d101a645f26f8d42f774378ed2776053c'
MANIFEST_SHA='9a9e34001e762b8a2790b29c69e2a45f8306e12a3380178fec911b7e4239cafb'
TENANT='rh-kb-local-b0e2af9d-tenant'

def demand(ok,code):
    if not ok:raise ValueError(code)

def safe_file(root,name):
    demand(isinstance(name,str) and pathlib.Path(name).name==name and '/' not in name and '\\' not in name,'RESTORE_PATH_INVALID')
    p=root/name
    demand(p.is_file() and not p.is_symlink(),'RESTORE_FILE_NOT_REGULAR')
    return p

def ident(value):return '"'+value.replace('"','""')+'"'
def literal(value):return "'"+value.replace("'","''")+"'"
def qualified(t):return ident(t['schema'])+'.'+ident(t['table'])

def unique_object(pairs):
    out={}
    for k,v in pairs:
        demand(k not in out,'RESTORE_DUPLICATE_JSON_KEY');out[k]=v
    return out

def parsed(raw):
    def invalid(_):raise ValueError('RESTORE_NONFINITE_NUMBER')
    return json.loads(raw,parse_int=decimal.Decimal,parse_float=decimal.Decimal,parse_constant=invalid,object_pairs_hook=unique_object)

def canonical(v):
    if v is None:return ['null']
    if isinstance(v,bool):return ['bool',v]
    if isinstance(v,str):return ['string',v]
    if isinstance(v,decimal.Decimal):
        sign,digits,exponent=v.as_tuple();digits=list(digits)
        if not any(digits):return ['number',0,'0',0]
        while digits[-1]==0:digits.pop();exponent+=1
        return ['number',sign,''.join(str(x) for x in digits),exponent]
    if isinstance(v,list):return ['array',[canonical(x) for x in v]]
    if isinstance(v,dict):return ['object',[[k,canonical(v[k])] for k in sorted(v)]]
    raise ValueError('RESTORE_JSON_TYPE_INVALID')

def row_hash(raw):return hashlib.sha256(json.dumps(canonical(parsed(raw)),ensure_ascii=False,separators=(',',':')).encode()).digest()
def table_hash(hashes):return hashlib.sha256(b''.join(sorted(hashes))).hexdigest()

def mapped_row(t,raw):
    if (t['schema'],t['table'])!=('rh_source','pmc_collector_binding'):return raw
    obj=parsed(raw);demand(obj.get('role_name')=='rh_pmc_collector_local','RESTORE_BINDING_ROLE_UNEXPECTED')
    # Match only the field, leaving every other JSON token and number untouched.
    out,n=re.subn(rb'("role_name"\s*:\s*)"rh_pmc_collector_local"',rb'\1"researchhub_demo_pmc_collector"',raw)
    demand(n==1,'RESTORE_BINDING_FIELD_INVALID');return out

def insert_sql(t,rows):
    cols=','.join(ident(x) for x in t['columns'])
    payload='['+','.join(x.decode('utf-8').strip() for x in rows)+']'
    return 'INSERT INTO '+qualified(t)+' ('+cols+') OVERRIDING SYSTEM VALUE SELECT '+cols+' FROM json_populate_recordset(NULL::'+qualified(t)+','+literal(payload)+');\n'

def source_manifest(path):
    raw=path.read_bytes();demand(hashlib.sha256(raw).hexdigest()==MANIFEST_SHA,'RESTORE_MANIFEST_HASH_MISMATCH')
    m=json.loads(raw.decode('utf-8'))
    demand(m.get('sourceSyntheticOnly') is True and m.get('parentClosureVerified') is True and m.get('sourceWrites')==0 and m.get('tenantId')==TENANT and m.get('schemaArchive',{}).get('sha256')==SOURCE_SHA,'RESTORE_SOURCE_REJECTED')
    demand(len(m['tables'])==182 and sum(t['rows'] for t in m['tables'])==98565,'RESTORE_SOURCE_COUNT_CHANGED')
    demand(len(set((t['schema'],t['table']) for t in m['tables']))==182,'RESTORE_DUPLICATE_TABLE')
    for t in m['tables']:
        demand((t['schema']=='public' or t['schema'].startswith('rh_')) and isinstance(t['columns'],list) and t['columns'] and len(set(t['columns']))==len(t['columns']),'RESTORE_TABLE_INVALID')
    return m

def inspect_data(root,manifest):
    expected=[]
    for t in manifest['tables']:
        h=hashlib.sha256();hashes=[];size=0
        with safe_file(root,t['file']).open('rb') as f:
            for raw in f:
                h.update(raw);size+=len(raw)
                obj=parsed(raw);demand(isinstance(obj,dict) and set(obj)==set(t['columns']),'RESTORE_ROW_COLUMNS_MISMATCH')
                hashes.append(row_hash(mapped_row(t,raw)))
        demand(size==t['bytes'] and h.hexdigest()==t['sha256'] and len(hashes)==t['rows'],'RESTORE_PAYLOAD_HASH_OR_COUNT_MISMATCH')
        expected.append({'schema':t['schema'],'table':t['table'],'rows':len(hashes),'sha256':table_hash(hashes)})
    return expected
