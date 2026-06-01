import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function isMatchMediaAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/**
 * Hook to detect if the user prefers reduced motion.
 * Returns true if the user has set prefers-reduced-motion: reduce in their OS settings.
 */
export function useReducedMotion(defaultValue: boolean = false): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (!isMatchMediaAvailable()) return defaultValue;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (!isMatchMediaAvailable()) return;

    const mediaQueryList = window.matchMedia(QUERY);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQueryList.addEventListener("change", handleChange);

    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
