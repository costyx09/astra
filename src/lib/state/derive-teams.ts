import type { TeamIdentity, TeamState, MarketLogEntry } from "@/types/auction";
import { STARTING_CREDITS } from "@/types/auction";

/**
 * Deriva l'intero array `teams` (budget + rosa) a partire da:
 * - le identità statiche delle squadre (id, nome) fissate al setup;
 * - il marketLog corrente.
 *
 * Design deliberato: `marketLog` è l'unica fonte di verità. Budget e rosa
 * non sono mai mutati incrementalmente — vengono sempre ricalcolati da
 * zero da questa funzione. Questo è ciò che rende triviale e sicura la
 * correzione errori (modifica/eliminazione/annulla): qualunque cambiamento
 * al marketLog si propaga automaticamente e correttamente a budget, rose
 * e a tutti i calcoli derivati (Decision Engine, Auction Intelligence
 * Engine), senza rischio di stati incoerenti.
 */
export function deriveTeams(teamIdentities: TeamIdentity[], marketLog: MarketLogEntry[]): TeamState[] {
  return teamIdentities.map((identity) => {
    const purchases = marketLog.filter((entry) => entry.buyerId === identity.id);
    const creditiSpesi = purchases.reduce((sum, entry) => sum + entry.pricePaid, 0);

    return {
      id: identity.id,
      name: identity.name,
      budget: {
        creditiTotali: STARTING_CREDITS,
        creditiSpesi,
        creditiResidui: STARTING_CREDITS - creditiSpesi,
      },
      roster: purchases.map((entry) => ({
        playerId: entry.playerId,
        role: entry.role,
        pricePaid: entry.pricePaid,
      })),
    };
  });
}
