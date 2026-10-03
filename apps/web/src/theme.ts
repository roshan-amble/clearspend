import { useEffect, useState } from "react";

/** The POC's 2 themes. Dark is the default (Roshan, 2026-09-30); gray is the light option. No pure white. */
export type Theme = "dark" | "gray";

export function storedTheme(): Theme {
  try {
    return localStorage.getItem("cs-theme") === "gray" ? "gray" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.csTheme = theme;
  try {
    localStorage.setItem("cs-theme", theme);
  } catch {
    // Private windows can refuse storage. The theme still applies for this visit.
  }
  window.dispatchEvent(new Event("cs-theme"));
}

/** Re-renders when the theme changes, so charts can read the new tokens. */
export function useThemeTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((value) => value + 1);
    window.addEventListener("cs-theme", onChange);
    return () => window.removeEventListener("cs-theme", onChange);
  }, []);
  return tick;
}
