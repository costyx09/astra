import type { Player, Role } from "@/types/player";
import type { AuctionState } from "@/types/auction";
import { TOTAL_TEAMS } from "@/types/auction";
import type {
  Badge,
  DepartmentDashboard,
  DepartmentGap,
  DepartmentReport,
  Opportunity,
  RankedAvailablePlayer,
} from "@/types/reparto";
import { getMyTeam, playersSoldByRole, slotsFree } from "./auction-context";
import { computeDynamicPricing, computeMarketSignals } from "./auction-intelligence-engine";
import { computePoolSizeByRole } from "./pool";
import { clamp } from "@/lib/utils/math";

/**
 * Reparto Intelligence Engine — consulente strategico del reparto attivo.
 *
 * L'asta si svolge un reparto alla volta (Portieri → Difensori →
 * Centrocampisti → Attaccanti, si completa un reparto in tutta la lega
 * prima di passare al successivo). Questo motore non sostituisce Decision
 * Engine, Auction Intelligence Engine o il suggeritore "Chi chiamare?" —
 * li riusa così come sono, aggiungendo un livello di lettura sopra:
 * non solo "compro questo giocatore?", ma "come sta andando il mio
 * reparto e cosa mi serve davvero?".
 *
 * Nessun limite di budget rigido: la "spesa media consigliata" nel
 * dashboard è sempre e solo un riferimento informativo, mai un vincolo.
 */

const ROLES_ORDER: Role[] = ["P", "D", "C", "A"];
const ROLE_LABEL: Record<Role, string> = { P: "Portieri", D: "Difesa", C: "Centrocampo", A: "Attacco" };

const TITOLARE_AFFIDABILE_SOGLIA = { titolarita: 75, affidabilita: 65 };
const RISCHIOSO_SOGLIA_AFFIDABILITA = 50;

/** --- Reparto attivo, dedotto dall'ordine di gioco P → D → C → A --- */
export function getActiveDepartment(auctionState: AuctionState): Role {
  for (const role of ROLES_ORDER) {
    const totalLeagueSlots = auctionState.roleTargets[role] * TOTAL_TEAMS;
    if (playersSoldByRole(auctionState, role) < totalLeagueSlots) return role;
  }
  return "A"; // asta di fatto conclusa: resta sull'ultimo reparto
}

function topThreshold(players: Player[], role: Role): number {
  const values = players.filter((p) => p.role === role).map((p) => p.scores.astraIndex).sort((a, b) => b - a);
  if (values.length === 0) return 80;
  return values[Math.floor(values.length * 0.2)] ?? values[values.length - 1];
}

