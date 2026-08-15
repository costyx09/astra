import type { Role } from "./player";
import type { TeamId } from "./auction";

/**
 * Tipi per il League Intelligence Engine — vedi
 * lib/engine/league-intelligence-engine.ts.
 *
 * Livello di CONTESTO, non un secondo motore decisionale: il Decision
 * Engine resta l'unica autorità su RILANCIA/ASPETTA/NON_RILANCIARE.
 */

export type PressureLevel = "tranquilla" | "moderata" | "forte";
export type ThreatLevel = "ALTA" | "MEDIA" | "BASSA";

export interface TeamLeagueStatus {
  teamId: TeamId;
  teamName: string;
  isMe: boolean;
  creditiResidui: number;
  giocatoriAcquistati: number;
  slotTotali: number;
  percentualeCompletata: number; // 0-1
  spesaMedia: number | null;
  slotMancantiPerRuolo: Record<Role, number>;
  pressione: PressureLevel;
  forzaStimata: number;
  aggressivita: number | null; // null se nessun acquisto ancora
  aggressivitaConfidence: number; // 0-1
}

export interface CompetitorInfo {
  teamId: TeamId;
  teamName: string;
  canAfford: boolean;
  slotLiberiRuolo: number;
  creditiResidui: number;
  pressione: PressureLevel;
  obbligoRuolo: number; // vedi roleObligationRatio
  aggressivita: number | null;
  aggressivitaConfidence: number;
}

export interface ThreatRankingEntry {
  teamId: TeamId;
  teamName: string;
  level: ThreatLevel;
  score: number;
  reason: string;
}

export interface LeagueInsight {
  emoji: string;
  message: string;
}

export interface PlayerCompetitionContext {
  competitorsReali: CompetitorInfo[]; // solo chi può davvero permetterselo (canAfford)
  threatRanking: ThreatRankingEntry[]; // sottoinsieme dei competitor reali, i più pericolosi
  insights: LeagueInsight[];
  datiSufficienti: boolean;
}
