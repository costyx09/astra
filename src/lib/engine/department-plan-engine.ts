import type { Player, Role } from "@/types/player";
import type { AuctionState } from "@/types/auction";
import type {
  DepartmentCompletion,
  DepartmentPlan,
  NextObjective,
  RepartoFitResult,
  Tier,
  TierCounts,
} from "@/types/department-plan";
import { getMyTeam, slotsFree } from "./auction-context";
import { computeMarketSignals } from "./auction-intelligence-engine";
import { computePoolSizeByRole } from "./pool";
import { rankRemainingPlayers } from "./reparto-intelligence-engine";
import { clamp } from "@/lib/utils/math";

/**
 * Department Plan Engine — vedi la conversazione di design per il
 * ragionamento completo. Principio guida, esplicitamente richiesto:
 * IL PIANO È UN'IPOTESI STRATEGICA, NON UN VINCOLO.
 *
 * Non introduce un secondo stato: legge sempre `AuctionState` fresco,
 * come tutti gli altri motori. Non modifica Decision Engine, Auction
 * Intelligence Engine, simulatore o Reparto Intelligence Engine — li
 * riusa (in particolare `rankRemainingPlayers` e `computeMarketSignals`)
 * e aggiunge un livello di lettura sopra, orientato al reparto invece
 * che al singolo giocatore o alla singola decisione.
 */

const ROLES_ORDER: Role[] = ["P", "D", "C", "A"];
const ROLE_LABEL: Record<Role, string> = { P: "portiere", D: "difensore", C: "centrocampista", A: "attaccante" };
const TIER_LABEL: Record<Tier, string> = { top: "top", semi_top: "semi-top", titolare: "titolare affidabile", scommessa: "scommessa" };
const TIER_PRIORITY: Tier[] = ["top", "semi_top", "titolare", "scommessa"];

function emptyTierCounts(): TierCounts {
  return { top: 0, semi_top: 0, titolare: 0, scommessa: 0 };
}

/**
 * Composizione "ipotesi iniziale" per reparto — un seed ragionevole, non
 * un target imposto: il piano se ne allontana liberamente durante l'asta
 * (vedi `computeDepartmentPlan`). Le somme corrispondono esattamente agli
 * slot totali per ruolo nella configurazione Classic (3/8/8/6).
 */
const ARCHETYPE: Record<Role, TierCounts> = {
  P: { top: 0, semi_top: 1, titolare: 2, scommessa: 0 },
  D: { top: 1, semi_top: 2, titolare: 4, scommessa: 1 },
  C: { top: 1, semi_top: 2, titolare: 4, scommessa: 1 },
  A: { top: 1, semi_top: 2, titolare: 2, scommessa: 1 },
};

/** Soglie di fascia, percentili dell'Astra Index sull'intero pool del ruolo (venduti inclusi: la fascia è una proprietà del giocatore, non del mercato residuo). */
function tierThresholds(players: Player[], role: Role): { p85: number; p65: number; p35: number } {
  const values = players.filter((p) => p.role === role).map((p) => p.scores.astraIndex).sort((a, b) => b - a);
  if (values.length === 0) return { p85: 85, p65: 65, p35: 35 };
  const at = (q: number) => values[Math.min(values.length - 1, Math.floor(values.length * q))];
  return { p85: at(0.15), p65: at(0.35), p35: at(0.65) };
}

export function classifyTier(player: Player, thresholds: { p85: number; p65: number; p35: number }): Tier {
  if (player.scores.astraIndex >= thresholds.p85) return "top";
  if (player.scores.astraIndex >= thresholds.p65) return "semi_top";
  if (player.scores.astraIndex >= thresholds.p35 && player.scores.subIndexAffidabilita >= 55) return "titolare";
  return "scommessa";
}

