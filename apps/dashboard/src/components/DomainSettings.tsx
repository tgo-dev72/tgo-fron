import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiClipboard, FiGlobe, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { api, type StorefrontDomainRecord } from "../api/client";
import { type Locale } from "../i18n";
import { friendlyError } from "../utils/errors";
import { ConfirmModal } from "./ConfirmModal";

const copy = {
  en: { title: "Store domains", intro: "Keep your TijaraGO address as a fallback and connect a domain you already own.", hostname: "Domain name", placeholder: "shop.example.com", pair: "Also connect the apex/www companion", connect: "Connect domain", connecting: "Connecting…", primary: "Primary", fallback: "Permanent fallback", check: "Check connection", checking: "Checking…", make: "Make primary", remove: "Disconnect", last: "Last checked", confirm: "Disconnect this domain? Your DNS records will not be deleted.", copied: "Copied", modalTitle: "Connect {domain} to this store", modalIntro: "Stay in this window while TijaraGO guides you through the complete connection.", stepOpen: "Open your DNS settings", stepOpenHelp: "Sign in to your domain provider and open the DNS settings for this domain.", stepAdd: "Add these DNS records", stepAddHelp: "Use the exact values below. For root-domain A records, @ means the root/apex of your DNS zone.", stepVerify: "Let TijaraGO check", stepVerifyHelp: "After saving the records, use the button below. If another record is needed, it will appear here automatically.", type: "Type", name: "Name / Host", value: "Value / Target", continue: "I added the record — Continue", verify: "Check connection", cancel: "Finish later" },
  fr: { title: "Domaines de la boutique", intro: "Gardez l’adresse TijaraGO comme secours et connectez un domaine que vous possédez.", hostname: "Nom de domaine", placeholder: "boutique.exemple.com", pair: "Connecter aussi le compagnon apex/www", connect: "Connecter", connecting: "Connexion…", primary: "Principal", fallback: "Adresse de secours permanente", check: "Vérifier", checking: "Vérification…", make: "Définir principal", remove: "Déconnecter", last: "Dernière vérification", confirm: "Déconnecter ce domaine ? Vos enregistrements DNS ne seront pas supprimés.", copied: "Copié", modalTitle: "Connecter {domain} à cette boutique", modalIntro: "Restez dans cette fenêtre : TijaraGO vous guide jusqu’à la connexion complète.", stepOpen: "Ouvrez vos paramètres DNS", stepOpenHelp: "Connectez-vous à votre fournisseur de domaine puis ouvrez les paramètres DNS.", stepAdd: "Ajoutez ces enregistrements DNS", stepAddHelp: "Utilisez exactement les valeurs ci-dessous. Pour un enregistrement A du domaine racine, @ désigne la racine de la zone DNS.", stepVerify: "Laissez TijaraGO vérifier", stepVerifyHelp: "Après avoir enregistré les entrées, utilisez le bouton ci-dessous. Si une autre entrée est nécessaire, elle apparaîtra ici automatiquement.", type: "Type", name: "Nom / Hôte", value: "Valeur / Cible", continue: "Entrée ajoutée — Continuer", verify: "Vérifier la connexion", cancel: "Terminer plus tard" },
  ar: { title: "نطاقات المتجر", intro: "احتفظ بعنوان TijaraGO كعنوان احتياطي واربط نطاقاً تملكه.", hostname: "اسم النطاق", placeholder: "shop.example.com", pair: "ربط نطاق apex/www المقابل أيضاً", connect: "ربط النطاق", connecting: "جارٍ الربط…", primary: "الرئيسي", fallback: "عنوان احتياطي دائم", check: "فحص الاتصال", checking: "جارٍ الفحص…", make: "تعيين كرئيسي", remove: "فصل", last: "آخر فحص", confirm: "فصل هذا النطاق؟ لن تُحذف سجلات DNS الخاصة بك.", copied: "تم النسخ", modalTitle: "ربط {domain} بهذا المتجر", modalIntro: "ابقَ في هذه النافذة، وستوجّهك TijaraGO حتى يكتمل الربط.", stepOpen: "افتح إعدادات DNS", stepOpenHelp: "سجّل الدخول إلى مزوّد النطاق وافتح إعدادات DNS لهذا النطاق.", stepAdd: "أضف سجلات DNS التالية", stepAddHelp: "استخدم القيم أدناه كما هي. في سجل A للنطاق الجذر، تعني @ جذر منطقة DNS.", stepVerify: "دع TijaraGO تتحقق", stepVerifyHelp: "بعد حفظ السجلات، استخدم الزر أدناه. إذا لزم سجل آخر فسيظهر هنا تلقائياً.", type: "النوع", name: "الاسم / المضيف", value: "القيمة / الوجهة", continue: "أضفت السجل — متابعة", verify: "فحص الاتصال", cancel: "الإكمال لاحقاً" },
} as const;

