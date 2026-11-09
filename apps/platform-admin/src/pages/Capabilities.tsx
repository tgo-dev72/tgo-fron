import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiCheckCircle, FiLayers, FiShield } from "react-icons/fi";
import { adminApi, type BusinessRuleTemplate, type PricingCatalog, type SupportedLocale } from "../api";
import { ErrorState, Loading, PageHeader } from "../components/Ui";
import { useI18n } from "../i18n";

function localizedCopy(rule: BusinessRuleTemplate, locale: string) {
  return rule.translations?.[locale as SupportedLocale] ?? rule.translations.en ?? {
    name: rule.name,
    description: rule.description,
  };
}

export function CapabilitiesPage() {
  const { locale, tr } = useI18n();
  const [data, setData] = useState<PricingCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setLoading(true); setError("");
    return adminApi.pricing().then(setData).catch(() => setError(tr("common.unavailableDetail"))).finally(() => setLoading(false));
  }, [tr]);
  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorState message={error} retry={load} />;
  if (!data) return null;

  return <>
    <PageHeader eyebrow={tr("capabilities.eyebrow")} title={tr("capabilities.title")} detail={tr("capabilities.detail")} />
    <div className="capability-guide-toolbar">
      <Link to="/plans" className="button secondary"><FiArrowLeft /> {tr("capabilities.back")}</Link>
      <p><FiShield /> {tr("capabilities.snapshot")}</p>
    </div>
    <section className="capability-guide-grid">
      {data.rule_templates.map((rule) => {
        const localized = localizedCopy(rule, locale);
        return <article key={rule.key}>
          <header><span><FiLayers /></span><div><h2>{localized.name}</h2><code>{rule.key}</code></div>{rule.configured && <b><FiCheckCircle /> {tr("capabilities.ready")}</b>}</header>
          <p>{localized.description}</p>
          <dl>
            <div><dt>{tr("capabilities.behaviour")}</dt><dd>{tr(`capabilities.kind.${rule.kind}`)}</dd></div>
            <div><dt>{tr("capabilities.scope")}</dt><dd>{tr(`capabilities.scope.${rule.scope}`)}</dd></div>
            <div><dt>{tr("capabilities.value")}</dt><dd>{tr(`capabilities.value.${rule.value_type}`)}</dd></div>
            <div><dt>{tr("capabilities.default")}</dt><dd>{String(rule.default_value)}{rule.unit ? ` ${rule.unit}` : ""}</dd></div>
          </dl>
          {rule.zero_means_unlimited && <small>{tr("capabilities.zeroUnlimited")}</small>}
        </article>;
      })}
    </section>
  </>;
}
