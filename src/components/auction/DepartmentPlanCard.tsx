import type { DepartmentCompletion, DepartmentPlan, NextObjective, RepartoFitResult, Tier } from "@/types/department-plan";

const TIER_LABEL: Record<Tier, string> = { top: "Top", semi_top: "Semi-top", titolare: "Titolare", scommessa: "Scommessa" };
const TIER_ORDER: Tier[] = ["top", "semi_top", "titolare", "scommessa"];

export function DepartmentPlanCard({
  plan,
  objective,
  bestFit,
  completion,
}: {
  plan: DepartmentPlan;
  objective: NextObjective | null;
  bestFit: RepartoFitResult | null;
  completion: DepartmentCompletion | null;
}) {
  if (completion) {
    return (
      <div className="card-primary animate-pop-in border-2 p-4" style={{ borderColor: "var(--color-rilancia)", backgroundColor: "var(--color-rilancia-soft)" }}>
        <div className="text-sm font-semibold" style={{ color: "var(--color-rilancia)" }}>
          ✓ Reparto completato
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Forza reparto" value={`${completion.forzaReparto}/100`} />
          <MiniStat label="Investimento" value={`${completion.investimentoTotale} cr`} />
          <MiniStat label="Efficienza" value={`${completion.efficienza}%`} />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-text)" }}>
          {completion.valutazione}
        </p>
      </div>
    );
  }

  return (
    <div className="card-primary p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
          Piano reparto
        </span>
        <span className="font-tabular text-sm" style={{ color: "var(--color-text-muted)" }}>
          {plan.spesoNelReparto} cr spesi · {plan.budgetDisponibile} cr residui
        </span>
      </div>

      {objective && (
        <div className="mb-3 rounded-lg px-3 py-2" style={{ backgroundColor: "var(--color-brand-soft)" }}>
          <div className="text-xs font-semibold" style={{ color: "var(--color-brand)" }}>
            🎯 {objective.title}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text)" }}>
            {objective.message}
          </p>
        </div>
      )}

      <div className="mb-3">
        <div className="mb-1.5 text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
          🧩 Profilo (ipotesi, non un vincolo)
        </div>
        <div className="flex flex-col gap-1.5">
          {TIER_ORDER.filter((t) => plan.achieved[t] > 0 || plan.remainingTarget[t] > 0).map((tier) => {
            const totale = plan.achieved[tier] + plan.remainingTarget[tier];
            const icon = plan.remainingTarget[tier] === 0 ? "✓" : plan.achieved[tier] > 0 ? "→" : "○";
            const color = plan.remainingTarget[tier] === 0 ? "var(--color-rilancia)" : plan.achieved[tier] > 0 ? "var(--color-aspetta)" : "var(--color-text-faint)";
            return (
              <div key={tier} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-center font-bold" style={{ color }}>
                  {icon}
                </span>
                <span style={{ color: "var(--color-text)" }}>
                  {totale} {TIER_LABEL[tier]}
                </span>
                <span className="font-tabular text-[11px]" style={{ color: "var(--color-text-faint)" }}>
                  ({plan.achieved[tier]}/{totale})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {bestFit && (
        <div className="card-secondary px-3 py-2">
          <div className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
            ⭐ Miglior fit: {bestFit.player.name}
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {bestFit.reason}
          </p>
        </div>
      )}

      {plan.crossDepartmentNote && (
        <p className="mt-3 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          💡 {plan.crossDepartmentNote}
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-tabular text-sm font-semibold">{value}</div>
      <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}
