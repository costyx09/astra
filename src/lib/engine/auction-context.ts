import type { Role } from "@/types/player";
import type { AuctionState, TeamState } from "@/types/auction";
import { MY_TEAM_ID, STARTING_CREDITS, TOTAL_SLOTS_PER_TEAM } from "@/types/auction";

/**
 * Funzioni pure di lettura dello stato asta, condivise da Decision
 * Engine, Auction Intelligence Engine, Department Plan Engine, League
 * Intelligence Engine e simulatore. Nessuna di queste muta lo stato:
 * prendono `AuctionState` e restituiscono numeri derivati.
 */

/**
 * Baseline di lega: crediti totali / slot totali per squadra, fisso per
 * tutta l'asta. Fonte unica di questa costante — prima duplicata in
 * auction-intelligence-engine.ts e team-status.ts, ora consolidata qui
 * e riusata da entrambi (vedi League Intelligence Engine).
 */
export const CREDITO_PER_SLOT_INIZIALE = STARTING_CREDITS / TOTAL_SLOTS_PER_TEAM; // 500 / 25 = 20

export function getTeam(auctionState: AuctionState, teamId: string): TeamState {
  const team = auctionState.teams.find((t) => t.id === teamId);
  if (!team) {
    throw new Error(`Squadra non trovata nello stato asta: ${teamId}`);
  }
  return team;
}

export function getMyTeam(auctionState: AuctionState): TeamState {
  return getTeam(auctionState, MY_TEAM_ID);
}

export function slotsOccupied(team: TeamState, role: Role): number {
  return team.roster.filter((slot) => slot.role === role).length;
}

export function slotsFree(auctionState: AuctionState, team: TeamState, role: Role): number {
  return auctionState.roleTargets[role] - slotsOccupied(team, role);
}

export function totalSlotsFree(auctionState: AuctionState, team: TeamState): number {
  const roles = Object.keys(auctionState.roleTargets) as Role[];
  return roles.reduce((sum, role) => sum + slotsFree(auctionState, team, role), 0);
}

/**
 * Riserva minima di crediti da tenere da parte per riuscire a riempire
 * tutti gli slot vuoti rimanenti (esclusa la decisione corrente).
 * Floor di sicurezza: 1 credito minimo per slot (vedi decision engine doc, 4.3).
 */
export function minReserve(auctionState: AuctionState, team: TeamState, excludingCurrentSlot: boolean): number {
  const free = totalSlotsFree(auctionState, team) - (excludingCurrentSlot ? 1 : 0);
  return Math.max(free, 0) * 1;
}

export function playersSoldByRole(auctionState: AuctionState, role: Role): number {
  return auctionState.marketLog.filter((entry) => entry.role === role).length;
}

/**
 * Quanto la necessità di un ruolo è concentrata per una squadra, rispetto
 * a quanto "dovrebbe" essere in proporzione alla composizione di lega
 * (es. in Classic i D sono 8/25 = 32% della rosa). Se una squadra ha il
 * 70% degli slot rimanenti proprio in D, è molto più "obbligata" a
 * comprare D ora di quanto lo sarebbe in media — usato sia per i badge
 * di League Intelligence sia (dati reali, non ipotetici) per pesare le
 * scelte nel Monte Carlo. Ritorna un valore che può essere negativo
 * (ruolo meno urgente della media) o positivo (più urgente).
 */
export function roleObligationRatio(auctionState: AuctionState, team: TeamState, role: Role): number {
  const totalFree = totalSlotsFree(auctionState, team);
  if (totalFree === 0) return 0;
  const roleFree = slotsFree(auctionState, team, role);
  const currentShare = roleFree / totalFree;
  const originalShare = auctionState.roleTargets[role] / TOTAL_SLOTS_PER_TEAM;
  return currentShare - originalShare;
}
