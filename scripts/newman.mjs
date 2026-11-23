import { spawnSync } from "node:child_process";

// Mirrors scripts/postman-cli.mjs. newman runs the same collection file locally
// with no login, so a run needs no Postman account. It is installed on demand
// through npx, which keeps its older dependency tree out of the lockfile and the
// container build.
const wrapperUrl = process.env.WRAPPER_URL ?? "http://localhost:3000";
const targetUrl = process.env.TARGET_URL ?? "http://127.0.0.1:4010/checkout";
const formUrl = process.env.FORM_URL ?? "http://127.0.0.1:4010/form";
const apiKey = process.env.API_KEY ?? "dev-local-key";

const result = spawnSync(
  "npx",
  [
    "--yes",
    "newman@6.2.2",
    "run",
    "postman/collection.json",
    "--env-var",
    `baseUrl=${wrapperUrl}`,
    "--env-var",
    `targetUrl=${targetUrl}`,
    "--env-var",
    `formUrl=${formUrl}`,
    "--env-var",
    `apiKey=${apiKey}`,
    "--reporters",
    "cli",
  ],
  { stdio: "inherit", shell: true, windowsHide: true },
);

if (result.error !== undefined) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
