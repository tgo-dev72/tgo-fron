import { StrictMode } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { loadStoreConfig } from "../config";
import type { StorefrontConfig } from "../config";
import { configurePreviewSession, isProtectedPreviewStore } from "../api/client";
import { ApiError } from "../api/client";

type LoaderIdentity = Pick<StorefrontConfig, "logoUrl" | "storeName" | "design">;

const LOADER_IDENTITY_KEY = "tijarago.storefront.loaderIdentity";

function cachedLoaderIdentity(): LoaderIdentity | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(LOADER_IDENTITY_KEY) || "null") as Partial<LoaderIdentity> | null;
    return value && typeof value.storeName === "string"
      ? {
          storeName: value.storeName,
          logoUrl: typeof value.logoUrl === "string" ? value.logoUrl : null,
          design: typeof value.design === "string" ? value.design : "basic",
        }
      : null;
  } catch {
    return null;
  }
}

function rememberLoaderIdentity(config: StorefrontConfig): void {
  try {
    window.sessionStorage.setItem(LOADER_IDENTITY_KEY, JSON.stringify({
      storeName: config.storeName,
      logoUrl: config.logoUrl,
      design: config.design,
    }));
  } catch {
    // Storage can be unavailable in privacy modes; loading must still work.
  }
}

/**
 * Standard storefront boot. The structural shell is useful immediately and
 * reserves the final header/catalog geometry while runtime config loads. It
 * never waits for logos, fonts, or images before mounting the real storefront.
 */
export function bootStorefront(root: HTMLElement, render: (config: StorefrontConfig) => ReactNode): void {
  const reactRoot = createRoot(root);

  const loading = (identity: LoaderIdentity | null = null) => reactRoot.render(
    <div className="ds-store-bootstrap" data-design={identity?.design ?? "basic"} aria-busy="true">
      <header className="ds-store-bootstrap-header">
        <span className="ds-store-bootstrap-action" aria-hidden="true" />
        <strong>{identity?.storeName || "Store"}</strong>
        <span className="ds-store-bootstrap-actions" aria-hidden="true"><i /><i /></span>
      </header>
      <nav className="ds-store-bootstrap-nav" aria-label="Loading navigation"><span /><span /><span /><span /></nav>
      <main className="ds-store-bootstrap-main" role="status" aria-live="polite" aria-label="Loading store">
        <section className="ds-store-bootstrap-hero" aria-hidden="true"><div><i /><i /><i /></div><span /></section>
        <section className="ds-store-bootstrap-products" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <i key={index} />)}</section>
      </main>
      <div className="ds-store-bootstrap-progress" aria-hidden="true"><span /></div>
    </div>,
  );

  const unavailable = (cause: unknown) => {
    const language = navigator.language.toLowerCase().startsWith("ar")
      ? "ar"
      : navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
    const maintenance = cause instanceof ApiError && cause.code === "storefront_temporarily_unavailable";
    const storeName = cause instanceof ApiError ? cause.fields.storeName?.[0] : "";
    const copy = {
      ar: { eyebrow: "سنعود قريبًا", title: "المتجر غير متاح حاليًا", body: "نقوم بتجهيز المتجر للعودة إليكم قريبًا. شكرًا لتفهمكم.", retry: "إعادة المحاولة", fallback: "تعذر فتح المتجر الآن. حاول مرة أخرى بعد قليل." },
      fr: { eyebrow: "À très bientôt", title: "Boutique momentanément indisponible", body: "Nous préparons la boutique pour vous accueillir à nouveau très prochainement. Merci de votre compréhension.", retry: "Réessayer", fallback: "La boutique ne peut pas être ouverte pour le moment. Réessayez dans quelques instants." },
      en: { eyebrow: "Coming soon", title: "Store temporarily unavailable", body: "We’re preparing the store to welcome you back very soon. Thank you for your patience.", retry: "Try again", fallback: "The store cannot be opened right now. Please try again shortly." },
    }[language];
    document.title = `${storeName || "Store"} — ${copy.title}`;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    reactRoot.render(
      <main className="ds-store-unavailable" role="alert">
        <div className="ds-store-unavailable-mark" aria-hidden="true"><span /></div>
        {storeName && <strong className="ds-store-unavailable-name">{storeName}</strong>}
        <span className="ds-store-unavailable-eyebrow">{maintenance ? copy.eyebrow : "TijaraGO"}</span>
        <h1>{maintenance ? copy.title : copy.fallback}</h1>
        {maintenance && <p>{copy.body}</p>}
        <button type="button" onClick={() => window.location.reload()}>{copy.retry}</button>
      </main>,
    );
  };

  const notFound = () => {
    const language = navigator.language.toLowerCase().startsWith("ar")
      ? "ar"
      : navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
    const copy = {
      ar: { title: "الصفحة غير موجودة", body: "عذرًا، تعذّر العثور على الصفحة التي تبحث عنها." },
      fr: { title: "Page introuvable", body: "Désolé, la page que vous recherchez est introuvable." },
      en: { title: "Page not found", body: "Sorry, the page you are looking for could not be found." },
    }[language];
    document.title = copy.title;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    reactRoot.render(
      <main className="ds-store-not-found">
        <div className="ds-store-not-found-code" aria-hidden="true">404</div>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </main>,
    );
  };

  const start = (previewLocale?: "en" | "fr" | "ar") => loadStoreConfig()
    .then((config) => {
      const currentHost = window.location.hostname.toLowerCase();
      const known = config.publicDomains?.some((item) => item.hostname.toLowerCase() === currentHost);
      const primary = config.publicDomains?.find((item) => item.primary)?.hostname;
      if (known && primary && primary.toLowerCase() !== currentHost && window.location.protocol === "https:") {
        window.location.replace(`https://${primary}${window.location.pathname}${window.location.search}${window.location.hash}`);
        return;
      }
      const localizedConfig = previewLocale ? { ...config, defaultLocale: previewLocale } : config;
      if (previewLocale) {
        try { window.localStorage.removeItem(`sf-locale:${config.slug ?? config.domain ?? "store"}`); } catch { /* storage unavailable */ }
      }
      rememberLoaderIdentity(localizedConfig);
      reactRoot.render(<StrictMode>{render(localizedConfig)}</StrictMode>);
    })
    .catch(unavailable);

  loading(cachedLoaderIdentity());
  if (window.self !== window.top) {
    const timeout = window.setTimeout(notFound, 10_000);
    const receiveSession = (event: MessageEvent) => {
      const data = event.data as { type?: string; ticket?: string; preset?: string; locale?: string } | null;
      if (event.source !== window.parent || data?.type !== "tijarago-preview-session" || typeof data.ticket !== "string") return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", receiveSession);
      configurePreviewSession(data.ticket, typeof data.preset === "string" ? data.preset : "");
      const previewLocale = data.locale === "ar" || data.locale === "fr" || data.locale === "en" ? data.locale : undefined;
      void start(previewLocale);
    };
    window.addEventListener("message", receiveSession);
    window.parent.postMessage({ type: "tijarago-preview-awaiting-session" }, "*");
    return;
  }
  if (isProtectedPreviewStore()) {
    notFound();
    return;
  }
  void start();
}
