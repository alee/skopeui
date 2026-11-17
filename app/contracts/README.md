# Frontend API contracts

`metadata-1.0.0.schema.json` is the existing versioned metadata contract.
`timeseries.schema.json` contains the request, result, and status definitions
exported from `skope-api` OpenAPI at the revision recorded in `x-skope-source`.
It includes referenced geometry, transform, and smoothing definitions.

To update time-series contracts, obtain `/openapi.json` from the matching backend
checkout or deployment, then run inside the frontend Docker service:

```sh
npm run types:timeseries -- /path/to/openapi.json skope-api@<commit>
```

To regenerate TypeScript from the committed schema snapshot:

```sh
npm run types:timeseries
```

The generator converts JSON Schema tuples and preserves OpenAPI discriminator
tag requirements in TypeScript unions. `make test` checks that generated files
match their committed snapshots and runs the focused API TypeScript check.
These checks do not compare against a running backend.

The backend currently omits successful response declarations for extract and
analyze. Analyze uses the existing `TimeseriesResponse` model, which OpenAPI
exposes through job status. The small extract acceptance reply is declared in
`types/api.ts` to mirror the existing route payload until its backend response
model is available. Response types describe the wire contract; request validation
and the missing-success-result check are the runtime checks in the API client.

## Saved analyses

`skope-request.json` files retain their existing raw extraction-request format.
There is no new envelope or schema-version field. Legacy files that omit analysis
options receive mean, no transform, and the original unsmoothed series; explicit
invalid options are rejected.

Imports validate JSON structure against the backend snapshot, then check the
frontend's single point/polygon restriction, closed polygon rings, calendar and
range ordering, unique series names, centered-window parity, dataset/variable
availability, time coverage, and dataset-specific window sizes. Invalid or
superseded imports leave active stores and persisted study areas untouched.
Backend checks remain authoritative for polygon validity, intersection, limits,
and whether a transform can be computed from the available values.
