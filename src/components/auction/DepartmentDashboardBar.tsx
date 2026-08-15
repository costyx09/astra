import type { DepartmentDashboard as Dashboard } from "@/types/reparto";

const ROLE_LABEL: Record<string, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };

export function DepartmentDashboardBar({ dashboard }: { dashboard: Dashboard }) {
  return (
    <div className="card-primary p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
          Reparto attivo: {ROLE_LABEL[dashboard.role]}
        </span>
        <span className="font-tabular text-lg font-semibold">
          {dashboard.giocatoriAcquistati}/{dashboard.giocatoriAcquistati + dashboard.giocatoriMancanti}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
        <Stat label="Qualità media" value={dashboard.qualitaMediaReparto !== null ? Math.round(dashboard.qualitaMediaReparto) : "—"} />
        <Stat label="Top rimasti" value={dashboard.topRimasti} />
        <Stat label="Inflazione" value={`${dashboard.inflazioneReparto}×`} />
        <Stat label="Budget" value={dashboard.budgetDisponibile} />
        <Stat label="Rif. spesa/slot" value={dashboard.spesaMediaConsigliata || "—"} />
        <Stat label="Slot liberi" value={dashboard.giocatoriMancanti} />
      </div>
      <p className="mt-3 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        Il riferimento di spesa è solo indicativo, non un vincolo: spendi quanto conviene davvero.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
      <div className="font-tabular text-sm font-semibold">{value}</div>
    </div>
  );
}
