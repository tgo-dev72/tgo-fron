import { FiAlertTriangle, FiX } from "react-icons/fi";
import { useId, useRef, type ReactNode } from "react";
import { useLocale, t } from "../i18n";
import { ModalShell } from "./ModalShell";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  hideConfirm?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  maxWidth?: number;
  dialogClassName?: string;
}

export function ConfirmModal({
  open, title, body, confirmLabel, cancelLabel, danger = false, loading = false, confirmDisabled = false, hideConfirm = false, onConfirm, onClose, maxWidth = 420, dialogClassName = "",
}: ConfirmModalProps) {
  const locale = useLocale();
  const titleId = useId();
  const bodyId = useId();
  const submittingRef = useRef(false);
  const presentedRef = useRef({ title, body, confirmLabel, cancelLabel, danger, loading, confirmDisabled, hideConfirm, maxWidth, dialogClassName });
  if (open) presentedRef.current = { title, body, confirmLabel, cancelLabel, danger, loading, confirmDisabled, hideConfirm, maxWidth, dialogClassName };
  const presented = presentedRef.current;
  const confirmOnce = async () => {
    if (submittingRef.current || loading || confirmDisabled) return;
    submittingRef.current = true;
    try { await onConfirm(); } finally { submittingRef.current = false; }
  };
  return <ModalShell open={open} onClose={onClose} busy={loading} role="alertdialog" labelledBy={titleId} describedBy={bodyId} maxWidth={presented.maxWidth} overlayClassName="confirm-modal-overlay" panelClassName={`confirm-modal ${presented.dialogClassName}`.trim()}>
        <div className="modal-head">
          <div id={titleId} className="d-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {presented.danger && <FiAlertTriangle style={{ color: "var(--danger)", fontSize: 18 }} />}
            {presented.title}
          </div>
          <button type="button" className="icon-btn modal-close" onClick={onClose} disabled={loading} aria-label={t(locale, "confirm.cancel")} title={t(locale, "confirm.cancel")}>
            <FiX />
          </button>
        </div>
        <div id={bodyId} className="modal-body" style={{ fontSize: 13.5, color: "var(--ink-secondary)", lineHeight: 1.6 }}>
          {presented.body}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {presented.cancelLabel ?? t(locale, "confirm.cancel")}
          </button>
          {!presented.hideConfirm && <button
            type="button"
            className={`btn ${presented.danger ? "btn-danger" : "btn-primary"}`}
            onClick={confirmOnce}
            disabled={loading || confirmDisabled}
          >
            {loading && <span className="spin" />}
            {presented.confirmLabel ?? (presented.danger ? t(locale, "confirm.delete") : t(locale, "confirm.yes"))}
          </button>}
        </div>
  </ModalShell>;
}
