#!/usr/bin/env python3
"""Independent stdlib oracle for this round's synthetic full-study evidence.

Never imports or executes the application projection, scorer, or Worker.  It
reads frozen source contracts, reconstructs the specified seed, and uses
statistics from the Python standard library. No network or database access.
"""
import argparse
from collections import Counter
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import statistics

REPO = Path(__file__).resolve().parents[1]
ROOT = REPO.parent
ROUND = ROOT / '.tmp/real-study-full-simulation-2026-11-13'
ARMS = ['MDD_TARGET', 'MDD_NON_TARGET', 'HEALTHY_REFERENCE']
VISITS = ['V1', 'V2', 'V3', 'V4']
SEED = 20261113
FANG_WEIGHTS = dict(zip([
    'main_distension_pain', 'main_depressed_emotion', 'secondary_irritability',
    'secondary_sighing', 'secondary_globus', 'secondary_irregular_menses',
    'secondary_dysmenorrhea', 'secondary_emotional_trigger', 'tongue_pale_red',
    'tongue_thin_white_coating', 'pulse_wiry', 'pulse_deep_wiry'],
    [4, 3, 2, 3, 4, 5, 5, 2, 5, 2, 6, 5]))
HAMD_MAXIMA = [4, 4, 4, 2, 2, 2, 4, 4, 4, 4, 4, 2, 2, 2, 4, 2, 2]
SOURCE_HASHES = {
    'phq': '09a8afdec1546b54162850faae7b9bc43d53879e9cbe8b8e1263e67ff254b095',
    'fang': '5e34d90ff887e801d3635ecfb2e216227b5510c540302082694d352ee6def3f1',
    'hamd': 'da9bbbe2da775cacaaab5825659d56566bef066c4d0834e07b5b4ea23719c968',
}
VARIABLES = {'phq9_total': 'phq', 'fang_total': 'fang', 'hamd17_total': 'hamd'}


def load(path):
    return json.loads(Path(path).read_text())


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def result(total=None, reason=None, complete=True, **extra):
    return {'complete': complete, 'scoreComplete': reason is None,
            'total': total, 'reason': reason, **extra}


def numeric_answers(answers, keys, domains):
    missing = [key for key in keys if answers.get(key) is None]
    for key, domain in zip(keys, domains):
        if key not in missing and (type(answers[key]) is not int or answers[key] not in domain):
            raise ValueError('Non-discrete/out-of-source answer: ' + key)
    return missing


def score_phq(answers):
    keys = [f'phq9_q{i}' for i in range(1, 10)]
    missing = numeric_answers(answers, keys, [range(4)] * 9)
    if missing:
        return result(reason='missing', complete=False, unresolvedItems=missing)
    # The optional functional item is neither required for the total nor scored.
    return result(total=sum(answers[key] for key in keys))


def phq_completeness(answers):
    required = [f'phq9_q{i}' for i in range(1, 10)]
    return {'scoredCount': sum(answers.get(key) is not None for key in required),
            'missingCount': sum(answers.get(key) is None for key in required + ['functional_difficulty']),
            'missingRequired': sum(answers.get(key) is None for key in required)}


def score_hamd(answers):
    keys = [f'hamd17_q{i}' for i in range(1, 18)]
    domains = [list(range(maximum + 1)) for maximum in HAMD_MAXIMA]
    domains[13].append(9)
    missing = numeric_answers(answers, keys, domains)
    if missing:
        return result(reason='missing', complete=False, unresolvedItems=missing)
    if answers['hamd17_q14'] == 9:
        return result(reason='source_code_9', unresolvedItems=['hamd17_q14'])
    # Explicit synthetic assumption; the original CRF has a blank total field.
    return result(total=sum(answers[key] for key in keys))


