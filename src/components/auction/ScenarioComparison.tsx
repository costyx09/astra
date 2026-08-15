"use client";

import { useState } from "react";
import type { Player } from "@/types/player";
import type { AuctionState } from "@/types/auction";
import { compareBuyVsPass, type ComparisonResult } from "@/lib/engine/simulator";
import type { SimulationTrigger } from "@/lib/engine/simulation-trigger";

export function ScenarioComparison({
  auctionState,
  players,
  player,
  currentBid,
  trigger,
}: {
  auctionState: AuctionState;
  players: Player[];
  player: Player;
  currentBid: number;
  trigger: SimulationTrigger;
}) {
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  function run() {
    setLoading(true);
    // Rimandato di un tick per lasciar disegnare lo stato di caricamento
    // prima del calcolo (sincrono, può richiedere qualche centinaio di ms —
    // dettaglio tecnico volutamente non esposto nella UI).
    setTimeout(() => {
      const r = compareBuyVsPass(auctionState, players, player, currentBid);
      setResult(r);
      setLoading(false);
    }, 30);
  }

  if (!result) {
    return (
      <div className="card-secondary animate-fade-in flex flex-col items-center gap-2 p-3">
        <span className="text-xs font-semibold" style={{ color: "var(--color-aspetta)" }}>
          ⚖️ Decisione equilibrata
        </span>
        <button
          onClick={run}
          disabled={loading}
          className="touch-target rounded-lg px-5 text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--color-brand)", color: "#0b0e14" }}
        >
          {loading ? "Confronto in corso…" : "🎲 Confronta scenari"}
        </button>
        <span className="text-center text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          {trigger.reason}
        </span>
      </div>
    );
  }

  const { scenarioCompro, scenarioLascio, raccomandazione, deltaTop3, pianoNota, spiegazione } = result;
  const winnerColor = raccomandazione === "COMPRA" ? "var(--color-rilancia)" : "var(--color-aspetta)";

  return (
    <div className="card-primary animate-pop-in p-4" style={{ backgroundColor: "var(--color-surface-raised)" }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">Confronto Astra</span>
        <button onClick={() => setResult(null)} className="touch-target text-xs" style={{ color: "var(--color-text-muted)" }}>
          Rifai
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <ScenarioCard title="COMPRO" data={scenarioCompro} highlight={raccomandazione === "COMPRA"} />
        <span className="text-xs font-bold" style={{ color: "var(--color-text-faint)" }}>
          VS
        </span>
        <ScenarioCard title="LASCIO" data={scenarioLascio} highlight={raccomandazione === "LASCIA"} />
      </div>

      <p className="mt-3 text-center font-tabular text-xs" style={{ color: "var(--color-text-muted)" }}>
        Δ probabilità Top 3: <span className="font-semibold" style={{ color: "var(--color-text)" }}>{deltaTop3 > 0 ? "+" : ""}{deltaTop3}%</span>
      </p>

      <div className="mt-3 rounded-xl border-2 p-3 text-center" style={{ borderColor: winnerColor, backgroundColor: `${winnerColor}1a` }}>
        <p className="text-base font-bold" style={{ color: winnerColor }}>
          {raccomandazione === "COMPRA" ? "🟢 CONVIENE COMPRARE" : "🟡 CONVIENE LASCIARE"}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--color-text)" }}>
          {spiegazione}
        </p>
        {pianoNota && (
          <p className="mt-1 text-xs" style={{ color: "var(--color-brand-strong)" }}>
            🧩 {pianoNota}
          </p>
        )}
      </div>

      <p className="mt-3 text-center text-[11px]" style={{ color: "var(--color-text-faint)" }}>
        Simulazione euristica, non una previsione certa — non sovrascrive un eventuale hard stop del Decision Engine.
      </p>
    </div>
  );
}

function ScenarioCard({
  title,
  data,
  highlight,
}: {
  title: string;
  data: ComparisonResult["scenarioCompro"];
  highlight: boolean;
}) {
  return (
    <div
      className="rounded-xl border-2 p-3 transition-colors duration-300"
      style={{
        borderColor: highlight ? "var(--color-brand)" : "var(--color-border)",
        backgroundColor: highlight ? "var(--color-brand-soft)" : "var(--color-surface)",
      }}
    >
      <div className="text-[11px] font-bold tracking-wide" style={{ color: highlight ? "var(--color-brand-strong)" : "var(--color-text-muted)" }}>
        {title} {highlight && "✓"}
      </div>
      <div className="mt-1 font-tabular text-2xl font-bold">{Math.round(data.probabilitaTop3 * 100)}%</div>
      <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
        Top 3
      </div>
      <div className="mt-2 flex flex-col gap-0.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        <div>
          Posizione: <span className="font-tabular font-semibold" style={{ color: "var(--color-text)" }}>{data.posizioneMediaSu8}°</span>
        </div>
        <div>
          Forza rosa: <span className="font-tabular font-semibold" style={{ color: "var(--color-text)" }}>{data.rosterPowerAtteso}</span>
        </div>
        <div style={{ color: data.probabilitaRosaIncompleta > 0.1 ? "var(--color-non-rilanciare)" : "var(--color-text-muted)" }}>
          Rosa incompleta: <span className="font-tabular font-semibold">{Math.round(data.probabilitaRosaIncompleta * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
