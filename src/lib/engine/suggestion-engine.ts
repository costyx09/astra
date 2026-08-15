import type { Player, Role } from "@/types/player";
import type { AuctionState } from "@/types/auction";
import { computeDynamicPricing, computeMarketSignals } from "./auction-intelligence-engine";
import { getMyTeam, minReserve, slotsFree } from "./auction-context";
import { computePoolSizeByRole } from "./pool";
import { computeRepartoFit } from "./department-plan-engine";
import { getActiveDepartment } from "./reparto-intelligence-engine";
import { getCachedComparison } from "./simulator";
import { computeCompetitorsForPlayer } from "./league-intelligence-engine";
import { clamp } from "@/lib/utils/math";

/**
 * Suggeritore "Chi chiamare?" — vedi astra-auction-intelligence-engine.md
 * (nota di design nella schermata Giocatori) per il punto di partenza
 * concettuale. Non modifica Decision Engine né Auction Intelligence
 * Engine: li riusa così come sono, aggiungendo solo un ordinamento sopra
 * i loro output.
 *
 * Principio: suggerisce i giocatori che offrono il miglior compromesso tra
 * qualità (Astra Index), urgenza di ruolo (quanto mi serve adesso) e
 * sostenibilità (posso permettermelo senza compromettere il resto della
 * rosa). Non è un'altra fonte di verità sul prezzo — usa gli stessi
 * dynamicSuggestedPrice/dynamicMaxPrice che vedresti chiamando il
 * giocatore in Asta Live.
 */

export interface Suggestion {
  player: Player;
  dynamicSuggestedPrice: number;
  dynamicMaxPrice: number;
  score: number;
  reason: string;
}

function roleUrgency(auctionState: AuctionState, role: Role): number {
  const myTeam = getMyTeam(auctionState);
  const free = slotsFree(auctionState, myTeam, role);
  const target = auctionState.roleTargets[role];
  if (free <= 0) return 0.35; // ruolo già coperto: resta visibile ma con priorità bassa
  return 1 + (free / target) * 0.8; // più slot mancano, più urgenza
}

export function suggestNextCalls(
  auctionState: AuctionState,
  players: Player[],
  limit: number = 10
): Suggestion[] {
  const myTeam = getMyTeam(auctionState);
  const soldIds = new Set(auctionState.marketLog.map((e) => e.playerId));
  const poolSizeByRole = computePoolSizeByRole(players);
  const marketSignals = computeMarketSignals(auctionState, players, poolSizeByRole);

  const reserve = minReserve(auctionState, myTeam, false);
  const budgetDisponibile = myTeam.budget.creditiResidui - reserve;

  // Il Piano del Reparto pesa solo sul reparto attivo (l'asta procede un
  // reparto alla volta): per gli altri ruoli il suggeritore resta quello
  // di sempre, qualità/prezzo × urgenza × confidence — nessuna riscrittura.
  //
  // L'asta è STRUTTURALMENTE sequenziale (Portieri → Difensori →
  // Centrocampisti → Attaccanti, un reparto completo prima del successivo):
  // suggerire un giocatore di un reparto non ancora aperto non avrebbe
  // senso nella realtà (non è nemmeno chiamabile). Il suggeritore quindi
  // restringe le candidature al reparto attivo.
  const activeRole = getActiveDepartment(auctionState);
  const fitByPlayerId = new Map(computeRepartoFit(auctionState, players, activeRole).map((f) => [f.player.id, f]));

  const suggestions: Suggestion[] = [];

  for (const player of players) {
    if (soldIds.has(player.id)) continue;
    if (player.role !== activeRole) continue; // fuori dal reparto attivo: non ancora chiamabile

    const pricing = computeDynamicPricing(
      player,
      auctionState,
      marketSignals,
      poolSizeByRole,
      player.pricing.suggestedPrice
    );

    if (pricing.dynamicSuggestedPrice > budgetDisponibile) continue; // fuori portata, non lo suggerisco

    const urgency = roleUrgency(auctionState, player.role);
    const qualityPerCredito = player.scores.astraIndex / Math.max(pricing.dynamicSuggestedPrice, 1);
    let score = qualityPerCredito * urgency * (0.5 + 0.5 * player.scores.confidence);

    const free = slotsFree(auctionState, myTeam, player.role);
    let reason =
      free > 0
        ? "Buon rapporto valore/prezzo per un ruolo che ti manca ancora"
        : "Ruolo già coperto, ma resta un'occasione di qualità";

    const fit = player.role === activeRole ? fitByPlayerId.get(player.id) : undefined;
    if (fit) {
      // Il fit può essere negativo (fascia già coperta): normalizzato a un
      // moltiplicatore 0.6-1.6 per pesare, non sostituire, il punteggio base.
      score *= clamp(1 + fit.fitScore / 60, 0.6, 1.6);
      reason = fit.reason;
    }

    // League Intelligence: a parità di merito, un giocatore conteso da
    // meno avversari reali è strategicamente più semplice da chiudere —
    // fattore additivo, mai una regola rigida "scegli sempre il meno conteso".
    const competitorsReali = computeCompetitorsForPlayer(auctionState, players, player.role, pricing.dynamicSuggestedPrice);
    score *= clamp(1 + (2 - competitorsReali.length) * 0.07, 0.8, 1.25);

    // Se un confronto Monte Carlo per questo giocatore a questo prezzo è
    // già stato calcolato (vedi ScenarioComparison), lo uso come segnale
    // aggiuntivo — non lo rilancio mai qui: sarebbe troppo lento farlo
    // per ogni candidato ad ogni render.
    const cached = getCachedComparison(player.id, pricing.dynamicSuggestedPrice);
    if (cached) {
      score *= clamp(1 + cached.deltaTop3 / 100, 0.7, 1.4);
      reason = `${reason} — Monte Carlo: ${cached.deltaTop3 > 0 ? "+" : ""}${cached.deltaTop3}% Top 3 se lo compri ora`;
    }

    suggestions.push({
      player,
      dynamicSuggestedPrice: pricing.dynamicSuggestedPrice,
      dynamicMaxPrice: pricing.dynamicMaxPrice,
      score,
      reason,
    });
  }

  suggestions.sort((a, b) => b.score - a.score);
  return suggestions.slice(0, limit);
}