/** --- 1) Analisi qualitativa del reparto + 2) cosa manca --- */
export function analyzeDepartment(auctionState: AuctionState, players: Player[], role: Role): DepartmentReport {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const myTeam = getMyTeam(auctionState);
  const myRoster = myTeam.roster.filter((s) => s.role === role);
  const myPlayers = myRoster.map((s) => playerById.get(s.playerId)).filter((p): p is Player => Boolean(p));
  const giocatoriMancanti = slotsFree(auctionState, myTeam, role);

  if (myPlayers.length === 0) {
    return {
      role,
      giocatoriAcquistati: 0,
      giocatoriMancanti,
      qualitaMedia: null,
      affidabilitaMedia: null,
      bonusMedia: null,
      titolariAffidabili: 0,
      rischiosi: 0,
      narrative: `${ROLE_LABEL[role]}: reparto ancora da iniziare.`,
      gaps: [],
    };
  }

  const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
  const qualitaMedia = avg(myPlayers.map((p) => p.scores.astraIndex));
  const affidabilitaMedia = avg(myPlayers.map((p) => p.scores.subIndexAffidabilita));
  const bonusMedia = avg(myPlayers.map((p) => p.scores.subIndexBonus));
  const titolariAffidabili = myPlayers.filter(
    (p) => p.scores.subIndexTitolarita >= TITOLARE_AFFIDABILE_SOGLIA.titolarita && p.scores.subIndexAffidabilita >= TITOLARE_AFFIDABILE_SOGLIA.affidabilita
  ).length;
  const rischiosi = myPlayers.filter((p) => p.scores.subIndexAffidabilita < RISCHIOSO_SOGLIA_AFFIDABILITA).length;

  // --- narrativa, composta a blocchi (stesso pattern di explanation_short in Python) ---
  const parts: string[] = [];
  if (bonusMedia >= 70) parts.push("molto offensivo");
  else if (bonusMedia < 45) parts.push("poco propositivo in fase offensiva");
  if (affidabilitaMedia < 55) parts.push("rischio turnover/infortuni elevato");
  else if (affidabilitaMedia >= 75) parts.push("solido e affidabile");
  if (titolariAffidabili === 0) parts.push("manca ancora un titolare davvero affidabile");

  const opening = parts.length > 0 ? `${ROLE_LABEL[role]}: ${parts.join(", ")}.` : `${ROLE_LABEL[role]}: reparto nella media.`;

  let advice = "";
  if (titolariAffidabili >= 1 && rischiosi === 0 && qualitaMedia >= 60 && giocatoriMancanti > 0) {
    advice = "Puoi permetterti una scommessa su un profilo rischioso.";
  } else if (titolariAffidabili === 0 && giocatoriMancanti > 0) {
    advice = "Priorità: assicurati un titolare affidabile prima di continuare.";
  } else if (rischiosi >= Math.ceil(myPlayers.length / 2) && giocatoriMancanti > 0) {
    advice = "Valuta di stabilizzare il reparto con un profilo più sicuro.";
  }

  const narrative = advice ? `${opening} ${advice}` : opening;

  // --- gap, basati sui dati di questa rosa, non su regole fisse generiche ---
  const gaps: DepartmentGap[] = [];
  if (giocatoriMancanti > 0) {
    const soglia = topThreshold(players, role);
    if (!myPlayers.some((p) => p.scores.astraIndex >= soglia)) {
      gaps.push({ type: "manca_top", message: `Non hai ancora un top ${role} (indice ≥ ${Math.round(soglia)}).`, severity: "info" });
    }
    if (titolariAffidabili === 0) {
      gaps.push({ type: "manca_titolare", message: "Ti manca ancora un titolare fisso e affidabile.", severity: "warning" });
    }
    if (rischiosi >= Math.ceil(myPlayers.length * 0.5) && myPlayers.length >= 2) {
      gaps.push({ type: "troppi_rischiosi", message: "Hai troppi giocatori rischiosi in questo reparto.", severity: "warning" });
    }
    if (myPlayers.length >= 3) {
      const subRoles = myPlayers.map((p) => p.subRole).filter(Boolean);
      if (subRoles.length >= 3 && new Set(subRoles).size === 1) {
        gaps.push({ type: "troppi_simili", message: "Hai giocatori molto simili tra loro: valuta un profilo diverso.", severity: "info" });
      }
    }
    if ((role === "A" || role === "C") && !myPlayers.some((p) => p.status.rigoristaRank)) {
      gaps.push({ type: "manca_rigorista", message: `Nessun rigorista designato ancora in rosa tra i tuoi ${ROLE_LABEL[role].toLowerCase()}.`, severity: "info" });
    }
    if (bonusMedia < 45 && myPlayers.length >= 2) {
      gaps.push({ type: "manca_bonus", message: "Ti manca un giocatore da bonus in questo reparto.", severity: "info" });
    }
    if (titolariAffidabili >= 1 && rischiosi === 0) {
      gaps.push({ type: "puoi_scommettere", message: "Reparto stabile: puoi permetterti una scommessa a basso costo.", severity: "info" });
    }
  }

  return { role, giocatoriAcquistati: myPlayers.length, giocatoriMancanti, qualitaMedia, affidabilitaMedia, bonusMedia, titolariAffidabili, rischiosi, narrative, gaps };
}

