# OpenAPI Mock Server

This lightweight Express server lets us exercise the UI (and future integration
tests) against the same contract defined in `openapi/rentease.yaml` while the
real backend endpoints are still in flight.

## Quick start

```bash
npm run mock:api
```

The task spins up a mock server on `http://localhost:4100` by default and
auto-registers every path/method described in the OpenAPI document. Responses
are generated from each schema (preferring `example`, `default`, or enum values
and falling back to sensible primitives), so consumers always receive payloads
that match the published contract.

### Customising

```bash
npm run mock:api -- --port 4300 --spec openapi/rentease.yaml
```

- `--port` sets the listening port (also supports `MOCK_PORT=4300`).
- `--spec` points to an alternative YAML/JSON OpenAPI file.

### Health & inspection endpoints

- `GET /__health` – returns `{ status: 'ok', spec: '<relative path>' }`.
- `GET /__spec` – returns the parsed OpenAPI document for quick debugging.

## Using in tests

1. Start the mock server (`npm run mock:api`) before executing your Cypress /
   Playwright / integration suite.
2. Point the frontend `environment.apiUrl` (or the test runner’s proxy) to the
   mock server (e.g. `http://localhost:4100`).
3. Extend `tools/openapi-mock-server.js` with richer examples if a particular
   endpoint requires deterministic fixtures.

Because the server is driven entirely by the OpenAPI contract, changes to the
spec immediately flow into the mock responses, keeping our automated tests and
manual QA aligned with the latest backend expectations.***
