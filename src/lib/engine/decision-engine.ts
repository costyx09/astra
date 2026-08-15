import type { Role } from "@/types/player";
import type { DecisionInput, DecisionResult } from "@/types/decision";
import { clamp } from "@/lib/utils/math";
import {
  getMyTeam,
  minReserve,
  playersSoldByRole,
  slotsFree,
} from "./auction-context";

/**
 * Decision Engine — vedi astra-decision-engine.md, sezione 4.
 *
 * Funzione pura, zero I/O: dato lo stato dell'asta e il giocatore chiamato,
 * restituisce un verdetto immediato. Gira interamente nel browser, nessuna
 * chiamata di rete — è questo che garantisce una risposta istantanea
 * durante l'asta live.
 *
 * `poolSizeByRole` è il numero totale di giocatori per ruolo nell'intero
 * listone (fisso per tutta l'asta, calcolato una volta da players.json),
 * necessario per stimare la scarsità di mercato nel calcolo dell'urgenza.
 *
 * `input.pricing`, se fornito dall'Auction Intelligence Engine, sostituisce
 * i prezzi statici del giocatore con quelli dinamici — la logica di
 * decisione sottostante resta identica (vedi
 * astra-auction-intelligence-engine.md, sezione 2).
 */
export function decide(
  input: DecisionInput,
  poolSizeByRole: Record<Role, number>
): DecisionResult {
  const { player, currentBid, auctionState } = input;
  const role = player.role;
  const myTeam = getMyTeam(auctionState);

  const suggestedPrice = input.pricing?.dynamicSuggestedPrice ?? player.pricing.suggestedPrice;
  const staticMaxPrice = input.pricing?.dynamicMaxPrice ?? player.pricing.maxPrice;

  // --- 4.2: contestualizzazione del prezzo massimo (urgenza di ruolo) ---
  const slotLiberi = slotsFree(auctionState, myTeam, role);
  const roleTarget = auctionState.roleTargets[role];
  const sold = playersSoldByRole(auctionState, role);
  const totalInPool = poolSizeByRole[role] ?? Math.max(sold, 1);
  const scarsita = totalInPool > 0 ? 1 - sold / totalInPool : 0;
  const urgenza = roleTarget > 0 ? (slotLiberi / roleTarget) * (1 - scarsita) : 0;
  const bonusUrgenza = clamp(urgenza * 0.2, 0, 0.2);
  const maxPriceUsed = staticMaxPrice * (1 + bonusUrgenza);

  // --- 4.3: guardrail di budget, priorità assoluta e incondizionata ---
  const reserve = minReserve(auctionState, myTeam, true);
  if (myTeam.budget.creditiResidui - currentBid < reserve) {
    return {
      verdict: "NON_RILANCIARE",
      reason: "Budget insufficiente a completare la rosa se rilanci qui",
      suggestedPriceUsed: suggestedPrice,
      maxPriceUsed,
      budgetGuardrailTriggered: true,
    };
  }

  // --- 4.4: logica di decisione principale ---
  if (currentBid > maxPriceUsed) {
    return {
      verdict: "NON_RILANCIARE",
      reason: "Oltre il prezzo massimo sostenibile per questo giocatore",
      suggestedPriceUsed: suggestedPrice,
      maxPriceUsed,
      budgetGuardrailTriggered: false,
    };
  }

  const ruoloScoperto = slotLiberi > 0;

  if (currentBid <= suggestedPrice) {
    if (ruoloScoperto) {
      return {
        verdict: "RILANCIA",
        reason: "Sotto valore consigliato e ruolo ancora da coprire",
        suggestedPriceUsed: suggestedPrice,
        maxPriceUsed,
        budgetGuardrailTriggered: false,
      };
    }

    const gapRelativo = (suggestedPrice - currentBid) / suggestedPrice;
    const occasioneChiara = player.scores.astraIndex >= 80 && gapRelativo > 0.15;
    if (occasioneChiara) {
      return {
        verdict: "RILANCIA",
        reason: "Occasione: indice alto, prezzo ancora favorevole",
        suggestedPriceUsed: suggestedPrice,
        maxPriceUsed,
        budgetGuardrailTriggered: false,
      };
    }

    return {
      verdict: "ASPETTA",
      reason: "Ruolo già coperto adeguatamente, valuta solo se sostituzione migliorativa",
      suggestedPriceUsed: suggestedPrice,
      maxPriceUsed,
      budgetGuardrailTriggered: false,
    };
  }

  // suggestedPrice < currentBid <= maxPriceUsed
  if (urgenza > 0.5) {
    return {
      verdict: "RILANCIA",
      reason: "Prezzo sopra il consigliato ma ruolo scarso e urgente",
      suggestedPriceUsed: suggestedPrice,
      maxPriceUsed,
      budgetGuardrailTriggered: false,
    };
  }

  if (player.scores.confidence < 0.5) {
    return {
      verdict: "ASPETTA",
      reason: "Dati incerti su questo giocatore, meglio non stirare il prezzo",
      suggestedPriceUsed: suggestedPrice,
      maxPriceUsed,
      budgetGuardrailTriggered: false,
    };
  }

  return {
    verdict: "ASPETTA",
    reason: "Prezzo alto ma ancora entro il massimo, valuta alternative prima di spingere",
    suggestedPriceUsed: suggestedPrice,
    maxPriceUsed,
    budgetGuardrailTriggered: false,
  };
}
