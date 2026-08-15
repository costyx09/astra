/**
 * Modello dati di un giocatore, così come viene generato dallo script Python
 * di preparazione dati e caricato staticamente da `players.json`.
 *
 * Principio di design (vedi astra-decision-engine.md, sezione 1):
 * i campi sono organizzati in blocchi che separano nettamente
 * "cosa sappiamo" (stats), "cosa ci aspettiamo" (status), "cosa pensa il
 * mercato" (market) e "cosa calcola Astra" (scores, pricing). Non vanno
 * mai fusi: è questa separazione che permette al Decision Engine di
 * scoprire disaccordi tra mercato e realtà.
 */

export type Role = "P" | "D" | "C" | "A";

export interface PlayerMarket {
  /** Quotazione ufficiale da listone, in crediti (base 500). Dato accessorio: non guida più il prezzo (vedi Budget Allocation Engine). */
  quotazioneUfficiale: number;
  /** Percentile della quotazione rispetto agli altri giocatori dello stesso ruolo (0-1). */
  quotazioneUfficialePercentileRuolo: number;
  /** FVM del listone dimezzato per una lega da 500 crediti. Solo accessorio/debug, non usato dal pricing. */
  fvmStimato500?: number | null;
}

export interface PlayerStats {
  presenzePrev: number;
  minutiPrev: number;
  mediaVoto: number;
  fantamedia: number;
  golPrev: number;
  assistPrev: number;
  rigoriCalciati: number;
  rigoriSegnati: number;
  ammonizioni: number;
  espulsioni: number;
  /** Solo per portieri e in parte difensori. */
  cleanSheetPrev: number | null;
}

export interface PlayerStatus {
  titolarePrevisto: boolean;
  /** Stima 0-1 della probabilità di essere titolare alla prima giornata utile. */
  probabilitaTitolarita: number;
  infortunioCorrente: string | null;
  /** Rango di rigorista designato (1=titolare, 2/3=riserva), null/assente se non rigorista. Segnale forward-looking, non dallo storico. */
  rigoristaRank?: number | null;
  storicoInfortuniGravi3y: number;
  giorniAssenzaUltimi12m: number;
  nuovoAcquisto: boolean;
  cambioRuoloTattico: boolean;
  /** 0-1, quanto è probabile che il calendario iniziale sia sfavorevole. */
  difficoltaCalendarioIniziale: number;
}

export interface PlayerScores {
  subIndexTitolarita: number;
  subIndexBonus: number;
  subIndexAffidabilita: number;
  /** Indice Astra 0-100, indipendente dal prezzo (vedi decision engine doc, sezione 2). */
  astraIndex: number;
  /** 0-1, quanto ci fidiamo di questa stima (dati completi/stabili vs incerti). */
  confidence: number;
}

export interface PlayerPricing {
  /** Prezzo consigliato statico, calcolato una tantum dallo script di preparazione. */
  suggestedPrice: number;
  /** Prezzo massimo statico oltre il quale il giocatore non è più un affare. */
  maxPrice: number;
  marginPct: number;
}

export interface PlayerMeta {
  computedAt: string;
  sourceFreshnessDays: number;
}

export interface Player {
  id: string;
  name: string;
  team: string;
  role: Role;
  subRole?: string;
  /** Nessuna fonte disponibile per l'età anagrafica in v1: opzionale, null se sconosciuta. */
  age: number | null;

  market: PlayerMarket;
  stats: PlayerStats;
  status: PlayerStatus;
  scores: PlayerScores;
  pricing: PlayerPricing;

  explanationShort: string;
  meta: PlayerMeta;
}
