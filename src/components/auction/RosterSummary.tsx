import type { AuctionState } from "@/types/auction";
import type { Role } from "@/types/player";
import { getMyTeam, slotsFree } from "@/lib/engine/auction-context";

const ROLE_ORDER: Role[] = ["P", "D", "C", "A"];

export function RosterSummary({ auctionState }: { auctionState: AuctionState }) {
  const myTeam = getMyTeam(auctionState);

  return (
    <div
      className="card-secondary flex items-center justify-between gap-4 px-4 py-2.5"
    >
      <div>
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Crediti residui
        </div>
        <div className="font-tabular text-2xl font-semibold" style={{ color: "var(--color-brand)" }}>
          {myTeam.budget.creditiResidui}
        </div>
      </div>

      <div className="flex gap-3">
        {ROLE_ORDER.map((role) => {
          const free = slotsFree(auctionState, myTeam, role);
          return (
            <div key={role} className="text-center">
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {role}
              </div>
              <div
                className="font-tabular text-lg font-semibold"
                style={{ color: free > 0 ? "var(--color-text)" : "var(--color-text-muted)" }}
              >
                {free}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
