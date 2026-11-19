# Frontend API contracts

`metadata-1.0.0.schema.json` is the existing versioned metadata contract.
`timeseries.schema.json` contains request, result, acceptance, status, and error
models exported from the backend OpenAPI document, including referenced geometry,
transform, and smoothing definitions. `x-skope-generated-from` identifies that
input as `openskope/skope-api OpenAPI components`. It is descriptive provenance;
it does not identify a contract version or perform runtime compatibility checks.
The generator sets it automatically, without branch names or commit references.

To update time-series contracts, obtain `/openapi.json` from the matching backend
checkout or deployment, then run inside the frontend Docker service:

```sh
npm run types:timeseries -- /path/to/openapi.json
```

To regenerate TypeScript from the committed schema snapshot:

```sh
npm run types:timeseries
```

The generator converts JSON Schema tuples and preserves OpenAPI discriminator
tag requirements in TypeScript unions. `make test` checks that generated files
match their committed snapshots and runs full Nuxt type checking.
These checks do not compare against a running backend.

Response types describe the wire contract. Request validation and response checks
in the API client remain responsible for runtime validation.

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
