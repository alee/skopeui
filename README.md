# Synthesizing Knowledge of Past Environments

[![DOI](https://zenodo.org/badge/159711888.svg)](https://zenodo.org/badge/latestdoi/159711888)
[![Build/Test Docker Image CI](https://github.com/openskope/skopeui/actions/workflows/docker-ci.yml/badge.svg)](https://github.com/openskope/skopeui/actions/workflows/docker-ci.yml)

SkopeUI is the Nuxt 4 frontend for the [Synthesizing Knowledge of Past Environments](https://www.openskope.org/) platform. It provides dataset discovery, interactive MapLibre visualization, study-area selection, and time-series analysis backed by [skope-api](https://github.com/openskope/skope-api).

Install Git, GNU Make 4.3 or newer, Docker, and Docker Compose on the host. Node and npm commands run inside the application container. Runtime and package-manager versions are defined in [the Dockerfile](app/Dockerfile) and [package.json](app/package.json); dependencies are installed reproducibly with `npm ci` from `app/package-lock.json`.

## Local development

Start the development server at <http://localhost:3000>:

```bash
make deploy-dev
```

The development build uses `http://localhost:8001` for the API by default. Override it for a single command when needed:

```bash
make deploy-dev SKOPE_API_HOST_URL=http://example.test:8001
```

Run the test suite with `make test`; it first runs full Nuxt type checking,
including Vue scripts, templates, and TypeScript tests. Use `make typecheck` to
run only the type check. Nuxt manages the application, server, shared, and build
configuration types through project references in `app/tsconfig.json`. Use `make lint` to run ESLint with automatic fixes, or `make format` to format files and apply ESLint fixes; both commands can modify source files.

After pulling dependency changes, recreate the development container and its anonymous `/code/node_modules` volume so it uses the rebuilt image's dependencies:

```bash
make down ENVIRONMENT=dev
make deploy-dev
```

Include your `SKOPE_API_HOST_URL` override again if you use a custom API endpoint.

## Deployment

After deploying coordinated UI and API changes, run the
[staging functional test plan](docs/staging-functional-test-plan.md) and attach
the completed run record to the release or PR.

Each deployment target selects its API endpoint explicitly:

| Target                   | UI image                    | API endpoint                        |
| ------------------------ | --------------------------- | ----------------------------------- |
| `make deploy-dev`        | `openskope/skopeui:dev`     | `http://localhost:8001`             |
| `make deploy-staging`    | `openskope/skopeui:staging` | `https://staging-api.openskope.org` |
| `make deploy-production` | `openskope/skopeui:prod`    | `https://api.openskope.org`         |

Deployments build the selected image, replace the running Compose service, and wait for its health check. Use `make config ENVIRONMENT=staging` to inspect the resolved Compose configuration before deploying. Operational commands accept the same environment selection, for example:

```bash
make ps ENVIRONMENT=staging
make logs ENVIRONMENT=staging
make restart ENVIRONMENT=staging
make down ENVIRONMENT=staging
```

UI deployments currently build on the application host and do not depend on
GitHub Actions or its artifacts. During a GitHub outage, use the existing local
checkout and run `make deploy-staging` or `make deploy-production` as usual.
Add `PULL=0` to build with cached base images if their registries are unavailable.
Missing Docker layers, citation tooling, and npm/OS packages can still require
network access; retain known-good images and the generated citation assets on
the host for broader outages. A local rebuild does not establish that the
resulting image passed CI; run `make test` before deployment when possible.

The API URL is read from Nuxt's `runtimeConfig.public.apiBase` at container
startup. Compose supplies `NUXT_PUBLIC_API_BASE` using the environment defaults
above. Both `NUXT_PUBLIC_API_BASE` and the existing Make override
`SKOPE_API_HOST_URL` are supported; the Make override takes precedence when both
are supplied. Changing the URL requires recreating the container, without an
image rebuild. An already-open browser needs a reload to receive the new value.

Make generates `app/generated/citation.txt` and `citation.bib` from `CITATION.cff`
before tests and builds. These ignored text assets are imported with Vite's
`?raw` suffix. Run `make citations` to generate them independently and `make clean`
to remove them. The Git version is passed to Docker as `SKOPE_BUILD_ID` and
compiled into Nuxt's `appConfig.buildId`; it stays tied to the built image.

API paths are resolved by `app/utils/apiEndpoints.ts` from the configured base.
Analysis options, export README text, and statistics helpers have their own
utility files. Application state lives in the Pinia stores under `app/stores/`.

The GitHub Actions workflow runs the test suite and builds the production image for pushes and pull requests against `main`. Run `make config ENVIRONMENT=staging` to check the staging runtime settings and `make build ENVIRONMENT=staging` to validate the deployable image before merging an upgrade.

## Maintenance

The Docker build follows the active Node LTS image and enforces the supported engine ranges in `app/package.json`. When LTS moves outside those ranges, CI fails until the new runtime and dependencies are reviewed. Rebuild regularly to receive base-image updates. Production contains only the Node runtime, required system packages, and Nuxt's built output; npm is available in the development image.

When changing dependencies, regenerate `app/package-lock.json` in Docker, rebuild the image, and recreate the development container as described above. Check compatibility with the framework and build tools, and select stable releases explicitly: a package's `latest` tag can point to a prerelease. Keep exact versions in the Dockerfile, package manifest, and lockfile rather than duplicating them in documentation.

Audit the lockfile's installed dependencies in a freshly built development image:

```bash
make build ENVIRONMENT=dev
docker run --rm openskope/skopeui:dev npm audit
```

Compare resolved versions, including nested copies, with the repository's [Dependabot alerts](https://github.com/openskope/skopeui/security/dependabot). Alerts describe the default branch and can remain open until an upgrade is merged. Review dependency overrides with each upgrade and remove them when upstream dependencies provide the required fixes. npm can report several affected parent packages for one advisory; inspect the dependency chain before accepting a suggested downgrade.

Validate upgrades with `make test` and `make build ENVIRONMENT=staging`. In a browser, also check dataset loading, study-area drawing and editing, raster playback, time-series plotting, and exports; automated tests and builds do not exercise the full interactive workflow.

## Maintainers

- Manuela Vanegas Ferro [@manuvanegas](https://github.com/manuvanegas)
- Allen Lee [@alee](https://github.com/alee)
- Kyle Bocinsky [@bocinsky](https://github.com/bocinsky)

Past and present contributions are recorded in the [GitHub contributors](../../graphs/contributors) history.

## Basemaps

All maps now use MapLibre. Workflow maps retain the Esri Topographic default,
Esri Terrain, and Esri Gray Canvas. Stamen Toner Lite and CARTO Positron are
available when their authentication is configured:

| Runtime environment variable          | Purpose                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `NUXT_PUBLIC_CARTO_API_KEY`           | Enables Positron using CARTO's `key` parameter.                                    |
| `NUXT_PUBLIC_STADIA_API_KEY`          | Enables Toner Lite using Stadia Maps' `api_key` parameter.                         |
| `NUXT_PUBLIC_STADIA_DOMAIN_AUTH=true` | Enables Toner Lite without a key after registering the UI domain with Stadia Maps. |

Set these in the deployment environment or the repository's ignored `.env`
file, then use the normal Make deployment target. Compose forwards them to the
Nuxt server at runtime; no credential is baked into the image. These are
browser-visible provider keys; restrict them to the UI domains in the provider
dashboards. Providers without configuration are omitted from the menu.

Toner Lite uses the current [Stadia Maps service](https://docs.stadiamaps.com/map-styles/stamen-toner/)
and [authentication options](https://docs.stadiamaps.com/authentication/).
Positron uses the current [CARTO raster service](https://www.carto.com/basemaps/).
Attribution is supplied on each raster source, and source zoom limits allow
MapLibre to overzoom Terrain's last supported level instead of requesting
unavailable tiles.

Dataset cards use topographic previews with the advertised viewport and extent.
They link to the dataset; previews create a WebGL map only near the viewport and
release it when offscreen. The old map-engine override and alternate renderer
have been removed.
