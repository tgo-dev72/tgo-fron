import React from "react";
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import phoneFlags from "react-phone-number-input/flags";
import phoneLabelsAr from "react-phone-number-input/locale/ar";
import phoneLabelsEn from "react-phone-number-input/locale/en";
import phoneLabelsFr from "react-phone-number-input/locale/fr";
import { ApiError, AuthProvider, useAuth } from "./auth/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider, useLocale } from "./i18n";
import Layout from "./Layout";
import { BrandLoader } from "./components/BrandLoader";
import { ContentLoader } from "./components/ContentLoader";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { IconMoon, IconPalette, IconShield, IconSun } from "./components/ShowroomIcons";
import { useTheme } from "./hooks/useTheme";
import { merchantPasswordRules, registrationFailureField, type RegistrationFailureField } from "./lib/registration";
import { merchantPasswordRecoveryUrl } from "./lib/appLinks";
import "./showroom.css";

const Landing = React.lazy(() => import("./pages/Landing"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const DesignDetail = React.lazy(() => import("./pages/DesignDetail"));
const ThemeStudio = React.lazy(() => import("./pages/ThemeStudio"));
const CreateStore = React.lazy(() => import("./pages/CreateStore"));
const Membership = React.lazy(() => import("./pages/Membership"));
const Gallery = React.lazy(() => import("./pages/Gallery"));
const Pricing = React.lazy(() => import("./pages/Pricing"));
const HowItWorks = React.lazy(() => import("./pages/HowItWorks"));
const Profile = React.lazy(() => import("./pages/Profile"));
const PlanDetail = React.lazy(() => import("./pages/PlanDetail"));
const Legal = React.lazy(() => import("./pages/Legal"));
const Unsubscribe = React.lazy(() => import("./pages/Unsubscribe"));

const PHONE_LABELS = { en: phoneLabelsEn, fr: phoneLabelsFr, ar: phoneLabelsAr };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function PasswordToggle({ visible, onToggle, disabled, controls }: { visible: boolean; onToggle: () => void; disabled: boolean; controls: string }) {
  const { t } = useLocale();
  return (
    <button type="button" className="sr-password-toggle" onClick={onToggle} aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")} aria-pressed={visible} aria-controls={controls} disabled={disabled}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.8" />
        {visible && <path d="M3 21 21 3" className="sr-password-eye-slash" />}
      </svg>
    </button>
  );
}

function Spinner({ text }: { text?: string }) {
  const message = text ?? "Opening showroom";
  return <BrandLoader label={message} text={message} />;
}

function AuthenticationBootstrap() {
  const { loading } = useAuth();
  if (!loading) return null;
  return (
    <main className="sr-auth-bootstrap" aria-busy="true">
      <BrandLoader label="Checking your session" />
    </main>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

function LoginPage() {
  const { login } = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      const remembered = window.sessionStorage.getItem("showroom-post-auth-return");
      window.sessionStorage.removeItem("showroom-post-auth-return");
      navigate(from || remembered || "/", { replace: true });
    } catch {
      setError(t("auth.err.invalid"));
      setSubmitting(false);
    }
  };

  return (
    <AuthForm
      mode="login"
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      onSubmit={handleSubmit}
      error={error}
      submitting={submitting}
      submitLabel={t("auth.login.submit")}
      footer={
        <div className="sr-auth-footer-stack">
          <span><a href={merchantPasswordRecoveryUrl()}>{t("auth.forgotPassword")}</a></span>
          <span>{t("auth.verify.help")} <Link to="/verify-email-pending" state={{ email }}>{t("auth.verify.helpLink")}</Link></span>
          <div className="sr-auth-signup-callout"><span>{t("auth.noAccount")}</span><Link to="/signup" className="sr-btn sr-btn-outline sr-btn-block">{t("auth.createAccount")} <span aria-hidden="true">→</span></Link></div>
        </div>
      }
    >
      <label className="sr-field">
        <span>{t("auth.email")}</span>
        <input type="email" inputMode="email" spellCheck={false} placeholder="you@example.com" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} required autoComplete="email" disabled={submitting} />
      </label>
      <div className="sr-field">
        <label htmlFor="login-password">{t("auth.password")}</label>
        <span className="sr-password-control"><input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} required autoComplete="current-password" disabled={submitting} /><PasswordToggle visible={showPassword} onToggle={() => setShowPassword((current) => !current)} disabled={submitting} controls="login-password" /></span>
      </div>
    </AuthForm>
  );
}