/** --- 3) Classifica giocatori disponibili del reparto, con badge --- */
export function rankRemainingPlayers(auctionState: AuctionState, players: Player[], role: Role): RankedAvailablePlayer[] {
  const soldIds = new Set(auctionState.marketLog.map((e) => e.playerId));
  const poolSizeByRole = computePoolSizeByRole(players);
  const marketSignals = computeMarketSignals(auctionState, players, poolSizeByRole);
  const soglia = topThreshold(players, role);

  const available = players.filter((p) => p.role === role && !soldIds.has(p.id));

  const provisional = available.map((player) => {
    const pricing = computeDynamicPricing(player, auctionState, marketSignals, poolSizeByRole, player.pricing.suggestedPrice);
    const valueRatio = player.scores.astraIndex / Math.max(pricing.dynamicSuggestedPrice, 1);
    const probabilitaSopraPrezzo = clamp(
      marketSignals.inflazioneEffettiva[role] - 1 + pricing.competitionPressure * 0.4,
      0,
      1
    );
    return { player, pricing, valueRatio, probabilitaSopraPrezzo };
  });

  const ranked: RankedAvailablePlayer[] = provisional.map(({ player, pricing, valueRatio, probabilitaSopraPrezzo }) => {
    const badges: Badge[] = [];
    if (player.scores.astraIndex >= soglia) badges.push("top");

    // "Occasione": non un rapporto qualità/prezzo generico (penalizzerebbe
    // sistematicamente i profili affidabili-ma-poco-offensivi, che il VOR
    // prezza correttamente basso pur avendo un Astra Index discreto) — il
    // confronto è con i PARI INDICE (±6 punti), stesso ruolo. Solo chi
    // costa molto meno di giocatori di qualità comparabile è un'anomalia
    // di mercato reale, non solo un profilo "affidabile ma economico".
    const peers = provisional.filter(
      (o) => o.player.id !== player.id && Math.abs(o.player.scores.astraIndex - player.scores.astraIndex) <= 6
    );
    if (peers.length >= 3) {
      const peerPrices = peers.map((o) => o.pricing.dynamicSuggestedPrice).sort((a, b) => a - b);
      const medianPeerPrice = peerPrices[Math.floor(peerPrices.length / 2)];
      if (pricing.dynamicSuggestedPrice < medianPeerPrice * 0.6 && medianPeerPrice >= 5) {
        badges.push("occasione");
      }
    }

    if (pricing.dynamicSuggestedPrice < player.pricing.suggestedPrice * 0.85) badges.push("sottovalutato");
    if (player.scores.subIndexAffidabilita < RISCHIOSO_SOGLIA_AFFIDABILITA || player.scores.confidence < 0.5) badges.push("rischioso");

    return {
      player,
      dynamicSuggestedPrice: pricing.dynamicSuggestedPrice,
      dynamicMaxPrice: pricing.dynamicMaxPrice,
      valueRatio: Math.round(valueRatio * 100) / 100,
      probabilitaSopraPrezzo: Math.round(probabilitaSopraPrezzo * 100) / 100,
      badges,
    };
  });

  ranked.sort((a, b) => b.player.scores.astraIndex - a.player.scores.astraIndex);
  return ranked;
}

/** --- 4) Occasioni del momento: solo segnali realmente rilevanti --- */
export function detectOpportunities(ranked: RankedAvailablePlayer[], role: Role): Opportunity[] {
  const opportunities: Opportunity[] = [];

  const occasioni = ranked
    .filter((r) => r.badges.includes("occasione"))
    .sort((a, b) => b.valueRatio - a.valueRatio)
    .slice(0, 2);

  for (const o of occasioni) {
    opportunities.push({
      kind: "occasione",
      title: "🔥 Occasione",
      message: `${o.player.name}: prezzo previsto ${o.dynamicSuggestedPrice}, indice ${o.player.scores.astraIndex} — tra i migliori affari rimasti in questo reparto.`,
      playerId: o.player.id,
    });
  }

  const topRimasti = ranked.filter((r) => r.badges.includes("top"));
  const inflazioneAlta = ranked.length > 0 && ranked[0].probabilitaSopraPrezzo > 0.55;
  if (inflazioneAlta && topRimasti.length <= 2 && topRimasti.length > 0) {
    opportunities.push({
      kind: "attenzione",
      title: "⚠️ Attenzione",
      message: `I top ${ROLE_LABEL[role].toLowerCase()} stanno andando sopra prezzo. Ne restano solo ${topRimasti.length}: il prossimo potrebbe essere l'ultima occasione.`,
    });
  }

  return opportunities.slice(0, 3);
}

/** --- 5) Dashboard sempre visibile del reparto attivo --- */
export function getDepartmentDashboard(auctionState: AuctionState, players: Player[], role: Role): DepartmentDashboard {
  const myTeam = getMyTeam(auctionState);
  const giocatoriMancanti = slotsFree(auctionState, myTeam, role);
  const report = analyzeDepartment(auctionState, players, role);
  const ranked = rankRemainingPlayers(auctionState, players, role);
  const poolSizeByRole = computePoolSizeByRole(players);
  const marketSignals = computeMarketSignals(auctionState, players, poolSizeByRole);

  const topRimasti = ranked.filter((r) => r.badges.includes("top")).length;

  // Riferimento informativo, MAI un vincolo: media dei prezzi dinamici dei
  // migliori N giocatori disponibili, N = slot che ti mancano davvero.
  const riferimento = ranked.slice(0, Math.max(giocatoriMancanti, 1));
  const spesaMediaConsigliata =
    giocatoriMancanti > 0 && riferimento.length > 0
      ? Math.round(riferimento.reduce((sum, r) => sum + r.dynamicSuggestedPrice, 0) / riferimento.length)
      : 0;

  return {
    role,
    giocatoriAcquistati: report.giocatoriAcquistati,
    giocatoriMancanti,
    qualitaMediaReparto: report.qualitaMedia,
    topRimasti,
    inflazioneReparto: Math.round(marketSignals.inflazioneEffettiva[role] * 100) / 100,
    budgetDisponibile: myTeam.budget.creditiResidui,
    spesaMediaConsigliata,
  };
}
