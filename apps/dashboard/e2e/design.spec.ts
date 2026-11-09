import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function addSection(page: Page, name: string) {
  const control = page.locator(".theme-add-section");
  await control.locator("select").selectOption({ label: name });
  await control.getByRole("button", { name: "Add a section", exact: true }).click();
}

const user = {
  email: "merchant@example.com",
  first_name: "Store",
  last_name: "Owner",
  email_verified: true,
};

const store = {
  id: 7,
  slug: "design-lab",
  name: "Design Lab",
  logo: null,
  logo_url: null,
  retail_type: null,
  retail_type_detail: null,
  members: [{ id: 1, user: 1, email: user.email, first_name: "Store", last_name: "Owner", role: "owner", created_at: "2026-09-01T00:00:00Z" }],
  storefront_url: "https://design-lab.example.test",
  storefront_request_id: 11,
  storefront_status: "live",
  storefront_progress: 100,
  plan: "premium",
  analytics_level: "standard",
  created_at: "2026-09-01T00:00:00Z",
};

const defaultAppearance = {
  schema_version: 1,
  typography: { body_font: "system", heading_font: "system", base_size: "medium", heading_scale: "medium" },
  header: { layout: "logo_start", sticky: "always", width: "contained", logo_size: "standard", nav_alignment: "center", show_search: true, show_account: true, show_language: true, show_cart: true },
  style: { button_shape: "rounded", card_shape: "rounded", content_width: "standard" },
  colors: { page: "", header: "", header_text: "", announcement: "", hero: "", section: "", card: "", newsletter: "", footer: "" },
  footer: { show_contact: true, show_social_links: true, copyright: { en: "", fr: "", ar: "" } },
};

const config = (design: string, appearance = defaultAppearance) => ({
  plan: "premium",
  currency: "MAD",
  payment_provider: "cash_on_delivery",
  payment_gateway: { code: "cash_on_delivery", name: "Cash on delivery", configured: true, sandbox: false, credential_fields: [], available_providers: [] },
  payment_keys: {},
  from_email: "",
  brand_color: "#2D6A4F",
  loyalty_enabled: true,
  shipping_fee: 0,
  design,
  contact_email: "hello@example.test",
  support_phone: "",
  whatsapp_phone: "",
  social_links: {},
  homepage_product_source: "featured",
  homepage_product_limit: 8,
  domain: "",
  appearance,
});

const designs = [
  { key: "nova", name: "Essential", tagline: "Everything a new store needs", description: "", screenshots: ["/theme-previews/basic.webp"], demo_url: null, tier: "standard", status: "ready", features: [], feature_maturity: {}, config_schema: [] },
  { key: "beauty", name: "Beauty", tagline: "Care with clarity", description: "", screenshots: ["/theme-previews/beauty.webp"], demo_url: null, tier: "premium", status: "ready", features: [], feature_maturity: {}, config_schema: [] },
  { key: "fashion", name: "Fashion", tagline: "A collection with a point of view", description: "", screenshots: ["/theme-previews/fashion.webp"], demo_url: null, tier: "premium", status: "ready", features: [], feature_maturity: {}, config_schema: [] },
  { key: "electronics", name: "Electronics", tagline: "Compare what matters", description: "", screenshots: ["/theme-previews/electronics.webp"], demo_url: null, tier: "premium", status: "ready", features: [], feature_maturity: {}, config_schema: [] },
  { key: "aura", name: "Atelier", tagline: "Objects with a point of view", description: "", screenshots: ["/theme-previews/atelier.webp"], demo_url: null, tier: "premium", status: "ready", features: [], feature_maturity: {}, config_schema: [] },
];

const deployment = (pipeline_state: "live" | "accepted" | "building" | "failed", design = "nova") => ({
  id: 11,
  store: 7,
  design,
  name: "Design Lab",
  slug: "design-lab",
  status: pipeline_state === "live" ? "created" : pipeline_state === "failed" ? "failed" : "scaffolding",
  deploy_status: pipeline_state === "live" ? "deployed" : pipeline_state === "failed" ? "failed" : "deploying",
  pipeline_state,
  progress: pipeline_state === "live" || pipeline_state === "failed" ? 100 : pipeline_state === "building" ? 82 : 0,
  public_message: "",
  event_version: 1,
  operation: design === "nova" ? "create" : "redesign",
  deployed_url: store.storefront_url,
  created_at: "2026-09-01T00:00:00Z",
});

