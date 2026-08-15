"use client";

import { useState } from "react";
import { useAuction } from "@/lib/state/auction-store";

const DEFAULT_OPPONENTS = Array.from({ length: 7 }, (_, i) => `Avversario ${i + 1}`);

export function SetupScreen() {
  const { initializeAuction } = useAuction();
  const [names, setNames] = useState<string[]>(DEFAULT_OPPONENTS);

  function updateName(index: number, value: string) {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--color-brand)" }}>
          Astra
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Lega Classic — 8 squadre, 500 crediti. Inserisci i nomi dei 7 avversari per iniziare.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {names.map((name, i) => (
          <input
            key={i}
            value={name}
            onChange={(e) => updateName(i, e.target.value)}
            placeholder={`Avversario ${i + 1}`}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        ))}
      </div>

      <button
        onClick={() => initializeAuction(names)}
        className="rounded-lg px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--color-brand)", color: "#0b0e14" }}
      >
        Inizia l&apos;asta
      </button>
    </div>
  );
}
