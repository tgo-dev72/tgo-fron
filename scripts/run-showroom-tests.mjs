#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";

const output = join(tmpdir(), `tijarago-showroom-tests-${process.pid}.mjs`);

try {
  await build({
    entryPoints: ["apps/showroom/src/lib/showroom.test.ts"],
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
    // The compiler may fail before creating an output file.
  }
}
