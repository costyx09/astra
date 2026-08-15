import type { Player } from "./player";
import type { AuctionState } from "./auction";
import type { DynamicPricing } from "./dynamic-pricing";

export type Verdict = "RILANCIA" | "NON_RILANCIARE" | "ASPETTA";

/**
 * Input per il Decision Engine (vedi astra-decision-engine.md, sezione 4).
 * `pricing` è opzionale: se assente, il motore usa i prezzi statici del
 * giocatore; se presente (fornito dall'Auction Intelligence Engine), usa
 * i prezzi dinamici — stessa logica, prezzi sempre aggiornati.
 */
export interface DecisionInput {
  player: Player;
  currentBid: number;
  auctionState: AuctionState;
  pricing?: DynamicPricing;
}

export interface DecisionResult {
  verdict: Verdict;
  reason: string;
  /** Prezzo consigliato e massimo effettivamente usati per la decisione (statici o dinamici). */
  suggestedPriceUsed: number;
  maxPriceUsed: number;
  /** true se il guardrail di budget ha determinato il verdetto (priorità assoluta, vedi sezione 4.3). */
  budgetGuardrailTriggered: boolean;
}
