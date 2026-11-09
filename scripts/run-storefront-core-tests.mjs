#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const output = join(tmpdir(), `tijarago-storefront-core-tests-${process.pid}.mjs`);

try {
  await build({
    entryPoints: ["packages/storefront-core/src/storefront/catalog.test.ts"],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: output,
    logLevel: "silent",
  });
  const result = spawnSync(process.execPath, [output], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally {
  try {
    unlinkSync(output);
  } catch {
    // Compilation can fail before an output file is created.
  }
}
