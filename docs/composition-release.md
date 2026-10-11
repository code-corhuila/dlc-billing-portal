# HU-BIL-002 independent composition release

Related issue: code-corhuila/dlc-billing-portal#3; HU: code-corhuila/dlc-docs#64.
Specification: ADR-011 and frontend-composition.md C01-C03 at docs `638e4f2`.
Base: develop `2f1cb4f`. No API connections or new dependencies are introduced.

## Build and serve

Run `npm run build:portal`, then `npm run serve:portal`.
Default entry: `dist/portals/billing/0.1.0-demo/entry.js`.
Preview URL: `http://localhost:4204/portals/billing/0.1.0-demo/entry.js`.
`BILLING_RELEASE` overrides the release; `PORT` overrides the preview port.
The preview and standalone application use the same default port; run one at a time.

The Angular application builder compiles only the composition entry into an ES
module and bundles its framework. There are no import maps or shared runtimes.
The entry is inert on import and is renamed from main.js after compilation.
Local rebuilds replace unpublished artifacts; published releases must never be
overwritten. Publish a new release directory and retain referenced releases.
The static service accepts GET/HEAD, sends no-store and returns real 404 responses.
Deep links belong to the shell; the asset service has no index.html fallback.

## Container handoff

`deploy/compose.yml` defines `billing-portal-demo`, HTTP port 80 internally and
host port 4204 by default (`BILLING_PORT`). Its network is `dlc-billing-portal_default`.
The final nginx image contains only versioned portal assets, not source or specs.
The build stage uses Node 22; this does not change dlc-front's Node 24 toolchain.
`docker compose -f deploy/compose.yml config` validates the configuration.
Image build, nginx runtime and container/network checks remain pending because
Docker Desktop was not running during this increment.

The separate dlc-front increment must update its registry descriptor to release
0.1.0-demo and entryUrl `/portals/billing/0.1.0-demo/entry.js`, add a same-origin
proxy for Billing to preview/nginx, and join the Billing network for Docker.
Proposed upstreams: local preview `http://localhost:4204`; Docker `http://billing-portal-demo`.
Keep existing visibility rules; `/procedures` still needs domain screen wiring.

## Revision-specific evidence

| Behavior | RED and expected failure | GREEN and result |
|---|---|---|
| Independent release and valid release names | `98fe7d0`: packaging script absent, 5 failures | `1a127c4`: 5 tests passed |
| Asset serving, HEAD, cache and confinement | `c28bd8a`: server module absent, 4 failures | `b83d9aa`: 4 tests passed |

Specs are colocated with scripts and executed by Vitest; no root tests folder is required.
The module audit evaluates the actual AOT bundle in an isolated ES-module realm,
rejecting bare/external imports and import-time DOM, request, history or timer work.
The realm includes browser-compatible performance; it does not simulate mounting.
The HTTP tests use actual sockets and temporary static fixtures.

Full `npm run test:coverage`: 85 tests passed in nine files; frontend source line
coverage is unchanged at 48.50%, with 100% for current domain utility lines.
Scripts have functional tests but are outside the existing src/**/*.ts metric.
The 80% overall target remains unmet. CI also builds the default portal release.
The existing build passed. Artifact tests built release 0.1.0-test successfully;
the final explicit default-release build was not run because approval was declined.

Browser check: actual AOT module imported with an empty host, mounted Angular
without errors, updated to local 404, unmounted twice and remounted/aborted.
The host returned to zero children and the sibling fixture remained present.
This used synthetic context and a disposable harness, not dlc-front itself.
The adapter still renders its unavailable frame; dummy domain views, shell
registration, integrated browser acceptance and independent DoD review remain pending.
