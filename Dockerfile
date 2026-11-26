# syntax=docker/dockerfile:1

# Pinned by digest. Renovate keeps the tag and digest current through the shared
# preset, and the tag must stay equal to the playwright version in package.json.
FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579 AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install from the Bun lockfile. The browser download is skipped because the base
# image already carries the pinned Playwright browsers.
FROM oven/bun:1.4.5-slim AS deps
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.4.5-slim AS prod-deps
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY fixture ./fixture
RUN ./node_modules/.bin/tsc -p tsconfig.build.json

# One image carries both the API and the tiny test fixture. Compose and CI start
# the fixture with a command override, and it is never exposed in production.
FROM base AS runtime
LABEL org.opencontainers.image.source="https://github.com/simpsonm09-projects/playwright-api-wrapper" \
      org.opencontainers.image.description="Lightweight HTTP API that runs one Playwright scenario per request." \
      org.opencontainers.image.licenses="MIT"
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
# Named scenarios for the flow-request path. FLOWS_FILE is relative to WORKDIR.
COPY flows ./flows
ENV FLOWS_FILE=flows/flows.json
USER pwuser
EXPOSE 3000
CMD ["node", "dist/src/server.js"]
