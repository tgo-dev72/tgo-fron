import { Link } from "react-router-dom";
import { platform, type Design } from "../api/platform";
import { DesignCard } from "../components/DesignCard";
import { PageTransition } from "../components/PageTransition";
import { useAsync } from "../hooks/useAsync";
import { useLocale } from "../i18n";
import { ScrollReveal } from "../motion/ScrollReveal";
import { StaggerContainer, StaggerItem } from "../motion/Stagger";

export default function Gallery() {
  const { t } = useLocale();
  const { data, loading, error, refresh } = useAsync<Design[]>(() => platform.listDesigns(), []);
  const designs = (data ?? []).filter((design) => design.status === "ready");
  const standardDesigns = designs.filter((design) => design.tier !== "premium");
  const premiumDesigns = designs.filter((design) => design.tier === "premium");

  const collection = (items: Design[], prioritize = false) => <StaggerContainer className="sr-designs-grid">
    {items.map((design, index) => <StaggerItem key={design.key}><DesignCard design={design} priority={prioritize && index < 2} /></StaggerItem>)}
  </StaggerContainer>;

  return <PageTransition><main className="sr-gallery-page" aria-labelledby="gallery-title"><div className="sr-container">
    <ScrollReveal as="header" className="sr-gallery-hero">
      <p className="sr-hero-eyebrow">{t("gallery.eyebrow")}</p><h1 id="gallery-title">{t("designs.title")}</h1><p>{t("designs.subtitle")}</p>
    </ScrollReveal>
    {loading && <div className="sr-gallery-loading" role="status" aria-label={t("preview.loading")}><span className="sr-only">{t("preview.loading")}</span>{[0, 1, 2, 3].map((item) => <div className="sr-gallery-card-skeleton" key={item} aria-hidden="true"><span /><i /><i /></div>)}</div>}
    {error && <div className="sr-studio-unavailable" role="alert"><h2>{t("preview.unavailable")}</h2><p>{t("preview.unavailableDesc")}</p><button className="sr-btn sr-btn-primary" type="button" onClick={refresh}>{t("preview.retry")}</button></div>}
    {!loading && !error && <>
      <ScrollReveal as="section" className="sr-premium-collection" aria-labelledby="premium-designs-title"><div className="sr-premium-collection-heading"><div><p className="sr-premium-kicker">{t("gallery.premium.eyebrow")}</p><h2 id="premium-designs-title">{t("gallery.premium.title")}</h2><p>{t("gallery.premium.subtitle")}</p></div><span className="sr-premium-count">{premiumDesigns.length} {t("gallery.premium.editions")}</span></div>{collection(premiumDesigns, true)}</ScrollReveal>
      <ScrollReveal as="section" className="sr-gallery-collection" aria-labelledby="standard-designs-title"><div className="sr-gallery-section-heading"><p>{t("gallery.standard.eyebrow")}</p><h2 id="standard-designs-title">{t("gallery.standard.title")}</h2></div>{collection(standardDesigns)}</ScrollReveal>
      <ScrollReveal as="section" className="sr-gallery-cta" variant="scale"><p className="sr-hero-eyebrow">{t("gallery.eyebrow")}</p><h2>{t("cta.title")}</h2><p>{t("cta.subtitle")}</p><Link className="sr-btn sr-btn-primary sr-btn-lg" to="/signup">{t("cta.create")}</Link></ScrollReveal>
    </>}
  </div></main></PageTransition>;
}
