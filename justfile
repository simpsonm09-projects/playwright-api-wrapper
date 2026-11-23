# Cross-platform task runner for humans and agents. `just --list` shows every
# recipe. Keep each recipe a thin call to a portable tool or a script under
# scripts/. See https://github.com/simpsonm09-projects/repo-standard/blob/main/docs/task-runner.md
set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

# List the recipes.
default:
    @just --list

# Install the pinned tools.
install:
    mise install

# Install the dependencies from the lockfile.
deps:
    mise exec -- bun install --frozen-lockfile

# Format TypeScript and JavaScript with Bun.
fmt:
    mise exec -- bun fmt src fixture test scripts

# Check TypeScript and JavaScript formatting with Bun.
fmt-check:
    mise exec -- bun fmt --check src fixture test scripts

# Type check the sources, the fixture and the tests with Bun.
typecheck:
    mise exec -- bun check

# Lint TypeScript and JavaScript, through Bun with an oxlint fallback.
lint:
    mise exec -- bun scripts/lint.ts

# Run the AI-slop gate.
aislop:
    npx --yes aislop@0.16.1 ci

# Run the unit and integration tests. These need no browser.
test:
    mise exec -- bun test test/unit test/integration

# Run the browser end-to-end tests. `just deps` and `bunx playwright install
# chromium` must have run first. The e2e workflow runs this on main and weekly.
test-e2e:
    mise exec -- bun test test/e2e

# Run the tests and write an lcov report to coverage/lcov.info.
coverage:
    mise exec -- bun install --frozen-lockfile
    mise exec -- bun test test/unit test/integration --coverage --coverage-reporter=lcov --coverage-dir=coverage

# Compile the sources to dist/ for the container.
build:
    mise exec -- bun run build

# Everything CI requires.
check: fmt-check lint typecheck test

# Historical alias for `check`, kept for the support template.
verify: check

# Install the guarded git hook.
hooks:
    git config --local core.hooksPath .githooks

# Check the .agents/skills tree and its .claude/skills links.
agent-files:
    mise exec -- bun scripts/agent-files.mjs

# Run the API in watch mode on http://127.0.0.1:3000.
dev:
    mise exec -- bun --watch src/server.ts

# Run the tiny fixture server on http://127.0.0.1:4010.
fixture:
    mise exec -- bun fixture/server.ts

# Run the compiled server with Node.
start:
    mise exec -- node dist/src/server.js

# Build the container image.
docker-build:
    docker build -t playwright-api-wrapper:local .

# Run the compose test stack.
compose-test:
    docker compose --profile test up --build

# Run the exported Postman collection through newman.
newman:
    mise exec -- bun scripts/newman.mjs

# Run the exported Postman collection through the Postman CLI.
postman:
    mise exec -- bun scripts/postman-cli.mjs

# Prune remote-tracking refs and delete local branches merged into main.
prune:
    mise exec -- bun scripts/prune.mjs
