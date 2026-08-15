import type { Verdict } from "@/types/decision";

const VERDICT_LABEL: Record<Verdict, string> = {
  RILANCIA: "RILANCIA",
  NON_RILANCIARE: "NON RILANCIARE",
  ASPETTA: "ASPETTA",
};

const VERDICT_ICON: Record<Verdict, string> = {
  RILANCIA: "▲",
  NON_RILANCIARE: "✕",
  ASPETTA: "◆",
};

const VERDICT_STYLE: Record<Verdict, { bg: string; fg: string; border: string }> = {
  RILANCIA: { bg: "var(--color-rilancia-soft)", fg: "var(--color-rilancia-strong)", border: "var(--color-rilancia)" },
  NON_RILANCIARE: {
    bg: "var(--color-non-rilanciare-soft)",
    fg: "var(--color-non-rilanciare-strong)",
    border: "var(--color-non-rilanciare)",
  },
  ASPETTA: { bg: "var(--color-aspetta-soft)", fg: "var(--color-aspetta-strong)", border: "var(--color-aspetta)" },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const style = VERDICT_STYLE[verdict];
  return (
    // key={verdict} forza un remount ad ogni cambio verdetto, così
    // l'animazione di comparsa si ri-attiva ogni volta — è il segnale più
    // importante di tutta la UI, deve essere impossibile non notarlo.
    <div
      key={verdict}
      className="animate-pop-in w-full rounded-2xl border-2 px-6 py-7 text-center"
      style={{ backgroundColor: style.bg, borderColor: style.border, boxShadow: "var(--shadow-card)" }}
    >
      <span className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: style.fg }}>
        {VERDICT_ICON[verdict]} {VERDICT_LABEL[verdict]}
      </span>
    </div>
  );
}
