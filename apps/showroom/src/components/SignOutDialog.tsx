import { useEffect, useId } from "react";

export function SignOutDialog({
  open,
  title,
  body,
  cancelLabel,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div className="sr-modal-overlay sr-confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="sr-modal sr-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
        <div className="sr-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="sr-modal-close" onClick={onCancel} disabled={busy} aria-label={cancelLabel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="sr-modal-body"><p id={bodyId}>{body}</p></div>
        <div className="sr-modal-footer">
          <button type="button" className="sr-btn sr-btn-ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="sr-btn sr-btn-primary" onClick={onConfirm} disabled={busy}>
            {busy && <span className="sr-btn-spinner" aria-hidden="true" />}{confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
