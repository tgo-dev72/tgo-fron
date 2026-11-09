import { AnimatePresence, motion } from "framer-motion";
import type { SubscriptionPlan } from "../api/platform";
import { useLocale } from "../i18n";
import { localizedPlanCopy } from "../lib/plans";

export function BalanceConsentDialog({ plan, available, busy, onChoose, onClose }: {
  plan: SubscriptionPlan | null;
  available: number;
  busy: boolean;
  onChoose: (useBalance: boolean) => void;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  if (!plan) return null;
  const numberLocale = locale === "ar" ? "en-US" : locale;
  const copy = localizedPlanCopy(plan, locale);
  const usable = Math.min(Math.floor(available), Math.floor(Number(plan.price)));
  const money = (value: number) => value.toLocaleString(numberLocale, { maximumFractionDigits: 0 });
  return <AnimatePresence>
    <motion.div className="sr-modal-overlay" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={() => { if (!busy) onClose(); }}>
      <motion.div className="sr-modal sr-balance-dialog" role="dialog" aria-modal="true" aria-labelledby="sr-balance-title" initial={{ opacity:0, scale:.96, y:18 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:.96, y:12 }} onClick={(event) => event.stopPropagation()}>
        <div className="sr-modal-header"><div><span className="sr-membership-kicker">{copy.name}</span><h2 id="sr-balance-title">{t("membership.balanceChoiceTitle")}</h2></div><button type="button" className="sr-modal-close" onClick={onClose} disabled={busy} aria-label={t("redesign.cancel")}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
        <div className="sr-modal-body sr-balance-dialog-body"><p>{t("membership.balanceChoiceBody")}</p><div><span>{t("membership.availableBalance")}</span><strong>{money(Math.floor(available))} {plan.currency}</strong></div><small>{t("membership.balanceChoicePolicy")}</small></div>
        <div className="sr-modal-footer sr-balance-dialog-actions"><button type="button" className="sr-btn sr-btn-ghost" onClick={() => onChoose(false)} disabled={busy}>{t("membership.payWithoutBalance")}</button><button type="button" className="sr-btn sr-btn-primary" onClick={() => onChoose(true)} disabled={busy}>{busy && <span className="sr-btn-spinner" />}{t("membership.applyBalance").replace("{amount}", `${money(usable)} ${plan.currency}`)}</button></div>
      </motion.div>
    </motion.div>
  </AnimatePresence>;
}