function SignupPage() {
  const { signup } = useAuth();
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  React.useEffect(() => {
    const requestedDesign = new URLSearchParams(location.search).get("design");
    if (requestedDesign && /^[a-z0-9-]{1,50}$/.test(requestedDesign)) {
      localStorage.setItem("showroom-pending-design", requestedDesign);
      sessionStorage.setItem("showroom-post-auth-return", `/create?design=${encodeURIComponent(requestedDesign)}`);
    }
  }, [location.search]);
  const [form, setForm] = React.useState({
    firstName: "", lastName: "", phoneNumber: "",
    email: "", confirmEmail: "", password: "", confirmPassword: "",
    preferredLanguage: locale, termsAccepted: false,
  });
  const [error, setError] = React.useState("");
  const [serverErrorField, setServerErrorField] = React.useState<RegistrationFailureField | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [mobileStep, setMobileStep] = React.useState<"details" | "security">("details");
  const emailValid = EMAIL_PATTERN.test(form.email.trim());
  const emailsMatch = emailValid && form.email.trim().toLowerCase() === form.confirmEmail.trim().toLowerCase();
  const phoneValid = Boolean(form.phoneNumber && isValidPhoneNumber(form.phoneNumber));
  const passwordRules = merchantPasswordRules({
    password: form.password,
    email: form.email,
    firstName: form.firstName,
    lastName: form.lastName,
  });
  const passwordValid = Object.values(passwordRules).every(Boolean);
  const passwordsMatch = form.password.length > 0 && form.confirmPassword === form.password;
  const registrationValid = Boolean(
    form.firstName.trim()
    && form.lastName.trim()
    && emailValid
    && emailsMatch
    && phoneValid
    && passwordValid
    && passwordsMatch
    && form.termsAccepted
  );

  const updateForm = (patch: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError("");
    setServerErrorField(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setServerErrorField(null);
    if (!registrationValid) {
      setAttempted(true);
      setError(t("auth.err.reviewFields"));
      const firstInvalid = !form.firstName.trim() ? "signup-first-name"
        : !form.lastName.trim() ? "signup-last-name"
        : !phoneValid ? "signup-phone"
        : !emailValid ? "signup-email"
        : !emailsMatch ? "signup-confirm-email"
        : !passwordValid ? "signup-password"
        : !passwordsMatch ? "signup-confirm-password"
        : "signup-terms";
      if (["signup-first-name", "signup-last-name", "signup-phone"].includes(firstInvalid)) setMobileStep("details");
      window.requestAnimationFrame(() => document.getElementById(firstInvalid)?.focus());
      return;
    }
    const email = form.email.trim().toLowerCase();
    const confirmEmail = form.confirmEmail.trim().toLowerCase();
    setSubmitting(true);
    try {
      await signup({
        email, confirmEmail, password: form.password, confirmPassword: form.confirmPassword,
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        preferredLanguage: form.preferredLanguage, termsAccepted: form.termsAccepted,
      });
      navigate("/verify-email-pending", { replace: true, state: { email } });
    } catch (requestError) {
      const field = requestError instanceof ApiError
        ? registrationFailureField(requestError.payload)
        : "general";
      setServerErrorField(field);
      setError(t(
        field === "password"
          ? "auth.err.passwordRejected"
          : field === "email"
            ? "auth.err.emailRejected"
            : field === "phone"
              ? "auth.err.phoneRejected"
              : "auth.err.signupRejected",
      ));
      setSubmitting(false);
    }
  };

  const continueToSecurity = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !phoneValid) {
      setAttempted(true);
      setError(t("auth.err.reviewFields"));
      const firstInvalid = !form.firstName.trim() ? "signup-first-name" : !form.lastName.trim() ? "signup-last-name" : "signup-phone";
      window.requestAnimationFrame(() => document.getElementById(firstInvalid)?.focus());
      return;
    }
    setError("");
    setMobileStep("security");
  };

  return (
    <AuthForm
      mode="signup"
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      onSubmit={handleSubmit}
      error={error}
      submitting={submitting}
      submitLabel={t("auth.signup.submit")}
      busyLabel={t("auth.creating")}
      formClassName={`sr-signup-form-step-${mobileStep}`}
      footer={<>{t("auth.haveAccount")} <Link to="/login">{t("auth.signInLink")}</Link></>}
    >
      <div className="sr-signup-progress" role="status">{mobileStep === "details" ? t("auth.stepDetails") : t("auth.stepSecurity")}</div>
      <div className={`sr-signup-fields sr-signup-step-${mobileStep}`}>
      <div className="sr-signup-column sr-signup-details">
      <div className="sr-auth-grid sr-auth-name-grid">
        <label className="sr-field">
          <span>{t("auth.firstName")}</span>
          <input id="signup-first-name" type="text" value={form.firstName} onChange={(e) => updateForm({ firstName: e.target.value })} required autoComplete="given-name" disabled={submitting} aria-invalid={attempted && !form.firstName.trim()} className={attempted && !form.firstName.trim() ? "validation-invalid" : ""} />
          {attempted && !form.firstName.trim() && <small className="sr-field-error">{t("auth.err.required")}</small>}
        </label>
        <label className="sr-field">
          <span>{t("auth.lastName")}</span>
          <input id="signup-last-name" type="text" value={form.lastName} onChange={(e) => updateForm({ lastName: e.target.value })} required autoComplete="family-name" disabled={submitting} aria-invalid={attempted && !form.lastName.trim()} className={attempted && !form.lastName.trim() ? "validation-invalid" : ""} />
          {attempted && !form.lastName.trim() && <small className="sr-field-error">{t("auth.err.required")}</small>}
        </label>
      </div>
      <div className="sr-auth-grid sr-auth-contact-grid">
      <label className="sr-field">
        <span>{t("auth.phone")}</span>
        <PhoneInput
          className={`sr-phone-input${form.phoneNumber || attempted ? (phoneValid && serverErrorField !== "phone" ? " valid" : " invalid") : ""}`}
          dir="ltr"
          id="signup-phone"
          countrySelectProps={{ "aria-label": t("auth.country") }}
          defaultCountry="MA"
          labels={PHONE_LABELS[locale]}
          flags={phoneFlags}
          limitMaxLength
          required
          autoComplete="tel"
          disabled={submitting}
          value={form.phoneNumber || undefined}
          aria-invalid={(attempted || Boolean(form.phoneNumber)) && !phoneValid}
          onChange={(value) => updateForm({ phoneNumber: value ?? "" })}
        />
        <small className={form.phoneNumber || attempted ? (phoneValid && serverErrorField !== "phone" ? "sr-field-success" : "sr-field-error") : ""} aria-live="polite">
          {form.phoneNumber || attempted ? (phoneValid && serverErrorField !== "phone" ? t("auth.valid.phone") : serverErrorField === "phone" ? t("auth.err.phoneRejected") : t("auth.err.phone")) : t("auth.phoneHint")}
        </small>
      </label>
      <label className="sr-field">
        <span>{t("auth.preferredLanguage")}</span>
        <select
          value={form.preferredLanguage}
          onChange={(event) => updateForm({ preferredLanguage: event.target.value as "en" | "fr" | "ar" })}
          disabled={submitting}
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
        </select>
        <small>{t("auth.preferredLanguageHint")}</small>
      </label>
      </div>
      <button type="button" className="sr-btn sr-btn-primary sr-btn-block sr-signup-next" onClick={continueToSecurity}>{t("auth.nextStep")} <span aria-hidden="true">→</span></button>
      </div>
      <div className="sr-signup-column sr-signup-security">
      <button type="button" className="sr-signup-back" onClick={() => { setError(""); setMobileStep("details"); }}>← {t("auth.previousStep")}</button>
      <div className="sr-auth-grid">
        <label className="sr-field">
          <span>{t("auth.email")}</span>
          <input id="signup-email" className={form.email || attempted ? (emailValid && serverErrorField !== "email" ? "validation-valid" : "validation-invalid") : ""} type="email" inputMode="email" spellCheck={false} placeholder="you@example.com" value={form.email} onChange={(e) => updateForm({ email: e.target.value })} required autoComplete="email" disabled={submitting} aria-invalid={form.email ? !emailValid || serverErrorField === "email" : undefined} />
          {(form.email || attempted) && <small className={emailValid && serverErrorField !== "email" ? "sr-field-success" : "sr-field-error"} aria-live="polite">{emailValid && serverErrorField !== "email" ? t("auth.valid.email") : serverErrorField === "email" ? t("auth.err.emailRejected") : t("auth.err.email")}</small>}
        </label>
        <label className="sr-field">
          <span>{t("auth.confirmEmail")}</span>
          <input id="signup-confirm-email" className={form.confirmEmail || attempted ? (emailsMatch ? "validation-valid" : "validation-invalid") : ""} type="email" inputMode="email" spellCheck={false} placeholder="you@example.com" value={form.confirmEmail} onChange={(e) => updateForm({ confirmEmail: e.target.value })} required autoComplete="off" disabled={submitting} aria-invalid={form.confirmEmail ? !emailsMatch : undefined} />
          {(form.confirmEmail || attempted) && <small className={emailsMatch ? "sr-field-success" : "sr-field-error"} aria-live="polite">{emailsMatch ? t("auth.valid.emailMatch") : t("auth.err.emailMatch")}</small>}
        </label>
      </div>
      <small className="sr-auth-password-hint">{t("auth.emailHint")}</small>
      <div className="sr-auth-grid sr-auth-password-grid">
        <div className="sr-field">
          <label htmlFor="signup-password">{t("auth.password")}</label>
          <span className="sr-password-control"><input id="signup-password" className={form.password || attempted ? (passwordValid && serverErrorField !== "password" ? "validation-valid" : "validation-invalid") : ""} type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => updateForm({ password: e.target.value })} required minLength={8} autoComplete="new-password" disabled={submitting} aria-invalid={(attempted || Boolean(form.password)) && (!passwordValid || serverErrorField === "password")} /><PasswordToggle visible={showPassword} onToggle={() => setShowPassword((current) => !current)} disabled={submitting} controls="signup-password" /></span>
          {serverErrorField === "password" && <small className="sr-field-error" role="alert">{t("auth.err.passwordRejected")}</small>}
        </div>
        <label className="sr-field">
          <span>{t("auth.confirmPassword")}</span>
          <input id="signup-confirm-password" className={form.confirmPassword || attempted ? (passwordsMatch ? "validation-valid" : "validation-invalid") : ""} type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => updateForm({ confirmPassword: e.target.value })} required minLength={8} autoComplete="new-password" disabled={submitting} aria-invalid={(attempted || Boolean(form.confirmPassword)) && !passwordsMatch} />
          {(form.confirmPassword || attempted) && <small className={passwordsMatch ? "sr-field-success" : "sr-field-error"} aria-live="polite">{passwordsMatch ? t("auth.valid.passwordMatch") : t("auth.err.passwordMatch")}</small>}
        </label>
      </div>
      <div className="sr-password-rules" aria-live="polite">
        <span className={form.password ? (passwordRules.length ? "valid" : "invalid") : ""}>{t("auth.passwordRule.length")}</span>
        <span className={form.password ? (passwordRules.letter ? "valid" : "invalid") : ""}>{t("auth.passwordRule.letter")}</span>
        <span className={form.password ? (passwordRules.number ? "valid" : "invalid") : ""}>{t("auth.passwordRule.number")}</span>
        <span className={form.password ? (passwordRules.uncommon ? "valid" : "invalid") : ""}>{t("auth.passwordRule.uncommon")}</span>
        <span className={form.password ? (passwordRules.personal ? "valid" : "invalid") : ""}>{t("auth.passwordRule.personal")}</span>
      </div>
      </div>
      </div>
      <label className="sr-terms-field">
        <input id="signup-terms" type="checkbox" aria-invalid={attempted && !form.termsAccepted} checked={form.termsAccepted} onChange={(e) => updateForm({ termsAccepted: e.target.checked })} required disabled={submitting} />
        <span>{t("auth.terms")} <Link to="/terms" onClick={(event) => event.stopPropagation()}>{t("layout.terms")}</Link> · <Link to="/privacy" onClick={(event) => event.stopPropagation()}>{t("layout.privacy")}</Link></span>
      </label>
      {attempted && !form.termsAccepted && <small className="sr-field-error">{t("auth.err.acceptTerms")}</small>}
    </AuthForm>
  );
}