const validationCopy = {
  en: { checking: "Checking your domain now…", checkingHelp: "TijaraGO is checking DNS, ownership, secure HTTPS, and storefront readiness. Keep this window open.", nextRedirect: "Your main address is connected. One last step: connect the companion address that will redirect visitors here.", redirects: "Permanently redirects to" },
  fr: { checking: "Vérification de votre domaine…", checkingHelp: "TijaraGO vérifie le DNS, la propriété, le HTTPS sécurisé et la disponibilité de la boutique. Gardez cette fenêtre ouverte.", nextRedirect: "Votre adresse principale est connectée. Dernière étape : connectez l’adresse associée qui redirigera les visiteurs ici.", redirects: "Redirige définitivement vers" },
  ar: { checking: "جارٍ التحقق من نطاقك…", checkingHelp: "تتحقق TijaraGO من DNS والملكية وHTTPS الآمن وجاهزية المتجر. أبقِ هذه النافذة مفتوحة.", nextRedirect: "تم ربط العنوان الرئيسي. بقيت خطوة أخيرة: ربط العنوان المرافق الذي سيعيد توجيه الزوار إليه.", redirects: "إعادة توجيه دائمة إلى" },
} as const;

const experienceCopy = {
  en: {
    recommendedPair: "Use www and redirect the root domain (recommended)",
    pairHelp: "Visitors using either address will reach the same store.",
    continueSetup: "Continue setup",
    viewStatus: "View status",
    close: "Close",
    stages: ["Ownership", "DNS", "Activation"],
    stageHelp: ["Confirm that this domain belongs to you.", "Point the domain to your TijaraGO store.", "TijaraGO secures and activates the address."],
    status: { pending: "Preparing", awaiting_ownership: "Ownership record needed", awaiting_dns: "Waiting for DNS", verifying: "Checking", active: "Connected", failed: "Needs attention", removing: "Disconnecting" },
    stateTitle: { ownership: "Confirm domain ownership", dns: "Connect your domain", activation: "Securing your domain", active: "Your domain is connected", failed: "Action needed" },
    waiting: "DNS updates may take a few minutes. You can close this window and return later—your progress is saved.",
  },
  fr: {
    recommendedPair: "Utiliser www et rediriger le domaine racine (recommandé)",
    pairHelp: "Les visiteurs utilisant l’une ou l’autre adresse arriveront sur la même boutique.",
    continueSetup: "Continuer la configuration",
    viewStatus: "Voir l’état",
    close: "Fermer",
    stages: ["Propriété", "DNS", "Activation"],
    stageHelp: ["Confirmez que ce domaine vous appartient.", "Dirigez le domaine vers votre boutique TijaraGO.", "TijaraGO sécurise et active l’adresse."],
    status: { pending: "Préparation", awaiting_ownership: "Preuve de propriété requise", awaiting_dns: "En attente du DNS", verifying: "Vérification", active: "Connecté", failed: "Action requise", removing: "Déconnexion" },
    stateTitle: { ownership: "Confirmez la propriété du domaine", dns: "Connectez votre domaine", activation: "Sécurisation de votre domaine", active: "Votre domaine est connecté", failed: "Action requise" },
    waiting: "La mise à jour DNS peut prendre quelques minutes. Vous pouvez fermer cette fenêtre et revenir plus tard : votre progression est enregistrée.",
  },
  ar: {
    recommendedPair: "استخدام www وتحويل النطاق الجذر إليه (موصى به)",
    pairHelp: "سيصل الزوار إلى المتجر نفسه باستخدام أي من العنوانين.",
    continueSetup: "متابعة الإعداد",
    viewStatus: "عرض الحالة",
    close: "إغلاق",
    stages: ["الملكية", "DNS", "التفعيل"],
    stageHelp: ["أثبت أن هذا النطاق ملك لك.", "وجّه النطاق إلى متجر TijaraGO.", "تؤمّن TijaraGO العنوان وتفعّله."],
    status: { pending: "جارٍ التحضير", awaiting_ownership: "إثبات الملكية مطلوب", awaiting_dns: "في انتظار DNS", verifying: "جارٍ التحقق", active: "متصل", failed: "يتطلب إجراءً", removing: "جارٍ الفصل" },
    stateTitle: { ownership: "أثبت ملكية النطاق", dns: "اربط نطاقك", activation: "جارٍ تأمين نطاقك", active: "تم ربط نطاقك", failed: "إجراء مطلوب" },
    waiting: "قد يستغرق تحديث DNS بضع دقائق. يمكنك إغلاق النافذة والعودة لاحقاً؛ تم حفظ تقدمك.",
  },
} as const;

