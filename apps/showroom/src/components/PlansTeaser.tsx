import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLocale } from "../i18n";
import { warmPlanCatalog } from "../lib/planCatalog";

export function PlansTeaser() {
  const { t } = useLocale();

  return (
    <section className="sr-section sr-plans-teaser" aria-labelledby="plans-teaser-title">
      <div className="sr-container">
        <motion.div
          className="sr-plans-teaser-card"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="sr-plans-teaser-copy">
            <span className="sr-membership-kicker">{t("plans.kicker")}</span>
            <h2 id="plans-teaser-title">{t("plans.teaserTitle")}</h2>
            <p>{t("plans.teaserSubtitle")}</p>
          </div>
          <Link to="/pricing" className="sr-btn sr-btn-primary sr-btn-lg" onMouseEnter={warmPlanCatalog} onFocus={warmPlanCatalog}>
            {t("plans.explore")} <span aria-hidden="true">→</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