function VerificationPendingPage() {
  const { resendVerification } = useAuth();
  const { t } = useLocale();
  const location = useLocation();
  const initialEmail = (location.state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = React.useState(initialEmail);
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      await resendVerification(email.trim().toLowerCase());
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <AuthShell mode="signup">
      <div className="sr-auth-card sr-verification-card">
        <div className="sr-verification-mark" aria-hidden="true">@</div>
        <div className="sr-auth-header">
          <h1>{t("auth.verify.helpTitle")}</h1>
          <p>{t("auth.verify.helpSubtitle")}</p>
        </div>
        <p className="sr-verification-copy">{t("auth.verify.helpInstructions")}</p>
        {status === "sent" && <div className="sr-auth-success" role="status">{t("auth.verify.helpSent")}</div>}
        {status === "error" && <div className="sr-auth-error" role="alert">{t("auth.verify.helpFailed")}</div>}
        <form className="sr-auth-form" data-verification-resend onSubmit={handleResend}>
          <label className="sr-field">
            <span>{t("auth.email")}</span>
            <input
              type="email"
              inputMode="email"
              spellCheck={false}
              value={email}
              onChange={(event) => { setEmail(event.target.value); setStatus("idle"); }}
              required
              autoComplete="email"
              disabled={status === "sending"}
            />
          </label>
          <button type="submit" className="sr-btn sr-btn-primary sr-btn-block" disabled={status === "sending"}>
            {status === "sending" ? <><span className="sr-btn-spinner" /> {t("auth.verify.sending")}...</> : t("auth.verify.resend")}
          </button>
        </form>
        <div className="sr-auth-footer"><Link to="/login">{t("auth.verify.back")}</Link></div>
      </div>
    </AuthShell>
  );
}

