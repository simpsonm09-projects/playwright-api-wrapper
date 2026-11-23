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
fmt *files:
    mise exec -- node scripts/fmt.mjs {{files}}

# Check TypeScript and JavaScript formatting with Bun.
fmt-check:
    mise exec -- bun fmt --check src fixture test scripts

# Type check the sources, the fixture and the tests with Bun.
typecheck:
    mise exec -- bun check

# Lint TypeScript and JavaScript, through Bun with an oxlint fallback.
lint *files:
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

# Install the shared Lefthook hooks and assert the merged jobs (C7.8).
hooks:
    mise exec -- node scripts/hooks.ts

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

# Staged secret scan (C7.10).
secrets-staged:
    mise exec -- gitleaks git --staged --redact --no-banner

# Reject env files, private keys, kubeconfigs and files over 5 MB (C7.10).
forbidden-files *files:
    mise exec -- node scripts/forbidden-files.ts {{files}}

# actionlint and zizmor over the given workflows, or every workflow (C7.10).
workflows *files:
    {{ if files == "" { "mise exec -- actionlint" } else { "mise exec -- actionlint -- " + files } }}
    {{ if files == "" { "mise exec -- zizmor --quiet .github/workflows" } else { "mise exec -- zizmor --quiet " + files } }}

# shellcheck over the given scripts; nothing to do when none are given (C7.10).
shellcheck *files:
    {{ if files == "" { "echo shellcheck: no files to check" } else { "mise exec -- shellcheck -- " + files } }}

# Advisory Conventional Commit check (C2.4); never fails the commit (C7.10).
commit-msg file:
    mise exec -- node scripts/commit-msg.ts {{quote(file)}}

# Read the pushed refs from stdin, refuse main, and scan the range (C7.10).
hook-pre-push:
    mise exec -- node scripts/git-hook.ts pre-push

# Fast pre-push subset, under 30 seconds (C7.10).
pre-push-check:
    just fmt-check
    just typecheck

# Refresh locked dependencies when a manifest changed (C7.10).
deps-refresh *files:
    {{ if files == "" { "mise exec -- node scripts/deps-refresh.ts mise.toml bun.lock" } else { "mise exec -- node scripts/deps-refresh.ts " + files } }}

# Owner hook: fail when this checkout cannot sign commits (C2.7).
signing-check:
    mise exec -- node scripts/signing-check.mjs

# Prune remote-tracking refs and delete local branches merged into main.
prune:
    mise exec -- bun scripts/prune.mjs
