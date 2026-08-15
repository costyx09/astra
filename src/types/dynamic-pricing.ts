import type { Role } from "./player";
import type { TeamId } from "./auction";

/**
 * Segnali di mercato ricalcolati ad ogni variazione di `marketLog`
 * (vedi astra-auction-intelligence-engine.md, sezione 3). Sono la base
 * su cui l'AIE corregge i prezzi statici del Decision Engine.
 */
export interface MarketSignals {
  /** Fattore di inflazione osservato per ruolo, smorzato per bassa numerosità campione. */
  inflazioneEffettiva: Record<Role, number>;
  /** Scarsità 0-1 per ruolo: quota di giocatori di quel ruolo ancora disponibili. */
  scarsita: Record<Role, number>;
  /** >1 = più crediti che slot rispetto al baseline di lega, prezzi in salita attesi. */
  pressioneBudget: number;
}

/** Profilo oggettivo di un singolo avversario, derivato dal suo storico acquisti. */
export interface OpponentProfile {
  teamId: TeamId;
  /** Media prezzo pagato / prezzo dinamico consigliato al momento dell'acquisto. */
  aggressivita: number;
  /** 0-1: quanto ci si può fidare di `aggressivita` — basso con pochi acquisti osservati. */
  confidence: number;
  /** true se crediti residui per slot rimanente < metà del baseline di lega. */
  sottoPressione: boolean;
}

/** Prezzi dinamici per un giocatore specifico, ricalcolati ad ogni acquisto registrato. */
export interface DynamicPricing {
  playerId: string;
  dynamicSuggestedPrice: number;
  dynamicMaxPrice: number;
  /** Quota di avversari (0-1) che potrebbero ancora permettersi questo giocatore a questo prezzo. */
  competitionPressure: number;
}
