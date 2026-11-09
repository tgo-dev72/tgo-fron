import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import type { Value as PhoneValue } from "react-phone-number-input";
import phoneLabelsAr from "react-phone-number-input/locale/ar";
import phoneLabelsEn from "react-phone-number-input/locale/en";
import phoneLabelsFr from "react-phone-number-input/locale/fr";
import "react-phone-number-input/style.css";
import { ApiError, customerAuth } from "../api/client";
import { trackStorefrontEvent } from "../api/analytics";
import type { Customer, CustomerOrder } from "../api/client";
import { formatPrice, localeTag, t, useLocale } from "../i18n";
import { authErrorHint, useAuth } from "./auth";
import { accountParameters, returnAfterAuthentication } from "./accountNavigation";
import { useStoreConfig } from "./context";
import type { AuthContextValue } from "./auth";
import { OptimizedImage } from "../media/image";

type Mode = "signin" | "register" | "recover";
type AccountTab = "overview" | "orders" | "profile";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return <label className={`sf-co-field ${error ? "is-error" : ""}`}><span className="sf-co-field-label">{label}</span>{children}{(error || hint) && <span className={`sf-account-field-note ${error ? "is-error" : ""}`}>{error || hint}</span>}</label>;
}

function tokenFromLocation(): string {
  if (typeof window === "undefined") return "";
  return accountParameters().get("verify") ?? "";
}

function VerificationCard({ email, verifyEmail, resendVerification, onBack }: { email: string; verifyEmail: AuthContextValue["verifyEmail"]; resendVerification: AuthContextValue["resendVerification"]; onBack: () => void }) {
  const locale = useLocale();
  const token = useMemo(tokenFromLocation, []);
  const started = useRef(false);
  const [resendEmail, setResendEmail] = useState(email);
  const [state, setState] = useState<"waiting" | "checking" | "unavailable">(token ? "checking" : "waiting");
  const [resent, setResent] = useState(false);
  const [resendFailed, setResendFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(() => {
        const params = accountParameters(); params.delete("verify");
        window.history.replaceState(null, "", `/account${params.size ? `?${params}` : ""}`);
        trackStorefrontEvent({ eventType: "registration_completed" });
        returnAfterAuthentication();
      })
      .catch(() => setState("unavailable"));
  }, [token, verifyEmail]);
  const resend = async () => {
    if (!emailPattern.test(resendEmail)) return;
    setBusy(true);
    setResendFailed(false);
    try { await resendVerification(resendEmail); setResent(true); setState("waiting"); } catch { setResendFailed(true); } finally { setBusy(false); }
  };
  return <div className="sf-account-form sf-verification-card" aria-live="polite">
    <span className="sf-account-kicker">{t(locale, "auth.secureAccount")}</span>
    <h1 className="ds-display-3">{state === "checking" ? t(locale, "auth.verifyingTitle") : state === "unavailable" ? t(locale, "auth.linkUnavailable") : t(locale, "auth.checkEmailTitle")}</h1>
    <p className="ds-body">{state === "checking" ? t(locale, "auth.verifyingBody") : state === "unavailable" ? t(locale, "auth.linkUnavailableBody") : t(locale, "auth.checkEmailBody", email || resendEmail)}</p>
    {state !== "checking" && <div className="sf-account-card">
      <Field label={t(locale, "auth.email")}><input type="email" autoComplete="email" value={resendEmail} onChange={(event) => { setResendEmail(event.target.value); setResent(false); }} /></Field>
      {resent && <p className="sf-co-success" role="status">{t(locale, "auth.resendDone")}</p>}
      {resendFailed && <p className="sf-co-error" role="alert">{t(locale, "auth.errorGeneric")}</p>}
      <button type="button" className="ds-btn ds-btn-primary" disabled={busy || !emailPattern.test(resendEmail)} onClick={() => void resend()}>{busy ? t(locale, "auth.processing") : t(locale, "auth.resendEmail")}</button>
      <button type="button" className="sf-account-text-button" onClick={onBack}>{t(locale, "auth.backToSignIn")}</button>
    </div>}
  </div>;
}

