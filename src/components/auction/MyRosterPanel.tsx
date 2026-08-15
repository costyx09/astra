import type { AuctionState } from "@/types/auction";
import type { Player, Role } from "@/types/player";
import { getMyTeam, slotsFree } from "@/lib/engine/auction-context";

const ROLE_ORDER: Role[] = ["P", "D", "C", "A"];
const ROLE_LABEL: Record<Role, string> = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };

export function MyRosterPanel({ auctionState, players }: { auctionState: AuctionState; players: Player[] }) {
  const myTeam = getMyTeam(auctionState);
  const playerById = new Map(players.map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-5 px-4 py-6">
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Crediti residui
          </span>
          <span className="font-tabular text-2xl font-semibold" style={{ color: "var(--color-brand)" }}>
            {myTeam.budget.creditiResidui}
          </span>
        </div>
      </div>

      {ROLE_ORDER.map((role) => {
        const slots = myTeam.roster.filter((s) => s.role === role);
        const free = slotsFree(auctionState, myTeam, role);

        return (
          <div key={role}>
            <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--color-text-muted)" }}>
              {ROLE_LABEL[role]} · {slots.length}/{slots.length + free}
            </h3>

            {slots.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Nessun giocatore ancora acquistato in questo ruolo.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {slots.map((slot) => {
                  const player = playerById.get(slot.playerId);
                  const suggested = player?.pricing.suggestedPrice ?? slot.pricePaid;
                  const delta = slot.pricePaid - suggested;
                  const deltaColor =
                    delta > 0 ? "var(--color-non-rilanciare)" : delta < 0 ? "var(--color-rilancia)" : "var(--color-text-muted)";

                  return (
                    <div
                      key={slot.playerId}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                      style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)" }}
                    >
                      <div>
                        <div className="text-sm font-medium">{player?.name ?? slot.playerId}</div>
                        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          Indice {player?.scores.astraIndex ?? "—"} · consigliato {suggested}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-tabular text-sm font-semibold">{slot.pricePaid} cr</div>
                        <div className="font-tabular text-xs" style={{ color: deltaColor }}>
                          {delta > 0 ? `+${delta}` : delta}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
