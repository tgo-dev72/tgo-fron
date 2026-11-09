import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getAccent, isPremium, isReady, type Design } from "../lib/designs";
import { useLocale } from "../i18n";
import { useAuth } from "../auth/AuthContext";
import { IconExternalLink } from "./ShowroomIcons";

interface DesignCardProps {
  design: Design;
  priority?: boolean;
}

export function DesignCard({ design, priority = false }: DesignCardProps) {
  const { t } = useLocale();
  const { user } = useAuth();
  const accent = getAccent(design.key);
  const premium = isPremium(design);
  const ready = isReady(design);

  return (
    <motion.article
      className={`sr-design-card${premium ? " sr-design-card-premium" : ""}${ready ? "" : " is-building"}`}
      style={{ "--accent": accent } as React.CSSProperties}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      >
      <Link className="sr-design-preview" to={`/design/${design.key}/preview`} aria-label={`${t("design.livePreview")}: ${design.name}`}>
        <img className="sr-design-gallery-photo" src={`/gallery/current/${design.key}.png`} alt={`${design.name} ${t("gallery.storefront")}`} width="1440" height="1080" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} />
        <span className={`sr-tier-badge ${premium ? "premium" : "standard"}`}>{t(premium ? "design.tier.premium" : "design.tier.standard")}</span>
        <span className="sr-design-preview-action">{t("design.livePreview")} <IconExternalLink /></span>
      </Link>
      <div className="sr-design-content">
        <header>
          <span className="sr-design-tag">{design.tagline}</span>
          <h3>{design.name}</h3>
        </header>
        <p className="sr-design-desc">{design.description}</p>
        <div className="sr-design-best-for">
          {design.best_for.slice(0, 3).map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="sr-design-actions">
          {ready && design.preview_available && <Link to={`/design/${design.key}/preview`} className="sr-btn sr-btn-primary">{t("design.livePreview")}</Link>}
          {ready && <Link to={`${user ? "/create" : "/signup"}?design=${encodeURIComponent(design.key)}`} className="sr-btn sr-btn-outline">{t(premium ? "detail.unlockDesign" : "detail.chooseDesign")}</Link>}
          {!ready && <Link to={`/design/${design.key}`} className="sr-btn sr-btn-outline">{t("design.details")}</Link>}
        </div>
      </div>
    </motion.article>
  );
}
