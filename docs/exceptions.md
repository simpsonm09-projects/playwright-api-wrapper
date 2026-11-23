# Exceptions

One row per rule this repository cannot meet yet. The reason and the revisit date
are required. The shared `standard` job reads this file.

| Rule | Reason | Revisit |
| --- | --- | --- |
| `C7.3` | The production build still runs `tsc` to emit `dist/` for the container. `bun build` would change the emitted layout and the container entrypoint, which is its own change. Bun formats, lints, type checks and runs the tests, and `bun check` is the type gate. | 2027-05-31 |
| `C7.4` | `scripts/newman.mjs`, `scripts/postman-cli.mjs` and `scripts/prune.mjs` are `.mjs`, not Bun TypeScript. They are thin callers around newman, the Postman CLI and git, and the port is its own change. | 2027-05-31 |
