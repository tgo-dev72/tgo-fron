import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { API_BASE } from "../api/platform";
import { PageTransition } from "../components/PageTransition";

const COPY = {
  en: { eyebrow: "Email preferences", title: "Unsubscribe from store updates?", body: "You will stop receiving marketing campaigns from this store. Order and account emails are not affected.", action: "Confirm unsubscribe", working: "Unsubscribing…", done: "You have been unsubscribed.", error: "This unsubscribe link is invalid or has expired." },
  fr: { eyebrow: "Préférences e-mail", title: "Se désabonner des actualités ?", body: "Vous ne recevrez plus les campagnes marketing de cette boutique. Les e-mails de commande et de compte restent actifs.", action: "Confirmer le désabonnement", working: "Désabonnement…", done: "Vous êtes désabonné.", error: "Ce lien de désabonnement est invalide ou a expiré." },
  ar: { eyebrow: "تفضيلات البريد", title: "هل تريد إلغاء الاشتراك في أخبار المتجر؟", body: "لن تتوصل بعد الآن بالحملات التسويقية لهذا المتجر. رسائل الطلبات والحساب لن تتأثر.", action: "تأكيد إلغاء الاشتراك", working: "جارٍ إلغاء الاشتراك…", done: "تم إلغاء اشتراكك.", error: "رابط إلغاء الاشتراك غير صالح أو منتهي الصلاحية." },
} as const;

export default function Unsubscribe() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const language = params.get("lang");
  const locale = language === "fr" || language === "ar" ? language : "en";
  const copy = useMemo(() => COPY[locale], [locale]);
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  async function confirm() {
    if (!code || state === "working") return;
    setState("working");
    try {
      const endpoint = import.meta.env.DEV
        ? `${API_BASE}/api/unsubscribe/${encodeURIComponent(code)}/`
        : `/api/unsubscribe/${encodeURIComponent(code)}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return <PageTransition>
    <main className="sr-unsubscribe-page" dir={locale === "ar" ? "rtl" : "ltr"}>
      <section className="sr-unsubscribe-card" aria-live="polite">
        <span className="sr-eyebrow">{copy.eyebrow}</span>
        <h1>{state === "done" ? copy.done : copy.title}</h1>
        {state !== "done" && <p>{state === "error" ? copy.error : copy.body}</p>}
        {state !== "done" && <button type="button" className="sr-btn sr-btn-primary" disabled={state === "working" || !code} onClick={() => void confirm()}>
          {state === "working" ? copy.working : copy.action}
        </button>}
      </section>
    </main>
  </PageTransition>;
}
