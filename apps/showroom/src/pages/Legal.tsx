import { Link } from "react-router-dom";
import { PageTransition } from "../components/PageTransition";
import { useLocale } from "../i18n";

export default function Legal({ document }: { document: "terms" | "privacy" }) {
  const { t } = useLocale();
  const prefix = `legal.${document}`;
  return (
    <PageTransition>
      <section className="sr-legal-page">
        <div className="sr-container sr-legal-container">
          <nav className="sr-account-breadcrumb" aria-label={t("legal.breadcrumb")}><Link to="/">{t("nav.home")}</Link><span>/</span><span>{t(`${prefix}.title`)}</span></nav>
          <header><span className="sr-membership-kicker">{t("legal.eyebrow")}</span><h1>{t(`${prefix}.title`)}</h1><p>{t(`${prefix}.intro`)}</p></header>
          <div className="sr-legal-content">
            <section><h2>{t(`${prefix}.section1.title`)}</h2><p>{t(`${prefix}.section1.body`)}</p></section>
            <section><h2>{t(`${prefix}.section2.title`)}</h2><p>{t(`${prefix}.section2.body`)}</p></section>
            <section><h2>{t(`${prefix}.section3.title`)}</h2><p>{t(`${prefix}.section3.body`)}</p></section>
            <section><h2>{t(`${prefix}.section4.title`)}</h2><p>{t(`${prefix}.section4.body`)}</p></section>
            {document === "terms" && <section><h2>{t(`${prefix}.section5.title`)}</h2><p>{t(`${prefix}.section5.body`)}</p></section>}
          </div>
          <p className="sr-legal-related">{t("legal.related")} <Link to={document === "terms" ? "/privacy" : "/terms"}>{t(document === "terms" ? "layout.privacy" : "layout.terms")}</Link></p>
        </div>
      </section>
    </PageTransition>
  );
}
