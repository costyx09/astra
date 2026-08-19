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

/**
 * Guardrail anti-esplosione prezzi (fix audit pre-asta 2026-08-19).
 *
 * Problema riscontrato: `inflazioneEffettiva` era una media semplice dei
 * rapporti prezzo-pagato/prezzo-consigliato, senza alcun limite, e già a
 * 5 vendite raggiungeva peso pieno. Una manciata di vendite "pazze" su
 * giocatori economici (comune nelle prime fasi reali di un'asta, specie
 * per D e C di fascia bassa: un 2 crediti pagato 8 fa un rapporto 4x)
 * poteva propagarsi come moltiplicatore diretto sul prezzo dinamico di
 * TUTTI i giocatori rimanenti di quel ruolo, producendo prezzi assurdi
 * (dimostrato in audit: difensore da 20cr -> consigliato dinamico 105,
 * massimo 136).
 *
 * Due livelli di protezione, entrambi necessari:
 * 1) SINGLE_SALE_RATIO_CLAMP: nessuna singola vendita può contribuire
 *    alla media con un rapporto oltre 3x o sotto 0.3x — un singolo
 *    eccesso/sconto isolato non deve dominare il segnale di inflazione.
 * 2) INFLATION_CAP: il fattore finale di inflazione per ruolo resta
 *    comunque entro [0.6, 1.6] — un'inflazione di ruolo sostenuta oltre
 *    il 60% è già un segnale fortissimo, oltre non aggiunge realismo,
 *    solo rischio di prezzi fuori scala quando composto con scarsità e
 *    pressione di budget (che possono aggiungere fino a un ulteriore
 *    +67% combinato) e col margine massimo (+40%) per il prezzo massimo.
 */
const SINGLE_SALE_RATIO_CLAMP: [number, number] = [0.3, 3];
const INFLATION_CAP: [number, number] = [0.6, 1.6];

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
        const raw = base > 0 ? e.pricePaid / base : 1;
        // Nessuna singola vendita può dominare la media (vedi guardrail sopra).
        return clamp(raw, SINGLE_SALE_RATIO_CLAMP[0], SINGLE_SALE_RATIO_CLAMP[1]);
      });
      const inflazioneRuolo = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      const pesoCampione = clamp(soldEntries.length / 5, 0, 1);
      const inflazioneSmorzata = 1 + (inflazioneRuolo - 1) * pesoCampione;
      inflazioneEffettiva[role] = clamp(inflazioneSmorzata, INFLATION_CAP[0], INFLATION_CAP[1]);
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
