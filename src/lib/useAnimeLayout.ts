"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { AutoLayout, LayoutAnimationParams } from "animejs";

const layoutParams: LayoutAnimationParams = {
  duration: 260,
  ease: "out(3)",
};

export function useAnimeLayout<T extends HTMLElement>() {
  const layoutRef = useRef<AutoLayout | null>(null);
  const reducedMotionRef = useRef(false);
  const [rootElement, setRootElement] = useState<T | null>(null);

  useEffect(() => {
    if (!rootElement) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mediaQuery.matches;

    if (mediaQuery.matches) return;

    let cancelled = false;

    import("animejs").then(({ createLayout }) => {
      if (cancelled) return;

      layoutRef.current = createLayout(rootElement, {
        children: "[data-layout-item]",
        ...layoutParams,
      });
    });

    return () => {
      cancelled = true;
      layoutRef.current?.revert();
      layoutRef.current = null;
    };
  }, [rootElement]);

  const animateLayoutChange = useCallback((update: () => void) => {
    const layout = layoutRef.current;

    if (!layout || reducedMotionRef.current) {
      update();
      return;
    }

    try {
      layout.update(() => {
        flushSync(update);
      }, layoutParams);
    } catch {
      update();
    }
  }, []);

  return { animateLayoutChange, layoutRootRef: setRootElement };
}
