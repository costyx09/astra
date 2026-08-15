import type { AuctionState } from "@/types/auction";
import type { Player, Role } from "@/types/player";
import { computeLeagueStatus } from "@/lib/engine/league-intelligence-engine";
import { computeTeamStatus } from "@/lib/state/team-status";

const ROLE_ORDER: Role[] = ["P", "D", "C", "A"];
const PRESSURE_COLOR: Record<string, string> = {
  tranquilla: "var(--color-rilancia)",
  moderata: "var(--color-aspetta)",
  forte: "var(--color-non-rilanciare)",
};

export function TeamsDashboard({ auctionState, players }: { auctionState: AuctionState; players: Player[] }) {
  const leagueStatus = computeLeagueStatus(auctionState, players);
  const statusByTeamId = new Map(leagueStatus.map((s) => [s.teamId, s]));

  return (
    <div className="flex flex-col gap-2 px-4 py-6">
      {auctionState.teams.map((team) => {
        const badges = computeTeamStatus(team, auctionState, players).badges;
        const status = statusByTeamId.get(team.id)!;
        const isMe = team.id === "me";
        const pressureColor = PRESSURE_COLOR[status.pressione];

        return (
          <div
            key={team.id}
            className="rounded-xl border-l-4 p-3 transition-colors"
            style={{
              backgroundColor: isMe ? "var(--color-brand-soft)" : "var(--color-surface)",
              borderLeftColor: pressureColor,
              border: `1px solid ${isMe ? "var(--color-brand)" : "var(--color-border)"}`,
              borderLeftWidth: "4px",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold">
                {isMe && (
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "var(--color-brand)", color: "#0b0e14" }}>
                    TU
                  </span>
                )}
                {team.name}
              </span>
              <span className="font-tabular text-xl font-bold" style={{ color: "var(--color-brand-strong)" }}>
                {team.budget.creditiResidui}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              <span>{Math.round(status.percentualeCompletata * 100)}% rosa</span>
              {status.spesaMedia !== null && <span>{status.spesaMedia} cr/giocatore</span>}
              <span>forza {status.forzaStimata}</span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex gap-3">
                {ROLE_ORDER.map((role) => (
                  <div key={role} className="text-center">
                    <div className="text-[9px]" style={{ color: "var(--color-text-faint)" }}>
                      {role}
                    </div>
                    <div className="font-tabular text-sm font-semibold">{status.slotMancantiPerRuolo[role]}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {badges.slice(0, 2).map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{ backgroundColor: "var(--color-surface-raised)", color: "var(--color-text-muted)" }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
