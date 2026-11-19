# Staging functional test plan

Use this checklist after deploying coordinated UI and API changes, before
promoting them to production. It covers the browser journey and the extraction
recovery contract across both services. The automated page checks remain in
[the page functional test plan](../app/tests/page-functional-test-plan.md).

Maintain this plan with changes to the extraction lifecycle. The API's detailed
contract is in `skope-api/docs/specs/recoverable-extraction-jobs-v1.md`.

## Preparation

- [ ] Record the exact UI and API commits, deployed image IDs, CI run/attempts
  where applicable, and served dataset releases in the run record below.
- [ ] Confirm the applicable automated tests passed. For local builds, record
  the checks actually run rather than assuming CI covered the resulting images.
- [ ] Drain existing extraction work before replacing the API. For the initial
  recoverable-jobs cutover, deploy backend support before the matching UI:
  the API requires an `Idempotency-Key` header that older clients do not send.
- [ ] Reload the browser after deploying the UI. Confirm requests use
  `https://staging-api.openskope.org` and the intended dataset releases.
- [ ] Open browser DevTools with Network **Preserve log** enabled. Keep API
  logs available to correlate idempotency keys, job IDs, and actual executions.
- [ ] Choose a small, valid study area for normal tests. Arrange a controlled
  proxy/interceptor for response loss and delayed responses. Schedule worker
  termination and capacity tests when other staging users will not be disrupted.

Do not reload the tab during recovery tests: submission keys currently live in
the Pinia session. Reloading begins a new attempt. Use separate fresh attempts
for tests that change the source or require a terminal job.

## Browser journey and recovery

Mark each row in the run record as pass, fail, or not run, with evidence.

| ID | Action | Expected result |
| --- | --- | --- |
| B1 | Select a dataset, draw a small study area, visualize, analyze, and download. | Dataset metadata, raster tiles, plot, summary, and export work without console errors. Exported values and units agree with the displayed result. |
| B2 | Change analysis options after extraction succeeds. | The UI calls `/timeseries/analyze` using the completed extraction; no new extraction executes. |
| B3 | Move between Visualize and Analyze while extraction is pending. | The pages share the existing job. Navigation neither abandons shared work nor launches a duplicate extraction. |
| B4 | Change the study area or dataset during a pending request. Repeat with a delayed response from the original source. | Obsolete browser requests/retry waits stop. Late results never overwrite the current selection. The original server job may still finish; browser abort is not server cancellation. |
| B5 | Let an extraction submission reach the API, then suppress its response. Restore connectivity and retry without reloading. | Retries retain the original idempotency key and captured payload, recover the same job ID, and cause only one extraction execution. |
| B6 | After receiving a job ID, interrupt polling, reconnect, and click Retry time series on Visualize. | The UI resumes polling the same job and retrieves its result without launching a replacement extraction. |
| B7 | Interrupt analysis, then reconnect and retry. | The completed extraction remains available and is reused. No new extraction starts. |
| B8 | Keep submission requests failing through the submission budget. Repeat separately for polling. | Waiting ends with a recoverable connection/phase-deadline error. Retrying reconnects using the retained attempt or job. A transport failure does not recommend a smaller area. |
| B9 | Delay an individual HTTP response or body beyond its operation budget. Separately inject a gateway 504 without a backend timeout code. | Waiting is bounded. These errors are treated as connection trouble, not a backend processing timeout; recovery preserves the attempt/job. |
| B10 | Complete a transformed analysis, then submit different options and fail that request. Separately delay a transformed request, click Clear, and let the older request finish last. | Labels continue to describe the displayed result. Failed or obsolete requests never relabel the current traces. |
| B11 | Fail metadata loading on each dataset workflow page, then restore the API and click Retry. Also open an unknown dataset or variable. | Failed loads stop spinning and show Retry and Back to datasets actions. Retry restores the workflow without a reload; unavailable selections show a distinct message. |

For B5, going offline before clicking does **not** prove recovery after
acceptance. Confirm from API logs that acceptance occurred before losing the
response. Count execution starts, not just repeated HTTP submissions: retries
are expected to make multiple requests.

For B8–B9, the current client limits are 60 seconds for submission/recovery,
60 seconds separately for polling, 15 seconds per HTTP operation (including
response-body reads), and 30 seconds for synchronous analysis. Allow a small
measurement tolerance. These are separate phase budgets, not one combined cap.

