import type { Opportunity } from "@/types/reparto";

export function DepartmentOpportunities({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {opportunities.map((o, i) => (
        <div
          key={`${o.playerId ?? "generic"}-${i}`}
          className="animate-pop-in rounded-xl border-2 px-4 py-3"
          style={{
            borderColor: o.kind === "occasione" ? "var(--color-rilancia)" : "var(--color-aspetta)",
            backgroundColor: o.kind === "occasione" ? "var(--color-rilancia-soft)" : "var(--color-aspetta-soft)",
          }}
        >
          <div className="text-sm font-semibold" style={{ color: o.kind === "occasione" ? "var(--color-rilancia)" : "var(--color-aspetta)" }}>
            {o.title}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text)" }}>
            {o.message}
          </p>
        </div>
      ))}
    </div>
  );
}
