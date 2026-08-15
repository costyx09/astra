import type { Player, Role } from "@/types/player";
import type { AuctionState, TeamState } from "@/types/auction";
import type {
  CompetitorInfo,
  LeagueInsight,
  PlayerCompetitionContext,
  PressureLevel,
  TeamLeagueStatus,
  ThreatLevel,
  ThreatRankingEntry,
} from "@/types/league";
import {
  CREDITO_PER_SLOT_INIZIALE,
  minReserve,
  roleObligationRatio,
  slotsFree,
  totalSlotsFree,
} from "./auction-context";
import { computeOpponentProfiles, computeTeamAggressivita } from "./auction-intelligence-engine";
import { rosterPower } from "./simulator";
import { clamp } from "@/lib/utils/math";

/**
 * League Intelligence Engine — vedi la conversazione di design per il
 * ragionamento completo. Livello di CONTESTO sulle altre 7 squadre, non
 * un secondo Decision Engine: non produce mai un verdetto proprio,
 * arricchisce quello già calcolato da `decide()`.
 *
 * Riusa `computeOpponentProfiles` (AIE) per aggressività/pressione anziché
 * duplicarla, e `rosterPower` (simulator.ts) per la forza stimata — unica
 * definizione di "quanto conta una rosa" in tutto il progetto.
 */

const ROLES: Role[] = ["P", "D", "C", "A"];

function pressureLevel(auctionState: AuctionState, team: TeamState): PressureLevel {
  const slotVuoti = totalSlotsFree(auctionState, team);
  if (slotVuoti === 0) return "tranquilla"; // rosa completa: nessuna pressione residua
  const creditoPerSlot = team.budget.creditiResidui / slotVuoti;
  // Soglie riusate esattamente da quelle già stabilite in AIE/team-status
  // per "sottoPressione" (0.5×baseline) — qui aggiunta solo una fascia
  // intermedia "moderata" (0.85×baseline), non una soglia nuova inventata.
  if (creditoPerSlot < CREDITO_PER_SLOT_INIZIALE * 0.5) return "forte";
  if (creditoPerSlot < CREDITO_PER_SLOT_INIZIALE * 0.85) return "moderata";
  return "tranquilla";
}

/** --- 1) Dashboard delle 8 squadre --- */
export function computeLeagueStatus(auctionState: AuctionState, players: Player[]): TeamLeagueStatus[] {
  const playerById = new Map(players.map((p) => [p.id, p]));

  return auctionState.teams.map((team) => {
    const slotTotali = Object.values(auctionState.roleTargets).reduce((a, b) => a + b, 0);
    const slotMancantiPerRuolo = Object.fromEntries(ROLES.map((r) => [r, slotsFree(auctionState, team, r)])) as Record<Role, number>;
    const giocatoriAcquistati = team.roster.length;
    // computeTeamAggressivita funziona simmetricamente per qualsiasi
    // squadra inclusa "me" — computeOpponentProfiles (AIE) la esclude per
    // definizione, quindi qui usiamo l'helper condiviso direttamente.
    const { aggressivita, confidence } = computeTeamAggressivita(auctionState, players, team);

    return {
      teamId: team.id,
      teamName: team.name,
      isMe: team.id === "me",
      creditiResidui: team.budget.creditiResidui,
      giocatoriAcquistati,
      slotTotali,
      percentualeCompletata: Math.round((giocatoriAcquistati / slotTotali) * 100) / 100,
      spesaMedia: giocatoriAcquistati > 0 ? Math.round((team.budget.creditiSpesi / giocatoriAcquistati) * 10) / 10 : null,
      slotMancantiPerRuolo,
      pressione: pressureLevel(auctionState, team),
      forzaStimata: Math.round(rosterPower(team, playerById)),
      aggressivita: aggressivita !== null ? Math.round(aggressivita * 100) / 100 : null,
      aggressivitaConfidence: confidence,
    };
  });
}

/** --- 2/3/4) Competitor reali per un giocatore specifico --- */
export function computeCompetitorsForPlayer(
  auctionState: AuctionState,
  players: Player[],
  role: Role,
  currentBid: number
): CompetitorInfo[] {
  const profiles = new Map(computeOpponentProfiles(auctionState, players).map((p) => [p.teamId, p]));

  return auctionState.teams
    .filter((t) => t.id !== "me")
    .map((team) => {
      const slotLiberiRuolo = slotsFree(auctionState, team, role);
      const reserve = minReserve(auctionState, team, false);
      const canAfford = slotLiberiRuolo > 0 && team.budget.creditiResidui > currentBid + reserve;
      const profile = profiles.get(team.id);

      return {
        teamId: team.id,
        teamName: team.name,
        canAfford,
        slotLiberiRuolo,
        creditiResidui: team.budget.creditiResidui,
        pressione: pressureLevel(auctionState, team),
        obbligoRuolo: Math.round(roleObligationRatio(auctionState, team, role) * 100) / 100,
        aggressivita: profile ? Math.round(profile.aggressivita * 100) / 100 : null,
        aggressivitaConfidence: profile?.confidence ?? 0,
      };
    })
    .filter((c) => c.canAfford); // "competitor reale" = può davvero permetterselo (scenario E)
}

