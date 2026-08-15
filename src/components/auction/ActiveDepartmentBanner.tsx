import type { AuctionState } from "@/types/auction";
import type { Role } from "@/types/player";
import { getMyTeam, slotsFree } from "@/lib/engine/auction-context";

const ROLE_LABEL: Record<Role, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };
const ROLE_ICON: Record<Role, string> = { P: "🧤", D: "🛡️", C: "⚙️", A: "🎯" };

export function ActiveDepartmentBanner({ auctionState, activeRole }: { auctionState: AuctionState; activeRole: Role }) {
  const myTeam = getMyTeam(auctionState);
  const mancanti = slotsFree(auctionState, myTeam, activeRole);
  const totale = auctionState.roleTargets[activeRole];
  const completati = totale - mancanti;

  return (
    // key={activeRole} riattiva l'animazione di comparsa ad ogni cambio
    // reparto, così il passaggio P→D→C→A è impossibile da non notare.
    <div
      key={activeRole}
      className="animate-fade-in flex items-center justify-between rounded-xl px-3 py-2"
      style={{ backgroundColor: "var(--color-brand-soft)", border: "1px solid var(--color-brand)" }}
    >
      <span className="flex items-center gap-2 text-sm font-bold tracking-wide" style={{ color: "var(--color-brand-strong)" }}>
        <span>{ROLE_ICON[activeRole]}</span>
        {ROLE_LABEL[activeRole].toUpperCase()}
      </span>
      <span className="font-tabular text-xs" style={{ color: "var(--color-text-muted)" }}>
        Reparto attivo · {completati}/{totale} completati
      </span>
    </div>
  );
}
