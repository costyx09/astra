import type { Role } from "./player";

/**
 * Stato dell'asta, tenuto interamente in memoria/localStorage nel browser
 * (nessun backend — vedi astra-v1-mvp.md). Questo è l'unico input "dinamico"
 * che Decision Engine e Auction Intelligence Engine ricevono oltre al
 * giocatore chiamato.
 */

/** Configurazione di lega Classic: 3 P, 8 D, 8 C, 6 A, 500 crediti, 8 squadre. */
export const ROLE_TARGETS: Record<Role, number> = {
  P: 3,
  D: 8,
  C: 8,
  A: 6,
};

export const TOTAL_SLOTS_PER_TEAM = 25;
export const TOTAL_TEAMS = 8;
export const STARTING_CREDITS = 500;

export interface Budget {
  creditiTotali: number;
  creditiSpesi: number;
  creditiResidui: number;
}

export interface RosterSlot {
  playerId: string;
  role: Role;
  pricePaid: number;
}

/**
 * Identifica una squadra nella lega. "me" è sempre la tua squadra;
 * le altre 7 sono identificate da un id libero (nome scelto da te
 * durante il setup, es. "Marco", "Squadra 2"...).
 */
export type TeamId = "me" | string;

export interface TeamState {
  id: TeamId;
  name: string;
  budget: Budget;
  roster: RosterSlot[];
}

/**
 * Una riga del log di mercato: registrata manualmente (due tap) ogni volta
 * che un giocatore viene aggiudicato, da te o da un avversario.
 * È la fonte di verità da cui l'intero Auction Intelligence Engine deriva
 * inflazione, scarsità, pressione di budget e profilo degli avversari.
 */
/**
 * Una riga del log di mercato: registrata manualmente (due tap) ogni volta
 * che un giocatore viene aggiudicato, da te o da un avversario.
 * È la fonte di verità da cui l'intero Auction Intelligence Engine deriva
 * inflazione, scarsità, pressione di budget e profilo degli avversari.
 *
 * `id` identifica univocamente la riga, necessario per modificarla o
 * eliminarla dal Pannello Rosa e Mercato senza toccare le altre.
 */
export interface MarketLogEntry {
  id: string;
  playerId: string;
  role: Role;
  pricePaid: number;
  buyerId: TeamId;
  timestamp: string;
}

/** Identità statica di una squadra (id + nome), stabilita al setup dell'asta. */
export interface TeamIdentity {
  id: TeamId;
  name: string;
}

export interface AuctionState {
  teams: TeamState[];
  marketLog: MarketLogEntry[];
  roleTargets: Record<Role, number>;
}

/** Id della tua squadra all'interno di `teams`. */
export const MY_TEAM_ID: TeamId = "me";
