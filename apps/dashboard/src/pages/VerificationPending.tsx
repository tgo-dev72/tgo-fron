import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiMail, FiShield, FiTrendingUp } from "react-icons/fi";

import { api } from "../api/client";
import { LangSwitcher } from "../components/LangSwitcher";
import { ThemeToggle } from "../components/ThemeToggle";
import { t, useLocale } from "../i18n";

type ResendState = "idle" | "sending" | "sent" | "error";

export function VerificationPendingPage() {
  const locale = useLocale();
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [state, setState] = useState<ResendState>("idle");

  async function resend(event: FormEvent) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      await api.resendMerchantVerification(email.trim().toLowerCase());
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="login-bg register-bg">
      <div className="login-atmosphere" aria-hidden="true"><span className="login-orb login-orb-one" /><span className="login-orb login-orb-two" /></div>
      <section className="login-story">
        <div className="login-brand-lockup">
          <img src="/brand/logos/tyjara-go-green-lime.svg" alt="TijaraGO" className="login-brand-logo" />
          <div><strong>TijaraGO</strong><small>{t(locale, "nav.brandSub")}</small></div>
        </div>
        <div className="login-story-copy">
          <span className="login-eyebrow">{t(locale, "verificationPending.eyebrow")}</span>
          <h1>{t(locale, "verificationPending.storyTitle")}</h1>
          <p>{t(locale, "verificationPending.storyDetail")}</p>
        </div>
        <div className="login-principles">
          <span><FiShield /> {t(locale, "login.secure")}</span>
          <span><FiTrendingUp /> {t(locale, "login.growth")}</span>
        </div>
      </section>

      <section className="login-form-wrap register-form-wrap">
        <div className="login-language"><ThemeToggle /><LangSwitcher compact /></div>
        <form className="login-card register-card verification-card" data-verification-resend onSubmit={resend}>
          <span className="login-icon verification-icon"><FiMail /></span>
          <h2>{t(locale, "verificationPending.title")}</h2>
          <p className="verification-copy">{t(locale, "verificationPending.instructions")}</p>

          {state === "sent" && <div className="login-success" role="status">{t(locale, "verificationPending.sent")}</div>}
          {state === "error" && <div className="login-error" role="alert">{t(locale, "verificationPending.failed")}</div>}

          <div className="field verification-email-field">
            <label className="field-label" htmlFor="verification-email">{t(locale, "login.email")}</label>
            <input
              id="verification-email"
              className="input"
              type="email"
              inputMode="email"
              spellCheck={false}
              required
              autoComplete="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setState("idle"); }}
            />
          </div>
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={state === "sending"}>
            {state === "sending" ? <span className="spin" /> : t(locale, "verificationPending.send")}
          </button>
          <p className="auth-switch"><Link to="/login">{t(locale, "verificationPending.backToLogin")}</Link></p>
        </form>
      </section>
    </div>
  );
}
