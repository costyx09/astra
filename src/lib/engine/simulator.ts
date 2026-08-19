import type { Player, Role } from "@/types/player";
import type { AuctionState, TeamState } from "@/types/auction";
import { deriveTeams } from "@/lib/state/derive-teams";
import { roleObligationRatio, slotsFree, totalSlotsFree } from "./auction-context";
import { computeDepartmentPlan } from "./department-plan-engine";
import { getActiveDepartment } from "./reparto-intelligence-engine";
import { computeMarketSignals, computeOpponentProfiles } from "./auction-intelligence-engine";
import { computePoolSizeByRole } from "./pool";
import type { OpponentProfile } from "@/types/dynamic-pricing";
import { clamp } from "@/lib/utils/math";

/**
 * Simulatore Monte Carlo "Compra vs Lascia" — vedi
 * astra-auction-intelligence-engine.md, sezione 6.
 *
 * Risponde alla domanda: "se prendo questo giocatore a questo prezzo, la
 * mia rosa finale sarà più forte rispetto alle altre 7, o mi conviene
 * lasciarlo?" Simula l'intero resto dell'asta, in modo stocastico, per
 * tutte le 8 squadre — non solo la mia — più volte, e confronta la
 * "potenza rosa" attesa nei due scenari.
 *
 * Limiti dichiarati (vedi anche l'UI, che li mostra sempre insieme al
 * risultato): è un'euristica statistica su un modello semplificato del
 * comportamento degli avversari, non una previsione certa. Usarlo per
 * confrontare due scelte tra loro, non come garanzia assoluta.
 */

/** Pesi di importanza per ruolo nella "forza rosa" — condivisi con League
 * Intelligence Engine, unica definizione per evitare due nozioni diverse
 * di "quanto conta questo ruolo" nello stesso progetto. */
export const ROLE_POWER_WEIGHT: Record<Role, number> = { P: 0.8, D: 1.0, C: 1.2, A: 1.3 };
const ROLES_ORDER: Role[] = ["A", "C", "D", "P"]; // simula prima i ruoli più "contesi"

export interface ScenarioResult {
  rosterPowerAtteso: number;
  posizioneMediaSu8: number;
  probabilitaTop3: number;
  probabilitaRosaIncompleta: number;
}

export interface ComparisonResult {
  scenarioCompro: ScenarioResult;
  scenarioLascio: ScenarioResult;
  raccomandazione: "COMPRA" | "LASCIA";
  deltaPosizione: number;
  deltaTop3: number;
  pianoNota: string | null;
  spiegazione: string;
}

/**
 * Cache in memoria (solo per la sessione, nessuna persistenza) dei
 * risultati Monte Carlo già calcolati — vedi "Integrazione con Chi
 * chiamare?" nel motore di suggerimento: non rilancia mai il Monte
 * Carlo per ogni candidato, usa solo risultati già disponibili qui.
 */
const comparisonCache = new Map<string, ComparisonResult>();

function cacheKey(playerId: string, currentBid: number): string {
  return `${playerId}:${currentBid}`;
}

export function getCachedComparison(playerId: string, currentBid: number): ComparisonResult | undefined {
  return comparisonCache.get(cacheKey(playerId, currentBid));
}

function rosterPower(team: TeamState, playersById: Map<string, Player>): number {
  return team.roster.reduce((sum, slot) => {
    const p = playersById.get(slot.playerId);
    if (!p) return sum;
    return sum + p.scores.astraIndex * ROLE_POWER_WEIGHT[slot.role];
  }, 0);
}

/** Esposta per riuso in League Intelligence Engine (dashboard: "forza stimata"). */
export { rosterPower };

/** Rumore casuale gaussiano approssimato (somma di uniformi), per rendere ogni iterazione diversa. */
function noise(spread: number): number {
  return ((Math.random() + Math.random() + Math.random() - 1.5) / 1.5) * spread;
}

/**
 * Simula lo svolgimento del resto dell'asta per tutte le squadre,
 * partendo da uno stato iniziale dato. Restituisce lo stato finale
 * (tutte le rose complete, per quanto possibile) e se qualche squadra
 * non è riuscita a completare la rosa nel budget.
 *
 * `opponentProfiles` (aggressività osservata REALE, dal marketLog fino a
 * questo momento — non ricalcolata per ogni iterazione, sarebbe scorretto
 * farlo su rose sintetiche) e `roleTargets` insieme rendono la scelta di
 * "chi si aggiudica il prossimo giocatore" più realistica: non solo chi
 * ha più budget, ma anche chi tende a pagare sopra valore e chi ha
 * un'urgenza di ruolo concentrata in questo momento della simulazione
 * (quest'ultima ricalcolata ad ogni assegnazione, perché cambia mentre
 * la simulazione stessa procede — è legittimo, a differenza
 * dell'aggressività che è un dato storico osservato una volta sola).
 */
