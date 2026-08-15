"use client";

import { useMemo, useState } from "react";
import type { Player } from "@/types/player";
import type { AuctionState } from "@/types/auction";
import { computeLiveDecisionContext } from "@/lib/engine/live-decision-context";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { PriceScale } from "@/components/ui/PriceScale";
import { Disclosure } from "@/components/ui/Disclosure";
import { ScenarioComparison } from "./ScenarioComparison";
import { CompetitorPanel } from "./CompetitorPanel";

const SUB_INDEX_LABEL: Record<string, string> = {
  subIndexTitolarita: "Titolarità",
  subIndexBonus: "Bonus",
  subIndexAffidabilita: "Affidabilità",
};

export function DecisionPanel({
  player,
  players,
  auctionState,
  onConfirmPurchase,
  onCancel,
}: {
  player: Player;
  players: Player[];
  auctionState: AuctionState;
  onConfirmPurchase: (params: { buyerId: string; price: number }) => void;
  onCancel: () => void;
}) {
  const [currentBid, setCurrentBid] = useState<number>(player.pricing.suggestedPrice);
  const [buyerId, setBuyerId] = useState<string>("me");

  // Un'unica chiamata: tutto il pannello legge lo stesso snapshot, niente
  // ricalcoli indipendenti degli stessi segnali (vedi live-decision-context.ts).
  const ctx = useMemo(
    () => computeLiveDecisionContext(auctionState, players, player, currentBid),
    [auctionState, players, player, currentBid]
  );
  const { decision, dynamicPricing, trigger, competitionContext, nextObjective } = ctx;

  const staticPrice = player.pricing.suggestedPrice;
  const dynamicPrice = dynamicPricing.dynamicSuggestedPrice;
  const variazionePct = staticPrice > 0 ? Math.round(((dynamicPrice - staticPrice) / staticPrice) * 100) : 0;
  const confidencePct = Math.round(player.scores.confidence * 100);
  const confidenceColor = confidencePct >= 75 ? "var(--color-rilancia)" : confidencePct >= 50 ? "var(--color-aspetta)" : "var(--color-non-rilanciare)";

  function nudgeBid(delta: number) {
    setCurrentBid((v) => Math.max(1, v + delta));
  }

  return (
    <div className="card-primary animate-pop-in flex w-full flex-col gap-4 p-4">
      {/* Header: giocatore + azione di uscita */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold leading-tight">{player.name}</h2>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {player.team} · {player.role}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="touch-target text-sm underline-offset-2 hover:underline"
          style={{ color: "var(--color-text-muted)" }}
        >
          Annulla
        </button>
      </div>

      {/* Bid — grande, con stepper per uso touch senza tastiera */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => nudgeBid(-1)}
          className="touch-target rounded-lg text-lg font-semibold"
          style={{ backgroundColor: "var(--color-surface-raised)", color: "var(--color-text)" }}
        >
          −
        </button>
        <input
          type="number"
          value={currentBid}
          onChange={(e) => setCurrentBid(Number(e.target.value) || 0)}
          className="w-28 rounded-lg border px-3 py-3 text-center font-tabular text-2xl font-bold outline-none focus:ring-2"
          style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border-strong)", color: "var(--color-text)" }}
        />
        <button
          onClick={() => nudgeBid(1)}
          className="touch-target rounded-lg text-lg font-semibold"
          style={{ backgroundColor: "var(--color-surface-raised)", color: "var(--color-text)" }}
        >
          +
        </button>
      </div>

      {/* 1. VERDETTO — sempre l'elemento dominante */}
      <VerdictBadge verdict={decision.verdict} />
      <p className="-mt-2 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
        {decision.reason}
      </p>

      {/* 2. Dove mi trovo rispetto a consigliato/massimo — a colpo d'occhio, non tre numeri da confrontare a mente */}
      <div className="card-secondary p-3">
        <PriceScale currentBid={currentBid} suggested={dynamicPrice} max={dynamicPricing.dynamicMaxPrice} />
      </div>

      {/* 3. Informazioni essenziali, sempre visibili */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <EssentialStat label="Consigliato" value={dynamicPrice} />
        <EssentialStat label="Massimo" value={dynamicPricing.dynamicMaxPrice} />
        <EssentialStat
          label="Movimento mercato"
          value={`${variazionePct >= 0 ? "↑" : "↓"} ${variazionePct >= 0 ? "+" : ""}${variazionePct}%`}
          color={variazionePct > 5 ? "var(--color-non-rilanciare)" : variazionePct < -5 ? "var(--color-rilancia)" : "var(--color-info)"}
        />
        <EssentialStat label="Confidence" value={`${confidencePct}%`} color={confidenceColor} />
      </div>

      {nextObjective && (
        <div className="card-secondary flex items-start gap-2 border-l-2 p-3" style={{ borderLeftColor: "var(--color-brand)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--color-brand)" }}>
            Piano
          </span>
          <span className="text-xs" style={{ color: "var(--color-text)" }}>
            {nextObjective.title}
          </span>
        </div>
      )}

      {competitionContext && (
        <div className="flex items-center justify-between text-xs" style={{ color: "var(--color-text-muted)" }}>
          <span>
            Competizione:{" "}
            <span className="font-tabular font-semibold" style={{ color: "var(--color-text)" }}>
              {competitionContext.competitorsReali.length}/{auctionState.teams.length - 1}
            </span>{" "}
            possono permetterselo
          </span>
        </div>
      )}

      {/* 4. Dettagli secondari — progressive disclosure, mai sopra il verdetto */}
      <Disclosure label="Dettagli">
        {competitionContext && <CompetitorPanel context={competitionContext} totalAvversari={auctionState.teams.length - 1} />}

        <div className="flex flex-col gap-2">
          {(["subIndexTitolarita", "subIndexBonus", "subIndexAffidabilita"] as const).map((key) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-24 text-xs" style={{ color: "var(--color-text-muted)" }}>
                {SUB_INDEX_LABEL[key]}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${player.scores[key]}%`, backgroundColor: "var(--color-brand)" }}
                />
              </div>
              <span className="w-8 text-right font-tabular text-xs">{player.scores[key]}</span>
            </div>
          ))}
        </div>

        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {player.explanationShort}
        </p>

        <p className="text-[11px]" style={{ color: "var(--color-text-faint)" }}>
          Il massimo è dinamico: tiene conto di quanti avversari potrebbero ancora superarti a questo prezzo, per questo si sposta leggermente col rilancio.
        </p>
      </Disclosure>

      {/* 5. Monte Carlo — solo nei casi ambigui, mai invadente */}
      {trigger.shouldSimulate && (
        <ScenarioComparison auctionState={auctionState} players={players} player={player} currentBid={currentBid} trigger={trigger} />
      )}

      {/* Azione — sempre visibile, in fondo */}
      <div className="card-secondary mt-1 flex flex-wrap items-center gap-2 p-3">
        <select
          value={buyerId}
          onChange={(e) => setBuyerId(e.target.value)}
          className="touch-target rounded-lg border px-2 text-sm"
          style={{ backgroundColor: "var(--color-surface-overlay)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        >
          {auctionState.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => onConfirmPurchase({ buyerId, price: currentBid })}
          className="touch-target ml-auto rounded-lg px-5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--color-brand)", color: "#0b0e14" }}
        >
          Registra acquisto a {currentBid}
        </button>
      </div>
    </div>
  );
}

function EssentialStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="card-secondary p-2.5 text-center">
      <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
      <div className="font-tabular text-base font-semibold transition-colors duration-300" style={{ color: color ?? "var(--color-text)" }}>
        {value}
      </div>
    </div>
  );
}
