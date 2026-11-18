# Batch source validation implementation plan

> For agentic workers: use the existing native subagents for owned modules; root integrates and verifies. Current user explicitly selected implementation of batch source validation. No further strategy selection is pending.

**Goal:** Reduce complete item and batch latency while preserving current authority, changing-source detection and item-native audit.

**Architecture:** Explicit limit3 on v2 only; transaction-local branded source proof with task-row protection; original native review and three-phase compute callbacks shared by at most3 items. Old limit1 remains intact.

**Tech stack:** Existing JS/TS, Nest/Prisma/Postgres, React/Vite and deterministic Python Worker.

**Spec:** docs/technical/full-study-batch-performance-2026-11-16.md

## Constraints and review focus

- No old source/schema/permission changes, production, queue, emails, paid model, global Shell, or old accepted evidence writes.
- Same request key never changes members; old marker must never be interpreted as batch3.
- Task heartbeat/claim/recovery bypass tenant locking: first lock then read; prove phantom insertion protection.
- All stage slot promises settle on rollback; no Worker before dispatch commit; no cleanup joining a dead barrier.
- Partial/unknown results cannot clear a batch marker; queued rows cannot masquerade as reviewed.
- Source/actor change between stages prevents publication, preserves original per-item proof and stops further work.

## Tasks

- [x] Freeze prior performance inputs and inspect runtime/source contracts. Owner target; baseline-independent new directory only.
- [x] Source guard: target owns new full-study-batch-source.mjs/tests and minimal full-study-analysis integration. RED cross-scope/tx/expired/source-write/heartbeat; implement; pure+guarded PG; root review.
- [x] Native batch adapter: creation_review owns scripts/full-study-methods-batch.mjs/tests and facade/local composition only. RED native command reuse, commit barriers, Worker/error/rollback cleanup; implement review then compute; integration review.
- [x] API claims/receipts: root owns full-study-runs, review-operations, process-receipt and their batch tests. RED frozen membership, CAS/replay, partial proof, oldlimit1, queued status; implement bounded batch, exact GET.
- [x] Frontend: creation_frontend owns full-study-ui-session, useFullStudyAnalysis, progress copy/tests only. RED v1/v2 marker/limit, batch proof and jump progress; implement current page, build; no layout expansion.
- [x] Independent integration: deduped regression, actual PG task/role/source concurrency and original source/Word checks; source review; load currentowned19501 after coordination.
- [x] Fresh same-source39 computations and reviews with before/after request timing, numeric oracle before approval, response-lost/partial/oldmarker/restart/roles and Chrome PNG/WebM.
- [x] Update living spec/manual/baseline/changes/both version logs/testing/Notion; release coordination; provide exact performance and limitations for user review.

Each implementation task follows RED→minimal code→GREEN→independent review. Shared dirty branch is retained; do not stash/reset/stage/commit unrelated work or switch worktrees. No commit requested.

## Technical handoff / business pending

All implementation and technical verification steps are complete. User business confirmation has been requested against the concrete final report; no business, clinical or production acceptance is inferred. The real restart test is postcommit only. Native200 inherited synthetic notice clipping is retained as a known UI issue outside this performance change. No migration/customer update release applies to this local-only delivery.