const authCopy = {
  en: { recoverTitle: "Reset your password", recoverBody: "We’ll send a secure link if this email belongs to an account.", recoverSend: "Send reset link", recoverDone: "If an eligible account exists, check your email for a reset link.", newPassword: "New password", resetCta: "Save new password", resetDone: "Your password is updated. You can sign in now.", resetInvalid: "This recovery link is unavailable or has expired.", resetWeak: "Choose a less common password that differs from your account details.", confirmPassword: "Confirm password", mismatch: "Passwords do not match.", requestNew: "Request a new link", passwordToggleShow: "Show password", passwordToggleHide: "Hide password", requiredPhone: "Required for order contact; no address is needed to create your account.", asideTitle: "Your space, ready when you are.", asideBody: "Follow orders and keep your details ready for your next visit.", forgot: "Forgot password?", back: "Back to sign in" },
  fr: { recoverTitle: "Réinitialiser votre mot de passe", recoverBody: "Nous enverrons un lien sécurisé si un compte utilise cette adresse.", recoverSend: "Envoyer le lien", recoverDone: "Si un compte éligible existe, consultez votre e-mail.", newPassword: "Nouveau mot de passe", resetCta: "Enregistrer le mot de passe", resetDone: "Votre mot de passe est modifié. Vous pouvez vous connecter.", resetInvalid: "Ce lien est indisponible ou expiré.", resetWeak: "Choisissez un mot de passe moins courant et différent de vos informations personnelles.", confirmPassword: "Confirmer le mot de passe", mismatch: "Les mots de passe ne correspondent pas.", requestNew: "Demander un nouveau lien", passwordToggleShow: "Afficher le mot de passe", passwordToggleHide: "Masquer le mot de passe", requiredPhone: "Nécessaire pour vous contacter au sujet d’une commande. Aucune adresse n’est demandée ici.", asideTitle: "Votre espace, quand vous en avez besoin.", asideBody: "Suivez vos commandes et retrouvez vos informations lors de votre prochaine visite.", forgot: "Mot de passe oublié ?", back: "Retour à la connexion" },
  ar: { recoverTitle: "إعادة تعيين كلمة المرور", recoverBody: "سنرسل رابطًا آمنًا إذا كان هناك حساب بهذا البريد.", recoverSend: "إرسال رابط الاستعادة", recoverDone: "إذا كان هناك حساب مؤهل، تحقق من بريدك الإلكتروني.", newPassword: "كلمة المرور الجديدة", resetCta: "حفظ كلمة المرور", resetDone: "تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.", resetInvalid: "هذا الرابط غير متاح أو انتهت صلاحيته.", resetWeak: "اختر كلمة مرور أقل شيوعًا ومختلفة عن معلومات حسابك.", confirmPassword: "تأكيد كلمة المرور", mismatch: "كلمتا المرور غير متطابقتين.", requestNew: "اطلب رابطًا جديدًا", passwordToggleShow: "إظهار كلمة المرور", passwordToggleHide: "إخفاء كلمة المرور", requiredPhone: "مطلوب للتواصل بشأن الطلبات. لا تحتاج إلى إدخال العنوان الآن.", asideTitle: "مساحتك جاهزة عند الحاجة.", asideBody: "تابع طلباتك واحتفظ ببياناتك لزيارتك القادمة.", forgot: "هل نسيت كلمة المرور؟", back: "العودة لتسجيل الدخول" },
};

