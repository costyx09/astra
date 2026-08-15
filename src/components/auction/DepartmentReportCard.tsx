import type { DepartmentReport } from "@/types/reparto";

export function DepartmentReportCard({ report }: { report: DepartmentReport }) {
  return (
    <div className="card-primary p-4">
      <p className="text-sm leading-relaxed">{report.narrative}</p>

      {report.giocatoriAcquistati > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Titolari affidabili" value={report.titolariAffidabili} />
          <MiniStat label="Rischiosi" value={report.rischiosi} />
          <MiniStat label="Bonus medio" value={report.bonusMedia !== null ? Math.round(report.bonusMedia) : "—"} />
        </div>
      )}

      {report.gaps.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5">
          {report.gaps.map((gap) => (
            <div
              key={gap.type}
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                backgroundColor: gap.severity === "warning" ? "var(--color-aspetta-soft)" : "var(--color-surface-raised)",
                color: gap.severity === "warning" ? "var(--color-aspetta)" : "var(--color-text-muted)",
              }}
            >
              {gap.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="font-tabular text-base font-semibold">{value}</div>
      <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}
