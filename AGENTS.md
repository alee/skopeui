# SkopeUI Agent Guide

SkopeUI is a Nuxt 4 frontend for paleoclimate dataset discovery, study-area selection, raster visualization, and time-series analysis. Application code lives under `app/`.

## Working Conventions

- Run Node and npm commands in Docker; do not use host-installed tooling. Prefer the root Make targets.
- Citation assets in `app/generated/` are generated and ignored. Generate them through `make citations`; do not edit them directly.
- The API URL comes from `runtimeConfig.public.apiBase` (`NUXT_PUBLIC_API_BASE`) at container startup. Staging must use `https://staging-api.openskope.org`. Make selects the environment default; `SKOPE_API_HOST_URL` remains a supported Make override. The Git build ID is compiled into Nuxt app config via `SKOPE_BUILD_ID`.
- Pinia stores in `app/stores/` are authoritative for application state. Shared utilities belong in `app/utils/`.
- Browser-dependent map components use the `.client.vue` suffix.
- Keep study-area persistence behind `useStudyArea`. The application supports one active study feature, and circles must become polygons before persistence or API submission.
- Preserve the study-area guard on the visualize and analyze routes (`middleware/requires-study-area.ts`): without an area they redirect to the select-area page.
- Raster work uses MapLibre with the `skope-api` tile gateway. Do not add direct storage coupling or restore GeoServer/WMS paths.

## Validation

Use `make test` for full Nuxt type checking and the Vitest suite. Use `make typecheck` for the type check alone; it includes Vue templates and TypeScript tests. Use `make build ENVIRONMENT=staging` to validate the deployable Nuxt image and `make config ENVIRONMENT=staging` to inspect resolved Compose configuration.

## Git And Decisions

- Use Conventional Commit messages and keep commits logically scoped. Treat the diff as the record of what changed; commit bodies should capture why and any non-obvious decisions.
- Do not create commits unless the user explicitly asks.
- Use scopes only for established repository areas.
- For non-trivial changes, use concise lowercase `-` bullets for rationale, tradeoffs, or operationally relevant details that are not evident from the diff.
- Omit a body when it would only restate the subject or diff.
- Prefer branch-wide issue references in the pull request description. Do not repeat the same issue footer across every commit in a branch. Add a lowercase commit footer only when standalone traceability matters, such as for a direct fix, backport, or independently cherry-picked change.
- Architectural decisions live in `.agents/decisions/`. Add an ADR only for durable, cross-cutting choices; preserve accepted ADRs and supersede them with a new ADR when a decision changes.
- Consider whether a frontend feature or change would be significantly simpler with coordinating backend changes in `openskope/skope-api`.
