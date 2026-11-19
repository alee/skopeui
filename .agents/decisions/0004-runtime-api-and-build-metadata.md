# 0004: Separate Runtime API Configuration from Build Metadata

- Status: Accepted
- Date: 2026-11-18
- Partially supersedes: [0003](0003-environment-specific-container-deployment.md), for generated client constants and API URL binding.

## Context

The API URL, Git version, and citation text previously shared a generated JavaScript module. This required an image rebuild for an API URL change and shell escaping of citation contents into source code.

## Decision

Use Nuxt public runtime configuration (`NUXT_PUBLIC_API_BASE`) for the API base URL. Read it when creating a store or composable and pass it to pure endpoint and request factories; no process-wide mutable API client is shared between app instances. Map tiles use the same configured API gateway.

Keep the Git version in Nuxt `appConfig.buildId`, populated at build time through the `SKOPE_BUILD_ID` Docker build argument. Generate citation text and BibTeX as ignored assets under `app/generated/`, imported with Vite's `?raw` suffix.

Retain the explicit Make deployment targets, environment defaults, distinct image tags, and Nitro production image from decision 0003. Make still accepts `SKOPE_API_HOST_URL` as an override and forwards the selected URL as runtime configuration.

## Consequences

- An API URL change requires recreating the container and reloading existing browser tabs; it does not require rebuilding the image.
- Build IDs and citation text remain tied to the image and require a rebuild to change.
- Test resolved deployment settings and exercise one built image with different API URLs, rather than expecting environment-specific URLs in the client bundle.
- Citation generation remains a prerequisite for tests and image builds, without generating application source code.