function ResetPasswordCard({ token, onDone }: { token: string; onDone: () => void }) {
  const locale = useLocale();
  const { user, logout } = useAuth();
  const copy = authCopy[locale];
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError(copy.mismatch); return; }
    if (password.length < 8 || !/\p{L}/u.test(password) || !/\d/.test(password)) { setError(t(locale, "auth.passwordRules")); return; }
    setBusy(true);
    try { await customerAuth.confirmPasswordReset(token, password); if (user) await logout(); setDone(true); setPassword(""); setConfirmation(""); }
    catch (cause) {
      if (cause instanceof ApiError && (cause.code === "password_invalid" || cause.fields.password)) setError(copy.resetWeak);
      else if (cause instanceof ApiError && cause.code === "reset_link_invalid") setError(copy.resetInvalid);
      else setError(t(locale, "auth.errorGeneric"));
    }
    finally { setBusy(false); }
  };
  if (!token) return <div className="sf-account-form sf-auth-reset"><div className="sf-account-card"><p role="alert">{copy.resetInvalid}</p><a className="ds-btn ds-btn-primary" href="/account?mode=recover">{copy.requestNew}</a></div></div>;
  return <div className="sf-account-form sf-auth-reset"><div className="sf-account-auth-intro"><span className="sf-account-kicker">{t(locale, "auth.secureAccount")}</span><h1 className="ds-display-3">{copy.recoverTitle}</h1></div>
    {done ? <div className="sf-account-card"><p role="status">{copy.resetDone}</p><button type="button" className="ds-btn ds-btn-primary" onClick={onDone}>{t(locale, "auth.signIn")}</button></div>
      : <form className="sf-account-card" onSubmit={submit} noValidate><Field label={copy.newPassword} hint={t(locale, "auth.passwordRules")} error={error}><div className="sf-password-control"><input type={visible ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} /><button type="button" aria-label={visible ? copy.passwordToggleHide : copy.passwordToggleShow} onClick={() => setVisible(!visible)}>{visible ? copy.passwordToggleHide : copy.passwordToggleShow}</button></div></Field><Field label={copy.confirmPassword}><input type={visible ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} /></Field><button className="ds-btn ds-btn-primary sf-account-submit" disabled={busy}>{busy ? t(locale, "auth.processing") : copy.resetCta}</button>{error === copy.resetInvalid && <a className="sf-account-text-button" href="/account?mode=recover">{copy.requestNew}</a>}</form>}
  </div>;
}