async function mockDesignPage(page: Page, scaffoldState: "building" | "failed") {
  let activeDesign = "nova";
  let redesignCreated = false;
  let scaffoldCalls = 0;
  let detailCalls = 0;
  let redesignCompleted = false;
  let failNextRedesignPoll = scaffoldState === "building";
  let directConfigDesignPatch = false;
  let currentAppearance = structuredClone(defaultAppearance);
  let appearancePatch: typeof defaultAppearance | null = null;

  await page.route("**/backend/accounts/me", (route) => json(route, { message: "ok", user }));
  await page.route("**/backend/api/store/", (route) => json(route, [store]));
  await page.route("**/backend/api/access/store/7/me/", (route) => json(route, {
    role: "owner",
    permissions: ["storefront.view", "storefront.customize", "settings.view", "settings.update"],
    field_permissions: {},
  }));
  await page.route("**/backend/api/subscriptions/status", (route) => json(route, { subscription: null, subscriptions: [], latest_payment: null, payment: null, balances: [] }));
  await page.route("**/backend/api/store/7/config/", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if ("design" in body) directConfigDesignPatch = true;
      if (body.appearance) {
        appearancePatch = body.appearance as typeof defaultAppearance;
        currentAppearance = structuredClone(appearancePatch);
      }
      if (typeof body.brand_color === "string") return json(route, { ...config(activeDesign, currentAppearance), brand_color: body.brand_color });
      if (body.appearance) return json(route, config(activeDesign, currentAppearance));
    }
    return json(route, config(activeDesign, currentAppearance));
  });
  await page.route("**/backend/api/store/7/pages/", (route) => json(route, []));
  await page.route("**/backend/api/catalog/store/7/sections/", (route) => json(route, []));
  await page.route("**/backend/api/catalog/store/7/products/", (route) => json(route, []));
  await page.route("**/backend/api/designs/", (route) => json(route, designs));
  await page.route("**/backend/api/requests/", async (route) => {
    if (route.request().method() !== "POST") return json(route, []);
    const body = route.request().postDataJSON() as { design: string };
    redesignCreated = body.design === "aura";
    return json(route, deployment("accepted", body.design), 201);
  });
  await page.route("**/backend/api/requests/11/scaffold", (route) => {
    scaffoldCalls += 1;
    return json(route, deployment(scaffoldCalls === 1 ? scaffoldState : "building", "aura"));
  });
  await page.route("**/backend/api/requests/11/", (route) => {
    detailCalls += 1;
    if (!redesignCreated) return json(route, deployment("live"));
    if (scaffoldState === "failed" && scaffoldCalls === 1) return json(route, deployment("failed", "aura"));
    if (failNextRedesignPoll) {
      failNextRedesignPoll = false;
      return json(route, { detail: "Temporary status failure" }, 503);
    }
    if (!redesignCompleted) return json(route, deployment("building", "aura"));
    activeDesign = "aura";
    return json(route, deployment("live", "aura"));
  });

  return {
    directPatch: () => directConfigDesignPatch,
    scaffoldCalls: () => scaffoldCalls,
    detailCalls: () => detailCalls,
    completeRedesign: () => { redesignCompleted = true; },
    appearancePatch: () => appearancePatch,
  };
}

