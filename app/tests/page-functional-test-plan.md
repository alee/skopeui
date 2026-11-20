# Page Functional Test Plan

## Goal

Ensure every Nuxt page loads, renders core UI, and completes its primary user action without runtime errors.

## In Scope (Current Routes)

- `/` (`pages/index.vue`)
- `/dataset/:id` (`pages/dataset/[id]/index.vue`)
- `/dataset/:id/visualize/:variable` (`pages/dataset/[id]/visualize/[variable].vue`)
- `/dataset/:id/analyze/:variable` (`pages/dataset/[id]/analyze/[variable].vue`)

## Test Layers

### 1) Route Smoke Tests

Purpose: verify each page mounts and critical content appears.

- Use Vitest + Vue Test Utils.
- Mock stores/composables (`useDatasetMetadata`, `useStudyArea`, Pinia stores) and network calls.
- Assert no unhandled promise rejection and no Vue error logs.

### 2) Page Behavior Tests

Purpose: verify each page's core CTA and state transitions.

- Keep assertions focused on one primary flow per page.
- Stub API responses for deterministic results.

### 3) Manual Journey Check (Required before release)

Purpose: verify integrated browser behavior with real backend data.

- One end-to-end path: Home -> Dataset -> Visualize -> Analyze -> Download.
- Record pass/fail in release checklist.
- Use the [staging functional test plan](../../docs/staging-functional-test-plan.md)
  for the science team browser journey and scientific acceptance checks.
- Maintainers use the [engineering checklist](../../docs/staging-maintainer-checklist.md)
  for deployment prerequisites, controlled recovery checks, and release records.

## Route Matrix (Must Pass)

| Route                              | Smoke assertions                                                            | Core behavior assertion                                                    |
| ---------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `/`                                | Header `Select a Dataset` renders; dataset cards or empty-state alert shown | Search/filter changes visible dataset list                                 |
| `/dataset/:id`                     | Map view renders after metadata load                                        | `Visualize Data` button is disabled without area, enabled after valid area |
| `/dataset/:id/visualize/:variable` | Map and TimeSeriesPlot render                                               | Time-series request updates store status and trace data                    |
| `/dataset/:id/analyze/:variable`   | Analysis form and plot render                                               | Clicking `Update` sends request data and refreshes summary/series          |

## Test Data and Mocks

- Baseline dataset fixture: one dataset with metadata, variables, and temporal range.
- Study area fixtures: `null`, polygon, feature collection.
- API fixtures for time series: success, 4xx validation, 5xx error, timeout-like failure.

## Maintainability Rules

- Keep one spec file per page route:
  - `tests/pages/index.spec.ts`
  - `tests/pages/dataset-id.spec.ts`
  - `tests/pages/visualize-variable.spec.ts`
  - `tests/pages/analyze-variable.spec.ts`
- Use shared factories for store state and API responses under `tests/fixtures/`.
- Avoid snapshot-heavy tests; prefer stable semantic assertions.
- For every new page route, add one smoke test and one core behavior test in the same PR.

## Execution Cadence

- Before merging: run `make test` from the repository root. It includes route smoke and page behavior tests.
- PR CI runs `make test` and builds the production image. A nightly behavior job is not configured.
- Release: run manual journey check once on staging.

## Definition of Done

The app is considered page-functional when:

- Smoke tests for all four routes pass.
- Behavior tests for all four routes pass.
- Manual release journey passes without blocking defects.