function AuthForm({ login, register, verifyEmail, resendVerification, initialMode = "signin" }: { login: AuthContextValue["login"]; register: AuthContextValue["register"]; verifyEmail: AuthContextValue["verifyEmail"]; resendVerification: AuthContextValue["resendVerification"]; initialMode?: Mode }) {
  const locale = useLocale();
  const config = useStoreConfig();
  const copy = authCopy[locale];
  const [mode, setMode] = useState<Mode>(initialMode);
  useEffect(() => { if (mode === "signin" || mode === "register") trackStorefrontEvent({ eventType: mode === "signin" ? "login_viewed" : "registration_viewed" }); }, [mode]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<PhoneValue>();
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [recoverySent, setRecoverySent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(tokenFromLocation() ? "" : null);
  const [busy, setBusy] = useState(false);
  const phoneLabels = locale === "ar" ? phoneLabelsAr : locale === "fr" ? phoneLabelsFr : phoneLabelsEn;
  const resetToken = accountParameters().get("reset");
  const fieldErrors = {
    firstName: firstName.trim().length < 2 ? t(locale, "auth.nameShort") : "",
    lastName: lastName.trim().length < 2 ? t(locale, "auth.nameShort") : "",
    email: !emailPattern.test(email) ? t(locale, "auth.invalidEmail") : "",
    phone: !phone || !isValidPhoneNumber(phone) ? t(locale, "auth.invalidPhone") : "",
    password: mode === "register" ? password.length < 8 || !/\p{L}/u.test(password) || !/\d/.test(password) ? t(locale, "auth.passwordRules") : "" : !password ? t(locale, "auth.required") : "",
  };
  const touch = (name: string) => setTouched((current) => ({ ...current, [name]: true }));
  const switchMode = (next: Mode) => { setMode(next); setError(null); setTouched({}); setRecoverySent(false); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(null);
    const required = mode === "register" ? ["firstName", "lastName", "email", "phone", "password"] : ["email", "password"];
    setTouched(Object.fromEntries(required.map((field) => [field, true])));
    if (required.some((field) => fieldErrors[field as keyof typeof fieldErrors])) return;
    setBusy(true);
    try {
      if (mode === "register") {
        const normalized = email.trim().toLowerCase();
        const result = await register({ firstName: firstName.trim(), lastName: lastName.trim(), email: normalized, confirmEmail: normalized, phone: phone ?? "", password, confirmPassword: password, preferredLanguage: locale });
        setPendingEmail(result.email);
      } else { trackStorefrontEvent({ eventType: "login_started" }); await login(email.trim().toLowerCase(), password); trackStorefrontEvent({ eventType: "login_completed" }); returnAfterAuthentication(); }
    } catch (err) {
      const hint = authErrorHint(err);
      if (mode === "signin") trackStorefrontEvent({ eventType: "login_failed" });
      if (hint === "verification") setPendingEmail(email.trim().toLowerCase());
      else setError(hint === "invalid" ? t(locale, "auth.errorInvalid") : t(locale, "auth.errorGeneric"));
    } finally { setBusy(false); }
  };
  const requestRecovery = async (event: FormEvent) => {
    event.preventDefault(); setTouched({ email: true }); setError(null);
    if (fieldErrors.email) return;
    setBusy(true);
    try { trackStorefrontEvent({ eventType: "password_reset_started" }); await customerAuth.requestPasswordReset(email.trim().toLowerCase()); setRecoverySent(true); }
    catch { setError(t(locale, "auth.errorGeneric")); }
    finally { setBusy(false); }
  };
  if (accountParameters().has("reset")) return <ResetPasswordCard token={resetToken ?? ""} onDone={() => {
    const params = accountParameters(); params.delete("reset");
    window.location.assign(`/account${params.size ? `?${params}` : ""}`);
    switchMode("signin");
  }} />;
  if (pendingEmail !== null) return <VerificationCard email={pendingEmail} verifyEmail={verifyEmail} resendVerification={resendVerification} onBack={() => { setPendingEmail(null); switchMode("signin"); }} />;
  return <div className="sf-account-form sf-auth-experience">
    <div className="sf-account-auth-intro"><span className="sf-account-kicker">{config.storeName} · {t(locale, "auth.customerSpace")}</span><h1 className="ds-display-3">{mode === "signin" ? t(locale, "auth.signInTitle") : mode === "register" ? t(locale, "auth.registerTitle") : copy.recoverTitle}</h1><p className="ds-body">{mode === "signin" ? t(locale, "auth.signInBody") : mode === "register" ? t(locale, "auth.registerBody") : copy.recoverBody}</p></div>
    {mode !== "recover" && <div className="sf-account-tabs" role="group" aria-label={t(locale, "auth.customerSpace")}><button type="button" aria-pressed={mode === "signin"} className={mode === "signin" ? "is-active" : ""} onClick={() => switchMode("signin")}>{t(locale, "auth.signIn")}</button><button type="button" aria-pressed={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => switchMode("register")}>{t(locale, "auth.createAccount")}</button></div>}
    {mode === "recover" ? <form className="sf-account-card" onSubmit={requestRecovery} noValidate><Field label={t(locale, "auth.email")} error={touched.email ? fieldErrors.email : ""}><input type="email" name="email" autoComplete="email" inputMode="email" value={email} onBlur={() => touch("email")} onChange={(event) => setEmail(event.target.value)} /></Field>{recoverySent && <p className="sf-co-success" role="status">{copy.recoverDone}</p>}{error && <p className="sf-co-error" role="alert">{error}</p>}<button type="submit" className="ds-btn ds-btn-primary sf-account-submit" disabled={busy}>{busy ? t(locale, "auth.processing") : copy.recoverSend}</button><a className="sf-account-text-button" href="/account">{copy.back}</a></form>
      : <form className="sf-account-card" onSubmit={submit} noValidate>
      {mode === "register" && <div className="sf-co-grid"><Field label={t(locale, "auth.firstName")} error={touched.firstName ? fieldErrors.firstName : ""}><input type="text" name="given-name" autoComplete="given-name" value={firstName} onBlur={() => touch("firstName")} onChange={(event) => setFirstName(event.target.value)} /></Field><Field label={t(locale, "auth.lastName")} error={touched.lastName ? fieldErrors.lastName : ""}><input type="text" name="family-name" autoComplete="family-name" value={lastName} onBlur={() => touch("lastName")} onChange={(event) => setLastName(event.target.value)} /></Field></div>}
      <Field label={t(locale, "auth.email")} error={touched.email ? fieldErrors.email : ""}><input type="email" name="email" autoComplete="email" inputMode="email" value={email} onBlur={() => touch("email")} onChange={(event) => setEmail(event.target.value)} /></Field>
      {mode === "register" && <Field label={t(locale, "auth.phone")} error={touched.phone ? fieldErrors.phone : ""} hint={copy.requiredPhone}><PhoneInput international defaultCountry="MA" countryCallingCodeEditable={false} labels={phoneLabels} value={phone} onBlur={() => touch("phone")} onChange={setPhone} /></Field>}
      <Field label={t(locale, "auth.password")} error={touched.password ? fieldErrors.password : ""} hint={mode === "register" ? t(locale, "auth.passwordRules") : undefined}><div className="sf-password-control"><input type={passwordVisible ? "text" : "password"} name="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onBlur={() => touch("password")} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={passwordVisible ? copy.passwordToggleHide : copy.passwordToggleShow} onClick={() => setPasswordVisible(!passwordVisible)}>{passwordVisible ? copy.passwordToggleHide : copy.passwordToggleShow}</button></div></Field>
      {error && <p className="sf-co-error" role="alert">{error}</p>}
      <button type="submit" className="ds-btn ds-btn-primary sf-account-submit" disabled={busy}>{busy ? t(locale, "auth.processing") : mode === "signin" ? t(locale, "auth.signInCta") : t(locale, "auth.createCta")}</button>
      {mode === "signin" && <a className="sf-account-text-button" href="/account?mode=recover">{copy.forgot}</a>}
      <p className="sf-account-switch"><button type="button" onClick={() => switchMode(mode === "signin" ? "register" : "signin")}>{mode === "signin" ? t(locale, "auth.switchMode") : t(locale, "auth.switchModeBack")}</button></p>
      {mode === "signin" && <button type="button" className="sf-account-text-button" onClick={() => setPendingEmail(email)}>{t(locale, "auth.missedVerification")}</button>}
    </form>}
    <aside className="sf-auth-aside" aria-hidden="true"><div className="sf-auth-aside-brand">{config.logoUrl ? <OptimizedImage src={config.logoUrl} widthHint={360} widths={[180, 240, 360]} sizes="180px" alt="" priority /> : config.storeName}</div><div><span className="sf-account-kicker">{t(locale, "auth.customerSpace")}</span><h2>{copy.asideTitle}</h2><p>{copy.asideBody}</p></div></aside>
  </div>;
}

function OrderCard({ order }: { order: CustomerOrder }) {
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium" }).format(new Date(order.created_at));
  const downloadInvoice = async () => { if (!order.invoice) return; const blob = await customerAuth.invoice(order.order_id); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${order.invoice.number}.pdf`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <article className="sf-customer-order"><div className="sf-customer-order-head"><div><span>{t(locale, "auth.orderReference")}</span><strong>{order.order_id.slice(0, 8).toUpperCase()}</strong></div><span className={`sf-order-status is-${order.status}`}>{t(locale, `auth.orderStatus.${order.status}`)}</span></div><div className="sf-customer-order-meta"><span>{date}</span><strong>{formatPrice(Number(order.amount), locale, order.currency)}</strong></div>{order.exception && <p className="sf-co-adjustment-note">{t(locale, "checkout.quantityAdjusted")}</p>}<div className="sf-customer-order-items">{order.items.map((item) => <div key={item.id}><span>{item.name} × {item.fulfilled_quantity}</span><span>{formatPrice(Number(item.price) * item.fulfilled_quantity, locale, order.currency)}</span></div>)}</div>{Number(order.discount_amount) > 0 && <div className="sf-customer-order-discount"><span>{t(locale, "checkout.discount")}{order.coupon_code ? ` · ${order.coupon_code}` : ""}</span><strong>−{formatPrice(Number(order.discount_amount), locale, order.currency)}</strong></div>}{order.tracking_number && <p className="sf-customer-tracking">{t(locale, "auth.tracking", order.carrier || "—", order.tracking_number)}</p>}{order.invoice && <button type="button" className="ds-btn" onClick={() => void downloadInvoice()}>{locale === "fr" ? "Télécharger la facture" : locale === "ar" ? "تنزيل الفاتورة" : "Download invoice"}</button>}</article>;
}

function CustomerSpace({ user, logout, updateProfile, children }: { user: Customer; logout: () => Promise<void>; updateProfile: AuthContextValue["updateProfile"]; children?: ReactNode }) {
  const locale = useLocale();
  const [tab, setTab] = useState<AccountTab>(() => { const requested = accountParameters().get("tab"); return requested === "orders" || requested === "profile" ? requested : "overview"; });
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersState, setOrdersState] = useState<"loading" | "ready" | "error">("loading");
  const [profile, setProfile] = useState(user);
  const [phone, setPhone] = useState<PhoneValue | undefined>((user.phone || undefined) as PhoneValue | undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const phoneLabels = locale === "ar" ? phoneLabelsAr : locale === "fr" ? phoneLabelsFr : phoneLabelsEn;
  useEffect(() => { let current = true; customerAuth.orders().then((data) => { if (current) { setOrders(data); setOrdersState("ready"); } }).catch(() => { if (current) setOrdersState("error"); }); return () => { current = false; }; }, []);
  useEffect(() => { setProfile(user); setPhone((user.phone || undefined) as PhoneValue | undefined); }, [user]);
  const activeOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  const saveProfile = async (event: FormEvent) => { event.preventDefault(); if (phone && !isValidPhoneNumber(phone)) return; setSaving(true); setSaved(false); setProfileError(false); try { await updateProfile({ firstName: profile.firstName, lastName: profile.lastName, phone: phone ?? "", address: profile.address, city: profile.city, country: profile.country, preferredLanguage: locale }); setSaved(true); } catch { setProfileError(true); } finally { setSaving(false); } };
  return <div className="sf-account sf-account-authenticated">
    <header className="sf-account-head"><div><span className="sf-account-kicker">{t(locale, "auth.customerSpace")}</span><h1 className="ds-display-3">{t(locale, "auth.welcome", user.firstName)}</h1><p className="ds-body">{t(locale, "auth.signedInAs", user.email)}</p></div><button type="button" className="ds-btn" onClick={() => void logout()}>{t(locale, "auth.logout")}</button></header>
    <nav className="sf-customer-tabs" aria-label={t(locale, "auth.customerSpace")}>{(["overview", "orders", "profile"] as AccountTab[]).map((item) => <button type="button" key={item} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{t(locale, `auth.tabs.${item}`)}</button>)}</nav>
    {tab === "overview" && <section className="sf-customer-overview"><div className="sf-customer-stat"><span>{t(locale, "auth.totalOrders")}</span><strong>{ordersState === "ready" ? orders.length : "—"}</strong></div><div className="sf-customer-stat"><span>{t(locale, "auth.activeOrders")}</span><strong>{ordersState === "ready" ? activeOrders : "—"}</strong></div><div className="sf-customer-stat"><span>{t(locale, "auth.loyaltyPoints")}</span><strong>{user.loyaltyPoints}</strong></div><div className="sf-customer-welcome-card"><h2>{t(locale, "auth.overviewTitle")}</h2><p>{t(locale, "auth.overviewBody")}</p><button type="button" className="ds-btn ds-btn-primary" onClick={() => setTab("orders")}>{t(locale, "auth.viewOrders")}</button></div>{children}</section>}
    {tab === "orders" && <section className="sf-customer-section"><div className="sf-customer-section-head"><span className="sf-account-kicker">{t(locale, "auth.ordersEyebrow")}</span><h2 className="ds-display-3">{t(locale, "auth.ordersTitle")}</h2></div>{ordersState === "loading" && <div className="sf-account-skeleton"><span /><span /><span /></div>}{ordersState === "error" && <div className="sf-customer-empty"><strong>{t(locale, "auth.ordersUnavailable")}</strong></div>}{ordersState === "ready" && orders.length === 0 && <div className="sf-customer-empty"><strong>{t(locale, "auth.noOrders")}</strong><p>{t(locale, "auth.noOrdersBody")}</p><a className="ds-btn ds-btn-primary" href="/collections/all">{t(locale, "auth.continueShopping")}</a></div>}{ordersState === "ready" && orders.length > 0 && <div className="sf-customer-orders">{orders.map((order) => <OrderCard key={order.order_id} order={order} />)}</div>}</section>}
    {tab === "profile" && <section className="sf-customer-section"><div className="sf-customer-section-head"><span className="sf-account-kicker">{t(locale, "auth.profileEyebrow")}</span><h2 className="ds-display-3">{t(locale, "auth.profileTitle")}</h2><p>{t(locale, "auth.profileBody")}</p></div><form className="sf-customer-profile" onSubmit={saveProfile}><div className="sf-co-grid"><Field label={t(locale, "auth.firstName")}><input value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} /></Field><Field label={t(locale, "auth.lastName")}><input value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} /></Field></div><Field label={t(locale, "auth.email")} hint={t(locale, "auth.verifiedEmail")}><input value={profile.email} disabled /></Field><Field label={t(locale, "auth.phone")} error={phone && !isValidPhoneNumber(phone) ? t(locale, "auth.invalidPhone") : ""} hint={t(locale, "auth.phoneProfileHint")}><PhoneInput international defaultCountry="MA" countryCallingCodeEditable={false} labels={phoneLabels} value={phone} onChange={setPhone} /></Field><div className="sf-co-grid"><Field label={t(locale, "auth.city")}><input value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} /></Field><Field label={t(locale, "auth.country")}><input value={profile.country} onChange={(event) => setProfile({ ...profile, country: event.target.value })} /></Field></div><Field label={t(locale, "auth.address")}><textarea rows={3} value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} /></Field>{saved && <p className="sf-co-success" role="status">{t(locale, "auth.profileSaved")}</p>}{profileError && <p className="sf-co-error" role="alert">{t(locale, "auth.errorGeneric")}</p>}<button type="submit" className="ds-btn ds-btn-primary" disabled={saving || Boolean(phone && !isValidPhoneNumber(phone))}>{saving ? t(locale, "auth.processing") : t(locale, "auth.saveProfile")}</button></form></section>}
  </div>;
}

export function AccountPage({ children, initialMode = "signin" }: { children?: ReactNode; initialMode?: Mode }) {
  const locale = useLocale();
  const { user, status, login, register, verifyEmail, resendVerification, updateProfile, logout } = useAuth();
  if (status === "loading") return <div className="sf-account sf-account-loading" aria-label={t(locale, "auth.loadingAccount")}><div className="sf-account-skeleton"><span /><span /><span /></div></div>;
  if (accountParameters().has("reset")) return <AuthForm login={login} register={register} verifyEmail={verifyEmail} resendVerification={resendVerification} initialMode="signin" />;
  if (user) return <CustomerSpace user={user} logout={logout} updateProfile={updateProfile}>{children}</CustomerSpace>;
  return <AuthForm login={login} register={register} verifyEmail={verifyEmail} resendVerification={resendVerification} initialMode={accountParameters().get("mode") === "register" ? "register" : accountParameters().get("mode") === "recover" ? "recover" : initialMode} />;
}