function AuthForm({
  mode, title, subtitle, onSubmit, error, submitting, submitDisabled = false, submitLabel, busyLabel, footer, children, formClassName = "",
}: {
  mode: "login" | "signup"; title: string; subtitle: string; onSubmit: (e: React.FormEvent) => void; error: string; submitting: boolean; submitDisabled?: boolean; submitLabel: string; busyLabel?: string; footer: React.ReactNode; children: React.ReactNode; formClassName?: string;
}) {
  const { t } = useLocale();
  return (
    <AuthShell mode={mode}>
      <div className={`sr-auth-card sr-auth-card-${mode}${submitting ? " sr-auth-processing" : ""}`} aria-busy={submitting}>
        <span className="sr-auth-icon" aria-hidden="true">{mode === "signup" ? <IconPalette /> : <IconShield />}</span>
        <div className="sr-auth-header">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {error && <div className="sr-auth-error" role="alert">{error}</div>}
        <form onSubmit={onSubmit} className={`sr-auth-form ${formClassName}`} noValidate={mode === "signup"}>
          {children}
          <button type="submit" className={`sr-btn sr-btn-primary sr-btn-block${submitting ? " is-processing" : ""}`} disabled={submitting || submitDisabled}>
            <span className="sr-auth-submit-content" aria-live="polite">{submitting ? <><span className="sr-btn-spinner" aria-hidden="true" /> {busyLabel ?? t("auth.logging")}</> : submitLabel}</span>
          </button>
        </form>
        <div className="sr-auth-footer">{footer}</div>
      </div>
    </AuthShell>
  );
}

