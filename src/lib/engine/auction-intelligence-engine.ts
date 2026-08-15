import type { Player, Role } from "@/types/player";
import type { AuctionState, TeamId } from "@/types/auction";
import type { DynamicPricing, MarketSignals, OpponentProfile } from "@/types/dynamic-pricing";
import { clamp } from "@/lib/utils/math";
import { CREDITO_PER_SLOT_INIZIALE, minReserve, slotsFree, totalSlotsFree } from "./auction-context";

/**
 * Auction Intelligence Engine — vedi astra-auction-intelligence-engine.md.
 *
 * Ricalcola i segnali di mercato e i prezzi dinamici a partire dal solo
 * `marketLog`: nessuna fonte esterna, nessuna chiamata di rete. Va
 * richiamato ad ogni variazione dello stato asta (nuovo acquisto,
 * tuo o di un avversario).
 */

const ROLES: Role[] = ["P", "D", "C", "A"];

/** --- Sezione 3: segnali di mercato --- */

export function computeMarketSignals(
  auctionState: AuctionState,
  players: Player[],
  poolSizeByRole: Record<Role, number>
): MarketSignals {
  const playerById = new Map(players.map((p) => [p.id, p]));

  const inflazioneEffettiva = {} as Record<Role, number>;
  const scarsita = {} as Record<Role, number>;

  for (const role of ROLES) {
    const soldEntries = auctionState.marketLog.filter((e) => e.role === role);
    const total = poolSizeByRole[role] ?? Math.max(soldEntries.length, 1);

    if (soldEntries.length === 0) {
      inflazioneEffettiva[role] = 1;
    } else {
      const ratios = soldEntries.map((e) => {
        const p = playerById.get(e.playerId);
        const base = p?.pricing.suggestedPrice ?? e.pricePaid;
        return base > 0 ? e.pricePaid / base : 1;
      });
      const inflazioneRuolo = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const pesoCampione = clamp(soldEntries.length / 5, 0, 1);
      inflazioneEffettiva[role] = 1 + (inflazioneRuolo - 1) * pesoCampione;
    }

    scarsita[role] = total > 0 ? 1 - soldEntries.length / total : 0;
  }

  const creditiResiduiTotali = auctionState.teams.reduce((sum, t) => sum + t.budget.creditiResidui, 0);
  const slotVuotiTotali = auctionState.teams.reduce((sum, t) => sum + totalSlotsFree(auctionState, t), 0);
  const creditoPerSlotAttuale = slotVuotiTotali > 0 ? creditiResiduiTotali / slotVuotiTotali : CREDITO_PER_SLOT_INIZIALE;
  const pressioneBudget = creditoPerSlotAttuale / CREDITO_PER_SLOT_INIZIALE;

  return { inflazioneEffettiva, scarsita, pressioneBudget };
}

/** --- Sezione 3.4: pressione di competizione su un giocatore specifico --- */

export function computeCompetitionPressure(
  auctionState: AuctionState,
  role: Role,
  currentBid: number
): number {
  const opponents = auctionState.teams.filter((t) => t.id !== "me");
  if (opponents.length === 0) return 0;

  const canAfford = opponents.filter((team) => {
    const reserve = minReserve(auctionState, team, false);
    const hasSlot = slotsFree(auctionState, team, role) > 0;
    return hasSlot && team.budget.creditiResidui > currentBid + reserve;
  });

  return canAfford.length / opponents.length;
}

/** --- Sezione 4: ricalcolo dinamico prezzo per un giocatore --- */

export function computeDynamicPricing(
  player: Player,
  auctionState: AuctionState,
  marketSignals: MarketSignals,
  poolSizeByRole: Record<Role, number>,
  currentBid: number
): DynamicPricing {
  const role = player.role;
  const myTeam = auctionState.teams.find((t) => t.id === "me");

  const dynamicSuggestedPrice = Math.max(
    1,
    Math.round(
      player.pricing.suggestedPrice *
        marketSignals.inflazioneEffettiva[role] *
        (1 + (1 - marketSignals.scarsita[role]) * 0.15) *
        (0.85 + 0.3 * clamp(marketSignals.pressioneBudget, 0, 2))
    )
  );

  const competitionPressure = computeCompetitionPressure(auctionState, role, currentBid);

  let urgenzaMiaRosa = 0;
  if (myTeam) {
    const slotLiberi = slotsFree(auctionState, myTeam, role);
    const roleTarget = auctionState.roleTargets[role];
    urgenzaMiaRosa = roleTarget > 0 ? (slotLiberi / roleTarget) * (1 - marketSignals.scarsita[role]) : 0;
  }

  const bonusUrgenzaDinamico = urgenzaMiaRosa * (1 - competitionPressure);
  const marginPctTotale = clamp(player.pricing.marginPct + bonusUrgenzaDinamico, 0.05, 0.4);

  const dynamicMaxPrice = Math.round(dynamicSuggestedPrice * (1 + marginPctTotale));

  return {
    playerId: player.id,
    dynamicSuggestedPrice,
    dynamicMaxPrice,
    competitionPressure,
  };
}

/** --- Sezione 5: profilo oggettivo degli avversari --- */

/**
 * Aggressività osservata (prezzo pagato / prezzo consigliato al momento
 * dell'acquisto) e relativa confidence, per QUALSIASI squadra — inclusa
 * "me", che `computeOpponentProfiles` esclude per definizione (modella
 * solo gli avversari). Estratta come helper condiviso proprio per questo:
 * la Dashboard Squadre la applica simmetricamente a tutte e 8, senza una
 * seconda implementazione del calcolo (vedi team-status.ts).
 */
export function computeTeamAggressivita(
  auctionState: AuctionState,
  players: Player[],
  team: { id: string; roster: { playerId: string; pricePaid: number }[] }
): { aggressivita: number | null; confidence: number } {
  if (team.roster.length === 0) return { aggressivita: null, confidence: 0 };

  const playerById = new Map(players.map((p) => [p.id, p]));
  const ratios = team.roster.map((slot) => {
    const p = playerById.get(slot.playerId);
    const base = p?.pricing.suggestedPrice ?? slot.pricePaid;
    return base > 0 ? slot.pricePaid / base : 1;
  });
  const aggressivita = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const confidence = clamp(team.roster.length / 5, 0, 1);
  return { aggressivita, confidence };
}

export function computeOpponentProfiles(auctionState: AuctionState, players: Player[]): OpponentProfile[] {
  return auctionState.teams
    .filter((t) => t.id !== "me")
    .map((team) => {
      const { aggressivita, confidence } = computeTeamAggressivita(auctionState, players, team);

      const slotVuoti = totalSlotsFree(auctionState, team);
      const creditoPerSlot = slotVuoti > 0 ? team.budget.creditiResidui / slotVuoti : Infinity;
      const sottoPressione = creditoPerSlot < CREDITO_PER_SLOT_INIZIALE * 0.5;

      return {
        teamId: team.id as TeamId,
        aggressivita: aggressivita ?? 1,
        confidence,
        sottoPressione,
      };
    });
}
