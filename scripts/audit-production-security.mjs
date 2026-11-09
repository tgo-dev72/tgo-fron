#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const errors = [];
const requiredHeaders = [
  "Content-Security-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Permissions-Policy",
  "Strict-Transport-Security",
  "Cross-Origin-Opener-Policy",
];
const liveOrigins = {
  showroom: "https://www.tijarago.com",
  dashboard: "https://dash.tijarago.com",
  "platform-admin": "https://admin.tijarago.com",
};

function filesBelow(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

function repoPath(path) {
  return relative(root, path).replaceAll("\\", "/");
}

for (const app of ["showroom", "dashboard", "platform-admin"]) {
  const configPath = join(root, "apps", app, "vercel.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const headers = new Map((config.headers?.flatMap((rule) => rule.headers ?? []) ?? []).map((header) => [header.key, header.value]));
  for (const header of requiredHeaders) {
    if (!headers.has(header)) errors.push(`${repoPath(configPath)} is missing ${header}`);
  }
  const csp = headers.get("Content-Security-Policy") ?? "";
  for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"]) {
    if (!csp.includes(directive)) errors.push(`${repoPath(configPath)} CSP is missing ${directive}`);
  }
  if (csp.includes("'unsafe-eval'")) errors.push(`${repoPath(configPath)} CSP permits unsafe-eval`);
  const indexPath = join(root, "apps", app, "index.html");
  const html = readFileSync(indexPath, "utf8");
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) {
    errors.push(`${repoPath(indexPath)} contains an inline script that the production CSP blocks`);
  }
  if (html.includes("fonts.googleapis.com") && !csp.includes("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com")) {
    errors.push(`${repoPath(configPath)} does not permit its Google Fonts stylesheet`);
  }
  if (app === "dashboard" && !csp.includes("https://api.cloudinary.com")) {
    errors.push(`${repoPath(configPath)} does not permit signed direct media uploads`);
  }
}

const viteConfigs = [
  ...filesBelow(join(root, "apps")),
  ...filesBelow(join(root, "designs")),
].filter((path) => path.endsWith("vite.config.ts"));
for (const configPath of viteConfigs) {
  if (!/sourcemap\s*:\s*false/.test(readFileSync(configPath, "utf8"))) {
    errors.push(`${repoPath(configPath)} must explicitly disable production source maps`);
  }
}

let trackedOutput;
try {
  trackedOutput = execFileSync("git", ["ls-files", "-z"], { cwd: root });
} catch (error) {
  // Some restricted runners report EPERM even when the read-only Git command
  // completed and returned stdout. Preserve the audit rather than skipping it.
  if (!error?.stdout?.length) throw error;
  trackedOutput = error.stdout;
}
const tracked = trackedOutput.toString().split("\0").filter(Boolean);
for (const path of tracked) {
  const name = path.split("/").at(-1) ?? "";
  if (!existsSync(join(root, path))) continue;
  if (path.startsWith("previews/")) errors.push(`${path} is a retired compiled preview artifact`);
  if (/\.map$/i.test(path)) errors.push(`${path} is a tracked source map`);
  if (/\.(?:pem|key)$/i.test(path)) errors.push(`${path} is tracked key material`);
  if (/^\.env(?:\.|$)/.test(name) && !name.endsWith(".example")) errors.push(`${path} is a tracked environment file`);
}

const outputFiles = ["apps", "designs"].flatMap((group) =>
  existsSync(join(root, group))
    ? readdirSync(join(root, group)).flatMap((name) => filesBelow(join(root, group, name, "dist")))
    : [],
);
const forbiddenOutputName = /(?:^|\/)(?:\.env(?:\.|$)|\.git(?:\/|$))|\.(?:map|pem|key|tsx?|jsx)$/i;
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk_live_[A-Za-z0-9]{16,}\b/,
  /\b(?:GITHUB_TOKEN|VERCEL_API_TOKEN|AWS_SECRET_ACCESS_KEY|DJANGO_SECRET_KEY|CLOUDINARY_API_SECRET|CRON_SECRET)\s*[:=]\s*["']?[^\s"']{8,}/,
  /\bpostgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/i,
];
for (const path of outputFiles) {
  const name = repoPath(path);
  if (forbiddenOutputName.test(name)) errors.push(`${name} must not be in a production artifact`);
  if (statSync(path).size > 8_000_000 || ![".html", ".js", ".css", ".json", ".txt", ".svg", ".xml"].includes(extname(path))) continue;
  const content = readFileSync(path, "utf8");
  if (secretPatterns.some((pattern) => pattern.test(content))) errors.push(`${name} contains a secret-like value`);
}

const sourceFiles = ["apps", "designs", "packages"].flatMap((group) => filesBelow(join(root, group)))
  .filter((path) => /\.(?:ts|tsx|js|mjs)$/.test(path) && !path.includes("/dist/") && !path.includes("/node_modules/"));
for (const path of sourceFiles) {
  const content = readFileSync(path, "utf8");
  for (const match of content.matchAll(/\bVITE_[A-Z0-9_]+\b/g)) {
    if (/(?:SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|API_KEY)/.test(match[0])) {
      errors.push(`${repoPath(path)} exposes secret-oriented variable ${match[0]} to the browser`);
    }
  }
}

if (errors.length) {
  console.error(`Production security audit failed (${errors.length}):`);
  for (const error of [...new Set(errors)]) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Production security audit OK — ${viteConfigs.length} builds, ${outputFiles.length} output files, ${tracked.length} tracked files checked`);

if (process.argv.includes("--live")) {
  const liveErrors = [];
  for (const [app, origin] of Object.entries(liveOrigins)) {
    try {
      const response = await fetch(origin, { redirect: "follow" });
      if (!response.ok) liveErrors.push(`${origin} returned HTTP ${response.status}`);
      for (const header of requiredHeaders) {
        if (!response.headers.get(header)) liveErrors.push(`${origin} is missing ${header}`);
      }
      const csp = response.headers.get("Content-Security-Policy") ?? "";
      if (csp.includes("'unsafe-eval'")) liveErrors.push(`${origin} CSP permits unsafe-eval`);
      if (!csp.includes("frame-ancestors 'none'")) liveErrors.push(`${origin} CSP does not deny framing`);
    } catch (error) {
      liveErrors.push(`${app} could not be verified: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (liveErrors.length) {
    console.error(`Live response-header audit failed (${liveErrors.length}):`);
    for (const error of liveErrors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Live response-header audit OK — ${Object.keys(liveOrigins).length} production applications checked`);
}
