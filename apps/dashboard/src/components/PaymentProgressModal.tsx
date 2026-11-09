import { FiCheck, FiCreditCard, FiShield } from "react-icons/fi";
import { t, useLocale } from "../i18n";
import { ModalShell } from "./ModalShell";

export type PaymentProgressStage = "preparing" | "redirecting" | "confirming";

const stages: PaymentProgressStage[] = ["preparing", "redirecting", "confirming"];

export function PaymentProgressModal({ open, stage, planName }: {
  open: boolean;
  stage: PaymentProgressStage;
  planName?: string;
}) {
  const locale = useLocale();
  const activeIndex = stages.indexOf(stage);
  const icon = stage === "preparing" ? <FiCreditCard /> : stage === "redirecting" ? <FiShield /> : <FiCheck />;

  return <ModalShell open={open} dismissible={false} busy labelledBy="payment-progress-title" describedBy="payment-progress-description" overlayClassName="payment-progress-overlay" panelClassName="payment-progress-modal">
      <div className="payment-progress-visual" aria-hidden="true"><span className="payment-progress-ring" />{icon}</div>
      {planName && <span className="d-eyebrow">{planName}</span>}
      <h2 id="payment-progress-title">{t(locale, `subscription.progress.${stage}.title`)}</h2>
      <p id="payment-progress-description" aria-live="polite">{t(locale, `subscription.progress.${stage}.body`)}</p>
      <ol className="payment-progress-steps">
        {stages.map((item, index) => <li className={index < activeIndex ? "done" : index === activeIndex ? "active" : ""} key={item}>
          <span>{index < activeIndex ? <FiCheck /> : index + 1}</span>
          <div><strong>{t(locale, `subscription.progress.${item}.step`)}</strong><small>{t(locale, index < activeIndex ? "subscription.progress.complete" : index === activeIndex ? "subscription.progress.inProgress" : "subscription.progress.next")}</small></div>
        </li>)}
      </ol>
      <small className="payment-progress-reassurance">{t(locale, "subscription.progress.reassurance")}</small>
  </ModalShell>;
}