function AuthShell({ mode, children }: { mode: "login" | "signup"; children: React.ReactNode }) {
  const { t, locale } = useLocale();
  const { theme, toggle } = useTheme();
  return (
    <div className={`sr-auth-page sr-auth-page-${mode}`} dir={locale === "ar" ? "rtl" : "ltr"}>
      <div className="sr-auth-atmosphere" aria-hidden="true">
        <span className="sr-auth-orb sr-auth-orb-one" />
        <span className="sr-auth-orb sr-auth-orb-two" />
      </div>
      <section className="sr-auth-story">
        <Link to="/" className="sr-auth-brand" aria-label="TijaraGO">
          <img src="/brand/logos/tyjara-go-white.svg" alt="" className="sr-auth-brand-logo" />
          <span><strong>TijaraGO</strong><small>{t("layout.collection")}</small></span>
        </Link>
        <div className="sr-auth-story-copy">
          <span className="sr-auth-eyebrow">{t(`auth.story.${mode}.eyebrow`)}</span>
          <h1>{t(`auth.story.${mode}.headline1`)}<br />{t(`auth.story.${mode}.headline2`)}</h1>
          <p>{t(`auth.story.${mode}.body`)}</p>
        </div>
        <div className="sr-auth-principles">
          <span><IconShield /> {t("hero.trust.secure")}</span>
          <span><IconPalette /> {t("hero.trust.guidance")}</span>
        </div>
      </section>
      <section className={`sr-auth-form-wrap sr-auth-form-wrap-${mode}`}>
        <div className="sr-auth-tools">
          <button
            type="button"
            className="sr-theme-toggle"
            onClick={toggle}
            aria-label={theme === "light" ? t("layout.theme.dark") : t("layout.theme.light")}
            title={theme === "light" ? t("layout.theme.dark") : t("layout.theme.light")}
          >
            {theme === "light" ? <IconMoon /> : <IconSun />}
          </button>
          <LanguageSwitcher />
        </div>
        {children}
      </section>
    </div>
  );
}

