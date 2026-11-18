# syntax=docker/dockerfile:1

# Follow active LTS updates; npm ci checks the supported range in package.json.
FROM node:lts-trixie-slim AS node-base

FROM node-base AS dependencies

WORKDIR /code

COPY package.json package-lock.json ./
# npm 12 enforces the package.json install-script allowlist.
RUN --mount=type=cache,target=/root/.npm \
    npm install --global npm@12 --no-audit --no-fund \
    && npm ci --engine-strict --no-audit --no-fund

FROM dependencies AS development

ENV NODE_ENV=development

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

FROM dependencies AS build

ARG SKOPE_BUILD_ID=development

ENV NODE_ENV=production \
    NITRO_PRESET=node-server

COPY . .
RUN SKOPE_BUILD_ID="$SKOPE_BUILD_ID" npm run build

# Keep build tools and package managers out of the deployed image.
FROM debian:trixie-slim AS production

RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && apt-get install -y --no-install-recommends \
        ca-certificates dumb-init libatomic1 libstdc++6 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 node \
    && useradd --uid 1000 --gid node --no-create-home --shell /usr/sbin/nologin node

ENV HOST=0.0.0.0 \
    NODE_ENV=production \
    PORT=3000

LABEL maintainer="Allen Lee <allen.lee@asu.edu>"

WORKDIR /code

COPY --from=node-base /usr/local/bin/node /usr/local/bin/node
COPY --from=build /code/.output ./.output

USER node

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", ".output/server/index.mjs"]
