# Bug reports

The header's Report a bug form submits explicit user feedback to the existing
Sentry project. It does not require a Sentry account, GitHub account or email
client. Contact remains available for general correspondence.

The reporter supplies a description, optional contact email and optional image
(PNG/JPEG/WebP, up to 5 MB). The form captures a snapshot when opened:

- Page URL without query or fragment, UI build and API base URL.
- API build/environment from `/version`, when reachable (three-second budget).
- Browser, language, viewport and capture timestamp.
- Current dataset/variable, release ID and declaration digest.
- Selected interval, map step, current analysis form draft, submitted settings
  and displayed-result settings, separately, so a pending form is not mistaken for a completed result.
- Current extraction job ID, if known, and the last 20 JSON request outcomes
  with operation, status, correlation ID and error code. This history is kept
  only in tab memory; it contains no bodies, idempotency keys or raw request URLs.
- Study-area geometry, included by default, with an option to exclude it. GeoJSON
  properties are stripped. The exclusion also applies to saved report copies;
  geometry is not hidden elsewhere in the analysis settings or request history.

The report includes `skope-diagnostics.json` (up to 2 MB) as an attachment.
The reporter can review it before sending. A dedicated Sentry client has no
replay, automatic error or breadcrumb integrations and does not inherit the
application's ambient user context. Sending a report does not enable general
client telemetry. Screenshots are supplied explicitly, never captured silently.

`NUXT_PUBLIC_SENTRY_DSN` configures the public feedback ingestion address at
container startup. It defaults to the existing SKOPE project. No account token
is exposed. Configure an empty value to disable sending. Private account access
and attachment retention are maintained in Sentry, not in the frontend.
Self-hosted Sentry 24.4.2 or newer is needed for the full feedback API.

A success message appears only after the SDK reports a successful ingestion
response. Loading the feedback SDK and waiting for ingestion acknowledgement
have separate 12-second limits. A stalled SDK download cannot send a report
later after that attempt has timed out. No confirmation, rejection, blocking or offline
failure preserves the draft and offers Save a copy and the existing contact
address. A timeout means delivery is uncertain; an event ID alone is not proof
of receipt. Save a copy contains the description, email and reviewed diagnostics;
any screenshot must be retained/attached separately when using the fallback.
Drafts are kept in memory while the page remains open, not persisted in browser
storage. Reloading loses an unsent draft.

API support is backward-compatible: `/version` is read-only and exposes only the
build ID and environment. Missing/unreachable version endpoints do not block a
report. `X-Request-ID` is exposed through CORS for JSON API request correlation.
The API's Compose builds and runtime-image CI bundle builds bake their revision
into the image. UI/API build identifiers locate the maintainer's deployment
record; the browser cannot read Docker image IDs, CI run attempts or host logs.
Dirty development builds are labeled as such, not represented as immutable
production identities.

Before inviting testers, verify that the deployed Sentry instance accepts and
retains feedback attachments. Local automated tests mock ingestion and do not
send reports to the team. A coordinator should verify one clearly labeled test
report on staging as part of deployment readiness.
