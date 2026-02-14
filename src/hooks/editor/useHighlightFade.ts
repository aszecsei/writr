"use client";

import { useEffect, useRef, useState } from "react";

const FADE_DELAY_MS = 2000;

export function useHighlightFade(isHighlighted: boolean | undefined) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [showHighlight, setShowHighlight] = useState(!!isHighlighted);

  useEffect(() => {
    if (!isHighlighted) {
      setShowHighlight(false);
      return;
    }

    setShowHighlight(true);

    if (elementRef.current) {
      elementRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    const timer = setTimeout(() => {
      setShowHighlight(false);
    }, FADE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isHighlighted]);

  return { elementRef, showHighlight };
}