def score_fang(answers):
    keys = list(FANG_WEIGHTS) + ['tongue_category', 'pulse_category']
    missing = [key for key in keys if answers.get(key) is None]
    unresolved = []
    for key in keys:
        value = answers.get(key)
        domain = ['met', 'not_met', 'uncertain'] if key.endswith('_category') else [
            'present', 'absent', 'not_applicable', 'uncertain']
        if value is not None and value not in domain:
            raise ValueError('Out-of-source answer: ' + key)
        if value is None or value in ['not_applicable', 'uncertain']:
            unresolved.append({'key': key, 'reason': 'missing' if value is None else value})
    if answers.get('pulse_wiry') == answers.get('pulse_deep_wiry') == 'present':
        return result(reason='review_required', complete=not missing, unresolvedItems=unresolved,
                      classification=None)
    if unresolved:
        return result(reason=unresolved[0]['reason'], complete=not missing,
                      unresolvedItems=unresolved, classification=None)
    total = sum(weight for key, weight in FANG_WEIGHTS.items() if answers[key] == 'present')
    main = all(answers[key] == 'present' for key in list(FANG_WEIGHTS)[:2])
    secondary = any(answers[key] == 'present' for key in list(FANG_WEIGHTS)[2:8])
    category = answers['tongue_category'] == 'met' or answers['pulse_category'] == 'met'
    return result(total=total, classification=total >= 20 and main and secondary and category,
                  thresholdMet=total >= 20, composition={
                      'primary': main, 'secondary': secondary, 'tongueOrPulse': category})


def describe(values):
    n = len(values)
    return {'type': 'number', 'total': n, 'observed': n, 'missing': 0,
            'min': min(values) if n else None, 'max': max(values) if n else None,
            'mean': statistics.mean(values) if n else None,
            'median': statistics.median(values) if n else None,
            'sampleStdDev': statistics.stdev(values) if n > 1 else None}


def source_contracts(bootstrap):
    profiles = {name: load(REPO / 'server/research-capture/source-profiles' / filename)
                for name, filename in [('phq', 'phq9-zh-CN-v1.json'),
                    ('fang', 'fang-2023-table5-v1.json'), ('hamd', 'hamd17-crf-simulation-v1.json')]}
    for name, profile in profiles.items():
        assert profile['source']['sha256'] == SOURCE_HASHES[name]
        assert bootstrap['refs'][name]['source']['sha256'] == SOURCE_HASHES[name]
        assert digest(profile['schema']) == bootstrap['refs'][name]['schemaHash']
        assert digest(profile['scoring']) == bootstrap['refs'][name]['scoringHash']
    assert [[c['value'] for c in f['choices']] for f in profiles['phq']['schema']['fields'][:9]] == [list(range(4))] * 9
    assert profiles['phq']['schema']['fields'][9]['score'] is False
    assert [[c['value'] for c in f['choices']] for f in profiles['hamd']['schema']['fields']] == [
        list(range(v + 1)) if i != 13 else [0, 1, 2, 9] for i, v in enumerate(HAMD_MAXIMA)]
    assert profiles['hamd']['scoring']['simulationPolicy'] == 'ordinary17-sum-special9-or-missing-no-total-v1'
    policy = profiles['fang']['scoring']['projectPolicy']
    assert {key: policy[key] for key in ['status', 'categoryMode', 'pulseCooccurrence', 'inapplicable']} == {
        'status': 'confirmed', 'categoryMode': 'explicit_reviewed_categories',
        'pulseCooccurrence': 'review_required', 'inapplicable': 'incomplete_no_total'}
    frozen_path = REPO / 'docs/planning/first-real-study-calibration-2026-11-13/core-forms/target-syndrome-fang2023-source-v1.json'
    frozen = load(frozen_path)
    assert {item['key']: item['sourceChoices'][0]['score'] for item in frozen['items']} == FANG_WEIGHTS
    assert frozen['rawTotal']['threshold'] == {'operator': '>=', 'value': 20, 'sourcePdfPage': 3, 'table': 5}
    return {'sourceHashes': SOURCE_HASHES, 'fangSource': str(frozen_path),
            'fangRows': {item['key']: item['sourceRef'] for item in frozen['items']},
            'profileHashes': {name: digest(profile) for name, profile in profiles.items()},
            'hamdTotalRule': 'synthetic assumption; not an author-verified total formula',
            'fangPolicy': policy}


