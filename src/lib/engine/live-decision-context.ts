import type { Player, Role } from "@/types/player";
import type { AuctionState } from "@/types/auction";
import type { DecisionResult } from "@/types/decision";
import type { DynamicPricing, MarketSignals } from "@/types/dynamic-pricing";
import type { PlayerCompetitionContext } from "@/types/league";
import type { DepartmentPlan, NextObjective, RepartoFitResult } from "@/types/department-plan";

import { computeDynamicPricing, computeMarketSignals } from "./auction-intelligence-engine";
import { computePoolSizeByRole } from "./pool";
import { decide } from "./decision-engine";
import { computeSimulationTrigger, type SimulationTrigger } from "./simulation-trigger";
import { computePlayerCompetitionContext } from "./league-intelligence-engine";
import { getActiveDepartment } from "./reparto-intelligence-engine";
import { computeDepartmentPlan, computeNextObjective, computeRepartoFit } from "./department-plan-engine";

/**
 * LiveDecisionContext — vedi la conversazione di design per il
 * ragionamento completo (fase "Live Auction Flow").
 *
 * NON è un nuovo motore: è un orchestratore puro che compone gli output
 * di Decision Engine, AIE, Simulation Trigger, Department Plan Engine e
 * League Intelligence — tutti già esistenti, tutti invariati. Il suo
 * unico scopo è calcolare UNA VOLTA per render lo snapshot che serve al
 * pannello di decisione, così `DecisionPanel`, `CompetitorPanel`,
 * `ScenarioComparison` e il suggerimento "prossima chiamata" leggono
 * tutti lo stesso dato invece di ricalcolarlo ciascuno per conto proprio.
 *
 * Nessuna soglia, nessuna formula, nessun nuovo calcolo: ogni campo qui
 * sotto è esattamente il valore che le funzioni originali avrebbero
 * prodotto se chiamate singolarmente (vedi test di regressione).
 */
export interface LiveDecisionContext {
  activeRole: Role;
  /** true se il giocatore passato appartiene al reparto attivo (l'unico per cui ha senso mostrare piano/competitor). */
  isActiveDepartment: boolean;
  poolSizeByRole: Record<Role, number>;
  marketSignals: MarketSignals;
  dynamicPricing: DynamicPricing;
  decision: DecisionResult;
  trigger: SimulationTrigger;
  /** null se il giocatore non è nel reparto attivo — mai calcolato per un reparto non ancora aperto. */
  competitionContext: PlayerCompetitionContext | null;
  departmentPlan: DepartmentPlan | null;
  repartoFit: RepartoFitResult | null;
  nextObjective: NextObjective | null;
}

export function computeLiveDecisionContext(
  auctionState: AuctionState,
  players: Player[],
  player: Player,
  currentBid: number
): LiveDecisionContext {
  const activeRole = getActiveDepartment(auctionState);
  const isActiveDepartment = player.role === activeRole;

  const poolSizeByRole = computePoolSizeByRole(players);
  const marketSignals = computeMarketSignals(auctionState, players, poolSizeByRole);
  const dynamicPricing = computeDynamicPricing(player, auctionState, marketSignals, poolSizeByRole, currentBid);
  const decision = decide({ player, currentBid, auctionState, pricing: dynamicPricing }, poolSizeByRole);
  const trigger = computeSimulationTrigger(auctionState, players, player, currentBid, decision, dynamicPricing);

  let competitionContext: PlayerCompetitionContext | null = null;
  let departmentPlan: DepartmentPlan | null = null;
  let repartoFit: RepartoFitResult | null = null;
  let nextObjective: NextObjective | null = null;

  if (isActiveDepartment) {
    competitionContext = computePlayerCompetitionContext(auctionState, players, activeRole, currentBid);
    departmentPlan = computeDepartmentPlan(auctionState, players, activeRole);
    const fitList = computeRepartoFit(auctionState, players, activeRole);
    repartoFit = fitList.find((f) => f.player.id === player.id) ?? null;
    nextObjective = computeNextObjective(auctionState, players, activeRole, fitList);
  }

  return {
    activeRole,
    isActiveDepartment,
    poolSizeByRole,
    marketSignals,
    dynamicPricing,
    decision,
    trigger,
    competitionContext,
    departmentPlan,
    repartoFit,
    nextObjective,
  };
}
