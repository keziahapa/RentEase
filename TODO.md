# TODO

- [x] Replace the mock maintenance collections in `src/app/services/maintenance.service.ts` with live API fetches (keep the graceful fallback, but ensure tenant and caretaker dashboards read real backend responses first).
- [x] Resolve build-time Angular template warnings, especially the unused component import and redundant optional chaining in the maintenance/admin templates (`src/app/components/dashboard/**/maintenance/maintenance.component.html`, `src/app/components/dashboard/admin/admin-dashboard/components/admin-overview/admin-overview.component.ts`).
- [x] Update `AdminDataService` (`src/app/services/admin-data.service.ts`) to persist fetched entities instead of relying on hard-coded business/advertisement arrays, and add error handling that surfaces backend validation messages to the UI.
- [x] Wire the new mock server into an automated integration/e2e test suite so CI can validate flows against the OpenAPI contract (see `tools/openapi-mock-server.js` & `docs/openapi-mock-server.md`).
- [x] Add targeted unit/integration tests for the new skeleton loading states to ensure they render for loading scenarios and disappear once live data resolves (tenant and caretaker maintenance components, admin overview).
