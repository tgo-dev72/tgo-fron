import { useEffect, useState } from "react";
import { useLocale } from "../i18n";

type ScreenshotView = "storefront" | "product" | "cart" | "checkout";

const views: ScreenshotView[] = ["storefront", "product", "cart", "checkout"];

export function DesignScreenshotGallery({ designKey, designName }: { designKey: string; designName: string }) {
  const { t } = useLocale();
  const [activeView, setActiveView] = useState<ScreenshotView>("storefront");
  const [fullView, setFullView] = useState(false);
  const imageFor = (view: ScreenshotView) => `/gallery/current/${designKey}${view === "storefront" ? "" : `-${view}`}.png`;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullView(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <section className="sr-detail-section sr-screenshot-gallery" aria-labelledby="gallery-title">
      <div className="sr-screenshot-gallery-head">
        <div>
          <h2 id="gallery-title">{t("gallery.screens")}</h2>
          <p>{t("gallery.screensNote")}</p>
        </div>
        <span className="sr-gallery-static-note">{t("gallery.static")}</span>
      </div>
      <button type="button" className="sr-screenshot-stage" onClick={() => setFullView(true)} aria-label={t("gallery.openFull")}>
        <img src={imageFor(activeView)} alt={`${designName} ${t(`gallery.${activeView}`)}`} onError={() => setActiveView("storefront")} />
        <span className="sr-brand-watermark" aria-label="TijaraGO">
          TijaraGO
        </span>
        <span className="sr-screenshot-expand" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-8 8" /><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" /></svg>
        </span>
      </button>
      <div className="sr-screenshot-thumbnails" role="tablist" aria-label={t("gallery.screens")}>
        {views.map((view) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={activeView === view}
            className={activeView === view ? "active" : ""}
            onClick={() => setActiveView(view)}
          >
            <img src={imageFor(view)} alt="" onError={(event) => { event.currentTarget.src = imageFor("storefront"); }} />
            <span>{t(`gallery.${view}`)}</span>
          </button>
        ))}
      </div>
      {fullView && (
        <div className="sr-gallery-lightbox" role="dialog" aria-modal="true" aria-label={t("gallery.openFull")} onClick={() => setFullView(false)}>
          <button type="button" className="sr-gallery-lightbox-close" onClick={() => setFullView(false)} aria-label={t("gallery.closeFull")}>×</button>
          <div className="sr-gallery-lightbox-image" onClick={(event) => event.stopPropagation()}>
            <img src={imageFor(activeView)} alt={`${designName} ${t(`gallery.${activeView}`)}`} onError={() => setActiveView("storefront")} />
            <span className="sr-brand-watermark">TijaraGO</span>
          </div>
        </div>
      )}
    </section>
  );
}