/** --- 1) Profilo reparto dinamico --- */
export function computeDepartmentPlan(auctionState: AuctionState, players: Player[], role: Role): DepartmentPlan {
  const myTeam = getMyTeam(auctionState);
  const playerById = new Map(players.map((p) => [p.id, p]));
  const myRosterSlots = myTeam.roster.filter((s) => s.role === role);
  const thresholds = tierThresholds(players, role);

  const achieved = emptyTierCounts();
  let spesoNelReparto = 0;
  for (const slot of myRosterSlots) {
    const p = playerById.get(slot.playerId);
    spesoNelReparto += slot.pricePaid;
    if (p) achieved[classifyTier(p, thresholds)] += 1;
  }

  const giocatoriMancanti = slotsFree(auctionState, myTeam, role);
  const archetype = ARCHETYPE[role];

  // Ipotesi attuale = archetipo meno quanto già raggiunto, mai negativa.
  const remainingTarget = emptyTierCounts();
  for (const tier of TIER_PRIORITY) remainingTarget[tier] = Math.max(0, archetype[tier] - achieved[tier]);

  // Aggiustamento di scarsità/inflazione: se il pool residuo di "top" è
  // quasi esaurito o il mercato li sta pagando molto sopra valore,
  // il piano si allontana dall'archetipo — declassa un'unità a semi-top.
  const soldIds = new Set(auctionState.marketLog.map((e) => e.playerId));
  const poolByTier = emptyTierCounts();
  for (const p of players) {
    if (p.role === role && !soldIds.has(p.id)) poolByTier[classifyTier(p, thresholds)] += 1;
  }
  const poolSizeByRole = computePoolSizeByRole(players);
  const marketSignals = computeMarketSignals(auctionState, players, poolSizeByRole);
  if (remainingTarget.top > 0 && (poolByTier.top <= 1 || marketSignals.inflazioneEffettiva[role] > 1.25)) {
    remainingTarget.top -= 1;
    remainingTarget.semi_top += 1;
  }

  // Riconcilia la somma con gli slot realmente mancanti (es. ho già
  // superato l'archetipo in una fascia: il surplus va redistribuito,
  // mai sprecato — altrimenti il piano non copre tutti gli slot).
  let diff = giocatoriMancanti - TIER_PRIORITY.reduce((s, t) => s + remainingTarget[t], 0);
  for (const tier of ["titolare", "semi_top", "top", "scommessa"] as Tier[]) {
    if (diff <= 0) break;
    remainingTarget[tier] += diff;
    diff = 0;
  }
  for (const tier of ["scommessa", "titolare", "semi_top", "top"] as Tier[]) {
    if (diff >= 0) break;
    const cut = Math.min(remainingTarget[tier], -diff);
    remainingTarget[tier] -= cut;
    diff += cut;
  }

  return {
    role,
    archetype,
    achieved,
    remainingTarget,
    giocatoriMancanti,
    spesoNelReparto,
    budgetDisponibile: myTeam.budget.creditiResidui,
    crossDepartmentNote: crossDepartmentOpportunity(auctionState, players, role),
  };
}

/** --- Costo-opportunità qualitativo verso il prossimo reparto (nessuna cifra da "riservare") --- */
function crossDepartmentOpportunity(auctionState: AuctionState, players: Player[], role: Role): string | null {
  const idx = ROLES_ORDER.indexOf(role);
  const nextRole = ROLES_ORDER[idx + 1];
  if (!nextRole) return null;

  const thresholdsCurrent = tierThresholds(players, role);
  const thresholdsNext = tierThresholds(players, nextRole);
  const soldIds = new Set(auctionState.marketLog.map((e) => e.playerId));

  const avgValueRatio = (r: Role, thresholds: { p85: number; p65: number; p35: number }) => {
    const tops = players.filter((p) => p.role === r && !soldIds.has(p.id) && classifyTier(p, thresholds) === "top");
    if (tops.length === 0) return null;
    return tops.reduce((s, p) => s + p.scores.astraIndex / Math.max(p.pricing.suggestedPrice, 1), 0) / tops.length;
  };

  const currentRatio = avgValueRatio(role, thresholdsCurrent);
  const nextRatio = avgValueRatio(nextRole, thresholdsNext);
  if (currentRatio === null || nextRatio === null) return null;

  if (currentRatio > nextRatio * 1.15) {
    return `I top di questo reparto costano relativamente meno di quelli che troverai in ${ROLE_LABEL[nextRole]}: può convenire investire di più ora.`;
  }
  if (currentRatio < nextRatio * 0.85) {
    return `I top di ${ROLE_LABEL[nextRole]} sembrano relativamente più convenienti: qui puoi permetterti più prudenza.`;
  }
  return null;
}

