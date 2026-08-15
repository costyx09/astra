import type { AuctionState } from "@/types/auction";
import type { Player } from "@/types/player";
import { suggestNextCalls } from "@/lib/engine/suggestion-engine";
import { computeRepartoFit } from "@/lib/engine/department-plan-engine";
import { getActiveDepartment } from "@/lib/engine/reparto-intelligence-engine";

const TIER_LABEL: Record<string, string> = { top: "Top", semi_top: "Semi-top", titolare: "Titolare", scommessa: "Scommessa" };

export function NextCallCard({
  auctionState,
  players,
  onSelect,
}: {
  auctionState: AuctionState;
  players: Player[];
  onSelect: (player: Player) => void;
}) {
  const [top] = suggestNextCalls(auctionState, players, 1);
  if (!top) return null;

  // Riuso il Reparto Fit già calcolato altrove solo per leggere la fascia
  // del giocatore suggerito — nessuna nuova logica, solo lettura.
  const activeRole = getActiveDepartment(auctionState);
  const fit = computeRepartoFit(auctionState, players, activeRole).find((f) => f.player.id === top.player.id);

  return (
    <button
      onClick={() => onSelect(top.player)}
      className="card-primary animate-fade-in flex w-full items-center gap-3 border-l-4 p-3 text-left transition-opacity hover:opacity-90"
      style={{ borderLeftColor: "var(--color-brand)" }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--color-brand)" }}>
            Prossima chiamata
          </span>
          {fit && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--color-brand-soft)", color: "var(--color-brand-strong)" }}>
              {TIER_LABEL[fit.tier]}
            </span>
          )}
        </div>
        <div className="truncate text-base font-semibold">{top.player.name}</div>
        <div className="truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
          {top.reason}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-tabular text-lg font-semibold" style={{ color: "var(--color-rilancia)" }}>
          {top.dynamicSuggestedPrice}
        </div>
        <div className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
          crediti
        </div>
      </div>
    </button>
  );
}
