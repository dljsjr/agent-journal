import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("package manifest exposes only the journal skill to Pi", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(manifest.keywords, ["pi-package"]);
  assert.deepEqual(manifest.pi, { skills: ["./skills/journal"] });
});
