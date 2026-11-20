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

After pulling dependency changes, run `make deploy-dev` again. Development deploys
rebuild the image and recreate the container with a fresh disposable
`/code/node_modules` volume, so dependencies match the lockfile. Source files
remain bind-mounted for live editing. There is no need to run `make down` first.

Include your `SKOPE_API_HOST_URL` override again if you use a custom API endpoint.
`make restart` only restarts the existing container; use `make deploy-dev` when
dependencies change. Staging and production use dependencies baked into their
images and do not renew development volumes.

## External study-area handoff

CyberSW and other browser clients can POST a `studyArea` field to
`/dataset/<dataset_id>` to open the selection map with that point or polygon
selected. The selection replaces the dataset's previously saved study area and
is persisted through the normal study-area workflow. This returns the HTML page;
it does not submit a time-series extraction.

Use a browser form with method `POST`, or test the response with:

```bash
curl --data-urlencode 'studyArea={"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[-107.971802,36.048799]}}' \
  https://staging.openskope.org/dataset/paleocar_v3
```

The legacy CyberSW request using `--data 'studyArea={...}'` with
`Content-Type: application/json` remains supported. JSON objects with a
`studyArea` field (a GeoJSON object or JSON string) are also accepted. A single
Feature, geometry, or one-feature FeatureCollection containing a Point or Polygon
is supported; missing, malformed, empty, or multiple study features return HTTP
400. The POST response is marked `Cache-Control: no-store`.

## Deployment

Science team members and end users follow the
[staging functional test plan](docs/staging-functional-test-plan.md).
Maintainers prepare and verify deployments with the separate
[engineering checklist](docs/staging-maintainer-checklist.md), and attach its
run record to the release or PR.

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
Esri Terrain, and Esri Gray Canvas. Stamen Toner Lite uses Stadia Maps domain
authentication by default. The Stadia configuration currently covers
`*.openskope.org`, so those registered subdomains do not need a Stadia API key.
Register additional UI domains with Stadia Maps before using domain
authentication there. CARTO Positron is available when its API key is configured:

| Runtime environment variable     | Purpose                                                             |
| -------------------------------- | ------------------------------------------------------------------- |
| `NUXT_PUBLIC_CARTO_API_KEY`        | Enables Positron using CARTO's `key` parameter.                       |
| `NUXT_PUBLIC_STADIA_API_KEY`       | Enables Toner Lite using Stadia Maps' `api_key` parameter.             |
| `NUXT_PUBLIC_STADIA_DOMAIN_AUTH`   | Enables Toner Lite without a key; defaults to `true`.                 |

Set `NUXT_PUBLIC_STADIA_DOMAIN_AUTH=false` to disable domain authentication.

Set these in the deployment environment or the repository's ignored `.env`
file, then use the normal Make deployment target. Compose forwards them to the
Nuxt server at runtime; no credential is baked into the image. These are
browser-visible provider keys; restrict them to the UI domains in the provider
dashboards. Positron is omitted without a CARTO key. Toner Lite is omitted when
domain authentication is disabled and no Stadia API key is supplied.

For a persistent CARTO override, add this to `.env` at the repository root:

```dotenv
NUXT_PUBLIC_CARTO_API_KEY=your-carto-key
```

For a single deployment, a shell environment variable overrides `.env`:

```bash
NUXT_PUBLIC_CARTO_API_KEY='your-carto-key' make deploy-staging
```

Use the production target on the production host. Settings take effect when
the container is recreated; reload open browser tabs afterward. A plain
container restart does not pick up changed Compose environment values.

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
