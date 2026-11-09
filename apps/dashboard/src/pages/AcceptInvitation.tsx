import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useLocale } from "../i18n";
import { friendlyError } from "../utils/errors";

const copy = {
  en: { title: "Join the store team", detail: "Accept your secure invitation and choose a password if this is your first TijaraGO account.", first: "First name", last: "Last name", password: "Password", accept: "Accept invitation", success: "Invitation accepted. You can now sign in to the merchant dashboard.", login: "Go to sign in", invalid: "The invitation link is missing." },
  fr: { title: "Rejoindre l’équipe", detail: "Acceptez votre invitation sécurisée et choisissez un mot de passe s’il s’agit de votre premier compte TijaraGO.", first: "Prénom", last: "Nom", password: "Mot de passe", accept: "Accepter l’invitation", success: "Invitation acceptée. Vous pouvez maintenant vous connecter.", login: "Se connecter", invalid: "Le lien d’invitation est absent." },
  ar: { title: "الانضمام إلى فريق المتجر", detail: "اقبل الدعوة الآمنة واختر كلمة مرور إذا كان هذا أول حساب لك في TijaraGO.", first: "الاسم الأول", last: "اسم العائلة", password: "كلمة المرور", accept: "قبول الدعوة", success: "تم قبول الدعوة. يمكنك الآن تسجيل الدخول.", login: "الذهاب لتسجيل الدخول", invalid: "رابط الدعوة غير موجود." },
};

export function AcceptInvitationPage() {
  const locale = useLocale(); const c = copy[locale]; const [params] = useSearchParams(); const token = params.get("token") || "";
  const [form, setForm] = useState({ first_name: "", last_name: "", password: "" }); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  return <main className="login-page"><section className="login-card"><img src="/brand/logos/tyjara-go-white.svg" alt="TijaraGO" /><h1>{c.title}</h1><p>{c.detail}</p>{done ? <><div className="login-success">{c.success}</div><a className="btn btn-primary" href="/login">{c.login}</a></> : <form onSubmit={async (event) => { event.preventDefault(); if (!token) return; setBusy(true); setError(""); try { await api.acceptInvitation({ token, ...form }); setDone(true); } catch (reason) { setError(friendlyError(reason, locale, "login.failed")); } finally { setBusy(false); } }}><label className="field"><span className="field-label">{c.first}</span><input className="input" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label><label className="field"><span className="field-label">{c.last}</span><input className="input" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label><label className="field"><span className="field-label">{c.password}</span><input className="input" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>{error && <div className="login-error">{error}</div>}{!token && <div className="login-error">{c.invalid}</div>}<button className="btn btn-primary" disabled={busy || !token}>{busy ? <span className="spin" /> : null}{c.accept}</button></form>}</section></main>;
}
