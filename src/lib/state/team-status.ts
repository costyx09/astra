import type { TeamState } from "@/types/auction";
import type { AuctionState } from "@/types/auction";
import type { Player, Role } from "@/types/player";
import { slotsFree } from "@/lib/engine/auction-context";
import { computeLeagueStatus } from "@/lib/engine/league-intelligence-engine";

/**
 * Badge di stato per la Dashboard delle Squadre — wrapper di
 * presentazione sopra `computeLeagueStatus` (League Intelligence Engine).
 *
 * Prima di questa versione, questo file ricalcolava aggressività e
 * pressione con una logica propria, parallela a quella dell'AIE — due
 * implementazioni indipendenti dello stesso concetto. Ora entrambe
 * derivano dallo stesso `computeTeamAggressivita` condiviso: qui restano
 * solo la selezione della squadra giusta dalla lista e la traduzione in
 * etichette per la UI.
 */

const ROLE_LABEL: Record<Role, string> = { P: "portieri", D: "difensori", C: "centrocampisti", A: "attaccanti" };
const PRESSURE_LABEL: Record<string, string> = { forte: "Sotto pressione", moderata: "Pressione moderata" };

export interface TeamStatus {
  creditoMedioPerSlot: number | null;
  badges: string[];
}

export function computeTeamStatus(team: TeamState, auctionState: AuctionState, players: Player[]): TeamStatus {
  const status = computeLeagueStatus(auctionState, players).find((s) => s.teamId === team.id);
  const badges: string[] = [];

  const slotVuotiTotali = Object.values(status?.slotMancantiPerRuolo ?? {}).reduce((a, b) => a + b, 0);
  const creditoMedioPerSlot = status && slotVuotiTotali > 0 ? team.budget.creditiResidui / slotVuotiTotali : null;

  if (status && status.pressione !== "tranquilla") badges.push(PRESSURE_LABEL[status.pressione]);
  else if (creditoMedioPerSlot !== null && creditoMedioPerSlot > 30) badges.push("Molti crediti");

  if (status?.aggressivita !== null && status && status.aggressivitaConfidence >= 0.4) {
    if (status.aggressivita! > 1.15) badges.push("Aggressiva");
    else if (status.aggressivita! < 0.9) badges.push("Attenta al prezzo");
  }

  (Object.keys(ROLE_LABEL) as Role[]).forEach((role) => {
    if (slotsFree(auctionState, team, role) === 0) {
      badges.push(`Reparto completo: ${ROLE_LABEL[role]}`);
    }
  });

  if (badges.length === 0) badges.push("Equilibrata");

  return { creditoMedioPerSlot, badges };
}
