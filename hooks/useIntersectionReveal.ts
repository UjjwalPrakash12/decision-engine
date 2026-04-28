"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

export type UseIntersectionRevealOptions = IntersectionObserverInit;

const DEFAULT_OPTIONS: IntersectionObserverInit = {
  rootMargin: "0px 0px -6% 0px",
  threshold: 0.12,
};

/**
 * Observes `ref` and flips `isVisible` to true once the element enters the viewport.
 * Stops observing after the first intersection to avoid extra work.
 */
export function useIntersectionReveal<T extends Element = HTMLDivElement>(
  options: UseIntersectionRevealOptions = DEFAULT_OPTIONS,
): { ref: RefObject<T | null>; isVisible: boolean } {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || isVisible) return;

    const obs = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setIsVisible(true);
        obs.unobserve(el);
      }
    }, options);

    obs.observe(el);
    return () => obs.disconnect();
  }, [isVisible, options]);

  return { ref, isVisible };
}