def check_seed(generator):
    assert generator['version'] == 'full-study-synthetic-generator-v1' and generator['seed'] == SEED
    assert digest({k: v for k, v in generator.items() if k != 'manifestHash'}) == generator['manifestHash']
    assert len(generator['subjects']) == len(generator['data']) == 6
    for row in generator['data']:
        arm, index = row['armCode'], row['index']
        assert arm in ARMS and index in [0, 1]
        n = ARMS.index(arm) * 2 + index
        assert list(row['visits']) == (VISITS if arm != 'HEALTHY_REFERENCE' else ['V1'])
        for stage, visit in row['visits'].items():
            stage_index = VISITS.index(stage)
            expected = {f'phq9_q{j + 1}': 0 if arm == 'HEALTHY_REFERENCE' and index == 0 else
                        (SEED + n * 5 + j + stage_index) % 4 for j in range(9)}
            assert {key: visit['phq'][key] for key in expected} == expected
            assert visit['phq']['functional_difficulty'] == 'difficulty_1'
            if arm != 'HEALTHY_REFERENCE':
                positive = {'main_distension_pain', 'main_depressed_emotion', 'secondary_globus',
                            'secondary_emotional_trigger', 'tongue_pale_red', 'pulse_wiry'}
                expected_fang = {key: 'present' if arm == 'MDD_TARGET' and key in positive else
                                 'absent' for key in FANG_WEIGHTS}
                expected_fang.update({key: 'met' if arm == 'MDD_TARGET' else 'not_met'
                                      for key in ['tongue_category', 'pulse_category']})
                if arm == 'MDD_TARGET' and index == 1 and stage == 'V3':
                    expected_fang['secondary_irregular_menses'] = 'not_applicable'
                assert visit['fang'] == expected_fang
                if 'fangInitial' in visit:
                    assert arm == 'MDD_TARGET' and index == 0 and stage == 'V1'
                    assert visit['fangInitial'] == {**expected_fang, 'pulse_deep_wiry': 'present'}
                assert ('hamd' in visit) == (stage != 'V2')
                if 'hamd' in visit:
                    expected_hamd = {f'hamd17_q{j + 1}': (SEED + n + j + stage_index) % (maximum + 1)
                                     for j, maximum in enumerate(HAMD_MAXIMA)}
                    if arm == 'MDD_NON_TARGET' and index == 1 and stage == 'V3':
                        expected_hamd['hamd17_q14'] = 9
                    assert visit['hamd'] == expected_hamd


def apply_corrections(generator, corrections):
    changed = deepcopy(generator['data'])
    for event in corrections:
        subject = next(row for row in changed if row['subjectId'] == event['subjectId'])
        answers = subject['visits'][event['logicalVisit']][event['form']]
        for key, value in event['patch'].items():
            if 'before' in event:
                assert answers.get(key) == event['before'][key], 'Correction before value differs'
            answers[key] = value
    return changed


