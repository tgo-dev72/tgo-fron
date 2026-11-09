import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle, FiCheck, FiMail } from "react-icons/fi";

import { api, ApiError } from "../api/client";
import { LangSwitcher } from "../components/LangSwitcher";
import { ThemeToggle } from "../components/ThemeToggle";
import { t, useLocale } from "../i18n";

type VerificationState = "verifying" | "success" | "invalid" | "temporary";

export function VerifyEmailPage() {
  const locale = useLocale();
  const [state, setState] = useState<VerificationState>("verifying");
  const token = useRef(new URLSearchParams(window.location.search).get("token")?.trim() ?? "");
  const started = useRef(false);

  function verify() {
    if (!token.current) {
      setState("invalid");
      return;
    }
    setState("verifying");
    api.verifyMerchantEmail(token.current)
      .then(() => setState("success"))
      .catch((caught) => {
        setState(caught instanceof ApiError && caught.status === 400 ? "invalid" : "temporary");
      });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // The signed token is needed only for this request. Remove it immediately
    // so it is not retained in browser history, screenshots, or copied URLs.
    window.history.replaceState(window.history.state, "", "/verify-email");
    verify();
    // The initial verification must run once for the token captured on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = {
    verifying: {
      icon: <FiMail />,
      title: t(locale, "verifyEmail.verifyingTitle"),
      detail: t(locale, "verifyEmail.verifyingDetail"),
    },
    success: {
      icon: <FiCheck />,
      title: t(locale, "verifyEmail.successTitle"),
      detail: t(locale, "verifyEmail.successDetail"),
    },
    invalid: {
      icon: <FiAlertTriangle />,
      title: t(locale, "verifyEmail.invalidTitle"),
      detail: t(locale, "verifyEmail.invalidDetail"),
    },
    temporary: {
      icon: <FiAlertTriangle />,
      title: t(locale, "verifyEmail.temporaryTitle"),
      detail: t(locale, "verifyEmail.temporaryDetail"),
    },
  }[state];

  return (
    <div className="login-bg register-bg">
      <div className="login-atmosphere" aria-hidden="true"><span className="login-orb login-orb-one" /><span className="login-orb login-orb-two" /></div>
      <section className="login-story">
        <div className="login-brand-lockup">
          <img src="/brand/logos/tyjara-go-green-lime.svg" alt="TijaraGO" className="login-brand-logo" />
          <div><strong>TijaraGO</strong><small>{t(locale, "nav.brandSub")}</small></div>
        </div>
        <div className="login-story-copy">
          <span className="login-eyebrow">{t(locale, "verifyEmail.eyebrow")}</span>
          <h1>{t(locale, "verifyEmail.storyTitle")}</h1>
          <p>{t(locale, "verifyEmail.storyDetail")}</p>
        </div>
      </section>

      <section className="login-form-wrap register-form-wrap">
        <div className="login-language"><ThemeToggle /><LangSwitcher compact /></div>
        <div className="login-card register-card verification-card" aria-live="polite">
          <span className={`login-icon verification-icon verification-icon-${state}`}>{state === "verifying" ? <span className="spin" /> : content.icon}</span>
          <h2>{content.title}</h2>
          <p className="verification-copy">{content.detail}</p>
          {state === "success" && <Link className="btn btn-primary btn-lg btn-block" to="/login">{t(locale, "verifyEmail.signIn")}</Link>}
          {state === "invalid" && <Link className="btn btn-secondary btn-lg btn-block" to="/verify-email-pending">{t(locale, "verifyEmail.register")}</Link>}
          {state === "temporary" && <button className="btn btn-primary btn-lg btn-block" type="button" onClick={verify}>{t(locale, "verifyEmail.retry")}</button>}
        </div>
      </section>
    </div>
  );
}
