import { FiCreditCard, FiDollarSign, FiX } from "react-icons/fi";
import type { SubscriptionPlan } from "../api/client";
import { t, useLocale } from "../i18n";
import { localizedPlanCopy } from "../lib/subscription";
import { ModalShell } from "./ModalShell";
import { useEffect, useState } from "react";

export function BalanceConsentModal({ plan, available, busy, onChoose, onClose }: {
  plan: SubscriptionPlan | null;
  available: number;
  busy: boolean;
  onChoose: (useBalance: boolean) => void;
  onClose: () => void;
}) {
  const locale = useLocale();
  const [renderedPlan, setRenderedPlan] = useState(plan);
  useEffect(() => { if (plan) setRenderedPlan(plan); }, [plan]);
  if (!renderedPlan) return null;
  const numberLocale = locale === "ar" ? "en-US" : locale;
  const copy = localizedPlanCopy(renderedPlan, locale);
  const usable = Math.min(Math.floor(available), Math.floor(Number(renderedPlan.price)));
  const money = (value: number) => value.toLocaleString(numberLocale, { maximumFractionDigits: 0 });
  return <ModalShell open={Boolean(plan)} onClose={onClose} busy={busy} labelledBy="balance-choice-title" panelClassName="balance-choice-modal">
      <div className="modal-head"><div><span className="d-eyebrow">{copy.name}</span><div className="d-card-title" id="balance-choice-title">{t(locale, "subscription.balanceChoiceTitle")}</div></div><button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy} aria-label={t(locale, "confirm.cancel")}><FiX /></button></div>
      <div className="modal-body balance-choice-body">
        <p>{t(locale, "subscription.balanceChoiceBody")}</p>
        <div className="balance-choice-summary"><span><FiDollarSign />{t(locale, "subscription.availableCredit")}</span><strong className="tnum">{money(Math.floor(available))} {renderedPlan.currency}</strong></div>
        <small>{t(locale, "subscription.balanceChoicePolicy")}</small>
      </div>
      <div className="modal-foot balance-choice-actions">
        <button type="button" className="btn btn-secondary" onClick={() => onChoose(false)} disabled={busy}><FiCreditCard />{t(locale, "subscription.payWithoutBalance")}</button>
        <button type="button" className="btn btn-primary" onClick={() => onChoose(true)} disabled={busy}>{busy && <span className="spin" />}{t(locale, "subscription.applyBalance", { amount: `${money(usable)} ${renderedPlan.currency}` })}</button>
      </div>
  </ModalShell>;
}
