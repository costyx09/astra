import type { PlayerCompetitionContext } from "@/types/league";

const THREAT_STYLE: Record<string, { fg: string; bg: string }> = {
  ALTA: { fg: "var(--color-non-rilanciare)", bg: "var(--color-non-rilanciare-soft)" },
  MEDIA: { fg: "var(--color-aspetta)", bg: "var(--color-aspetta-soft)" },
  BASSA: { fg: "var(--color-text-muted)", bg: "var(--color-surface-overlay)" },
};

export function CompetitorPanel({ context, totalAvversari }: { context: PlayerCompetitionContext; totalAvversari: number }) {
  const { competitorsReali, threatRanking, insights } = context;

  // Niente da mostrare: nessun competitor reale e nessun insight — non
  // riempire la UI con una sezione vuota (filosofia "niente rumore").
  if (competitorsReali.length === 0 && insights.length === 0) return null;

  return (
    <div className="card-secondary p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
          👥 Competitor
        </span>
        <span className="font-tabular text-xs font-semibold">
          {competitorsReali.length}/{totalAvversari}
        </span>
      </div>

      {threatRanking.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {threatRanking.map((t) => {
            const style = THREAT_STYLE[t.level];
            return (
              <div key={t.teamId} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ backgroundColor: style.bg }}>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: style.fg }}>
                  {t.level}
                </span>
                <span className="text-[11px]" style={{ color: "var(--color-text)" }}>
                  <span className="font-semibold">{t.teamName}</span> — {t.reason}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {insights.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 border-t pt-2" style={{ borderColor: "var(--color-border)" }}>
          {insights.map((insight, i) => (
            <div key={i} className="text-[11px]" style={{ color: "var(--color-info)" }}>
              {insight.emoji} {insight.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
