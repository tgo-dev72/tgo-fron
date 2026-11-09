import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { revealViewport, staggerContainer, staggerItem } from "./motionTokens";
import { useScrollReveal } from "./useScrollReveal";

const componentCache = new Map<ElementType, ReturnType<typeof motion.create>>();

function motionComponent(tag: ElementType) {
  const cached = componentCache.get(tag);
  if (cached) return cached;
  const created = motion.create(tag);
  componentCache.set(tag, created);
  return created;
}

type StaggerProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  viewport?: typeof revealViewport;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function StaggerContainer<T extends ElementType = "div">({ as, children, className, viewport: _viewport = revealViewport, ...rest }: StaggerProps<T>) {
  const reduceMotion = useReducedMotion();
  const { ref, revealed } = useScrollReveal(Boolean(reduceMotion));
  const Component = motionComponent(as ?? "div");
  return <Component ref={ref} className={className} variants={staggerContainer} initial={reduceMotion ? false : "hidden"} animate={revealed ? "visible" : "hidden"} {...rest}>{children}</Component>;
}

export function StaggerItem<T extends ElementType = "div">({ as, children, className, ...rest }: Omit<StaggerProps<T>, "viewport">) {
  const Component = motionComponent(as ?? "div");
  return <Component className={className} variants={staggerItem} {...rest}>{children}</Component>;
}