def build_expected(generator, bootstrap, corrections):
    data = apply_corrections(generator, corrections)
    scores, audit = {}, []
    score_function = {'phq': score_phq, 'fang': score_fang, 'hamd': score_hamd}
    for i, subject in enumerate(data):
        for stage, visit in subject['visits'].items():
            for form in score_function:
                if form not in visit:
                    continue
                score = score_function[form](visit[form])
                provenance = {'generatorPointer': f'/data/{i}/visits/{stage}/{form}',
                              'generatorHash': generator['manifestHash'],
                              'sourceSha256': SOURCE_HASHES[form],
                              'correctionEvents': [event for event in corrections if
                                  event['subjectId'] == subject['subjectId'] and event['logicalVisit'] == stage and event['form'] == form]}
                scores[(subject['subjectId'], stage, form)] = {**score, 'provenance': provenance}
                audit.append({'subjectId': subject['subjectId'], 'armCode': subject['armCode'],
                              'logicalVisit': stage, 'form': form, 'answers': visit[form],
                              'expectedScore': score, 'provenance': provenance})
                if form == 'fang' and 'fangInitial' in visit:
                    audit.append({'subjectId': subject['subjectId'], 'logicalVisit': stage,
                                  'form': form, 'historicalOnly': True,
                                  'answers': visit['fangInitial'], 'expectedScore': score_fang(visit['fangInitial']),
                                  'provenance': {'generatorPointer': f'/data/{i}/visits/{stage}/fangInitial'}})
    slices = []
    for arm in ARMS:
        selected = [subject for subject in data if subject['armCode'] == arm]
        for visit in VISITS:
            for variable, form in VARIABLES.items():
                for kind in (['timepoint', 'paired_change'] if arm != 'HEALTHY_REFERENCE' and visit != 'V1' else ['timepoint']):
                    applicable = not (arm == 'HEALTHY_REFERENCE' and (visit != 'V1' or form != 'phq')) and not (form == 'hamd' and visit == 'V2')
                    denominator = {'population': len(selected), 'eligible': 0, 'valid': 0,
                                   'missing': 0, 'notCollected': 0, 'notApplicable': 0,
                                   'incompleteScore': 0, 'reasons': {}}
                    values, sources, reasons = [], [], Counter()
                    for subject in selected:
                        if not applicable:
                            denominator['notApplicable'] += 1
                            continue
                        denominator['eligible'] += 1
                        followup = scores.get((subject['subjectId'], visit, form))
                        baseline = scores.get((subject['subjectId'], 'V1', form)) if kind == 'paired_change' else None
                        endpoints = [baseline, followup] if kind == 'paired_change' else [followup]
                        reason = next(('not_collected' if s is None else s['reason'] for s in endpoints
                                       if s is None or not s['scoreComplete']), None)
                        source = {'subjectId': subject['subjectId'], 'status': reason or 'valid',
                                  'followup': followup, 'baseline': baseline}
                        if reason:
                            denominator['missing'] += 1
                            if reason == 'not_collected':
                                denominator['notCollected'] += 1
                            else:
                                denominator['incompleteScore'] += 1
                            reasons[reason] += 1
                        else:
                            value = followup['total'] - baseline['total'] if baseline else followup['total']
                            values.append(value)
                            source['value'] = value
                            denominator['valid'] += 1
                        sources.append(source)
                    denominator['reasons'] = dict(reasons)
                    slices.append({'armCode': arm, 'logicalVisit': visit, 'variableKey': variable,
                                   'kind': kind, 'denominators': denominator, 'values': values,
                                   'statistics': describe(values), 'sources': sources,
                                   'status': 'not_applicable' if not applicable else 'ready' if values else 'no_valid_data'})
    return {'schemaVersion': 'independent-python-full-study-oracle-v1',
            'studyId': bootstrap['study']['id'], 'runId': bootstrap['runId'],
            'formVersionIds': {name: bootstrap['refs'][name]['id'] for name in SOURCE_HASHES},
            'generatorHash': generator['manifestHash'], 'seed': SEED,
            'subjects': generator['subjects'], 'scoreAudit': audit, 'slices': slices,
            'corrections': corrections, 'statisticsImplementation': 'Python statistics stdlib',
            'numericComparison': {'relativeTolerance': 1e-12, 'absoluteTolerance': 1e-12,
                                  'countsAndScoreTotals': 'exact integers', 'n1SampleStdDev': None}}