test("theme heading keeps a Shift+Enter line break through preview, save, and reload", async ({ page }) => {
  await mockDesignPage(page, "building");
  await page.route("**/backend/accounts/csrf", (route) => json(route, {}));
  let saved: Record<string, any> = { page_key: "home", page_type: "system", route: "", title: { en: "Home", fr: "Accueil", ar: "الرئيسية" }, is_visible: true, show_in_navigation: false, is_protected: true, draft_sections: [], published_sections: [], revision: 1 };
  await page.route("**/backend/api/store/7/pages/home/", (route) => {
    if (route.request().method() === "PATCH") saved = { ...saved, ...route.request().postDataJSON() };
    return json(route, saved);
  });
  await page.goto("/design/pages/home");
  await addSection(page, "Main banner");
  const heading = page.getByRole("textbox", { name: /^Heading/ });
  await heading.fill("New arrivals");
  await heading.press("Shift+Enter");
  await heading.pressSequentially("for every day");
  await expect(heading).toHaveValue("New arrivals\nfor every day");
  await expect(page.locator(".tp-hero h2")).toHaveText("New arrivals\nfor every day");
  await expect(page.locator(".tp-hero h2")).toHaveCSS("white-space", "pre-line");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  expect(saved.draft_sections[0].settings.title.en).toBe("New arrivals\nfor every day");
  await page.reload();
  await expect(page.getByRole("textbox", { name: /^Heading/ })).toHaveValue("New arrivals\nfor every day");
});

test("formatted story copy survives preview, draft save, and reload", async ({ page }) => {
  await mockDesignPage(page, "building");
  await page.route("**/backend/accounts/csrf", (route) => json(route, {}));
  let saved: Record<string, any> = { page_key: "home", page_type: "system", route: "", title: { en: "Home", fr: "Accueil", ar: "الرئيسية" }, is_visible: true, show_in_navigation: false, is_protected: true, draft_sections: [], published_sections: [], revision: 1 };
  await page.route("**/backend/api/store/7/pages/home/", (route) => {
    if (route.request().method() === "PATCH") saved = { ...saved, ...route.request().postDataJSON() };
    return json(route, saved);
  });
  await page.goto("/design/pages/home");
  await addSection(page, "Story");
  const editor = page.locator(".theme-settings-body .rich-text-content");
  await editor.fill("Fresh arrivals");
  await editor.press("ControlOrMeta+A");
  await page.locator(".theme-settings-body .rich-text-toolbar").getByRole("button", { name: "Bold" }).click();
  await editor.press("ArrowRight");
  await editor.press("Shift+Enter");
  await editor.pressSequentially("Shop now");
  await page.locator(".theme-settings-body .rich-text-toolbar").getByRole("button", { name: "Center" }).click();
  await expect(page.locator(".tp-story .tp-rich-copy strong").first()).toContainText("Fresh arrivals");
  await expect(page.locator(".tp-story .tp-rich-copy br")).toHaveCount(1);
  await expect(page.locator(".tp-story .tp-rich-copy p")).toHaveCSS("text-align", "center");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  expect(saved.draft_sections[0].settings.body.en).toContain("<strong>Fresh arrivals</strong>");
  expect(saved.draft_sections[0].settings.body.en).toContain("<br>");
  expect(saved.draft_sections[0].settings.body.en).toContain("text-align: center");
  await page.reload();
  await expect(page.locator(".tp-story .tp-rich-copy strong").first()).toContainText("Fresh arrivals");
});

