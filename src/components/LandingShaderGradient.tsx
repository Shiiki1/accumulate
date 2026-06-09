"use client";

import { useEffect, useState } from "react";
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

export function LandingShaderGradient() {
  const [shouldAnimate, setShouldAnimate] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    function handleChange(event: MediaQueryListEvent) {
      setShouldAnimate(!event.matches);
    }

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
      <ShaderGradientCanvas
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.95,
        }}
        pixelDensity={1}
        fov={45}
      >
        <ShaderGradient
          animate={shouldAnimate ? "on" : "off"}
          brightness={1}
          cAzimuthAngle={180}
          cDistance={2.93}
          cPolarAngle={80}
          cameraZoom={9.1}
          color1="#606080"
          color2="#ffcd87"
          color3="#212121"
          envPreset="city"
          grain="on"
          lightType="3d"
          positionX={0}
          positionY={0}
          positionZ={0}
          range="disabled"
          rangeEnd={40}
          rangeStart={0}
          reflection={0.1}
          rotationX={50}
          rotationY={0}
          rotationZ={-60}
          shader="defaults"
          type="waterPlane"
          uAmplitude={0}
          uDensity={1.5}
          uFrequency={0}
          uSpeed={0.1}
          uStrength={1.5}
          uTime={8}
          wireframe={false}
        />
      </ShaderGradientCanvas>
    </div>
  );
}
