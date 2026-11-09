import type { Transition, Variants, ViewportOptions } from "framer-motion";

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;
export const MOTION_EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const revealViewport: ViewportOptions = {
  once: true,
  amount: 0.12,
  margin: "0px 0px 80px 0px",
};

export const revealTransition: Transition = {
  duration: 0.72,
  ease: MOTION_EASE,
};

export const revealVariants: Record<string, Variants> = {
  "fade-in": {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: revealTransition },
  },
  "fade-up": {
    hidden: { opacity: 0, y: "var(--motion-distance, 42px)" },
    visible: { opacity: 1, y: 0, transition: revealTransition },
  },
  "fade-down": {
    hidden: { opacity: 0, y: "calc(var(--motion-distance, 42px) * -1)" },
    visible: { opacity: 1, y: 0, transition: revealTransition },
  },
  "slide-left": {
    hidden: { opacity: 0, x: "var(--motion-distance-horizontal, 52px)" },
    visible: { opacity: 1, x: 0, transition: revealTransition },
  },
  "slide-right": {
    hidden: { opacity: 0, x: "calc(var(--motion-distance-horizontal, 52px) * -1)" },
    visible: { opacity: 1, x: 0, transition: revealTransition },
  },
  scale: {
    hidden: { opacity: 0, y: "calc(var(--motion-distance, 42px) * .45)", scale: 0.955 },
    visible: { opacity: 1, y: 0, scale: 1, transition: revealTransition },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.06 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: "var(--motion-distance, 42px)", scale: 0.975 },
  visible: { opacity: 1, y: 0, scale: 1, transition: revealTransition },
};