/** --- 2) Reparto Fit: valore marginale rispetto alle alternative realistiche, non forza assoluta --- */
export function computeRepartoFit(auctionState: AuctionState, players: Player[], role: Role): RepartoFitResult[] {
  const ranked = rankRemainingPlayers(auctionState, players, role); // riuso, già ordinato per Astra Index desc
  const plan = computeDepartmentPlan(auctionState, players, role);
  const thresholds = tierThresholds(players, role);

  const byTier: Record<Tier, typeof ranked> = { top: [], semi_top: [], titolare: [], scommessa: [] };
  for (const r of ranked) byTier[classifyTier(r.player, thresholds)].push(r);

  const results: RepartoFitResult[] = ranked.map((r) => {
    const tier = classifyTier(r.player, thresholds);
    const sameTier = byTier[tier].filter((x) => x.player.id !== r.player.id);
    const alternative = sameTier[0]; // il migliore rimasto della stessa fascia: la vera "alternativa realistica"

    const qualityGap = alternative ? r.player.scores.astraIndex - alternative.player.scores.astraIndex : r.player.scores.astraIndex - 40;

    // Se ho già la fascia coperta, un altro esemplare vale strutturalmente
    // meno (è il cuore della richiesta: un secondo top pesa meno del primo).
    const needFactor = plan.remainingTarget[tier] > 0 ? 1.3 : plan.achieved[tier] > 0 ? 0.55 : 1.0;
    const scarcityFactor = clamp(1 + (2 - sameTier.length) * 0.18, 0.7, 1.7);
    const valueMargin = (r.dynamicMaxPrice - r.dynamicSuggestedPrice) / Math.max(r.dynamicSuggestedPrice, 1);

    const fitScore = Math.round((qualityGap * needFactor * scarcityFactor + valueMargin * 15) * 10) / 10;

    const parts: string[] = [];
    if (plan.remainingTarget[tier] > 0) parts.push(`completa la fascia ${TIER_LABEL[tier]} che ti manca`);
    else if (plan.achieved[tier] > 0) parts.push(`fascia ${TIER_LABEL[tier]} già coperta, meno prioritario`);
    if (sameTier.length <= 1) parts.push("pochissime alternative simili rimaste");
    if (valueMargin > 0.3) parts.push("buon margine tra prezzo previsto e massimo");
    const reason = parts.length > 0 ? parts.join(", ") : "profilo nella media per questo slot";

    return { player: r.player, tier, fitScore, reason, alternativesRemaining: sameTier.length };
  });

  results.sort((a, b) => b.fitScore - a.fitScore);
  return results;
}

/** --- 3) Prossimo obiettivo --- */
export function computeNextObjective(
  auctionState: AuctionState,
  players: Player[],
  role: Role,
  fit: RepartoFitResult[]
): NextObjective | null {
  const plan = computeDepartmentPlan(auctionState, players, role);
  if (plan.giocatoriMancanti === 0) return null;

  if (plan.giocatoriMancanti === 1) {
    return {
      tier: null,
      title: "Ultimo slot",
      message: "Cerca il miglior completamento disponibile, senza compromettere budget e qualità del resto della rosa.",
      candidatiRimasti: fit.length,
    };
  }

  const poolSizeByRole = computePoolSizeByRole(players);
  const marketSignals = computeMarketSignals(auctionState, players, poolSizeByRole);

  let targetTier = TIER_PRIORITY.find((t) => plan.remainingTarget[t] > 0) ?? "titolare";
  let demoted = false;
  let candidates = fit.filter((f) => f.tier === targetTier);

  if (targetTier === "top" && (candidates.length <= 1 || marketSignals.inflazioneEffettiva[role] > 1.25)) {
    targetTier = "semi_top";
    demoted = true;
    candidates = fit.filter((f) => f.tier === "semi_top");
  }

  return {
    tier: targetTier,
    title: demoted ? "Non inseguire i top per ora" : `Cerca un profilo di fascia ${TIER_LABEL[targetTier]}`,
    message: demoted
      ? `I top ${ROLE_LABEL[role]} sono scarsi o sopra prezzo: punta su un ${TIER_LABEL["semi_top"]} conveniente.`
      : `Ti serve ancora una fascia ${TIER_LABEL[targetTier]}: ${candidates.length} candidati validi ancora disponibili.`,
    candidatiRimasti: candidates.length,
  };
}

/** --- 8) Fine reparto --- */
export function computeDepartmentCompletion(auctionState: AuctionState, players: Player[], role: Role): DepartmentCompletion | null {
  const myTeam = getMyTeam(auctionState);
  if (slotsFree(auctionState, myTeam, role) > 0) return null;

  const playerById = new Map(players.map((p) => [p.id, p]));
  const mySlots = myTeam.roster.filter((s) => s.role === role);
  const myPlayers = mySlots.map((s) => playerById.get(s.playerId)).filter((p): p is Player => Boolean(p));
  if (myPlayers.length === 0) return null;

  const forzaReparto = Math.round(myPlayers.reduce((s, p) => s + p.scores.astraIndex, 0) / myPlayers.length);
  const investimentoTotale = mySlots.reduce((s, slot) => s + slot.pricePaid, 0);
  const valoreEquoTotale = myPlayers.reduce((s, p) => s + p.pricing.suggestedPrice, 0);
  const efficienza = investimentoTotale > 0 ? Math.round((valoreEquoTotale / investimentoTotale) * 100) : 100;

  const valutazione =
    efficienza >= 110 ? "Ottimo affare complessivo" : efficienza >= 95 ? "Reparto costruito a valore equo" : "Hai pagato un premio: valuta se la qualità ottenuta lo giustifica";

  return { role, forzaReparto, investimentoTotale, efficienza, valutazione };
}
