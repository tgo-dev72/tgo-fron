import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { t, useLocale } from "../i18n";
import { LangSwitcher } from "../components/LangSwitcher";
import { ThemeToggle } from "../components/ThemeToggle";
import { FiArrowRight, FiLock, FiShield, FiTrendingUp } from "react-icons/fi";
import { showroomSignupUrl } from "../lib/appLinks";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locale = useLocale();
  const verification = new URLSearchParams(location.search).get("verification");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      const from = (location.state as { from?: { pathname: string; search?: string; hash?: string } } | null)?.from;
      navigate(from ?? "/", { replace: true });
    } catch {
      setError(t(locale, "login.failed"));
      setBusy(false);
    }
  }

  return (
    <div className="login-bg" dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="login-atmosphere" aria-hidden="true"><span className="login-orb login-orb-one" /><span className="login-orb login-orb-two" /></div>
      <section className="login-story">
        <div className="login-brand-lockup">
          <img src="/brand/logos/tyjara-go-green-lime.svg" alt="TijaraGO" className="login-brand-logo" />
          <div><strong>TijaraGO</strong><small>{t(locale, "nav.brandSub")}</small></div>
        </div>
        <div className="login-story-copy">
          <span className="login-eyebrow">{t(locale, "login.eyebrow")}</span>
          <h1>{t(locale, "login.headline1")}<br />{t(locale, "login.headline2")}</h1>
          <p>{t(locale, "login.story")}</p>
        </div>
        <div className="login-principles">
          <span><FiShield /> {t(locale, "login.secure")}</span>
          <span><FiTrendingUp /> {t(locale, "login.growth")}</span>
        </div>
      </section>

      <section className="login-form-wrap">
        <div className="login-language"><ThemeToggle /><LangSwitcher compact /></div>
        <form className={`login-card${busy ? " auth-processing" : ""}`} onSubmit={submit} aria-busy={busy}>
          <span className="login-icon"><FiLock /></span>
          <h2>{t(locale, "login.welcomeBack")}</h2>
          <p className="sub">{t(locale, "login.subtitle")}</p>

          {verification === "success" && <div className="login-success" role="status">{t(locale, "login.emailVerified")}</div>}
          {verification === "invalid" && <div className="login-error" role="alert">{t(locale, "login.verificationInvalid")}</div>}
          {error && <div className="login-error" role="alert">{error}</div>}

          <div className="field" style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="email">{t(locale, "login.email")}</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              autoComplete="email"
              placeholder="you@store.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="field" style={{ marginBottom: 22 }}>
            <label className="field-label" htmlFor="password">{t(locale, "login.password")}</label>
            <input
              id="password"
              className="input"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>

          <button className={`btn btn-primary btn-lg btn-block login-submit${busy ? " is-processing" : ""}`} type="submit" disabled={busy}>
            <span className="auth-submit-content" aria-live="polite">
              {busy ? <><span className="spin" aria-hidden="true" /> {t(locale, "login.signingIn")}</> : <>{t(locale, "login.signIn")} <FiArrowRight /></>}
            </span>
          </button>
          <p className="auth-switch"><Link to="/forgot-password" state={{ email }}>{t(locale, "recovery.forgot")}</Link></p>
          <p className="auth-switch auth-verification-help">
            {t(locale, "login.notVerified")} <Link to="/verify-email-pending" state={{ email }}>{t(locale, "login.resendVerification")}</Link>
          </p>
          <p className="auth-switch">{t(locale, "login.noAccount")} <a href={showroomSignupUrl(locale)}>{t(locale, "login.createAccount")}</a></p>
        </form>
      </section>
    </div>
  );
}
