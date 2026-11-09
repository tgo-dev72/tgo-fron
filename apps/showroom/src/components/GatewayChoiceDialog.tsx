import { AnimatePresence, motion } from "framer-motion";

type Gateway = { code: string; name: string; sandbox: boolean };

export function GatewayChoiceDialog({ open, gateways, locale, onClose, onChoose }: {
  open: boolean;
  gateways: Gateway[];
  locale: "en" | "fr" | "ar";
  onClose: () => void;
  onChoose: (code: string) => void;
}) {
  const copy = {
    en: { title: "Choose how to pay", detail: "Select an available secure payment method.", sandbox: "Test mode", close: "Cancel", paypal: "Pay with your PayPal account", youcanpay: "Pay securely by card" },
    fr: { title: "Choisissez votre moyen de paiement", detail: "Sélectionnez un moyen de paiement sécurisé disponible.", sandbox: "Mode test", close: "Annuler", paypal: "Payer avec votre compte PayPal", youcanpay: "Payer par carte en toute sécurité" },
    ar: { title: "اختر طريقة الدفع", detail: "اختر إحدى طرق الدفع الآمنة المتاحة.", sandbox: "وضع الاختبار", close: "إلغاء", paypal: "الدفع باستخدام حساب PayPal", youcanpay: "الدفع الآمن بالبطاقة" },
  }[locale];
  return <AnimatePresence>{open && <motion.div className="sr-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.section className="sr-modal sr-gateway-dialog" role="dialog" aria-modal="true" aria-labelledby="sr-gateway-title" initial={{ opacity: 0, scale: .96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97, y: 12 }} onClick={(event) => event.stopPropagation()}>
      <div className="sr-modal-header"><div><h2 id="sr-gateway-title">{copy.title}</h2><p>{copy.detail}</p></div><button type="button" className="sr-modal-close" onClick={onClose} aria-label={copy.close}>×</button></div>
      <div className="sr-modal-body sr-gateway-options">{gateways.map((gateway) => <button type="button" className="sr-gateway-option" key={gateway.code} onClick={() => onChoose(gateway.code)}>
        <span><strong>{gateway.name}</strong><small>{gateway.code === "paypal" ? copy.paypal : gateway.code === "youcanpay" ? copy.youcanpay : gateway.name}</small></span>
        {gateway.sandbox && <em>{copy.sandbox}</em>}
      </button>)}</div>
      <div className="sr-modal-footer"><button type="button" className="sr-btn sr-btn-ghost" onClick={onClose}>{copy.close}</button></div>
    </motion.section>
  </motion.div>}</AnimatePresence>;
}
