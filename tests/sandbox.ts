import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { TestContext } from "node:test";

assert.equal(
  process.versions.bun,
  undefined,
  "Run the suite with Node, not Bun.",
);
assert.ok(
  Number(process.versions.node.split(".")[0]) >= 24,
  "Node 24+ is required.",
);

export function sandbox(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "journal-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths = Object.fromEntries(
    ["home", "config", "cache", "data", "state", "project", "tmp"].map(
      (name) => {
        const path = join(root, name);
        mkdirSync(path);
        return [name, path];
      },
    ),
  );
  const cwd = paths.project ?? root;
  const env: NodeJS.ProcessEnv = {
    HOME: paths.home,
    XDG_CONFIG_HOME: paths.config,
    XDG_CACHE_HOME: paths.cache,
    XDG_DATA_HOME: paths.data,
    XDG_STATE_HOME: paths.state,
    TMPDIR: paths.tmp,
    PATH: `${dirname(process.execPath)}:/usr/bin:/bin`,
    TZ: "UTC",
  };
  return { root, cwd, env, directory: join(cwd, ".agent-journal") };
}