## API lifecycle checks

Start from a valid extraction request captured in DevTools. Preserve its complete
body and source headers when replaying it; use a fresh UUID for each independent
attempt. Retain the response bodies, headers, job IDs, and relevant API logs.

| ID | Action | Expected result |
| --- | --- | --- |
| A1 | Submit a valid request, then replay the same key and identical payload, including after completion. | Acceptance is `202`; every replay returns the same job ID. Only one extraction executes. |
| A2 | Replay an existing key with a changed payload. | `409 IDEMPOTENCY_CONFLICT`; no replacement work is scheduled. |
| A3 | Submit without `Idempotency-Key`. | `422`; no work is accepted. |
| A4 | Hold all four staging extraction slots with controlled requests. Submit a fifth attempt and replay one already accepted request while capacity is full. | The new attempt receives `503 CAPACITY_EXHAUSTED` with `Retry-After: 5`. The browser can read that header through CORS. The accepted attempt still recovers its original job. After capacity clears, new work succeeds. |
| A5 | Submit a valid request with a deliberately short supported processing budget that the workload exceeds. | Status becomes terminal `TIMED_OUT` with `PROCESSING_TIMEOUT`. The UI distinguishes it from connection trouble; no replacement extraction starts automatically. A later explicit attempt can succeed. |
| A6 | Interrupt the worker responsible for an accepted job without normal cleanup. Poll/replay after its ownership lease expires. | The job reconciles to terminal `FAILED / WORKER_LOST`, admission is released, and its terminal result remains stable. A fresh attempt can succeed. |
| A7 | Inspect accepted and status responses throughout a job's lifecycle. | Release identity and lifecycle fields are present as defined by the API contract. Status never exposes `base_series`, ownership tokens, fingerprints, or internal provenance. |

A4 needs requests that actually overlap long enough to fill capacity; a burst
of fast successful requests is not sufficient. Use controlled fixtures/delays
where necessary. A6 must preserve Redis: restarting/flushing Redis tests a
different failure boundary and can lose recovery records entirely.

## Controlled fixture checks

Run these with isolated fixtures or a dedicated staging exercise when lifecycle,
release identity, or analysis execution changes. Do not wait 24 hours or mutate
shared Redis records just to force expiration. Record any omitted test and why.

| ID | Scenario | Expected result |
| --- | --- | --- |
| F1 | Stored results expire while their key tombstone remains. | Reads and matching submissions return `410 RESULT_EXPIRED`; no extraction is dispatched. A conflicting payload still returns `409 IDEMPOTENCY_CONFLICT`. |
| F2 | New submission declares a stale source release; separately analyze stored work against a different currently served release. | Submission returns `409 SOURCE_CHANGED`; incompatible analysis returns `410 SOURCE_CHANGED`. Refresh metadata before a new source attempt. |
| F3 | Recover an accepted attempt after the served release changes. | Recovery returns the original accepted job and release before current-source/capacity checks. It never silently extracts against the new release. |
| F4 | Analysis exceeds its server budget. | The API reports `ANALYSIS_TIMEOUT`; the executing analysis process is stopped and its slot becomes available. The extraction remains usable. A later analysis can succeed without re-extracting. |

## Release gate

- [ ] B1–B11 and A1–A7 pass, or an explicit release decision records an exception,
  its evidence, and its impact.
- [ ] Applicable F checks pass; omitted fixture checks have a recorded reason.
- [ ] Submission and polling recovery preserve job identity without duplicate
  extraction execution.
- [ ] Stale results never replace the current source's results.
- [ ] Processing timeout, worker loss, and connection failures leave staging
  able to accept and complete fresh work.
- [ ] Production promotion selects the intended staging-tested images. If a
  local rebuild is necessary, record it and the validation performed on it.

## Run record

Copy this template into the release/PR record for each staging pass. Keep the
reusable plan here; link to logs, screenshots, and exports from the run record.

```text
Date/time and tester:
UI URL / commit / image ID:
API URL / commit / image IDs:
CI runs/attempts or local-build details:
Dataset release IDs:
Browser/version:
Study area and analysis options:

Test ID | Pass / Fail / Not run | Evidence and observations

Exceptions and reasons:
Blocking defects / issue links:
Release decision and owner:
```
