/**
 * Global keyframe definitions (injected once in root layout).
 * Use {@link animations} for `animation` shorthand values on elements.
 */
export const animationKeyframes = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translate3d(0, 14px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes fadeInLeft {
  from {
    opacity: 0;
    transform: translate3d(-16px, 0, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translate3d(0, -8px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.35);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(212, 175, 55, 0);
  }
}

@keyframes skeletonShimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
`.trim();

/** Ready-to-use `animation` CSS values (names match @keyframes above). */
export const animations = {
  fadeInUp: "fadeInUp 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards",
  fadeInLeft: "fadeInLeft 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards",
  slideDown: "slideDown 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards",
  pulseGlow: "pulseGlow 2.2s ease-in-out infinite",
  skeletonShimmer: "skeletonShimmer 1.2s ease-in-out infinite",
} as const;
