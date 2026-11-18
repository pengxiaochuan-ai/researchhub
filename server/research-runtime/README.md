# ResearchHub research runtime

Independent HTTP entry for Hub authentication and research-project / Study commands. It mounts no legacy AppModule, workers, fixture initializer, background recovery, or migration runner. Schema migration is an explicit deployment prerequisite.

F03 also mounts separate public, admitted-member and administrator academic-content controllers for the fixed `lingshu-xinyu` Hub. The current F01/F03 assembly requires exactly one allowed tenant. Apply and verify the explicit academic-content schema before enabling these routes; startup does not migrate it. Public responses never inherit member scope from a cookie. See [F03 interfaces, storage and operation](../../docs/technical/f03-academic-content-2026-11-18.md) for route contracts, 256 KiB handling, versioned resources and local verification boundaries. Production configuration and real content approval remain separate.

For the current shared local site, use `node scripts/local-knowledge.mjs start` from the ResearchHub directory and visit `http://127.0.0.1:19501/pages/q02/`. The research controller is assembled into its existing internal API. The former isolated local instance is stopped; `scripts/research-creation-local.mjs` now forwards to that shared launcher. This standalone entry remains a deployment assembly option, not a second running local site.

Required environment:

| Key | Contract |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL connection URLs, respectively restricted application and authorization/administrative connections |
| `JWT_SECRET` | At least 32 UTF-8 bytes; supplied by secret management |
| `DEPLOYMENT_ID` | Existing deployment identifier syntax |
| `DEPLOYMENT_PRODUCT` | `researchhub` |
| `ALLOWED_TENANT_IDS` | Nonempty unique CSV, existing deployment scope syntax |
| `DEFAULT_TENANT_ID` | One of the allowed tenant IDs |
| `AUTH_COOKIE_NAME` | Existing Hub deployment cookie rules; never the legacy `aisci_session` |
| `HUB_APP_ORIGIN` | Exact public HTTPS origin, or explicit HTTP loopback origin with port |
| `HUB_AUTH_COOKIE_SECURE` | `true` for HTTPS; `false` only for HTTP loopback |

`CONTROL_PLANE_ENABLED` must be absent or `false`. `ENABLED_WORKER_KINDS` and `OFFICIAL_JOB_KINDS` must be empty. `HUB_API_HOST` defaults to `127.0.0.1`; `HUB_API_PORT` defaults to `19612` (valid TCP port). All invalid configuration fails before clients connect; diagnostics name only fields, never values.

Start explicitly with `node server/research-runtime/start.mjs`. Import `bootResearchRuntime(env)` from `main.mjs` for controlled orchestration; it resolves to `{ app, address, close }`. Importing does not start a service. `close()` is idempotent. The standalone entry handles SIGINT/SIGTERM. Startup failure closes clients and yields a generic diagnostic.

Serve the SPA separately and proxy `/api` to this listener under `HUB_APP_ORIGIN`; this runtime does not serve static files or grant cross-origin browser access. All responses are noncacheable. JSON bodies are limited to 256 KiB, must be objects/arrays (endpoint validation further restricts shapes), and unsafe requests require the configured Origin and JSON content type. This byte limit accommodates the allowed 20,000-character question plus four 10,000-character PICO fields in Chinese. Auth cookies keep the shared 12-hour session contract.

Run runtime tests with `node --test server/research-runtime/*.test.mjs`. Unit/HTTP assembly verification is separate from real database, browser, deployment, and business acceptance.
