import type { Badge, RankedAvailablePlayer } from "@/types/reparto";

const BADGE_LABEL: Record<Badge, string> = {
  occasione: "🔥 Occasione",
  top: "⭐ Top",
  sottovalutato: "💎 Sottovalutato",
  rischioso: "⚠️ Rischioso",
};

export function DepartmentPlayerList({ ranked }: { ranked: RankedAvailablePlayer[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {ranked.map((r) => (
        <div
          key={r.player.id}
          className="card-secondary px-3 py-2"
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">{r.player.name}</div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {r.player.team} · indice {r.player.scores.astraIndex}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-tabular text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
                {r.dynamicSuggestedPrice} cr
              </div>
              <div className="font-tabular text-xs" style={{ color: "var(--color-text-muted)" }}>
                max {r.dynamicMaxPrice} · sopra prezzo {Math.round(r.probabilitaSopraPrezzo * 100)}%
              </div>
            </div>
          </div>
          {r.badges.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {r.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={{ backgroundColor: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}
                >
                  {BADGE_LABEL[b]}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      {ranked.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Nessun giocatore rimasto in questo reparto.
        </p>
      )}
    </div>
  );
}
