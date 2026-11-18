"""Offline only: freeze new benchmark inputs, invoke the original oracle, bind provenance."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys
import argparse

ROOT=Path('/Users/mac/aisciencesys')
RH=ROOT/'researchhub'
parser=argparse.ArgumentParser(description='Offline only: verify this task after39 using a fresh read-only audit export.')
parser.add_argument('--local-synthetic',action='store_true',required=True)
parser.add_argument('--phase',choices=('pre-review','final'),required=True)
parser.add_argument('--audit-dir',type=Path,required=True)
options=parser.parse_args()
TAIL=RH/'docs/testing/evidence/full-study-compute-tail-2026-11-16'
ACTUAL=options.audit_dir.resolve()
assert ACTUAL.parent==(TAIL/'native-audit').resolve(),'CURRENT_TASK_AUDIT_DIRECTORY_REQUIRED'
assert ACTUAL.name.startswith(options.phase+'-'),'AUDIT_PHASE_PATH_MISMATCH'
audit=json.loads((ACTUAL/'result.json').read_text())
assert audit['passed'] is True and audit['mode']==options.phase and audit['stage']=='after','SUCCESSFUL_CURRENT_AFTER_AUDIT_REQUIRED'
OUT=TAIL/'oracle'/('after-'+options.phase+'-independent')
OLD=RH/'docs/testing/evidence/real-study-full-simulation-2026-11-13'
PERF=RH/'docs/testing/evidence/full-study-performance-2026-11-13'
PRIVATE=ROOT/'.tmp/real-study-full-simulation-2026-11-13'
load=lambda p:json.loads(p.read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def digest(x):
    return hashlib.sha256(json.dumps(x,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()).hexdigest()

TAIL=RH/'docs/testing/evidence/full-study-compute-tail-2026-11-16'
BATCH=RH/'docs/testing/evidence/full-study-batch-performance-2026-11-16'
JOURNAL=ROOT/'.tmp/full-study-compute-tail-2026-11-16/after/benchmark-journal.json'
journalGuard=json.loads(JOURNAL.read_text())
assert journalGuard['task']=='full-study-compute-tail-2026-11-16' and journalGuard['stage']=='after'
assert journalGuard['runGroupId']==audit['runGroupId']
assert journalGuard['steps']['create']['status']=='done'
assert journalGuard['steps']['create']['value']['id']==audit['runGroupId']
assert audit['runGroupId']!='full-run-b45d1768-8f72-406a-9da5-cb083aead9db'
assert not OUT.exists(),'PRESERVE_SUCCESSFUL_OR_FAILED_ORACLE_OUTPUT'
OUT.mkdir(parents=True,exist_ok=False)
inputs=OUT/'inputs'
inputs.mkdir(exist_ok=False)
PREPARED=BATCH/'oracle/prepared-inputs'
sources={
 'snapshot':ACTUAL/'snapshot.json','group':ACTUAL/'group.json','runs':ACTUAL/'actual-method-runs.json',
 'journal':JOURNAL,
 'generator':PREPARED/'generator.json','bootstrap':PREPARED/'bootstrap.json','events':PREPARED/'events.json',
 'raw48':ACTUAL/'raw-revisions-48.json','native_proof':ACTUAL/'native-proof.json','audit_result':ACTUAL/'result.json',
 'corrected_snapshot':OLD/'report-corrected/snapshot.json','corrected_group':OLD/'report-corrected/group.json',
 'corrected_runs':OLD/'report-corrected/actual-method-runs.json','initial_group':OLD/'report-initial/group.json',
 'initial_runs':OLD/'report-initial/actual-method-runs.json','perf_group':PERF/'final-readonly/group.json',
 'batch_group':BATCH/'native-audit/final-e1b4d77f/group.json','baseline_group':TAIL/'actual/baseline/group.json','old195':TAIL/'baseline/old-native-runs-195.json',
}
copies={}
for key,path in sources.items():
    data=path.read_bytes();target=inputs/(key+'.json');target.write_bytes(data)
    copies[key]={'source':str(path),'copy':str(target),'sha256':sha(target),'sizeBytes':len(data)}
baseline=load(PERF/'baseline/baseline.json')
before={key:sha(ROOT/v['path']) for key,v in baseline['immutableInputs'].items()}
args=[sys.executable,str(RH/'scripts/full-study-oracle.py'),
 '--generator',str(inputs/'generator.json'),'--bootstrap',str(inputs/'bootstrap.json'),
 '--corrections',str(inputs/'events.json'),'--actual-revisions',str(inputs/'raw48.json'),
 '--actual-snapshot',str(inputs/'snapshot.json'),'--actual-group',str(inputs/'group.json'),
 '--actual-runs',str(inputs/'runs.json'),'--out',str(OUT)]+(['--pre-review'] if options.phase=='pre-review' else [])
completed=subprocess.run(args,cwd=RH,capture_output=True,text=True,timeout=60)
(OUT/'oracle-stdout.json').write_text(completed.stdout)
(OUT/'oracle-stderr.log').write_text(completed.stderr)
comparison=load(OUT/'comparison.json');raw_comparison=load(OUT/'source-comparison.json')
new,group,runs,journal=[load(inputs/(k+'.json')) for k in ('snapshot','group','runs','journal')]
old,old_group,old_runs=[load(inputs/(k+'.json')) for k in ('corrected_snapshot','corrected_group','corrected_runs')]
initial_runs=load(inputs/'initial_runs.json')
problems=[];checks=0
def check(label,want,got):
    global checks
    checks+=1
    if want!=got:problems.append({'path':label,'expected':want,'actual':got})

check('oracle.exit',0,completed.returncode)
if options.phase=='pre-review':
    check('oracle.numericPassed',True,comparison.get('numericPassed'))
    check('oracle.reviewPending',True,comparison.get('reviewPending'))
    check('oracle.mode','pre_review_numeric_only',comparison.get('mode'))
    check('oracle.pendingChildren',39,comparison.get('pendingChildRuns'))
else:
    check('oracle.finalPassed',True,comparison.get('passed'))
    check('oracle.reviewPending',False,comparison.get('reviewPending'))
    check('oracle.mode','final_confirmed',comparison.get('mode'))
check('raw.sourcePassed',True,raw_comparison.get('passed'))
check('expected.sha256','5dc8e1c64146310620d7eac4d954fa1a3aab4c5afd34fab11e868c34b2370d65',sha(OUT/'expected.json'))
check('root.fullBasis',old['basis'],new['basis'])
check('root.fullManifest',old['manifest'],new['manifest'])
check('root.fullGate',old['qualityGate'],new['qualityGate'])
check('root.canonicalManifestHash',new['basis']['manifestHash'],digest(new['manifest']))
for field in ('studyId','planId','snapshotId','manifestHash'):
    check('group.root.'+field,new['basis'][field],group[field])
    check('group.oldRoot.'+field,old_group[field],group[field])
check('group.journalId',journal['runGroupId'],group['runGroupId'])
check('group.id',group['runGroupId'],group['id'])
check('group.newId',False,group['runGroupId'] in [old_group['runGroupId'],load(inputs/'initial_group.json')['runGroupId'],load(inputs/'perf_group.json')['runGroupId'],load(inputs/'batch_group.json')['runGroupId'],load(inputs/'baseline_group.json')['runGroupId']])
check('group.remaining',0,group['remaining'])
check('group.status','needs_review' if options.phase=='pre-review' else 'completed',group['status'])
check('group.reviewStatus','pending_review' if options.phase=='pre-review' else 'confirmed',group['reviewStatus'])
check('runs.studyId',group['studyId'],runs['studyId'])
check('runs.groupId',group['runGroupId'],runs['runGroupId'])
check('slices.count',54,len(group['slices']))
check('slices.uniqueIds',54,len({s['sliceId'] for s in group['slices']}))
check('runs.count',39,len(runs['runs']))
new_runs={r['id']:r for r in runs['runs']};old_by_id={r['id']:r for r in old_runs['runs']}
old_slices={s['sliceId']:s for s in old_group['slices']}
manifest_slices={s['sliceId']:s for s in new['manifest']['slices']}
linked={s['methodRunId'] for s in group['slices'] if s.get('methodRunId')}
check('runs.exactLinkedSet',sorted(linked),sorted(new_runs))
prior_ids={r['id'] for r in load(inputs/'old195.json')['runs']}
check('prior195.unique',195,len(prior_ids))
proof=load(inputs/'native_proof.json')
check('old195.fullNativeRows',sorted(load(inputs/'old195.json')['runs'],key=lambda r:r['id']),proof['oldRuns'])
check('group.expectedNewGroup',audit['runGroupId'],group['runGroupId'])
check('runs.noPriorIdReuse',[],sorted(set(new_runs)&prior_ids))
create_key=journal['steps']['create']['body']['requestKey']
bindings=[]
for s in group['slices']:
    prior=old_slices[s['sliceId']];m=manifest_slices[s['sliceId']]
    for key in ('kind','armCode','logicalVisit','variable','denominators','snapshotId'):
        check(s['sliceId']+'/'+key,prior[key],s[key])
    if not s.get('methodRunId'):
        check(s['sliceId']+'/emptyMatches',None,prior.get('methodRunId'))
        continue
    run=new_runs[s['methodRunId']];previous=old_by_id[prior['methodRunId']]
    basis=run['dataSources']['analysisBasis']
    check(s['sliceId']+'/oldBasis',previous['dataSources']['analysisBasis'],basis)
    check(s['sliceId']+'/childSnapshot',s['snapshotId'],basis['snapshotId'])
    check(s['sliceId']+'/inputStudy',group['studyId'],run['inputSummary']['studyId'])
    check(s['sliceId']+'/inputSnapshot',s['snapshotId'],run['inputSummary']['snapshotId'])
    check(s['sliceId']+'/rootSnapshot',group['snapshotId'],basis['rootSnapshotId'])
    check(s['sliceId']+'/rootHash',group['manifestHash'],basis['rootManifestHash'])
    check(s['sliceId']+'/workerHash',basis['manifestHash'],run['artifactRefs']['outputs']['manifestHash'])
    check(s['sliceId']+'/envBasis',basis,run['environment']['analysisBasis'])
    for key in ('accountId','skillKey','skillVersion','executorVersion','inputHash'):
        check(s['sliceId']+'/'+key,previous[key],run[key])
    native_key='full-slice-'+digest({'studyId':group['studyId'],'actor':run['accountId'],'requestKey':create_key,'snapshotId':s['snapshotId']})
    check(s['sliceId']+'/newParentNativeKey',native_key,run['idempotencyKey'])
    check(s['sliceId']+'/outputsExact',previous['artifactRefs']['outputs'],run['artifactRefs']['outputs'])
    check(s['sliceId']+'/evidenceExact',sorted(previous['numericEvidence'],key=lambda x:x['name']),sorted(run['numericEvidence'],key=lambda x:x['name']))
    bindings.append({'sliceId':s['sliceId'],'newRunId':run['id'],'oldRunId':previous['id'],
                     'childSnapshotId':s['snapshotId'],'basisHash':digest(basis),
                     'sourcesHash':digest(m['sources']),'outputsHash':digest(run['artifactRefs']['outputs']),
                     'numericEvidenceHash':digest(sorted(run['numericEvidence'],key=lambda x:x['name']))})

inventory={}
for key,entry in baseline['immutableInputs'].items():
    after=sha(ROOT/entry['path'])
    inventory[key]={'path':entry['path'],'baselineSha256':entry['sha256'],'beforeSha256':before[key],'afterSha256':after,'authorizedSourceException':key=='profile_script'}
    check('files.duringCheck/'+key,before[key],after)
    if key!='profile_script':check('files.baseline/'+key,entry['sha256'],after)
check('oldWord.sha256','e961a2b57679f1ae9bd40a37bd49c16b268323826b58cc68fef98be208b21bb7',sha(OLD/'report-corrected/report.docx'))
for key,entry in copies.items():check('inputStableDuringCopy/'+key,entry['sha256'],sha(Path(entry['source'])))
result={'schemaVersion':'full-study-compute-tail-after-oracle-v1','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'passed':not problems,'numericPassed':not problems,'reviewPending':options.phase=='pre-review','finalPassed':not problems and options.phase=='final','preReviewGatePassed':not problems and options.phase=='pre-review','phase':options.phase,
        'syntheticOnly':True,'studyId':group['studyId'],'runGroupId':group['runGroupId'],
        'oracleChecks':comparison.get('checks'),'sourceChecks':raw_comparison.get('checks'),
        'independentBindingChecks':checks,'newChildCount':len(new_runs),'priorChildIdsReused':sorted(set(new_runs)&prior_ids),
        'expectedSha256':sha(OUT/'expected.json'),'oracleScriptSha256':sha(RH/'scripts/full-study-oracle.py'),
        'comparisonSha256':sha(OUT/'comparison.json'),'sourceComparisonSha256':sha(OUT/'source-comparison.json'),
        'frozenInputCopies':copies,'immutableFileInventory':inventory,'sliceBindings':bindings,'problems':problems,
        'command':args,'databaseCalls':0,'httpCalls':0,'workerExecutions':0,
        'method':'Unchanged original stdlib oracle with explicit phase plus complete root/slice/basis/old output/evidence/source comparisons and no prior195 ID reuse. Inputs copied from parent actual readback; no live DB or HTTP by this checker. Baseline39 remains a pending-review before measurement, not an after acceptance. Native audit export must already be successful before this offline command.'}
(OUT/'integrity.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ('passed','numericPassed','reviewPending','finalPassed','oracleChecks','sourceChecks','independentBindingChecks','newChildCount','priorChildIdsReused','expectedSha256','problems')},ensure_ascii=False))
sys.exit(0 if result['passed'] else 1)
