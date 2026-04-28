"use client";

import { memo, useEffect, useState } from "react";

function OnboardingToastInner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem("de_onboarded");
    if (onboarded === "true") {
      setDismissed(true);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed) return null;

  return (
    <aside
      className={`fixed bottom-4 left-4 z-50 w-[calc(100%-32px)] max-w-[320px] rounded-2xl p-5 transition-all duration-300 sm:bottom-6 sm:left-auto sm:right-6 sm:w-full ${
        visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
      style={{
        background:
          "linear-gradient(165deg, rgba(255,255,255,0.03), rgba(255,255,255,0) 50%), var(--bg-surface)",
        border: "1px solid rgba(99,102,241,0.3)",
        boxShadow: "0 16px 36px rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
      }}
      aria-label="First visit onboarding"
    >
      <h3 className="text-base font-semibold text-[var(--text-primary)]">How this works</h3>
      <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
        <li className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent-light)]" aria-hidden />
          <span>Your business data is analyzed automatically</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 rounded-full bg-[var(--positive)]" aria-hidden />
          <span>Problems are detected using business rules</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 rounded-full bg-[var(--warning)]" aria-hidden />
          <span>Actions are suggested to fix each problem</span>
        </li>
      </ul>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem("de_onboarded", "true");
          setVisible(false);
          window.setTimeout(() => setDismissed(true), 280);
        }}
        className="mt-4 rounded-lg border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.08)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-light)]"
      >
        Got it
      </button>
    </aside>
  );
}

export const OnboardingToast = memo(OnboardingToastInner);
