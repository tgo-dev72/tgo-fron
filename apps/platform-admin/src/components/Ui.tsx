import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { useI18n, type Locale } from "../i18n";

const localeTag = (locale: Locale) => locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-GB";
const localeOptions = (locale: Locale) => locale === "ar" ? { numberingSystem: "latn" } : {};

export function formatDate(value: string | null | undefined, withTime = false, locale: Locale = "en") {
  if (!value) return locale === "ar" ? "أبدًا" : locale === "fr" ? "Jamais" : "Never";
  return new Intl.DateTimeFormat(localeTag(locale), {
    ...localeOptions(locale),
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

export function money(value: number, currency = "MAD", locale: Locale = "en") {
  return new Intl.NumberFormat(localeTag(locale), { ...localeOptions(locale), style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function number(value: number, locale: Locale = "en") {
  return new Intl.NumberFormat(localeTag(locale), { ...localeOptions(locale), notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export function Status({ value }: { value: string }) {
  const { tr } = useI18n();
  const key = value.toLowerCase().replace(/[^a-z]/g, "-");
  return <span className={`status status-${key}`}><i />{tr(`status.${key}`, {}, tr("status.other"))}</span>;
}

export function PageHeader({ eyebrow, title, detail, actions }: { eyebrow: string; title: string; detail: string; actions?: ReactNode }) {
  return <header className="page-header">
    <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>;
}

export function Loading() {
  const { tr } = useI18n();
  return <div className="loading-view" role="status" aria-label={tr("common.loading")} aria-busy="true">
    <span className="loading-title" aria-hidden="true" />
    <span className="loading-copy" aria-hidden="true" />
    <div className="loading-grid" aria-hidden="true"><div /><div /><div /><div /></div>
    <span className="visually-hidden">{tr("common.loading")}</span>
  </div>;
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  const { tr } = useI18n();
  void message;
  return <div className="state-card"><span className="state-mark">!</span><h2>{tr("common.unavailable")}</h2><p>{tr("common.unavailableDetail")}</p><button className="button" onClick={retry}>{tr("common.tryAgain")}</button></div>;
}

export function Empty({ text }: { text?: string }) {
  const { tr } = useI18n();
  return <div className="empty-row">{text ?? tr("common.noRecords")}</div>;
}

const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function useModalFocus(open: boolean, onEscape: () => void, busy = false): RefObject<HTMLElement> {
  const modalRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const escapeRef = useRef(onEscape);
  const busyRef = useRef(busy);
  escapeRef.current = onEscape;
  busyRef.current = busy;
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      const items = modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
      items?.[0]?.focus();
    });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); escapeRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = Array.from(modalRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open]);
  return modalRef;
}

export function ConfirmDialog({ open, title, detail, confirmLabel, cancelLabel, busy = false, danger = false, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  detail: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { tr } = useI18n();
  const dialogRef = useModalFocus(open, onCancel, busy);
  if (!open) return null;
  return createPortal(<div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section ref={dialogRef} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-detail">
      <button type="button" className="modal-close" aria-label={tr("common.close")} title={tr("common.close")} disabled={busy} onClick={onCancel}><FiX /></button>
      <span className={`state-mark${danger ? " danger" : ""}`}>!</span>
      <h2 id="confirm-dialog-title">{title}</h2><p id="confirm-dialog-detail">{detail}</p>
      <footer><button type="button" className="button secondary" disabled={busy} onClick={onCancel}>{cancelLabel ?? tr("common.cancel")}</button><button type="button" className={`button${danger ? " danger-button" : ""}`} disabled={busy} onClick={onConfirm}>{busy && <span className="spin" aria-hidden="true" />}{confirmLabel}</button></footer>
    </section>
  </div>, document.body);
}
