import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { IconCard, IconStore } from "../components/ShowroomIcons";
import { PageTransition } from "../components/PageTransition";
import { useLocale } from "../i18n";

export default function Profile() {
  const { user } = useAuth();
  const { t } = useLocale();
  if (!user) return null;

  const language = t(`account.language.${user.preferredLanguage}`);
  const value = (candidate: string) => candidate || t("account.notProvided");

  return (
    <PageTransition>
      <section className="sr-account-page">
        <nav className="sr-account-breadcrumb" aria-label={t("account.breadcrumb")}>
          <Link to="/dashboard">{t("nav.stores")}</Link>
          <span aria-hidden="true">/</span>
          <span>{t("nav.profile")}</span>
        </nav>

        <header className="sr-account-page-header">
          <p>{t("account.eyebrow")}</p>
          <h1>{t("account.title")}</h1>
          <span>{t("account.subtitle")}</span>
        </header>

        <div className="sr-account-layout">
          <article className="sr-profile-card">
            <div className="sr-profile-identity">
              <span className="sr-profile-avatar">{user.name.charAt(0).toUpperCase()}</span>
              <div>
                <h2>{user.name}</h2>
                <p>{value(user.businessName)}</p>
              </div>
              <span className={`sr-profile-status${user.emailVerified ? " verified" : ""}`}>
                {user.emailVerified ? t("account.verified") : t("account.pending")}
              </span>
            </div>

            <div className="sr-profile-details">
              <div><span>{t("account.fullName")}</span><strong>{user.name}</strong></div>
              <div><span>{t("account.business")}</span><strong>{value(user.businessName)}</strong></div>
              <div><span>{t("account.email")}</span><strong dir="ltr">{user.email}</strong></div>
              <div><span>{t("account.phone")}</span><strong dir="ltr">{value(user.phoneNumber)}</strong></div>
              <div><span>{t("account.language")}</span><strong>{language}</strong></div>
              <div><span>{t("account.phoneStatus")}</span><strong>{user.phoneVerified ? t("account.verified") : t("account.notVerified")}</strong></div>
            </div>
          </article>

          <aside className="sr-account-side">
            <section className="sr-account-side-card">
              <h2>{t("account.shortcuts")}</h2>
              <Link to="/dashboard"><IconStore /><span><strong>{t("nav.stores")}</strong><small>{t("account.storesHint")}</small></span></Link>
              <Link to="/membership"><IconCard /><span><strong>{t("nav.billing")}</strong><small>{t("account.billingHint")}</small></span></Link>
            </section>
          </aside>
        </div>
      </section>
    </PageTransition>
  );
}
