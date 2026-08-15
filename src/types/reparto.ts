import type { Player, Role } from "./player";

/**
 * Tipi per il Reparto Intelligence Engine — vedi
 * lib/engine/reparto-intelligence-engine.ts per la logica.
 * L'asta si svolge un reparto alla volta (P → D → C → A): questi tipi
 * descrivono lo stato e i suggerimenti relativi al reparto attivo.
 */

export type GapType =
  | "manca_top"
  | "manca_titolare"
  | "troppi_rischiosi"
  | "troppi_simili"
  | "manca_rigorista"
  | "manca_bonus"
  | "puoi_scommettere";

export interface DepartmentGap {
  type: GapType;
  message: string;
  severity: "info" | "warning";
}

export interface DepartmentReport {
  role: Role;
  giocatoriAcquistati: number;
  giocatoriMancanti: number;
  qualitaMedia: number | null;
  affidabilitaMedia: number | null;
  bonusMedia: number | null;
  titolariAffidabili: number;
  rischiosi: number;
  narrative: string;
  gaps: DepartmentGap[];
}

export type Badge = "occasione" | "top" | "sottovalutato" | "rischioso";

export interface RankedAvailablePlayer {
  player: Player;
  dynamicSuggestedPrice: number;
  dynamicMaxPrice: number;
  valueRatio: number;
  probabilitaSopraPrezzo: number;
  badges: Badge[];
}

export type OpportunityKind = "occasione" | "attenzione";

export interface Opportunity {
  kind: OpportunityKind;
  title: string;
  message: string;
  playerId?: string;
}

export interface DepartmentDashboard {
  role: Role;
  giocatoriAcquistati: number;
  giocatoriMancanti: number;
  qualitaMediaReparto: number | null;
  topRimasti: number;
  inflazioneReparto: number;
  budgetDisponibile: number;
  spesaMediaConsigliata: number;
}
