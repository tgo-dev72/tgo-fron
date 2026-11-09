import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "../i18n";

export type PaymentProgressStage = "preparing" | "redirecting" | "confirming";

const stages: PaymentProgressStage[] = ["preparing", "redirecting", "confirming"];

export function PaymentProgressDialog({ open, stage, planName }: {
  open: boolean;
  stage: PaymentProgressStage;
  planName?: string;
}) {
  const { t } = useLocale();
  const activeIndex = stages.indexOf(stage);
  return <AnimatePresence>
    {open && <motion.div className="sr-modal-overlay sr-payment-progress-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="sr-modal sr-payment-progress" role="dialog" aria-modal="true" aria-busy="true" aria-labelledby="sr-payment-progress-title" aria-describedby="sr-payment-progress-description" initial={{ opacity: 0, scale: .96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97, y: 12 }}>
        <div className="sr-payment-progress-visual" aria-hidden="true"><span /><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg></div>
        {planName && <span className="sr-membership-kicker">{planName}</span>}
        <h2 id="sr-payment-progress-title">{t(`paymentProgress.${stage}.title`)}</h2>
        <p id="sr-payment-progress-description" aria-live="polite">{t(`paymentProgress.${stage}.body`)}</p>
        <ol>
          {stages.map((item, index) => <li className={index < activeIndex ? "done" : index === activeIndex ? "active" : ""} key={item}>
            <span>{index < activeIndex ? "✓" : index + 1}</span>
            <div><strong>{t(`paymentProgress.${item}.step`)}</strong><small>{t(index < activeIndex ? "paymentProgress.complete" : index === activeIndex ? "paymentProgress.inProgress" : "paymentProgress.next")}</small></div>
          </li>)}
        </ol>
        <small className="sr-payment-progress-note">{t("paymentProgress.reassurance")}</small>
      </motion.div>
    </motion.div>}
  </AnimatePresence>;
}
