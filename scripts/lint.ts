#!/usr/bin/env bun
// Lint JavaScript and TypeScript through Bun. `bun lint --no-script` is the
// standard command; until Bun ships a stable linter it reports "Script not
// found", and this script falls back to the pinned oxlint. See the owner
// standard C7.3.
import { spawnSync } from "node:child_process";

function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) {
    process.stderr.write(
      `lint: cannot run ${command}: ${result.error.message}\n`,
    );
    return 1;
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

const bun = spawnSync("bun", ["lint", "--no-script"], {
  encoding: "utf8",
  windowsHide: true,
});
const output = `${bun.stdout ?? ""}${bun.stderr ?? ""}`;
if (!bun.error && !output.includes("Script not found")) {
  if (bun.stdout) process.stdout.write(bun.stdout);
  if (bun.stderr) process.stderr.write(bun.stderr);
  process.exit(bun.status ?? 1);
}

process.exit(run("oxlint", ["."]));