def compare_actual(expected, snapshot, group, actual_runs, pre_review=False):
    problems, compared, bindings_evidence = [], Counter(), []
    def check(path, want, got):
        compared['checks'] += 1
        equal = (type(got) in [int, float] and math.isfinite(got) and
                 math.isclose(want, got, rel_tol=1e-12, abs_tol=1e-12)) if type(want) is float else want == got
        if not equal:
            problems.append({'path': path, 'expected': want, 'actual': got})
    check('snapshot.basis.studyId', expected['studyId'], snapshot['basis']['studyId'])
    check('runs.studyId', expected['studyId'], actual_runs['studyId'])
    check('group.runGroupId', actual_runs['runGroupId'], group.get('runGroupId', group.get('id')))
    manifest = snapshot['manifest']
    check('snapshot.rootManifestHash', digest(manifest), snapshot['basis']['manifestHash'])
    check('snapshot.generatorHash', expected['generatorHash'], manifest['caseMetadata']['generator']['manifestHash'])
    check('manifest.sliceCount', len(expected['slices']), len(manifest['slices']))
    runs = {run['id']: run for run in actual_runs['runs']}
    check('uniqueChildRunIds', len(actual_runs['runs']), len(runs))
    linked = set()
    for want in expected['slices']:
        label = '/'.join([want['armCode'], want['logicalVisit'], want['variableKey'], want['kind']])
        matches = [s for s in manifest['slices'] if s['armCode'] == want['armCode'] and
                   s['logicalVisit'] == want['logicalVisit'] and s['variable']['key'] == want['variableKey'] and s['kind'] == want['kind']]
        if len(matches) != 1:
            problems.append({'path': label, 'expected': 'one slice', 'actual': len(matches)})
            continue
        actual = matches[0]
        check(label + '/formVersionId', expected['formVersionIds'][VARIABLES[want['variableKey']]], actual['variable']['formVersionId'])
        check(label + '/fieldKey', 'total', actual['variable']['fieldKey'])
        check(label + '/valueSource', 'score_total', actual['variable']['source'])
        bindings_evidence.append({'sliceId': actual['sliceId'], 'logicalKey': label,
                                  'sources': actual['sources']})
        check(label + '/denominators', want['denominators'], actual['denominators'])
        check(label + '/sourceStates', sorted((s['subjectId'], s['status']) for s in want['sources']),
              sorted((s['subjectId'], s['status']) for s in actual['sources']))
        for source in actual['sources']:
            if source['status'] == 'valid':
                endpoint_names = ['baselineRef', 'followupRef'] if want['kind'] == 'paired_change' else ['followupRef']
                for endpoint in endpoint_names:
                    ref = source.get(endpoint)
                    check(label + '/' + source['subjectId'] + '/' + endpoint + '/completeRef', True,
                          isinstance(ref, dict) and all(ref.get(k) is not None for k in ['responseId', 'assignmentId', 'revisionNo', 'contentHash']) and len(ref.get('contentHash', '')) == 64)
        if 'rows' in actual:
            row_values = sorted((row['subjectId'], row['cells'][0]['value']) for row in actual['rows'])
            check(label + '/independentSubjectValues', sorted((s['subjectId'], s['value']) for s in want['sources'] if s['status'] == 'valid'), row_values)
        bindings = [s for s in group['slices'] if s['sliceId'] == actual['sliceId']]
        if len(bindings) != 1:
            problems.append({'path': label + '/binding', 'expected': 'one binding', 'actual': len(bindings)})
            continue
        binding = bindings[0]
        if not want['values']:
            check(label + '/emptyMethodRun', None, binding.get('methodRunId'))
            continue
        run = runs.get(binding.get('methodRunId'))
        if run is None:
            problems.append({'path': label + '/run', 'expected': 'real linked child MethodRun', 'actual': binding.get('methodRunId')})
            continue
        linked.add(run['id'])
        compared['childRuns'] += 1
        outputs = run['artifactRefs']['outputs']
        if pre_review:
            check(label + '/reviewableOrConfirmedState', True,
                  (run['status'], run['reviewStatus']) in [('needs_review', 'pending_review'), ('completed', 'confirmed')])
            if (run['status'], run['reviewStatus']) == ('needs_review', 'pending_review'):
                compared['pendingChildRuns'] += 1
        else:
            check(label + '/status', 'completed', run['status'])
            check(label + '/reviewStatus', 'confirmed', run['reviewStatus'])
        check(label + '/rowCount', want['denominators']['valid'], outputs['rowCount'])
        check(label + '/statisticalUnit', 'subject', outputs['statisticalUnit'])
        check(label + '/skillKey', 'descriptive-statistics', run['skillKey'])
        check(label + '/executorVersion', 'descriptive-v1', run['executorVersion'])
        check(label + '/columnKeys', [want['variableKey']], list(outputs['columns']))
        check(label + '/snapshotBinding', binding['snapshotId'], run['inputSummary']['snapshotId'])
        run_basis = run['dataSources']['analysisBasis']
        check(label + '/workerManifestHash', run_basis['manifestHash'], outputs['manifestHash'])
        check(label + '/basisSnapshotBinding', binding['snapshotId'], run_basis['snapshotId'])
        check(label + '/workerIsNotLLM', False, run['environment']['llm'])
        actual_statistics = outputs['columns'][want['variableKey']]
        check(label + '/statistics/status', 'single_observation' if len(want['values']) == 1 else 'available', actual_statistics.get('status'))
        for key, value in want['statistics'].items():
            check(label + '/statistics/' + key, value, actual_statistics.get(key))
        wanted_evidence = {'rowCount': want['denominators']['valid'], **{
            'columns.' + want['variableKey'] + '.' + key: value
            for key, value in want['statistics'].items() if type(value) in [int, float]}}
        evidence = {item['name']: item for item in run['numericEvidence']}
        check(label + '/uniqueNumericEvidence', len(run['numericEvidence']), len(evidence))
        check(label + '/numericEvidencePaths', sorted(wanted_evidence), sorted(evidence))
        for path, value in wanted_evidence.items():
            check(label + '/numericEvidence/' + path, value, evidence.get(path, {}).get('value'))
            check(label + '/numericEvidenceBasis/' + path, True,
                  'manifestHash:' + run_basis['manifestHash'] in evidence.get(path, {}).get('assumptions', []))
    check('realChildRunSet', sorted(linked), sorted(runs))
    outcome = ({'mode': 'pre_review_numeric_only', 'numericPassed': not problems,
                'reviewPending': bool(compared['pendingChildRuns']), 'pendingChildRuns': compared['pendingChildRuns']}
               if pre_review else {'mode': 'final_confirmed', 'passed': not problems, 'reviewPending': False})
    return {**outcome, **compared, 'problems': problems, 'sourceBindings': bindings_evidence,
            'scope': 'Actual root manifest, linked DB child runs, source refs and independently calculated per-slice values/statistics'}


