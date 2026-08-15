import type { Player } from "@/types/player";
import type { AuctionState } from "@/types/auction";
import type { DecisionResult } from "@/types/decision";
import type { DynamicPricing } from "@/types/dynamic-pricing";
import { getMyTeam } from "./auction-context";
import { computeDepartmentPlan, computeRepartoFit } from "./department-plan-engine";
import { getActiveDepartment } from "./reparto-intelligence-engine";
import { clamp } from "@/lib/utils/math";

/**
 * Simulation Trigger — decide SE vale la pena eseguire il Monte Carlo
 * Compra/Lascia, non lo esegue mai da solo (il calcolo resta sempre
 * un'azione esplicita dell'utente, vedi ScenarioComparison). Non è un
 * terzo motore di decisione: legge gli output di Decision Engine, AIE e
 * Department Plan Engine così come sono, senza modificarli.
 *
 * Principio guida (esplicitamente richiesto): il Monte Carlo non deve
 * mai poter ribaltare un hard stop del Decision Engine. Se il rilancio è
 * nettamente sopra il prezzo massimo, il trigger non propone MAI la
 * simulazione — indipendentemente da quanto il resto del contesto
 * (fit, scarsità, piano) sembri favorevole. Vedi `HARD_STOP_MARGIN`.
 */

const HARD_STOP_MARGIN = 1.15; // oltre il 15% sopra il massimo, nessun dubbio possibile
const CLEAR_BARGAIN_MARGIN = 0.85; // sotto l'85% del consigliato, nessun dubbio nel verso opposto
const AMBIGUITY_THRESHOLD = 0.5;

export interface SimulationTrigger {
  shouldSimulate: boolean;
  ambiguityScore: number; // 0-1, solo a scopo di trasparenza/debug
  reason: string;
}

export function computeSimulationTrigger(
  auctionState: AuctionState,
  players: Player[],
  player: Player,
  currentBid: number,
  decision: DecisionResult,
  pricing: DynamicPricing
): SimulationTrigger {
  const { dynamicSuggestedPrice: suggested, dynamicMaxPrice: max } = pricing;

  // --- Casi netti: nessun dubbio possibile, mai simulare (vedi principio guida) ---
  if (currentBid > max * HARD_STOP_MARGIN) {
    return { shouldSimulate: false, ambiguityScore: 0, reason: "Rilancio nettamente sopra il prezzo massimo: nessun dubbio, hard stop del Decision Engine." };
  }

  const myTeam = getMyTeam(auctionState);
  const activeRole = getActiveDepartment(auctionState);
  const inActiveDepartment = player.role === activeRole;

  const fit = inActiveDepartment ? computeRepartoFit(auctionState, players, activeRole).find((f) => f.player.id === player.id) : undefined;
  const plan = inActiveDepartment ? computeDepartmentPlan(auctionState, players, activeRole) : undefined;

  const ruoloScopertoUrgente = fit && plan ? plan.remainingTarget[fit.tier] > 0 : false;
  const alternativeAbbondanti = fit ? fit.alternativesRemaining >= 3 : false;

  if (currentBid <= suggested * CLEAR_BARGAIN_MARGIN && ruoloScopertoUrgente && alternativeAbbondanti) {
    return { shouldSimulate: false, ambiguityScore: 0, reason: "Sotto valore, fascia scoperta, molte alternative: scelta netta, RILANCIA senza dubbi." };
  }

  // --- Zona grigia: calcolo un punteggio di ambiguità, non un secondo verdetto ---
  // Quanto currentBid è vicino al prezzo massimo (0 = al prezzo consigliato, 1 = al massimo).
  const range = Math.max(max - suggested, 1);
  const posizione = clamp((currentBid - suggested) / range, -1, 1.5);
  const vicinanzaAlLimite = clamp(1 - Math.abs(posizione - 0.85), 0, 1); // massimo intorno all'85% del range verso il tetto

  const importanzaPiano = fit ? clamp(fit.fitScore / 8, 0, 1) : 0.3;
  const scarsita = fit ? clamp((3 - fit.alternativesRemaining) / 3, 0, 1) : 0.3;
  const incertezzaDati = 1 - player.scores.confidence;

  const budgetDisponibile = Math.max(myTeam.budget.creditiResidui, 1);
  const rischioBudget = clamp(currentBid / budgetDisponibile - 0.15, 0, 1);

  const ambiguityScore =
    0.32 * vicinanzaAlLimite + 0.25 * importanzaPiano + 0.2 * scarsita + 0.13 * incertezzaDati + 0.1 * rischioBudget;

  const shouldSimulate = decision.verdict === "ASPETTA" || ambiguityScore >= AMBIGUITY_THRESHOLD;

  const reasonParts: string[] = [];
  if (decision.verdict === "ASPETTA") reasonParts.push("il Decision Engine è già indeciso");
  if (vicinanzaAlLimite > 0.6) reasonParts.push("il prezzo è vicino al limite");
  if (fit && ruoloScopertoUrgente) reasonParts.push("il giocatore è importante per il piano del reparto");
  if (fit && !alternativeAbbondanti) reasonParts.push("restano poche alternative simili");
  if (rischioBudget > 0.3) reasonParts.push("l'acquisto assorbirebbe una quota rilevante del budget residuo");

  const reason = shouldSimulate
    ? reasonParts.length > 0
      ? `Decisione equilibrata: ${reasonParts.join(", ")}.`
      : "Decisione equilibrata: vale la pena confrontare gli scenari."
    : "Situazione abbastanza chiara: la simulazione aggiungerebbe poco.";

  return { shouldSimulate, ambiguityScore: Math.round(ambiguityScore * 100) / 100, reason };
}
