import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ScrollReveal } from "../motion/ScrollReveal";
import { StaggerContainer, StaggerItem } from "../motion/Stagger";
import { platform, type SubscriptionStatus } from "../api/platform";
import { useAuth } from "../auth/AuthContext";
import { useLocale } from "../i18n";
import { loadPlanCatalog, readPlanCatalogCache } from "../lib/planCatalog";
import { activePlanSubscriptions, formatPlanPrice, hasUsedFreePlan, localizedPlanCopy, planBenefits, recommendedPlanId } from "../lib/plans";

const officialEntitlements = [
  "stores.max_count", "designs.premium", "team.max_members", "catalog.max_products",
  "domains.custom", "branding.remove_platform", "invoicing.issue", "analytics.level",
  "marketing.email_monthly_sends", "catalog.import",
] as const;

function entitlementDisplay(value: boolean | number | string | undefined, locale: "en" | "fr" | "ar") {
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (typeof value === "number") return value.toLocaleString(locale === "ar" ? "ar-MA" : locale);
  const levels: Record<string, Record<string, string>> = {
    essential: { en: "Essential", fr: "Essentiel", ar: "أساسي" },
    standard: { en: "Standard", fr: "Standard", ar: "قياسي" },
    advanced: { en: "Advanced", fr: "Avancé", ar: "متقدم" },
  };
  return value ? levels[value]?.[locale] ?? value : "—";
}

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
                    <span>{plan.is_free ? t("plans.freePeriod") : `/ ${plan.duration_days} ${t("membership.days")}`}</span>
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
          <>
            <p className="sr-plans-note">{t("plans.note")}</p>
            <ScrollReveal as="section" className="sr-plan-comparison" aria-labelledby="plans-comparison-title">
              <div className="sr-section-header">
                <span className="sr-membership-kicker">{t("plans.compareKicker")}</span>
                <h2 id="plans-comparison-title">{t("plans.compareTitle")}</h2>
              </div>
              <div className="sr-plan-table-scroll">
                <table>
                  <thead><tr><th>{t("plans.feature")}</th>{plans.map((plan) => <th key={plan.id}>{localizedPlanCopy(plan, locale).name}</th>)}</tr></thead>
                  <tbody>{officialEntitlements.map((key) => <tr key={key}>
                    <th>{t(`plans.entitlement.${key}`)}</th>
                    {plans.map((plan) => <td key={plan.id}>{entitlementDisplay(plan.entitlements?.[key], locale)}</td>)}
                  </tr>)}</tbody>
                </table>
              </div>
            </ScrollReveal>
            <ScrollReveal as="section" className="sr-plan-education">
              <span className="sr-membership-kicker">{t("plans.educationKicker")}</span>
              <h2>{t("plans.educationTitle")}</h2>
              <p>{t("plans.educationBody")}</p>
            </ScrollReveal>
          </>
        )}
      </div>
    </section>
  );
}
