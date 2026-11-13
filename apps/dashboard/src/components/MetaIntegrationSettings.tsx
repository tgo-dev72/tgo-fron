import { useEffect, useState } from "react";
import { api, type MetaIntegration } from "../api/client";
import type { Locale } from "../i18n";

const copy = {
  en: { title: "Meta Pixel", intro: "Connect browser Pixel and secure server-side Conversions API events.", enabled: "Enable Meta tracking", pixel: "Pixel / Dataset ID", token: "Conversions API access token", tokenHint: "Stored encrypted and never displayed again.", save: "Save connection", testCode: "Test Event Code", test: "Send test PageView", disconnect: "Disconnect", connected: "Connected", guide: "In Meta Events Manager, choose your dataset, open Test events, copy the test code, then send a test here. Accept tracking on your storefront to test the browser Pixel." },
  fr: { title: "Meta Pixel", intro: "Connectez le Pixel navigateur et les événements serveur de l’API Conversions.", enabled: "Activer le suivi Meta", pixel: "ID Pixel / Dataset", token: "Jeton d’accès API Conversions", tokenHint: "Chiffré et jamais réaffiché.", save: "Enregistrer", testCode: "Code d’événement test", test: "Envoyer un PageView test", disconnect: "Déconnecter", connected: "Connecté", guide: "Dans le Gestionnaire d’événements Meta, ouvrez Événements de test, copiez le code puis testez ici. Acceptez le suivi sur la boutique pour tester le Pixel." },
  ar: { title: "Meta Pixel", intro: "اربط بيكسل المتصفح وأحداث واجهة التحويلات الآمنة من الخادم.", enabled: "تفعيل تتبع Meta", pixel: "معرّف Pixel / Dataset", token: "رمز وصول واجهة التحويلات", tokenHint: "يُخزن مشفراً ولا يُعرض مرة أخرى.", save: "حفظ الربط", testCode: "رمز حدث الاختبار", test: "إرسال PageView اختباري", disconnect: "قطع الاتصال", connected: "متصل", guide: "افتح Test events في مدير أحداث Meta وانسخ الرمز ثم اختبر هنا. وافق على التتبع في واجهة المتجر لاختبار البيكسل." },
} as const;

export function MetaIntegrationSettings({ storeId, locale }: { storeId: number; locale: Locale }) {
  const c = copy[locale]; const [state, setState] = useState<MetaIntegration | null>(null);
  const [pixel, setPixel] = useState(""); const [token, setToken] = useState(""); const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { api.getMetaIntegration(storeId).then((value) => { setState(value); setPixel(value.pixel_id); setEnabled(value.enabled); }).catch((e) => setMessage(String(e))); }, [storeId]);
  const run = async (fn: () => Promise<MetaIntegration>) => { setBusy(true); setMessage(""); try { const value = await fn(); setState(value); setPixel(value.pixel_id); setEnabled(value.enabled); setToken(""); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  return <div className="form-section">
    <div className="d-card-title">{c.title} {state?.status === "connected" && <span className="badge badge-success">{c.connected}</span>}</div><p className="field-hint">{c.intro}</p>
    <label className="field"><span className="field-label">{c.enabled}</span><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /></label>
    <label className="field"><span className="field-label">{c.pixel}</span><input className="input" inputMode="numeric" value={pixel} onChange={(e) => setPixel(e.target.value.replace(/\D/g, ""))} /></label>
    <label className="field"><span className="field-label">{c.token}</span><input className="input" type="password" autoComplete="new-password" value={token} placeholder={state?.token_configured ? "••••••••••••" : ""} onChange={(e) => setToken(e.target.value)} /><span className="field-hint">{c.tokenHint}</span></label>
    <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.updateMetaIntegration(storeId, { enabled, pixel_id: pixel, ...(token ? { access_token: token } : {}) }))}>{c.save}</button>
    <hr /><p className="field-hint">{c.guide}</p><label className="field"><span className="field-label">{c.testCode}</span><input className="input" value={code} onChange={(e) => setCode(e.target.value)} /></label>
    <button className="btn btn-secondary" disabled={busy || !code} onClick={() => run(() => api.testMetaIntegration(storeId, code))}>{c.test}</button>{" "}<button className="btn btn-danger" disabled={busy || state?.status === "disconnected"} onClick={() => run(() => api.disconnectMetaIntegration(storeId))}>{c.disconnect}</button>
    {state?.last_tested_at && <p className="field-hint">{state.last_test_succeeded ? "✓" : "✕"} {new Date(state.last_tested_at).toLocaleString()} {state.last_error_code}</p>}{message && <p className="form-error">{message}</p>}
  </div>;
}
