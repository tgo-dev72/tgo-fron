import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { revealVariants, revealViewport } from "./motionTokens";
import { useScrollReveal } from "./useScrollReveal";

const componentCache = new Map<ElementType, ReturnType<typeof motion.create>>();

function motionComponent(tag: ElementType) {
  const cached = componentCache.get(tag);
  if (cached) return cached;
  const created = motion.create(tag);
  componentCache.set(tag, created);
  return created;
}

export type RevealVariant = keyof typeof revealVariants;

type ScrollRevealProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  className?: string;
  viewport?: typeof revealViewport;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function ScrollReveal<T extends ElementType = "div">({
  as,
  children,
  variant = "fade-up",
  delay = 0,
  className,
  viewport: _viewport = revealViewport,
  ...rest
}: ScrollRevealProps<T>) {
  const reduceMotion = useReducedMotion();
  const { ref, revealed } = useScrollReveal(Boolean(reduceMotion));
  const Component = motionComponent(as ?? "div");
  const variants = revealVariants[variant];

  return (
    <Component
      className={["motion-reveal", className].filter(Boolean).join(" ")}
      ref={ref}
      initial={reduceMotion ? false : "hidden"}
      animate={revealed ? "visible" : "hidden"}
      variants={variants}
      transition={delay ? { delay } : undefined}
      {...rest}
    >
      {children}
    </Component>
  );
}
