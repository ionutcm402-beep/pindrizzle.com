"use client";

import { useEffect, useState } from "react";
import { readAnalyticsChoice, saveAnalyticsChoice, type AnalyticsChoice } from "@/components/Phase22StorageChoice";

export default function AnalyticsStorageControls() {
  const [choice, setChoice] = useState<AnalyticsChoice | null>(null);

  useEffect(() => {
    setChoice(readAnalyticsChoice());
    const onChoice = (event: Event) => {
      const next = (event as CustomEvent<{ choice?: AnalyticsChoice }>).detail?.choice;
      if (next === "allow" || next === "necessary") setChoice(next);
    };
    window.addEventListener("ping:analytics-choice", onChoice as EventListener);
    return () => window.removeEventListener("ping:analytics-choice", onChoice as EventListener);
  }, []);

  const choose = (next: AnalyticsChoice) => {
    saveAnalyticsChoice(next);
    setChoice(next);
  };

  return (
    <section className="legal-card legal-callout">
      <h2>Your analytics choice</h2>
      <p>Optional product analytics is off unless you choose Allow analytics. Necessary storage continues because Pindrizzle needs it for sign-in, security and preferences.</p>
      <div className="legal-choice-row" role="group" aria-label="Analytics choice">
        <button type="button" className={choice === "necessary" ? "selected" : ""} aria-pressed={choice === "necessary"} onClick={() => choose("necessary")}>Only necessary</button>
        <button type="button" className={choice === "allow" ? "allow" : ""} aria-pressed={choice === "allow"} onClick={() => choose("allow")}>Allow analytics</button>
      </div>
      <div className="legal-status" role="status" aria-live="polite">
        {choice === "allow" ? "Optional product analytics is allowed on this browser." : choice === "necessary" ? "Only necessary browser storage is enabled." : "No analytics choice is saved yet. Optional analytics remains off."}
      </div>
    </section>
  );
}
