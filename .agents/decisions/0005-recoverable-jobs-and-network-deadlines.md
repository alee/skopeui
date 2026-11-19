# 0005: Recover Shared Jobs With Bounded Network Operations

- Status: Accepted
- Date: 2026-11-18

## Context

A lost extraction acceptance response must not cause a blind second extraction.
Polling and capacity timers cannot bound stalled HTTP operations by checking the
clock only between calls. Jobs are shared across workflow pages and variables.

## Decision

Follow the backend's `docs/specs/recoverable-extraction-jobs-v1.md` contract in
`openskope/skope-api`. Generate public acceptance/status/error types from OpenAPI.
The extraction store owns a random submission key, captured original payload and
accepted job identity. Keep uncertain attempts and known jobs available for later
reconnection; apply changed analysis options through the recovered extraction.

Keep separate 60-second submission and polling budgets. Bound each fetch plus
body read to 15 seconds or the phase's remaining time. Bound analysis to 30 seconds,
allowing the backend's 20-second processing budget. Abort obsolete source/area
requests and waits, without treating that as server cancellation. Page disposal
and variable changes do not abort shared work.

Distinguish transport/phase deadlines, capacity exhaustion, backend processing
and analysis timeouts, expiry and worker loss. Only an explicit extraction
processing timeout suggests trying a smaller area. Terminal extraction failures
require a later user attempt rather than automatically starting expensive work.

## Consequences

- Retry of an uncertain submission uses the same key and payload.
- Successful shared work survives analysis/polling connection failures.
- Raw responses and detached exports retain their existing ownership guarantees.
- Keys live in the Pinia session; reloading the browser starts a new attempt.
- Redis loss intentionally loses server-side recovery records. Temporal is a later executor phase, with the same HTTP contract.
