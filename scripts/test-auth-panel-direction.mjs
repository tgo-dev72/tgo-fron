import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fixtures = [
  {
    app: "showroom",
    css: "apps/showroom/src/showroom.css",
    source: "apps/showroom/src/App.tsx",
    root: ".sr-auth-page",
    panel: ".sr-auth-page-login .sr-auth-form-wrap",
    signup: ".sr-auth-page-signup .sr-auth-form-wrap",
  },
  {
    app: "dashboard",
    css: "apps/dashboard/src/styles/pages.css",
    source: "apps/dashboard/src/pages/Login.tsx",
    root: ".login-bg",
    panel: ".login-form-wrap",
  },
  {
    app: "platform-admin",
    css: "apps/platform-admin/src/styles/app.css",
    source: "apps/platform-admin/src/App.tsx",
    root: ".login-page",
    panel: ".login-card",
  },
];

for (const fixture of fixtures) {
  const [css, source] = await Promise.all([
    readFile(new URL(`../${fixture.css}`, import.meta.url), "utf8"),
    readFile(new URL(`../${fixture.source}`, import.meta.url), "utf8"),
  ]);

  assert.match(css, /--auth-slide-offset\s*:\s*100px/, `${fixture.app}: LTR offset`);
  assert.match(css, /\[dir=["']rtl["']\][^{]*\{[^}]*--auth-slide-offset\s*:\s*-100px/s, `${fixture.app}: RTL offset`);
  assert.match(css, /translate3d\(var\(--auth-slide-offset\),\s*0,\s*0\)/, `${fixture.app}: direction-aware initial transform`);
  assert.match(css, /to\s*\{[^}]*transform\s*:\s*translate3d\(0,\s*0,\s*0\)/s, `${fixture.app}: zero final transform`);
  assert.ok(css.includes(fixture.panel), `${fixture.app}: auth panel owns the animation`);
  if (fixture.signup) assert.ok(css.includes(fixture.signup), `${fixture.app}: signup shares the panel animation`);
  assert.match(source, /dir=\{locale === ["']ar["'] \? ["']rtl["'] : ["']ltr["']\}/, `${fixture.app}: direction is present on first auth render`);
  assert.match(css, /prefers-reduced-motion:\s*reduce/, `${fixture.app}: reduced motion support`);
}

const dashboardRoutes = await readFile(new URL("../apps/dashboard/src/App.tsx", import.meta.url), "utf8");
assert.match(dashboardRoutes, /path=["']\/register["'][^\n]*ShowroomSignupRedirect/, "dashboard registration remains an intentional showroom redirect");

const adminRoutes = await readFile(new URL("../apps/platform-admin/src/App.tsx", import.meta.url), "utf8");
assert.doesNotMatch(adminRoutes, /path=["'][^"']*(signup|register)/i, "platform admin does not invent a signup route");

console.log("Auth panel direction contract passed for showroom, dashboard, and platform admin.");
