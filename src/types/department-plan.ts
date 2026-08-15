import type { Player, Role } from "./player";

/**
 * Tipi per il Department Plan Engine — vedi
 * lib/engine/department-plan-engine.ts.
 *
 * "Tier" (fascia) è un concetto relativo, ricalcolato dai percentili
 * dell'Astra Index nel pool reale del ruolo — non soglie fisse. Il piano
 * che ne deriva è un'ipotesi strategica, ricalcolata ad ogni acquisto,
 * mai un vincolo di budget.
 */

export type Tier = "top" | "semi_top" | "titolare" | "scommessa";

export type TierCounts = Record<Tier, number>;

export interface DepartmentPlan {
  role: Role;
  /** Ipotesi iniziale (seed), mostrata solo per trasparenza — non un target fisso. */
  archetype: TierCounts;
  /** Fasce già coperte dai giocatori che ho comprato in questo reparto. */
  achieved: TierCounts;
  /** Ipotesi attuale, ricalcolata ad ogni acquisto e in base a scarsità/inflazione del pool. */
  remainingTarget: TierCounts;
  giocatoriMancanti: number;
  spesoNelReparto: number;
  budgetDisponibile: number;
  crossDepartmentNote: string | null;
}

export interface RepartoFitResult {
  player: Player;
  tier: Tier;
  fitScore: number;
  reason: string;
  /** Quante altre alternative restano nella stessa fascia — usato anche dal Simulation Trigger per stimare la scarsità reale. */
  alternativesRemaining: number;
}

export interface NextObjective {
  tier: Tier | null;
  title: string;
  message: string;
  candidatiRimasti: number;
}

export interface DepartmentCompletion {
  role: Role;
  forzaReparto: number;
  investimentoTotale: number;
  efficienza: number;
  valutazione: string;
}