export default function AppRoutes() {
  const location = useLocation();
  return (
    <I18nProvider>
      <AuthProvider>
        <AuthGate location={location} />
      </AuthProvider>
    </I18nProvider>
  );
}

function AuthGate({ location }: { location: ReturnType<typeof useLocation> }) {
  const { loading } = useAuth();
  if (loading) return <AuthenticationBootstrap />;
  return (
    <>
      <ErrorBoundary>
        <React.Suspense fallback={<ContentLoader label="Loading page" />}>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Landing />} />
                <Route path="gallery" element={<Gallery />} />
                <Route path="pricing" element={<Pricing />} />
                <Route path="how-it-works" element={<HowItWorks />} />
                <Route path="pricing/:slug" element={<PlanDetail />} />
                <Route path="plans" element={<Navigate to="/pricing" replace />} />
                <Route path="login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
                <Route path="signup" element={<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>} />
                <Route path="verify-email-pending" element={<PublicOnlyRoute><VerificationPendingPage /></PublicOnlyRoute>} />
                <Route path="design/:key" element={<DesignDetail />} />
                <Route path="create" element={<ProtectedRoute><CreateStore /></ProtectedRoute>} />
                <Route path="launch/pending/:storeSlug" element={<ProtectedRoute><CreateStore /></ProtectedRoute>} />
                <Route path="launch/:requestId" element={<ProtectedRoute><CreateStore /></ProtectedRoute>} />
                <Route path="membership" element={<ProtectedRoute><Membership /></ProtectedRoute>} />
                <Route path="subscription" element={<ProtectedRoute><Membership /></ProtectedRoute>} />
                <Route path="dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="terms" element={<Legal document="terms" />} />
                <Route path="privacy" element={<Legal document="privacy" />} />
                <Route path="unsubscribe/:code" element={<Unsubscribe />} />
              </Route>
              <Route path="/design/:key/preview" element={<ThemeStudio />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </React.Suspense>
      </ErrorBoundary>
    </>
  );
}
