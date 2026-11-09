import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiLock, FiShield, FiTrendingUp } from "react-icons/fi";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LangSwitcher } from "../components/LangSwitcher";
import { ThemeToggle } from "../components/ThemeToggle";
import { t, useLocale } from "../i18n";

export function PasswordRecoveryPage() {
  const locale = useLocale();
  const location = useLocation();
  const { user, logout } = useAuth();
  const resetting = location.pathname === "/reset-password";
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? new URLSearchParams(window.location.search).get("token") ?? "");
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (resetting && token) window.history.replaceState(window.history.state, "", "/reset-password");
  }, [resetting, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (resetting) {
      if (password.length < 8 || !/\p{L}/u.test(password) || !/\d/.test(password)) {
        setError(t(locale, "recovery.rules"));
        return;
      }
      if (password !== confirmation) { setError(t(locale, "recovery.mismatch")); return; }
    }
    setBusy(true);
    try {
      if (resetting) {
        await api.confirmPasswordReset(token, password);
        if (user) { try { await logout(); } catch { /* Local session still clears. */ } }
        setPassword(""); setConfirmation(""); setDone(true);
      } else {
        await api.requestPasswordReset(email.trim().toLowerCase());
        setSent(true);
      }
    } catch (cause) {
      if (resetting) {
        if (cause instanceof ApiError && (cause.code === "password_invalid" || cause.payload?.password)) {
          setError(t(locale, "recovery.weak"));
        } else if (cause instanceof ApiError && cause.code === "reset_link_invalid") {
          setError(t(locale, "recovery.invalid"));
        } else {
          setError(t(locale, "recovery.error"));
        }
      } else setError(t(locale, "recovery.error"));
    } finally { setBusy(false); }
  }

  return <div className="login-bg">
    <div className="login-atmosphere" aria-hidden="true"><span className="login-orb login-orb-one" /><span className="login-orb login-orb-two" /></div>
    <section className="login-story">
      <div className="login-brand-lockup"><img src="/brand/logos/tyjara-go-green-lime.svg" alt="TijaraGO" className="login-brand-logo" /><div><strong>TijaraGO</strong><small>{t(locale, "nav.brandSub")}</small></div></div>
      <div className="login-story-copy"><span className="login-eyebrow">{t(locale, "login.eyebrow")}</span><h1>{t(locale, "recovery.requestTitle")}</h1><p>{t(locale, "recovery.requestBody")}</p></div>
      <div className="login-principles"><span><FiShield /> {t(locale, "login.secure")}</span><span><FiTrendingUp /> {t(locale, "login.growth")}</span></div>
    </section>
    <section className="login-form-wrap">
      <div className="login-language"><ThemeToggle /><LangSwitcher compact /></div>
      <form className="login-card" onSubmit={submit} aria-busy={busy}>
        <span className="login-icon"><FiLock /></span>
        <h2>{t(locale, resetting ? "recovery.resetTitle" : "recovery.requestTitle")}</h2>
        {!resetting && <p className="sub">{t(locale, "recovery.requestBody")}</p>}
        {sent && <div className="login-success" role="status">{t(locale, "recovery.sent")}</div>}
        {done && <div className="login-success" role="status">{t(locale, "recovery.success")}</div>}
        {(error || (resetting && !token)) && <div className="login-error" role="alert">{error || t(locale, "recovery.invalid")}</div>}
        {!done && (!resetting || token) && <>
          {!resetting ? <div className="field" style={{ marginBottom: 18 }}>
            <label className="field-label" htmlFor="recovery-email">{t(locale, "login.email")}</label>
            <input id="recovery-email" className="input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
          </div> : <>
            <div className="field" style={{ marginBottom: 14 }}>
              <label className="field-label" htmlFor="recovery-password">{t(locale, "recovery.newPassword")}</label>
              <input id="recovery-password" className="input" type={visible ? "text" : "password"} autoComplete="new-password" required value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} disabled={busy} aria-invalid={Boolean(error)} />
              <p className="field-hint">{t(locale, "recovery.rules")}</p>
            </div>
            <div className="field" style={{ marginBottom: 18 }}>
              <label className="field-label" htmlFor="recovery-confirm">{t(locale, "recovery.confirmPassword")}</label>
              <input id="recovery-confirm" className="input" type={visible ? "text" : "password"} autoComplete="new-password" required value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} disabled={busy} aria-invalid={Boolean(error)} />
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => setVisible(!visible)} aria-label={t(locale, visible ? "recovery.hide" : "recovery.show")}>{t(locale, visible ? "recovery.hide" : "recovery.show")}</button>
          </>}
          <button className="btn btn-primary btn-lg btn-block login-submit" type="submit" disabled={busy}>{busy ? <span className="spin" /> : t(locale, resetting ? "recovery.reset" : "recovery.send")}</button>
        </>}
        {resetting && !done && <p className="auth-switch"><Link to="/forgot-password">{t(locale, "recovery.again")}</Link></p>}
        <p className="auth-switch"><Link to="/login">{t(locale, "recovery.back")}</Link></p>
      </form>
    </section>
  </div>;
}