test("slideshow drafts preview localized content, retain ordering and publish separately", async ({ page }) => {
  await mockDesignPage(page, "building");
  await page.route("**/backend/accounts/csrf", (route) => json(route, {}));
  let saved: Record<string, any> = { page_key: "home", page_type: "system", route: "", title: { en: "Home", fr: "Accueil", ar: "الرئيسية" }, is_visible: true, show_in_navigation: false, is_protected: true, draft_sections: [], published_sections: [], revision: 1 };
  let failSave = false;
  await page.route("**/backend/api/store/7/pages/home/", async (route) => {
    if (route.request().method() === "PATCH") {
      if (failSave) return json(route, { detail: "Temporary failure" }, 503);
      saved = { ...saved, ...route.request().postDataJSON() };
    }
    return json(route, saved);
  });
  await page.route("**/backend/api/store/7/pages/home/publish/", (route) => {
    saved.published_sections = structuredClone(saved.draft_sections);
    saved.revision += 1;
    return json(route, saved);
  });
  await page.goto("/design/pages/home");
  await addSection(page, "Slideshow");
  const cards = page.locator(".slide-settings-card");
  await cards.first().locator(".destination-picker select").selectOption({ label: "All products" });
  await cards.first().getByLabel("Heading · EN", { exact: true }).fill("Summer collection");
  await expect(page.locator(".sf-slideshow").getByRole("heading", { name: "Summer collection" })).toBeVisible();
  await page.getByRole("button", { name: "Add slide", exact: true }).click();
  await cards.nth(1).getByLabel("Heading · EN", { exact: true }).fill("New arrivals");
  await page.getByRole("button", { name: "Move earlier 2" }).click();
  await expect(page.locator(".sf-slideshow").getByRole("heading", { name: "New arrivals" })).toBeVisible();
  const slideBody = cards.first().locator(".rich-text-content");
  await slideBody.fill("Today only");
  await slideBody.press("Shift+Enter");
  await slideBody.pressSequentially("Shop the collection");
  await expect(page.locator(".sf-slide-body br")).toHaveCount(1);
  await page.getByRole("button", { name: "AR", exact: true }).click();
  await cards.first().getByLabel("Heading · AR", { exact: true }).fill("وصل حديثاً");
  await expect(page.locator(".sf-slideshow")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".sf-slideshow").getByRole("heading", { name: "وصل حديثاً" })).toBeVisible();
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await cards.nth(1).scrollIntoViewIfNeeded();
  const saveBounds = await page.getByRole("button", { name: "Save draft", exact: true }).boundingBox();
  expect(saveBounds).not.toBeNull();
  expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: test.info().outputPath("slideshow-editor-mobile-ar.png"), fullPage: true });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  expect(saved.published_sections).toEqual([]);
  expect(saved.draft_sections[0].settings.slides[0].title.ar).toBe("وصل حديثاً");
  expect(saved.draft_sections[0].settings.slides[1].cta_url).toBe("/collections/all");
  expect(saved.draft_sections[0].settings.slides[0].body.en).toContain("<br>");
  await page.reload();
  await expect(cards).toHaveCount(2);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("textbox", { name: "Heading · EN" }).first().fill("Revised arrivals");
  failSave = true;
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeEnabled();
  expect(saved.revision).toBe(1);
  expect(saved.published_sections).toEqual([]);
  await expect(page.getByRole("textbox", { name: "Heading · EN" }).first()).toHaveValue("Revised arrivals");
  failSave = false;
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Your storefront is up to date.", { exact: true })).toBeVisible();
  expect(saved.published_sections[0].settings.slides[0].title.en).toBe("Revised arrivals");
  await page.getByRole("button", { name: "Remove slide 1", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "Remove slide", exact: true })).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(cards).toHaveCount(1);
  expect(saved.published_sections[0].settings.slides).toHaveLength(2);
});

test("premium draft preview uses merchant products and publishes through the existing page flow", async ({ page }) => {
  await mockDesignPage(page, "building");
  await page.route("**/backend/accounts/csrf", (route) => json(route, {}));
  await page.route("**/backend/api/store/7/config/", (route) => json(route, config("beauty")));
  await page.route("**/backend/api/catalog/store/7/sections/", (route) => json(route, [
    { id: 3, key: "skincare", label: "Skincare", is_visible: true, thumbnail: "", attribute_defs: [] },
  ]));
  await page.route("**/backend/api/catalog/store/7/products/", (route) => json(route, [
    { id: 9, section: 3, name: "Merchant Serum", ref: "SERUM-1", price: 120, promo: 0, compare_at_price: null,
      is_active: true, is_featured: true, merchandising_order: 0, rating: 0, reviews_count: 0,
      created_at: "2026-09-01T00:00:00Z", images: [{ id: 1, image: "/serum.webp", is_primary: true, order: 0 }] },
  ]));
  let saved: Record<string, any> = { page_key: "home", page_type: "system", route: "",
    title: { en: "Home", fr: "Accueil", ar: "الرئيسية" }, is_visible: true,
    show_in_navigation: false, is_protected: true, draft_sections: [], published_sections: [], revision: 1 };
  await page.route("**/backend/api/store/7/pages/home/", (route) => {
    if (route.request().method() === "PATCH") saved = { ...saved, ...route.request().postDataJSON() };
    return json(route, saved);
  });
  await page.route("**/backend/api/store/7/pages/home/publish/", (route) => {
    saved.published_sections = structuredClone(saved.draft_sections);
    saved.revision += 1;
    return json(route, saved);
  });

  await page.goto("/design/pages/home");
  await addSection(page, "Theme feature");
  await expect(page.locator(".tp-theme-feature")).toContainText("Merchant Serum");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
  expect(saved.published_sections).toEqual([]);
  await page.reload();
  await expect(page.locator(".tp-theme-feature")).toContainText("Merchant Serum");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Your storefront is up to date.", { exact: true })).toBeVisible();
  expect(saved.published_sections[0].settings.kind).toBe("beauty");
});

