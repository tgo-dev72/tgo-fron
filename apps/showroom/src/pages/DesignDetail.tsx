import { useParams, Link } from "react-router-dom";
import rawManifest from "@manifest?raw";
import { PageTransition } from "../components/PageTransition";
import { DesignScreenshotGallery } from "../components/DesignScreenshotGallery";
import { featureDescription, featureLabel, getAccent, isPremium, isReady, type Manifest } from "../lib/designs";
import { useLocale } from "../i18n";

export default function DesignDetail() {
  const { key } = useParams<{ key: string }>();
  const { t } = useLocale();
  const manifest = JSON.parse(rawManifest) as Manifest;
  const design = manifest.designs.find((d) => d.key === key);

  if (!design) return <div className="sr-not-found">{t("detail.notFound")}</div>;

  const premium = isPremium(design);
  const ready = isReady(design);
  const selectUrl = `/create?design=${encodeURIComponent(design.key)}`;

  return (
    <PageTransition>
      <div className="sr-design-detail">
      <nav className="sr-breadcrumb" aria-label="Breadcrumb">
        <Link to="/gallery">{t("nav.gallery")}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{design.name}</span>
      </nav>

      <header className="sr-detail-header">
        <div className="sr-detail-meta" style={{ "--accent": getAccent(design.key) } as React.CSSProperties}>
          <span className="sr-detail-tag">{design.tagline}</span>
          <h1>{design.name}</h1>
          <p>{design.description}</p>
          <strong className="sr-detail-business-need">{design.business_need}</strong>
          <div className="sr-design-best-for">
            {design.best_for.map((item) => <span key={item}>{item}</span>)}
          </div>
          <div className="sr-detail-badges">
            <span className={`sr-tier-badge ${premium ? "premium" : "standard"}`}>
              {t(premium ? "design.tier.premium" : "design.tier.standard")}
            </span>
            <span className="sr-badge">{t("detail.badge.responsive")}</span>
            <span className="sr-badge">{t("detail.badge.curated")}</span>
          </div>
        </div>
        <div className="sr-detail-actions">
          {ready ? (
            <>
              <Link to={`/design/${design.key}/preview`} className="sr-btn sr-btn-primary sr-btn-lg">{t("detail.livePreview")}</Link>
              <Link to={selectUrl} className="sr-btn sr-btn-outline sr-btn-lg">{t(premium ? "detail.unlockDesign" : "detail.chooseDesign")}</Link>
            </>
          ) : (
            <span className="sr-btn sr-btn-ghost sr-btn-lg" aria-disabled="true">{t("dash.metrics.building")}</span>
          )}
          <Link to="/gallery" className="sr-btn sr-btn-ghost sr-btn-lg">{t("detail.backGallery")}</Link>
        </div>
      </header>

      {ready && <DesignScreenshotGallery designKey={design.key} designName={design.name} />}

      <section className="sr-detail-section" aria-labelledby="business-journey-title">
        <h2 id="business-journey-title">{design.business_need}</h2>
        <ol className="sr-business-journey">
          {design.journey.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <section className="sr-detail-section" aria-labelledby="business-outcomes-title">
        <h2 id="business-outcomes-title">{t("detail.businessOutcomes")}</h2>
        <div className="sr-tech-grid sr-business-outcomes">
          {design.business_outcomes.map((outcome, index) => (
            <article className="sr-tech-card" key={outcome}>
              <span className="sr-experience-number">{String(index + 1).padStart(2, "0")}</span>
              <h3>{outcome}</h3>
            </article>
          ))}
        </div>
      </section>

      {premium && design.features && design.features.length > 0 && (
        <section className="sr-detail-section" aria-labelledby="premium-features-title">
          <h2 id="premium-features-title">{t("design.premiumFeatures")}</h2>
          <div className="sr-premium-feature-grid">
            {design.features.map((feature) => (
              <article key={feature} className="sr-premium-feature">
                <h3>{featureLabel(feature)}</h3>
                <p>{featureDescription(feature)}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="sr-detail-section" aria-labelledby="experience-title">
        <h2 id="experience-title">{t("detail.experience.title")}</h2>
        <p>{t("detail.experience.subtitle")}</p>
        <div className="sr-tech-grid sr-experience-grid">
          <div className="sr-tech-card">
            <span className="sr-experience-number">01</span>
            <h3>{t("detail.experience.brand.title")}</h3>
            <p>{t("detail.experience.brand.desc")}</p>
          </div>
          <div className="sr-tech-card">
            <span className="sr-experience-number">02</span>
            <h3>{t("detail.experience.customer.title")}</h3>
            <p>{t("detail.experience.customer.desc")}</p>
          </div>
          <div className="sr-tech-card">
            <span className="sr-experience-number">03</span>
            <h3>{t("detail.experience.care.title")}</h3>
            <p>{t("detail.experience.care.desc")}</p>
          </div>
        </div>
      </section>
      </div>
    </PageTransition>
  );
}
