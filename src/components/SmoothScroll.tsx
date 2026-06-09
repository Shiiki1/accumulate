"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";

type SmoothScrollProps = {
  children: ReactNode;
};

export function SmoothScroll({ children }: SmoothScrollProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/app")) return;

    const lenis = new Lenis({
      duration: 1.08,
      easing: (time) => Math.min(1, 1.001 - Math.pow(2, -10 * time)),
      lerp: 0.1,
      smoothWheel: true,
      wheelMultiplier: 0.82,
    });

    let frame = 0;

    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }

    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [pathname]);

  return children;
}
