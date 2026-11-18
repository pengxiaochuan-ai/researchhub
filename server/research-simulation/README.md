# Scoped simulation execution factory

`createResearchSimulation` in `execution.mjs` is composition only. It starts no service/transaction, imports no fixture guard, mutates no global clock and applies no schema. Admission and the v2 analysis approval resolver are supplied by the caller. Ordinary protocols delegate unchanged; configured simulation sections without admission return `not_ready` and reject execution rather than falling back.

```js
const simulation = createResearchSimulation({
  resolveCase,                         // parent's trusted admission resolver
  resolveApprovedPlan: analysis.approvedPlan, // (tx, scope, {studyId, protocolVersionId})
  lockAuthorization: load('common/worker-publication', 'lockAuthorizationMutation'),
  completionIntegrity: load('study-operations/formal-visit-evidence', 'visitCompletionIntegrity'),
  authorizeAdvance: async (tx,user,s) => {
    await load('common/worker-publication','lockAuthorizationMutation')(tx,s.tenantId);
    await authorizeParticipation(tx,user,s.studyGroupId,s.researchProjectId);
  },
});
```

The trusted case schema is `full-study-simulation-case-v1`, with `caseId,studyId,scope,protocolVersionId,protocolHash,policyId,policyHash,baseDate,subjects,visitPlans,forms`. `scope` has `tenantId,studyGroupId,researchProjectId`; subjects contain exact database `id,armCode`; plans contain exact `id,code,logicalVisit,armCodes`; forms contain `id,schemaHash,scoringHash`, hashed with the existing `requestHash` canonical function (`scoring:null` hashes null). Additional admission/analysis metadata is retained by the trusted resolver. Six unique subjects, two in each frozen arm, and all five frozen plans are mandatory. All plans anchor to enrollment; nominal offsets stay 0/14/28/56. `baseDate` is an ISO UTC instant, displayed with the explicit `Asia/Shanghai` timezone.

Policy draft additions are strictly typed and hashed with the original sections:

```js
populationSchedule: {
  status:'configured', source:'...', reason:'...',
  rules:{schemaVersion:'population-schedule-v1', armVisitCodes:{
    MDD_TARGET:['V1_PATIENT','V2','V3','V4'],
    MDD_NON_TARGET:['V1_PATIENT','V2','V3','V4'],
    HEALTHY_REFERENCE:['V1_HEALTHY'],
  }},
},
simulation: {
  status:'configured', source:'...', reason:'...',
  rules:{schemaVersion:'study-simulation-clock-v1',stageDays:[0,14,28,56],timezone:'Asia/Shanghai'},
},
```

No case IDs, subject registry, base date or free clock value are accepted in those HTTP policy sections. Draft shape may be saved before admission; execution requires exact approved protocol/policy hashes, unchanged form schema/scoring and an approved v2 analysis plan. Ordinary policy inputs add no new absent keys, preserving their hash shape.

## Wiring and receipt ordering

- `context(tx,scope)` returns null for ordinary protocols, or public `{enabled,ready,status,...stageIndex,stage,day,logicalDate,timezone}`. A registered but unready case returns `ready:false,status:'not_ready',reason`.
- `withExecutionTx(tx,user,scope,fn,options)` wraps **only execution**, not policy/plan drafting or read-only queries. It uses the existing transaction. Enrollment must pass `{operation:'enroll',subjectId:<database id>,armCode}`. The original authorized enrollment core receives the proxy and filters its `include.taskTemplates + visitPlans` protocol read to that subject's approved plans. Enrollment/enrollment-anchor dates become the baseline. Visit targets/windows derive from untouched nominal offsets; only actual start/completion domain dates become the active stage instant. `createdAt`, `updatedAt`, audit, session, response revision and authorization clocks are untouched.
- `guardVisitSchedule(tx,scope,visitId,{operation})` is a **new-operation check after original receipt replay**. It checks exact subject/plan/protocol, active stage, resolved anchor and logical instant within the original window. Old-stage `correct` remains allowed through original correction authorization. Ordinary protocols return null.
- `presentVisit(tx,scope,visit)` retains the original result and adds `simulation`; current-stage checks narrow `canStart/canAssign/canComplete`. Existing historical `canReverify` is retained.
- `advance(tx,user,scope,{requestKey,expectedStage})` runs in the caller's existing transaction after normal Study authority. It requires the original permission callback, sequential CAS and exactly one completed/current-integrity visit for each applicable subject/plan at this stage. It appends an AuditLog event; replay of the same actor/key/body returns its original receipt after advancement. No shadow clock table or real-time rewrite is used.

For enrollment, pass the proxy to the original `operations.enrollInTransaction` from `createEnrollmentService`'s core callback. For start/complete, put `withExecutionTx` and the guard in the `createVisitsService` core callback, which is already called after its own saved receipt path. Do not wrap the entire Studies service: that would incorrectly gate configuration/approval before the plan exists.

The original formal-response writer invokes `assertVisitCaptureSchedule` **after** its form command receipt replay. The parent's private module adapter may overlay that exported function to call the original guard then `simulation.guardVisitSchedule`. Preserve this location; do not gate at HTTP entry or before saved receipt resolution. Assignment, CSV, H5, file upload and visit handlers each need their corresponding post-replay integration; the existence of this factory does not claim those paths are already mounted. For completion, a callback can guard then pass the proxy to the original completion core. Never replace raw SQL text globally.

Lock order is original tenant authorization lock → exact ResearchProject `FOR UPDATE` → existing protocol/subject/enrollment/visit locks. Clock transitions and execution both acquire the project lock, so an in-flight stage write cannot race advancement. Audit events order by explicit validated stage sequence, not wall timestamps. Only three valid transitions can exist. A changed approved plan after advancement blocks further execution.

Validation: `node --test server/research-simulation/*.test.mjs server/research-execution/policy-input.test.mjs server/research-execution/protocols.test.mjs server/research-execution/protocol-release.test.mjs` (29 passing at initial delivery). These are pure/transaction contract tests, not real PG/API/browser or deployment acceptance.
