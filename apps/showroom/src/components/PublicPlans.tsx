import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ScrollReveal } from "../motion/ScrollReveal";
import { StaggerContainer, StaggerItem } from "../motion/Stagger";
import { platform, type SubscriptionStatus } from "../api/platform";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "../i18n";
import { loadPlanCatalog, readPlanCatalogCache } from "../lib/planCatalog";
import { activePlanSubscriptions, formatPlanPrice, hasUsedFreePlan, localizedPlanCopy, planBenefits, recommendedPlanId } from "../lib/plans";

export function PublicPlans() {
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState(readPlanCatalogCache);
  const [loading, setLoading] = useState(() => !readPlanCatalogCache());
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [statusResolved, setStatusResolved] = useState(() => !user);

  const load = async () => {
    if (!catalog) setLoading(true);
    setFailed(false);
    try {
      setCatalog(await loadPlanCatalog());
    } catch {
      if (!catalog) setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadPlanCatalog()
      .then((next) => {
        if (active) {
          setCatalog(next);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active && !readPlanCatalogCache()) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) {
      setStatus(null);
      setStatusResolved(true);
      return;
    }
    setStatusResolved(false);
    let active = true;
    platform.subscriptionStatus()
      .then((next) => { if (active) setStatus(next); })
      .catch(() => { if (active) setStatus(null); })
      .finally(() => { if (active) setStatusResolved(true); });
    return () => { active = false; };
  }, [user]);

  const plans = (catalog?.plans ?? []).filter((plan) => (
    !user || !plan.is_free || (statusResolved && status !== null && (!hasUsedFreePlan(status) || activePlanSubscriptions(status, plan).length > 0))
  ));
  const recommendedId = recommendedPlanId(plans);
  return (
    <section id="plans" className="sr-section sr-public-plans" aria-labelledby="plans-title">
      <div className="sr-container">
        <ScrollReveal as="header" className="sr-section-header">
          <span className="sr-membership-kicker">{t("plans.kicker")}</span>
          <h2 id="plans-title">{t("plans.title")}</h2>
          <p>{t("plans.subtitle")}</p>
        </ScrollReveal>

        <StaggerContainer className="sr-plan-decision-guide" aria-label={t("plans.guide.label")}>
          <StaggerItem as="article"><span>01</span><div><strong>{t("plans.guide.compare")}</strong><p>{t("plans.guide.compareDesc")}</p></div></StaggerItem>
          <StaggerItem as="article"><span>02</span><div><strong>{t("plans.guide.coverage")}</strong><p>{t("plans.guide.coverageDesc")}</p></div></StaggerItem>
          <StaggerItem as="article"><span>03</span><div><strong>{t("plans.guide.review")}</strong><p>{t("plans.guide.reviewDesc")}</p></div></StaggerItem>
        </StaggerContainer>

        {loading && (
          <div className="sr-plan-grid" aria-busy="true" aria-label={t("plans.loading")}>
            {[0, 1, 2].map((item) => <div key={item} className="sr-plan-card sr-plan-skeleton" aria-hidden="true" />)}
          </div>
        )}

        {!loading && failed && !catalog && (
          <div className="sr-plans-unavailable" role="status">
            <span>{t("plans.unavailable")}</span>
            <button type="button" className="sr-btn sr-btn-ghost sr-btn-sm" onClick={() => void load()}>{t("preview.retry")}</button>
          </div>
        )}

        {!loading && !failed && plans.length === 0 && (
          <div className="sr-plans-unavailable" role="status">{t("plans.empty")}</div>
        )}

        {!loading && plans.length > 0 && (
          <StaggerContainer className="sr-plan-grid">
            {plans.map((plan) => {
              const copy = localizedPlanCopy(plan, locale);
              const benefits = planBenefits(plan, locale);
              const recommended = plan.id === recommendedId;
              const activeSubscriptions = activePlanSubscriptions(status, plan);
              const current = activeSubscriptions.length > 0;
              const activeStoreCount = activeSubscriptions.filter((entry) => entry.selected_store).length;
              return (
                <StaggerItem as="article" key={plan.id} className={`sr-plan-card sr-public-plan-card${recommended ? " featured" : ""}${current ? " current" : ""}`}>
                  <div className="sr-plan-card-topline">
                    {current ? <span className="sr-plan-current-badge">{t("membership.current")}</span> : recommended ? <span className="sr-plan-recommended">{t("plans.recommended")}</span> : <span />}
                    <span className="sr-plan-scope-pill">{current && activeStoreCount > 0 ? `${activeStoreCount} ${t(activeStoreCount === 1 ? "plans.activeStore" : "plans.activeStores")}` : t(plan.entitlement_scope === "one_store" ? "planDetail.scopeStore" : "planDetail.scopeAccount")}</span>
                  </div>
                  <div className="sr-plan-heading"><Link to={`/pricing/${encodeURIComponent(plan.slug)}`}>{copy.name}</Link></div>
                  <p>{copy.description || t("planDetail.coreIncluded")}</p>
                  <div className="sr-plan-price">
                    <strong>{plan.is_free ? t("membership.free") : formatPlanPrice(plan.price, plan.currency, locale)}</strong>
                    {!plan.is_free && <span>/ {plan.duration_days} {t("membership.days")}</span>}
                  </div>
                  <div className="sr-plan-highlights-heading">
                    <span>{t("plans.highlights")}</span>
                    {benefits.length > 5 && <small>+{benefits.length - 5} {t("plans.more")}</small>}
                  </div>
                  <ul>
                    {benefits.slice(0, 5).map((benefit) => <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>)}
                  </ul>
                  <div className="sr-plan-card-footer">
                    <Link to={`/pricing/${encodeURIComponent(plan.slug)}`} className={`sr-btn sr-btn-block ${recommended ? "sr-btn-primary" : "sr-btn-ghost"}`}>
                      {t(current ? "plans.viewCurrent" : "plans.viewDetails")}
                    </Link>
                    <span>{t("plans.reviewFirst")}</span>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        )}

        {!loading && plans.length > 0 && (
          <p className="sr-plans-note">{t("plans.note")}</p>
        )}
      </div>
    </section>
  );
}
