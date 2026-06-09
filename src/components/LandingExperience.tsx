"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const LandingShaderGradient = dynamic(
  () =>
    import("@/components/LandingShaderGradient").then(
      (mod) => mod.LandingShaderGradient,
    ),
  { ssr: false },
);

export function LandingExperience() {
  return (
    <main
      className="relative grid min-h-screen place-items-center overflow-hidden bg-[rgb(7_6_5)] px-5 text-[rgb(236_229_218)]"
    >
      <LandingShaderGradient />
      <section className="relative z-10 flex flex-col items-center gap-10 text-center">
        <Link
          href="/app"
          aria-label="Enter Accumulate"
          className="premium-focus group block cursor-pointer"
        >
          <h1
            className="font-serif-accent text-7xl leading-none tracking-normal text-[rgb(238_234_225)] mix-blend-difference transition-[opacity,letter-spacing] duration-300 ease-out group-hover:opacity-90 group-hover:tracking-[0.018em] group-focus-visible:opacity-90 group-focus-visible:tracking-[0.018em] sm:text-8xl lg:text-9xl"
          >
            Accumulate
          </h1>
        </Link>
      </section>
    </main>
  );
}
