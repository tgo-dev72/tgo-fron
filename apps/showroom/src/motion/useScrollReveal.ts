import { useCallback, useEffect, useRef, useState } from "react";

type RevealCallback = () => void;

const callbacks = new WeakMap<Element, RevealCallback>();
let sharedObserver: IntersectionObserver | null = null;

function getObserver() {
  if (sharedObserver || typeof window === "undefined" || !("IntersectionObserver" in window)) return sharedObserver;
  sharedObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      callbacks.get(entry.target)?.();
      callbacks.delete(entry.target);
      sharedObserver?.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: "0px 0px 80px 0px" });
  return sharedObserver;
}

export function useScrollReveal(disabled = false) {
  const [revealed, setRevealed] = useState(disabled);
  const targetRef = useRef<HTMLElement | null>(null);
  const ref = useCallback((node: HTMLElement | null) => { targetRef.current = node; }, []);

  useEffect(() => {
    if (disabled) {
      setRevealed(true);
      return;
    }
    const target = targetRef.current;
    const observer = getObserver();
    if (!target || !observer) {
      setRevealed(true);
      return;
    }
    callbacks.set(target, () => setRevealed(true));
    observer.observe(target);
    return () => {
      callbacks.delete(target);
      observer.unobserve(target);
    };
  }, [disabled]);

  return { ref, revealed };
}