function simulateRestOfAuction(
  teams: TeamState[],
  availablePlayers: Player[],
  roleTargets: Record<Role, number>,
  opponentProfiles: Map<string, OpponentProfile> = new Map(),
  inflazioneByRole: Record<Role, number> = { P: 1, D: 1, C: 1, A: 1 }
): { teams: TeamState[]; incomplete: boolean } {
  const teamsCopy: TeamState[] = teams.map((t) => ({
    ...t,
    budget: { ...t.budget },
    roster: [...t.roster],
  }));
  const pool = [...availablePlayers];
  let incomplete = false;

  for (const role of ROLES_ORDER) {
    // Ordina il pool di questo ruolo per qualità con un po' di rumore,
    // per non ripetere sempre esattamente lo stesso ordine tra iterazioni.
    const rolePool = pool
      .filter((p) => p.role === role)
      .map((p) => ({ p, score: p.scores.astraIndex + noise(12) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);

    let cursor = 0;
    let teamsNeeding = teamsCopy.filter((t) => slotsFree({ teams: teamsCopy, marketLog: [], roleTargets }, t, role) > 0);

    while (teamsNeeding.length > 0 && cursor < rolePool.length) {
      // Peso di ogni squadra per aggiudicarsi il prossimo giocatore:
      // budget residuo (come prima) × aggressività osservata reale ×
      // urgenza di ruolo concentrata in questo momento della rosa.
      const stateNow = { teams: teamsCopy, marketLog: [], roleTargets };
      const weights = teamsNeeding.map((t) => {
        const budgetWeight = Math.max(1, t.budget.creditiResidui);

        const profile = opponentProfiles.get(t.id);
        const aggressivitaFactor = profile
          ? clamp(1 + profile.confidence * (profile.aggressivita - 1), 0.7, 1.6)
          : 1;

        const obbligo = roleObligationRatio(stateNow, t, role);
        const obbligoFactor = clamp(1 + obbligo, 0.7, 1.5);

        return budgetWeight * aggressivitaFactor * obbligoFactor;
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * totalWeight;
      let idx = 0;
      for (; idx < weights.length; idx++) {
        r -= weights[idx];
        if (r <= 0) break;
      }
      const buyer = teamsNeeding[Math.min(idx, teamsNeeding.length - 1)];
      const player = rolePool[cursor];
      cursor++;

      // Fix audit pre-asta 2026-08-19: il prezzo simulato ora parte dal
      // prezzo statico corretto per l'inflazione di ruolo GIÀ osservata
      // nel marketLog reale fino a questo momento (calcolata una sola
      // volta prima della simulazione, non ricalcolata nel loop — stesso
      // principio già applicato all'aggressività osservata). Prima usava
      // solo il prezzo statico: se il mercato reale era già inflazionato,
      // il simulatore sottostimava quanto budget gli avversari avrebbero
      // speso nel resto dell'asta, rendendo COMPRA otticamente più
      // favorevole di quanto la realtà avrebbe permesso.
      const basePrice = player.pricing.suggestedPrice * (inflazioneByRole[role] ?? 1);
      const price = Math.max(1, Math.round(basePrice * (1 + noise(0.25))));
      const affordable = Math.min(price, buyer.budget.creditiResidui);

      buyer.budget.creditiResidui -= affordable;
      buyer.budget.creditiSpesi += affordable;
      buyer.roster.push({ playerId: player.id, role, pricePaid: affordable });

      const poolIdx = pool.findIndex((p) => p.id === player.id);
      if (poolIdx >= 0) pool.splice(poolIdx, 1);

      teamsNeeding = teamsCopy.filter((t) => slotsFree({ teams: teamsCopy, marketLog: [], roleTargets }, t, role) > 0);
    }

    if (teamsNeeding.length > 0) incomplete = true; // pool esaurito prima di riempire tutti gli slot
  }

  // Eventuali squadre rimaste con slot vuoti (budget insufficiente anche
  // per l'ultimo giocatore disponibile) sono segnalate come rosa incompleta.
  for (const t of teamsCopy) {
    if (totalSlotsFree({ teams: teamsCopy, marketLog: [], roleTargets }, t) > 0) incomplete = true;
  }

  return { teams: teamsCopy, incomplete };
}

function runScenario(
  teams: TeamState[],
  availablePlayers: Player[],
  roleTargets: Record<Role, number>,
  playersById: Map<string, Player>,
  iterations: number,
  opponentProfiles: Map<string, OpponentProfile>,
  inflazioneByRole: Record<Role, number>
): ScenarioResult {
  let sumPower = 0;
  let sumRank = 0;
  let top3Count = 0;
  let incompleteCount = 0;

  for (let i = 0; i < iterations; i++) {
    const { teams: finalTeams, incomplete } = simulateRestOfAuction(teams, availablePlayers, roleTargets, opponentProfiles, inflazioneByRole);
    const powers = finalTeams.map((t) => ({ id: t.id, power: rosterPower(t, playersById) }));
    powers.sort((a, b) => b.power - a.power);

    const myPower = powers.find((p) => p.id === "me")?.power ?? 0;
    const myRank = powers.findIndex((p) => p.id === "me") + 1;

    sumPower += myPower;
    sumRank += myRank;
    if (myRank <= 3) top3Count++;
    if (incomplete) incompleteCount++;
  }

  return {
    rosterPowerAtteso: Math.round(sumPower / iterations),
    posizioneMediaSu8: Math.round((sumRank / iterations) * 10) / 10,
    probabilitaTop3: Math.round((top3Count / iterations) * 100) / 100,
    probabilitaRosaIncompleta: Math.round((incompleteCount / iterations) * 100) / 100,
  };
}

export function compareBuyVsPass(
  auctionState: AuctionState,
  players: Player[],
  player: Player,
  currentBid: number,
  iterations: number = 80
): ComparisonResult {
  const playersById = new Map(players.map((p) => [p.id, p]));
  const soldIds = new Set(auctionState.marketLog.map((e) => e.playerId));
  const availablePool = players.filter((p) => !soldIds.has(p.id) && p.id !== player.id);

  // Aggressività osservata REALE, calcolata una sola volta dal marketLog
  // fino ad ora — mai ricalcolata dentro il loop stocastico (vedi nota
  // in simulateRestOfAuction sul perché sarebbe scorretto farlo lì).
  const opponentProfiles = new Map(computeOpponentProfiles(auctionState, players).map((p) => [p.teamId, p]));

  // Inflazione di ruolo già osservata nel marketLog reale fino ad ora
  // (stesso principio dell'aggressività: calcolata una volta sola prima
  // della simulazione, mai ricalcolata dentro il loop stocastico).
  const poolSizeByRole = computePoolSizeByRole(players);
  const marketSignals = computeMarketSignals(auctionState, players, poolSizeByRole);
  const inflazioneByRole = marketSignals.inflazioneEffettiva;

  // --- Scenario "Lo compro": il giocatore chiamato è già mio ---
  const teamsBuy = deriveTeams(
    auctionState.teams.map((t) => ({ id: t.id, name: t.name })),
    [
      ...auctionState.marketLog,
      {
        id: "__simulated_buy__",
        playerId: player.id,
        role: player.role,
        pricePaid: currentBid,
        buyerId: "me",
        timestamp: new Date().toISOString(),
      },
    ]
  );
  const scenarioCompro = runScenario(teamsBuy, availablePool, auctionState.roleTargets, playersById, iterations, opponentProfiles, inflazioneByRole);

  // --- Scenario "Lo lascio": il giocatore chiamato viene rimosso dal pool
  // (se lo aggiudica probabilisticamente qualcun altro nella simulazione) ---
  const scenarioLascio = runScenario(
    auctionState.teams,
    availablePool,
    auctionState.roleTargets,
    playersById,
    iterations,
    opponentProfiles,
    inflazioneByRole
  );

  const deltaPosizione = scenarioLascio.posizioneMediaSu8 - scenarioCompro.posizioneMediaSu8;
  const deltaTop3 = Math.round((scenarioCompro.probabilitaTop3 - scenarioLascio.probabilitaTop3) * 100);
  const raccomandazione: "COMPRA" | "LASCIA" =
    scenarioCompro.probabilitaTop3 >= scenarioLascio.probabilitaTop3 ? "COMPRA" : "LASCIA";

  // --- Impatto sul Piano del Reparto: il giocatore chiamato completa una
  // fascia che il piano segna ancora come mancante? (deterministico, non
  // serve rilanciare il Monte Carlo per saperlo — vedi department-plan-engine) ---
  let pianoNota: string | null = null;
  const activeRole = getActiveDepartment(auctionState);
  if (player.role === activeRole) {
    const planPrima = computeDepartmentPlan(auctionState, players, activeRole);
    const stateDopo = { ...auctionState, teams: teamsBuy };
    const planDopo = computeDepartmentPlan(stateDopo, players, activeRole);
    const fasceCompletate = (Object.keys(planPrima.remainingTarget) as Array<keyof typeof planPrima.remainingTarget>).filter(
      (tier) => planPrima.remainingTarget[tier] > 0 && planDopo.remainingTarget[tier] < planPrima.remainingTarget[tier]
    );
    if (fasceCompletate.length > 0) {
      pianoNota = `Comprarlo copre la fascia "${fasceCompletate[0]}" che il piano del reparto segna ancora come mancante.`;
    }
  }

  const costoOpportunita = Math.round(currentBid);
  const spiegazione =
    raccomandazione === "COMPRA"
      ? `Comprarlo migliora la probabilità di Top 3 di ${Math.abs(deltaTop3)} punti percentuali${pianoNota ? " e avanza il piano del reparto" : ""}; il costo-opportunità di ${costoOpportunita} crediti risulta accettabile in questa simulazione.`
      : `Lasciarlo mantiene ${costoOpportunita} crediti liberi per alternative successive, con una probabilità di Top 3 comparabile o migliore rispetto a comprarlo ora.`;

  const result: ComparisonResult = {
    scenarioCompro,
    scenarioLascio,
    raccomandazione,
    deltaPosizione,
    deltaTop3,
    pianoNota,
    spiegazione,
  };

  comparisonCache.set(cacheKey(player.id, currentBid), result);
  return result;
}