def compare_revisions(expected, base_expected, snapshot, raw):
    """Resolve immutable refs first, then compare raw answers and independent scores.

    Current refs must match the current generator plus explicit corrections.
    Historical refs may match the original frozen case or its deliberate dual-
    pulse revision. Absent/null optional answers are reported distinctly; neither
    can replace a generated non-null answer merely to make comparison pass.
    """
    problems, checked, representations, records = [], Counter(), [], []
    def check(path, want, got):
        checked['checks'] += 1
        equal = want == got
        if type(want) in [int, float, bool] and type(want) is not type(got):
            equal = False
        if not equal:
            problems.append({'path': path, 'expected': want, 'actual': got})
    check('studyId', expected['studyId'], raw['studyId'])
    check('snapshot.studyId', expected['studyId'], snapshot['basis']['studyId'])
    check('syntheticOnly', True, raw['syntheticOnly'])
    refs, assignments = {}, {}
    for observation in snapshot['manifest']['observations']:
        for variable, cell in observation['cells'].items():
            source = cell.get('source')
            if not source or not source.get('ref'):
                continue
            reference = source['ref']
            context = {'subjectId': observation['subjectId'], 'logicalVisit': observation['logicalVisit'],
                       'form': VARIABLES[variable], 'formVersionId': source['formVersionId']}
            key = (reference['responseId'], reference['revisionNo'])
            check('uniqueCurrentRef/' + str(key), False, key in refs)
            refs[key] = {**context, 'ref': reference, 'cell': cell}
            assignments[reference['assignmentId']] = context
    current_audit = [a for a in expected['scoreAudit'] if not a.get('historicalOnly')]
    historical_audit = expected['scoreAudit'] + base_expected['scoreAudit']
    scorer = {'phq': score_phq, 'fang': score_fang, 'hamd': score_hamd}
    algorithms = {'phq': 'numeric-sum-v1', 'fang': 'fang-2023-table5-v1', 'hamd': 'hamd17-simulation-sum-v1'}
    seen = set()
    for revision in raw['revisions']:
        reference, answers, stored = revision['ref'], revision['answers'], revision['score']
        key = (reference['responseId'], reference['revisionNo'])
        label = reference['responseId'] + '/revision/' + str(reference['revisionNo'])
        check(label + '/uniqueRawRef', False, key in seen)
        seen.add(key)
        current = refs.get(key)
        context = current or assignments.get(reference['assignmentId'])
        if not context:
            problems.append({'path': label, 'expected': 'reference within this current study/assignment set', 'actual': reference})
            continue
        form = context['form']
        candidates = [a for a in (current_audit if current else historical_audit) if
                      all(a.get(k) == context[k] for k in ['subjectId', 'logicalVisit', 'form'])]
        exact = [a for a in candidates if a['answers'] == answers]
        audit = exact[0] if exact else candidates[0] if candidates else None
        if audit is None:
            problems.append({'path': label, 'expected': 'frozen source answer provenance', 'actual': context})
            continue
        check(label + '/formVersionId', expected['formVersionIds'][form], revision['formVersionId'])
        if current:
            check(label + '/immutableRef', current['ref'], reference)
            checked['currentCount'] += 1
        else:
            checked['historicalCount'] += 1
        all_keys = set(audit['answers']) | set(answers)
        for field in sorted(all_keys):
            wanted, actual = audit['answers'].get(field), answers.get(field)
            wanted_kind = 'absent' if field not in audit['answers'] else 'null' if wanted is None else 'value'
            actual_kind = 'absent' if field not in answers else 'null' if actual is None else 'value'
            if wanted_kind != actual_kind:
                representations.append({'ref': reference, 'field': field, 'expectedKind': wanted_kind,
                                        'actualKind': actual_kind, 'optional': form == 'phq' and field == 'functional_difficulty'})
            if form == 'phq' and field == 'functional_difficulty' and wanted is None and actual is None:
                continue
            check(label + '/answers/' + field, wanted, actual)
        try:
            independent = scorer[form](answers)
        except ValueError as error:
            problems.append({'path': label + '/answerDomain', 'actual': str(error)})
            continue
        for field in ['total', 'complete']:
            check(label + '/score/' + field, independent[field], stored.get(field))
        check(label + '/scoreAlgorithm', algorithms[form], revision['scoreAlgorithm'])
        check(label + '/score/algorithm', algorithms[form], stored.get('algorithm'))
        check(label + '/changeAfterAnswers', answers, revision.get('changes', {}).get('after'))
        if form == 'phq':
            for counter, wanted in phq_completeness(answers).items():
                check(label + '/score/' + counter, wanted, stored.get(counter))
            if 'scoreComplete' in stored:
                check(label + '/score/scoreComplete', independent['scoreComplete'], stored['scoreComplete'])
            else:
                representations.append({'ref': reference, 'field': 'scoreComplete', 'actualKind': 'absent',
                    'interpretation': 'numeric-sum-v1 legacy DTO uses complete/scoredCount/missingCount; no field was added to input'})
            if answers.get('functional_difficulty') not in [None, 'difficulty_1', 'difficulty_2', 'difficulty_3', 'difficulty_4']:
                problems.append({'path': label + '/functional_difficulty', 'actual': answers['functional_difficulty']})
        else:
            check(label + '/score/scoreComplete', independent['scoreComplete'], stored.get('scoreComplete'))
            status = 'scored' if independent['scoreComplete'] else 'review_required' if independent['reason'] == 'review_required' else 'incomplete_data'
            check(label + '/score/processingStatus', status, stored.get('processingStatus'))
            check(label + '/score/sourceSha256', SOURCE_HASHES[form], stored.get('sourceSha256'))
            if form == 'fang':
                check(label + '/score/policyConfirmed', True, stored.get('policyConfirmed'))
                check(label + '/score/pulseReviewRequired', answers.get('pulse_wiry') == answers.get('pulse_deep_wiry') == 'present', stored.get('pulseReviewRequired'))
                check(label + '/score/classification', ('positive' if independent['classification'] else 'negative') if independent['scoreComplete'] else None, stored.get('classification'))
                check(label + '/score/diagnosis', independent['classification'], stored.get('diagnosis'))
                check(label + '/score/thresholdMet', independent.get('thresholdMet'), stored.get('thresholdMet'))
                check(label + '/score/composition', independent.get('composition'), stored.get('composition'))
                unresolved = [{'key': item['key'], 'status': item['reason']} for item in independent.get('unresolvedItems', [])]
                score_count = sum(answers.get(k) in ['present', 'absent'] for k in FANG_WEIGHTS)
            else:
                check(label + '/score/classification', None, stored.get('classification'))
                check(label + '/score/diagnosis', None, stored.get('diagnosis'))
                check(label + '/score/special9', answers.get('hamd17_q14') == 9, stored.get('special9'))
                check(label + '/score/simulationOnly', True, stored.get('simulationOnly'))
                check(label + '/score/simulationPolicy', 'ordinary17-sum-special9-or-missing-no-total-v1', stored.get('simulationPolicy'))
                unresolved = [{'key': item, 'status': independent['reason']} for item in independent.get('unresolvedItems', [])]
                score_count = sum(type(answers.get(f'hamd17_q{i}')) is int and answers[f'hamd17_q{i}'] != 9 for i in range(1, 18))
            check(label + '/score/unresolvedItems', unresolved, stored.get('unresolvedItems'))
            check(label + '/score/scoredCount', score_count, stored.get('scoredCount'))
            missing = sum(value is None for value in answers.values())
            check(label + '/score/missingCount', missing, stored.get('missingCount'))
            check(label + '/score/missingRequired', missing, stored.get('missingRequired'))
        if current:
            check(label + '/observation/value', independent['total'], current['cell'].get('value'))
            check(label + '/observation/status', 'valid' if independent['scoreComplete'] else independent['reason'], current['cell']['status'])
        records.append({'ref': reference, **{k: context[k] for k in ['subjectId', 'logicalVisit', 'form']},
                        'current': bool(current), 'answers': answers, 'independentScore': independent,
                        'storedScore': stored, 'provenance': {k: revision.get(k) for k in [
                            'source', 'actorKind', 'actorId', 'reason', 'changes', 'sourceSubmittedAt', 'createdAt']}})
    check('allCurrentRefsCovered', sorted(refs), sorted(set(refs) & seen))
    check('currentRefCount', len(current_audit), checked['currentCount'])
    return {'passed': not problems, 'scope': 'raw revisions and frozen-source scoring only; not Methods approval or final report acceptance',
            **checked, 'problems': problems, 'representationNotes': representations, 'records': records,
            'nativeHashVerification': {'performedIndependentlyHere': False,
                'upstreamReadbackClaimsVerified': raw.get('allImmutableHashesVerified'),
                'currentRefsMatchedExactlyHere': not any('/immutableRef' in p['path'] or p['path'] in ['allCurrentRefsCovered', 'currentRefCount'] for p in problems)}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--generator', type=Path, default=ROUND / 'generator.json')
    parser.add_argument('--bootstrap', type=Path, default=ROUND / 'bootstrap.json')
    parser.add_argument('--corrections', type=Path)
    parser.add_argument('--actual-snapshot', type=Path)
    parser.add_argument('--actual-group', type=Path)
    parser.add_argument('--actual-runs', type=Path)
    parser.add_argument('--actual-revisions', type=Path,
                        help='Raw immutable revision readback; requires the actual snapshot for current ref mapping')
    parser.add_argument('--pre-review', action='store_true',
                        help='Numerical gate only: accept needs_review/pending_review or completed/confirmed; never a final pass')
    parser.add_argument('--out', type=Path, default=ROUND / 'oracle-evidence/initial')
    args = parser.parse_args()
    generator, bootstrap = load(args.generator), load(args.bootstrap)
    assert bootstrap['syntheticOnly'] is True
    assert generator['subjects'] == bootstrap['subjects']
    assert generator['manifestHash'] == bootstrap['manifest']['generator']['manifestHash']
    check_seed(generator)
    contracts = source_contracts(bootstrap)
    corrections = load(args.corrections) if args.corrections else []
    if isinstance(corrections, dict):
        corrections = corrections['events']
    expected = build_expected(generator, bootstrap, corrections)
    input_paths = {'generator': args.generator, 'bootstrap': args.bootstrap}
    if args.corrections:
        input_paths['corrections'] = args.corrections
    supplied = [args.actual_snapshot, args.actual_group, args.actual_runs]
    if (args.actual_group or args.actual_runs) and not all(supplied):
        parser.error('Actual comparison requires --actual-snapshot, --actual-group and --actual-runs together')
    if args.actual_revisions and not args.actual_snapshot:
        parser.error('--actual-revisions requires --actual-snapshot')
    if args.pre_review and not all(supplied):
        parser.error('--pre-review requires all three actual evidence files')
    verification = {'status': 'expectation_only_actual_comparison_pending', 'syntheticOnly': True,
                    'independentOfApplicationNumericalCode': True}
    if all(supplied):
        verification = compare_actual(expected, load(args.actual_snapshot), load(args.actual_group), load(args.actual_runs),
                                      pre_review=args.pre_review)
        input_paths.update({'actualSnapshot': args.actual_snapshot, 'actualGroup': args.actual_group, 'actualRuns': args.actual_runs})
    revision_comparison = None
    if args.actual_revisions:
        revision_comparison = compare_revisions(expected, build_expected(generator, bootstrap, []),
                                               load(args.actual_snapshot), load(args.actual_revisions))
        input_paths.update({'actualSnapshot': args.actual_snapshot, 'actualRevisions': args.actual_revisions})
    provenance = {'inputs': {name: {'path': str(path.resolve()), 'sha256': file_hash(path)} for name, path in input_paths.items()},
                  'scriptSha256': file_hash(__file__), 'sourceContracts': contracts,
                  'notClinicalData': True, 'notClinicalEndpointValidation': True}
    args.out.mkdir(parents=True, exist_ok=True)
    for name, value in [('expected', expected), ('provenance', provenance), ('comparison', verification)]:
        (args.out / (name + '.json')).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    if revision_comparison is not None:
        (args.out / 'source-comparison.json').write_text(json.dumps(revision_comparison, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps({'out': str(args.out.resolve()), 'sliceCount': len(expected['slices']),
                      'currentScoreCount': sum(not row.get('historicalOnly', False) for row in expected['scoreAudit']),
                      **verification, **({'sourcePassed': revision_comparison['passed']} if revision_comparison is not None else {})}, ensure_ascii=False))
    return 1 if verification.get('passed') is False or verification.get('numericPassed') is False or revision_comparison is not None and not revision_comparison['passed'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