/** --- 6) Chi devo temere? --- */
export function computeThreatRanking(competitors: CompetitorInfo[], currentBid: number): ThreatRankingEntry[] {
  return competitors
    .map((c) => {
      const obbligoFactor = clamp(0.5 + c.obbligoRuolo, 0, 1); // 0.5 = neutro, sopra = più urgente della media
      const aggressivitaFactor = c.aggressivita !== null ? clamp(1 + c.aggressivitaConfidence * (c.aggressivita - 1), 0.5, 1.6) / 1.6 : 0.6;
      const headroom = clamp((c.creditiResidui - currentBid) / Math.max(currentBid, 1), 0, 1);

      const score = Math.round((obbligoFactor * 0.4 + aggressivitaFactor * 0.3 + headroom * 0.3) * 100) / 100;
      const level: ThreatLevel = score >= 0.65 ? "ALTA" : score >= 0.4 ? "MEDIA" : "BASSA";

      const parts: string[] = [`${c.slotLiberiRuolo} mancanti`, `${c.creditiResidui} crediti`];
      if (c.aggressivitaConfidence >= 0.4 && c.aggressivita !== null && c.aggressivita > 1.1) parts.push("tende a pagare sopra valore");
      if (c.pressione === "forte") parts.push("sotto forte pressione di budget");

      return { teamId: c.teamId, teamName: c.teamName, level, score, reason: parts.join(" · ") };
    })
    .sort((a, b) => b.score - a.score);
}

/** --- 7) Insight strategici, pochi e azionabili --- */
export function generateInsights(
  auctionState: AuctionState,
  role: Role,
  competitors: CompetitorInfo[],
  threatRanking: ThreatRankingEntry[]
): LeagueInsight[] {
  const insights: LeagueInsight[] = [];
  const totaleAvversari = auctionState.teams.length - 1;

  // Dati insufficienti: dichiara l'incertezza invece di inventare conclusioni.
  const conAggressivitaAffidabile = competitors.filter((c) => c.aggressivitaConfidence >= 0.4).length;
  if (auctionState.marketLog.length < 6) {
    insights.push({ emoji: "❓", message: "Asta appena iniziata: i segnali sugli avversari sono ancora poco affidabili." });
    return insights; // non aggiungere altro rumore sopra un segnale già dichiarato incerto
  }

  if (competitors.length === 0) {
    insights.push({ emoji: "🟢", message: "Nessun avversario è in grado di competere seriamente per questo giocatore." });
  } else if (competitors.length === 1) {
    insights.push({ emoji: "💡", message: `Solo ${competitors[0].teamName} può davvero competere per questo giocatore.` });
  }

  const moltiObbligatiConBudget = competitors.filter((c) => c.obbligoRuolo > 0.15 && c.pressione !== "forte").length;
  if (moltiObbligatiConBudget >= 2) {
    insights.push({
      emoji: "⚠️",
      message: `${moltiObbligatiConBudget} avversari devono ancora completare questo ruolo e hanno budget sufficiente: aspettati pressione sul prezzo.`,
    });
  }

  const ruoloCompletatoDaAltri = auctionState.teams.filter((t) => t.id !== "me" && slotsFree(auctionState, t, role) === 0).length;
  if (ruoloCompletatoDaAltri >= Math.ceil(totaleAvversari * 0.6)) {
    insights.push({
      emoji: "🔥",
      message: `${ruoloCompletatoDaAltri}/${totaleAvversari} avversari hanno già completato questo ruolo: la concorrenza si sta riducendo.`,
    });
  }

  if (conAggressivitaAffidabile === 0 && competitors.length > 0) {
    insights.push({ emoji: "❓", message: "Ancora troppi pochi acquisti per questi avversari per stimarne l'aggressività reale." });
  }

  const topThreat = threatRanking[0];
  if (topThreat && topThreat.level === "ALTA" && threatRanking.length === 1) {
    insights.push({ emoji: "💡", message: `Solo ${topThreat.teamName} è un rischio reale: puoi lasciare che sia lui a spingere il prezzo.` });
  }

  return insights.slice(0, 3); // pochi e azionabili, mai una lista infinita
}

/** --- Composizione per il DecisionPanel: tutto quanto serve per un giocatore specifico --- */
export function computePlayerCompetitionContext(
  auctionState: AuctionState,
  players: Player[],
  role: Role,
  currentBid: number
): PlayerCompetitionContext {
  const competitorsReali = computeCompetitorsForPlayer(auctionState, players, role, currentBid);
  const threatRanking = computeThreatRanking(competitorsReali, currentBid).slice(0, 3);
  const insights = generateInsights(auctionState, role, competitorsReali, threatRanking);
  const datiSufficienti = auctionState.marketLog.length >= 6;

  return { competitorsReali, threatRanking, insights, datiSufficienti };
}
