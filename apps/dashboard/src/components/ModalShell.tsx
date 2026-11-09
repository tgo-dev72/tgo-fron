import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const EXIT_MS = 220;
const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function useLastPresent<T>(value: T | null | undefined) {
  const [last, setLast] = useState<T | null>(value ?? null);
  useEffect(() => { if (value != null) setLast(value); }, [value]);
  return last;
}

export function ModalShell({
  open,
  children,
  onClose,
  dismissible = true,
  role = "dialog",
  labelledBy,
  describedBy,
  overlayClassName = "",
  panelClassName = "",
  maxWidth,
  busy = false,
}: {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
  dismissible?: boolean;
  role?: "dialog" | "alertdialog";
  labelledBy?: string;
  describedBy?: string;
  overlayClassName?: string;
  panelClassName?: string;
  maxWidth?: number;
  busy?: boolean;
}) {
  const fallbackTitleId = useId();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  onCloseRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    let exitTimer = 0;
    let enterFrame = 0;
    let visibleFrame = 0;
    if (open) {
      setMounted(true);
      enterFrame = window.requestAnimationFrame(() => {
        visibleFrame = window.requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      exitTimer = window.setTimeout(() => setMounted(false), EXIT_MS);
    }
    return () => {
      window.cancelAnimationFrame(enterFrame);
      window.cancelAnimationFrame(visibleFrame);
      window.clearTimeout(exitTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingInlineEnd;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingInlineEnd = `${scrollbarWidth}px`;
    const focusFrame = window.requestAnimationFrame(() => {
      const preferred = panelRef.current?.querySelector<HTMLElement>("[data-modal-autofocus]");
      const fallback = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? fallback ?? panelRef.current)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible && !busyRef.current) {
        event.preventDefault(); onCloseRef.current?.(); return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (!focusable.length) { event.preventDefault(); panelRef.current?.focus(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingInlineEnd = previousPadding;
      restoreFocusRef.current?.focus();
    };
  }, [mounted, dismissible]);

  if (!mounted) return null;
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target && dismissible && !busy) onClose?.();
  };
  const content = <div className={`modal-overlay ${visible ? "is-visible" : "is-exiting"} ${overlayClassName}`.trim()} onMouseDown={closeFromBackdrop}>
    <div
      ref={panelRef}
      className={`modal ${panelClassName}`.trim()}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy || fallbackTitleId}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      tabIndex={-1}
      style={{ maxWidth }}
      onMouseDown={(event) => event.stopPropagation()}
    >{children}</div>
  </div>;
  return typeof document === "undefined" ? content : createPortal(content, document.body);
}
