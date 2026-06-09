import type { Variants } from "framer-motion";

export const softSpring = {
  type: "spring",
  stiffness: 180,
  damping: 24,
  mass: 0.85,
} as const;

export const pageReveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] },
  },
};

export const staggerParent: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.08,
    },
  },
};

export const gridItemReveal: Variants = {
  hidden: { opacity: 0, y: 22, filter: "blur(12px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] },
  },
};

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.28 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

export const modalPanel: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.985, filter: "blur(12px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: softSpring,
  },
  exit: {
    opacity: 0,
    y: 18,
    scale: 0.99,
    filter: "blur(8px)",
    transition: { duration: 0.2 },
  },
};