test("uploaded hero banner is persisted as a draft and remains pending publication", async ({ page }) => {
  await mockDesignPage(page, "building");
  await page.route("**/backend/accounts/csrf", (route) => json(route, {}));
  const hero = {
    id: "hero",
    type: "hero",
    enabled: true,
    settings: {
      eyebrow: { en: "New season", fr: "Nouvelle saison", ar: "موسم جديد" },
      title: { en: "LUX", fr: "LUX", ar: "LUX" },
      subtitle: { en: "", fr: "", ar: "" },
      cta_label: { en: "Shop", fr: "Acheter", ar: "تسوق" },
      cta_url: "#products",
      image_url: "",
    },
  };
  let saved: Record<string, any> = {
    page_key: "home", page_type: "system", route: "",
    title: { en: "Home", fr: "Accueil", ar: "الرئيسية" }, is_visible: true,
    show_in_navigation: false, is_protected: true,
    draft_sections: [structuredClone(hero)], published_sections: [structuredClone(hero)], revision: 1,
  };
  await page.route("**/backend/api/store/7/pages/home/", (route) => {
    if (route.request().method() === "PATCH") saved = { ...saved, ...route.request().postDataJSON() };
    return json(route, saved);
  });
  await page.route("**/backend/api/store/7/storefront-assets/sign/", (route) => json(route, { direct_upload: false }));
  await page.route("**/backend/api/store/7/storefront-assets/", (route) => json(route, {
    id: 91,
    image: "https://res.cloudinary.com/demo/image/upload/lux-banner.webp",
    image_url: "https://res.cloudinary.com/demo/image/upload/lux-banner.webp",
    created_at: "2026-10-21T19:00:00Z",
  }, 201));

  await page.goto("/design/pages/home");
  await page.locator(".theme-section-row").filter({ hasText: "Main banner" }).click();
  await page.getByLabel("Choose an image").setInputFiles({ name: "lux-banner.webp", mimeType: "image/webp", buffer: Buffer.from("banner") });

  await expect(page.getByText("Banner uploaded and saved. Publish to show it on your store.", { exact: true })).toBeVisible();
  await expect.poll(() => saved.draft_sections[0].settings.image_url).toBe("https://res.cloudinary.com/demo/image/upload/lux-banner.webp");
  expect(saved.published_sections[0].settings.image_url).toBe("");
  await expect(page.getByText("Unpublished changes", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeEnabled();
  await expect(page.locator(".theme-upload-preview")).toBeVisible();
});

test("a design change activates only after the redesign deployment is verified", async ({ page }) => {
  const state = await mockDesignPage(page, "building");
  await page.goto("/design");
  await expect(page.getByRole("heading", { name: "Design" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("theme-gallery-desktop.png"), fullPage: true });

  const auraCard = page.locator(".design-card").filter({ hasText: "Atelier" });
  await auraCard.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("dialog", { name: "Atelier" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Atelier" }).locator("img")).toHaveJSProperty("naturalWidth", 960);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Atelier" })).toBeHidden();
  await page.getByRole("button", { name: /Atelier/ }).click();
  await expect(page.getByRole("alertdialog", { name: "Change storefront design?" })).toBeVisible();
  expect(state.directPatch()).toBe(false);
  await page.getByRole("button", { name: "Build and verify design" }).click();

  await expect(page.getByText("Preparing the new storefront design")).toBeVisible();
  await expect(page.getByRole("button", { name: /Essential/ })).toHaveAttribute("aria-pressed", "true");
  expect(state.directPatch()).toBe(false);
  const callsBeforeCompletion = state.detailCalls();
  state.completeRedesign();
  await expect.poll(state.detailCalls, { timeout: 10_000 }).toBeGreaterThan(callsBeforeCompletion);
  await expect(page.getByRole("button", { name: /Atelier/ })).toHaveAttribute("aria-pressed", "true");
  expect(state.directPatch()).toBe(false);
});

test("a failed redesign preserves the current design and offers retry", async ({ page }) => {
  const state = await mockDesignPage(page, "failed");
  await page.goto("/design");
  await page.getByRole("button", { name: /Atelier/ }).click();
  await page.getByRole("button", { name: "Build and verify design" }).click();

  await expect(page.getByText("The design change needs attention")).toBeVisible();
  await expect(page.getByText(/current storefront and design were preserved/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Essential/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Retry change" }).click();
  await expect.poll(state.scaffoldCalls).toBe(2);
  await expect(page.getByText("Preparing the new storefront design")).toBeVisible();
  expect(state.directPatch()).toBe(false);
});

test("global appearance controls persist one normalized storefront contract", async ({ page }) => {
  const state = await mockDesignPage(page, "building");
  await page.goto("/design");

  await expect(page.getByRole("tab", { name: /Theme & appearance/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /Pages & content/ }).click();
  await expect(page.getByRole("heading", { name: "Store pages" })).toBeVisible();
  await expect(page.getByText("Global appearance", { exact: true })).toBeHidden();
  await page.getByRole("tab", { name: /Theme & appearance/ }).click();

  await page.getByRole("tab", { name: "Typography" }).click();
  await page.getByLabel("Body font").selectOption("editorial");
  await page.getByRole("tab", { name: "Header" }).click();
  await page.getByLabel("Logo position").selectOption("logo_center");
  await page.getByLabel("Header width").selectOption("full");
  await page.getByLabel("Logo size").selectOption("large");
  await page.getByLabel("Menu alignment").selectOption("start");
  await page.getByLabel("Show search").uncheck();
  await page.getByLabel("Show customer account").uncheck();
  await page.getByRole("tab", { name: "Shapes and width" }).click();
  await page.getByLabel("Button shape").selectOption("pill");
  await page.getByRole("tab", { name: "Colors & backgrounds" }).click();
  await page.locator(".appearance-color").filter({ hasText: "Page background" }).locator('input[type="color"]').fill("#112233");
  await page.locator(".appearance-color").filter({ hasText: "Footer background" }).locator('input[type="color"]').fill("#F0E1D2");
  await page.getByRole("tab", { name: "Footer" }).click();
  await page.getByLabel("Copyright text").fill("Design Lab — all rights reserved");
  await page.getByRole("button", { name: "Save appearance" }).click();

  await expect.poll(() => state.appearancePatch()?.typography.body_font).toBe("editorial");
  expect(state.appearancePatch()?.header).toMatchObject({ layout: "logo_center", width: "full", logo_size: "large", nav_alignment: "start", show_search: false, show_account: false });
  expect(state.appearancePatch()?.style.button_shape).toBe("pill");
  expect(state.appearancePatch()?.colors).toMatchObject({ page: "#112233", footer: "#f0e1d2" });
  expect(state.appearancePatch()?.footer.copyright.en).toBe("Design Lab — all rights reserved");
  await expect(page.getByText("Storefront appearance saved.")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Colors & backgrounds" }).click();
  await expect(page.locator(".appearance-color").filter({ hasText: "Page background" }).locator('input[type="color"]')).toHaveValue("#112233");
  await expect(page.locator(".appearance-color").filter({ hasText: "Footer background" }).locator('input[type="color"]')).toHaveValue("#f0e1d2");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Settings section")).toBeVisible();
  await page.getByLabel("Settings section").selectOption("header");
  await expect(page.getByRole("heading", { name: "Header", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save appearance" }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("appearance-mobile.png"), fullPage: true });
});
