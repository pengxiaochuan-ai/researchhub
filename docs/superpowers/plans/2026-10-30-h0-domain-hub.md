# H0 Domain Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make H05/H01 and later H02–H07 read and operate on authorized, traceable Hub data without displaying demo results in real mode.

**Architecture:** Add a ResearchHub-only `rh_hub` schema and local bounded API, reuse `rh_source` current review projection and old shared Account/Study relationships. Keep public Hub information separate from private Study records. Implement three vertical stages; stop before new grants or paid AI.

**Tech Stack:** PostgreSQL, NestJS local ResearchHub adapter, React/Vite, Node test runner, Playwright/Chrome.

**Spec:** `researchhub/docs/product/domain-hub-h0-spec-2026-10-30.md`

## Global Constraints

- Only `wp01_test_full_baseline` synthetic PG; no clinical DB, old service modification, remote configuration, cloud resource, or release.
- Do not broaden existing roles or grant `source.review` for Hub scope administration.
- No paid model call without renewed price and cost approval.
- Frontend demo remains only behind explicit demo mode; real mode never falls back to static data.
- Preserve old UI Shell and H01/H05 visual grammar; all new counts are deterministic and source-qualified.

## Review Focus

- Forged hub key or cross-tenant session must not reveal Hub relations or private Study data (Task 1/2 tests).
- Unreviewed or revoked source must not appear in H01 or metric (Task 3 tests).
- Duplicate source rows must not be reported as distinct publications (Task 3 tests).
- Slow account switch must not restore prior user's follow state (Task 2 browser test).
- Failed scope AI or stale source must not look approved or complete (Task 4 tests).

---

### Task 1: Single Hub storage and bounded read API

**Files:** Create `server/hub/schema.sql`, `server/hub/repository.mjs`, `server/hub/controller.mjs`, `scripts/hub-schema.mjs`; modify `scripts/local-knowledge.mjs`; tests beside modules.

**Interfaces:** `listHubs({db,tenantId})`, `getHub({db,tenantId,hubKey})` return only public ACTIVE Hub fields; authenticated relation operations are separate.

- [x] Write failing schema/API tests for one Hub, unknown Hub, wrong tenant and no-study-grant follow.
- [x] Run tests and confirm expected RED.
- [x] Add additive FORCE RLS schema, guarded synthetic migration/initializer and public API.
- [x] Run local unit/PG/HTTP tests and confirm GREEN; preserve existing tables and source rows.
- [x] Update local living spec, changes and test evidence; ResearchHub Notion destination remains unassigned (old-project page is not a safe target).

### Task 2: H05/H01 true-data page connection

**Files:** Modify `src/real-mode-route.js`, `pages/h05/src/main.jsx`, `pages/h01/src/main.jsx` or focused real components and scoped CSS; tests in `tests/`.

**Interfaces:** Consume Task 1 API; no demo fallback on 401/403/5xx.

- [ ] Add automated page behavior tests for 403/5xx and account-switch races (API negatives and real browser account-switch are covered; race injection remains).
- [x] Existing route test failed on H01 pending→live classification; corrected expectation and reran GREEN.
- [x] Implement real-mode H05/H01 while preserving explicit demo and public Shell.
- [ ] Run tests/build and browser flow with screenshots/recording, including desktop/mobile/200% (tests/build/desktop screenshots and two-account switch done; other viewport/recording pending).
- [x] Update local product/usage/technical/test docs; ResearchHub Notion destination remains unassigned.

### Task 3: Reviewed sources and calculated metrics

**Files:** Extend `server/hub/repository.mjs`, `controller.mjs`, H01 real component and tests; reuse `server/hub-sources/visible-repository.mjs`.

**Interfaces:** Return latest currently approved publications with provenance; metric values are `null` until canonical dedup and source-type coverage are verified.

- [x] Write failing overview test and PG tests for revoked/unreviewed/duplicate DOI sources, positive synthetic current-review fixture and distinct metric status.
- [x] Run overview HTTP test and confirm expected RED before implementation.
- [x] Add source-backed current-approved projection and `null` metricStatus where evidence does not support a count.
- [x] Run unit/PG/HTTP/browser/build and record zero-approved real state plus rollback-only eligible synthetic fixture (2 current-approved same-DOI records → 1 after revoke).
- [x] Update local living spec, version history and test evidence; ResearchHub Notion destination remains unassigned.

### Task 4: Clinical/guide source and H02–H04 governance

**Files:** Scope/guide/registry modules and H02–H04/H06/H07 scoped components; tests and docs.

**Interfaces:** Current reviewed source and explicit governance grant; deterministic checks before any model draft.

- [ ] Stop for any new Hub governance authorization or paid model price/cost permission before enabling those actions.
- [ ] Implement only approved source types and rights, versioned scope draft/confirm, free checks and authorized AI adapter with source-version fences.
- [ ] Verify real PG/API/Chrome, role negatives, revocation and professional artifact; update docs and Notion.

### Task 5: Independent total review

- [x] One fresh read-only reviewer checks scope, privacy, counting, source rights and UI fidelity; six findings received a post-repair read-only recheck.
- [x] Fix confirmed code/document findings with targeted RED→GREEN, 16/16 suite, build, guarded schema reapply and desktop browser recheck; retain concurrency/slow-response, mobile/zoom and recording evidence gaps explicitly.
- [ ] Report four acceptance layers separately; do not claim production/professional completion without evidence.
