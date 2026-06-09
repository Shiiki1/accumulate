"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    const stored = window.localStorage.getItem("accumulate.theme");
    return stored === "light" ? "light" : "dark";
  });

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("accumulate.theme", nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="grid size-9 shrink-0 place-items-center border border-[var(--line)] text-[var(--muted)] transition hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