export function DomainSettings({ storeId, locale }: { storeId: number; locale: Locale }) {
  const c = copy[locale];
  const vc = validationCopy[locale];
  const xc = experienceCopy[locale];
  const [domains, setDomains] = useState<StorefrontDomainRecord[]>([]);
  const [hostname, setHostname] = useState("");
  const [includeWww, setIncludeWww] = useState(true);
  const [busy, setBusy] = useState<string | number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [verificationDomain, setVerificationDomain] = useState<StorefrontDomainRecord | null>(null);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationQueue, setVerificationQueue] = useState<StorefrontDomainRecord[]>([]);
  const load = useCallback(async () => { try { setDomains(await api.getDomains(storeId)); setError(""); } catch (e) { setError(friendlyError(e, locale, "settings.saveFailed")); } }, [storeId, locale]);
  useEffect(() => { void load(); }, [load]);

  async function act(key: string | number, callback: () => Promise<unknown>) {
    setBusy(key); setError("");
    try { await callback(); await load(); } catch (e) { setError(e instanceof Error && e.message ? e.message : friendlyError(e, locale, "settings.saveFailed")); } finally { setBusy(null); }
  }
  return <section className="domain-settings" aria-labelledby="domain-settings-title">
    <div className="domain-settings-head"><span><FiGlobe /></span><div><h2 id="domain-settings-title">{c.title}</h2><p>{c.intro}</p></div></div>
    <form className="domain-connect" onSubmit={(event) => { event.preventDefault(); void act("connect", async () => { const result = await api.connectDomain(storeId, hostname.trim(), includeWww); setHostname(""); setVerificationMessage(""); setVerificationDomain(result.domains[0] || null); setVerificationQueue(result.domains.slice(1)); }); }}>
      <label><span>{c.hostname}</span><input className="input" inputMode="url" autoCapitalize="none" autoCorrect="off" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="example.com" required /></label>
      <label className="domain-pair"><input type="checkbox" checked={includeWww} onChange={(e) => setIncludeWww(e.target.checked)} /> <span><strong>{xc.recommendedPair}</strong><small>{xc.pairHelp}</small></span></label>
      <button className="btn btn-primary" disabled={busy !== null || !hostname.trim()}>{busy === "connect" ? c.connecting : c.connect}</button>
    </form>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="domain-list">{domains.map((domain) => <article className={`domain-card ${domain.is_primary ? "is-primary" : ""}`} key={domain.id}>
      <header><div><a href={domain.url} target="_blank" rel="noreferrer">{domain.display_hostname || domain.hostname}</a><div className="domain-badges">{domain.is_primary && <span><FiCheck /> {c.primary}</span>}<span className={`domain-status-${domain.status}`}>{xc.status[domain.status]}</span></div></div></header>
      <p>{domain.kind === "platform" ? c.fallback : domain.public_message}</p>
      {domain.redirect_to && <p><strong>{vc.redirects}:</strong> {domain.redirect_to}</p>}
      {domain.last_checked_at && <small>{c.last}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(domain.last_checked_at))}</small>}
      {domain.kind !== "platform" && <footer><button className="btn" disabled={busy !== null} aria-haspopup="dialog" onClick={() => { setVerificationMessage(""); setVerificationQueue([]); setVerificationDomain(domain); }}><FiRefreshCw /> {domain.status === "active" ? xc.viewStatus : xc.continueSetup}</button><button className="btn" disabled={busy !== null || !domain.healthy || domain.is_primary || Boolean(domain.redirect_to)} onClick={() => void act(`primary-${domain.id}`, () => api.makeDomainPrimary(storeId, domain.id))}>{c.make}</button><button className="btn btn-ghost domain-remove" disabled={busy !== null} onClick={() => { if (window.confirm(c.confirm)) void act(`remove-${domain.id}`, () => api.disconnectDomain(storeId, domain.id)); }}><FiTrash2 /> {c.remove}</button></footer>}
    </article>)}</div>
    <ConfirmModal open={verificationDomain !== null} maxWidth={620} dialogClassName="domain-verification-modal" title={c.modalTitle.replace("{domain}", verificationDomain?.display_hostname || verificationDomain?.hostname || "")} confirmLabel={busy === verificationDomain?.id ? c.checking : verificationDomain?.ownership_verified_at ? c.verify : c.continue} cancelLabel={verificationDomain && (verificationDomain.status === "active" || verificationDomain.healthy) ? xc.close : c.cancel} loading={busy === verificationDomain?.id} onClose={() => { setVerificationDomain(null); setVerificationMessage(""); setVerificationQueue([]); }} onConfirm={async () => {
      if (!verificationDomain) return;
      const id = verificationDomain.id;
      setBusy(id); setError("");
      try {
        const updated = await api.verifyDomain(storeId, id);
        setDomains((current) => current.map((domain) => domain.id === updated.id ? updated : domain));
        if (updated.healthy || updated.status === "active") {
          const next = verificationQueue[0];
          if (next) {
            setVerificationDomain(next);
            setVerificationQueue((current) => current.slice(1));
            setVerificationMessage(vc.nextRedirect);
          } else {
            setVerificationDomain(null);
            setVerificationMessage("");
          }
        } else {
          setVerificationDomain(updated);
          setVerificationMessage(updated.public_message);
        }
      }
      catch (e) { setVerificationMessage(e instanceof Error && e.message ? e.message : friendlyError(e, locale, "settings.saveFailed")); }
      finally { setBusy(null); }
    }} hideConfirm={Boolean(verificationDomain && (verificationDomain.status === "active" || verificationDomain.healthy))} body={verificationDomain && (() => {
      const active = verificationDomain.status === "active" || verificationDomain.healthy;
      const currentStage = active ? 3 : !verificationDomain.ownership_verified_at ? 0 : !verificationDomain.provider_verified ? 1 : 2;
      const stateKey = verificationDomain.status === "failed" ? "failed" : active ? "active" : currentStage === 0 ? "ownership" : currentStage === 1 ? "dns" : "activation";
      return <div className="domain-verification-guide">
      <ol className="domain-progress" aria-label={c.modalTitle.replace("{domain}", verificationDomain.display_hostname || verificationDomain.hostname)}>
        {xc.stages.map((stage, index) => <li className={index < currentStage || active ? "is-complete" : index === currentStage ? "is-current" : ""} aria-current={index === currentStage && !active ? "step" : undefined} key={stage}><span>{index < currentStage || active ? <FiCheck /> : index + 1}</span><div><strong>{stage}</strong><small>{xc.stageHelp[index]}</small></div></li>)}
      </ol>
      <div aria-live="polite" aria-atomic="true">
        {busy === verificationDomain.id
          ? <div className="domain-validation-status" role="status"><strong>{vc.checking}</strong><p>{vc.checkingHelp}</p></div>
          : <div className={`domain-validation-status ${stateKey === "failed" ? "is-error" : ""}`} role="status"><strong>{xc.stateTitle[stateKey]}</strong><p>{verificationMessage || verificationDomain.public_message || xc.waiting}</p>{!active && stateKey !== "failed" && <small>{xc.waiting}</small>}</div>}
      </div>
      {verificationDomain.redirect_to && <p className="domain-guide-intro"><strong>{vc.redirects}:</strong> {verificationDomain.redirect_to}</p>}
      {!active && <section className="domain-current-action">
        <header><span>{currentStage + 1}</span><div><strong>{currentStage === 2 ? c.stepVerify : c.stepAdd}</strong><p>{currentStage === 2 ? c.stepVerifyHelp : c.stepAddHelp}</p></div></header>
        {currentStage < 2 && <><div className="domain-provider-hint"><strong>{c.stepOpen}</strong><span>{c.stepOpenHelp}</span><code className="domain-guide-host" dir="ltr">{verificationDomain.hostname}</code></div><div className="domain-record-table">{verificationDomain.expected_dns_records.map((record, index) => { const recordName = record.type === "A" && record.name === verificationDomain.hostname ? "@" : record.name; return <div className="domain-record" key={`${record.type}-${record.name}-${index}`}><b>{record.type}</b><dl><div><dt>{c.name}</dt><dd><code dir="ltr">{recordName}</code><button type="button" aria-label={`${c.copied}: ${recordName}`} onClick={async () => { await navigator.clipboard.writeText(recordName); setCopied(`${verificationDomain.id}-${index}-name`); }}><FiClipboard />{copied === `${verificationDomain.id}-${index}-name` && <span>{c.copied}</span>}</button></dd></div><div><dt>{c.value}</dt><dd><code dir="ltr">{record.value}</code><button type="button" aria-label={`${c.copied}: ${record.value}`} onClick={async () => { await navigator.clipboard.writeText(record.value); setCopied(`${verificationDomain.id}-${index}-value`); }}><FiClipboard />{copied === `${verificationDomain.id}-${index}-value` && <span>{c.copied}</span>}</button></dd></div></dl></div>; })}</div></>}
      </section>}
    </div>; })()} />
  </section>;
}
