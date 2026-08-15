"""
Calcolo dell'Astra Index e dei sotto-indici — vedi astra-decision-engine.md,
sezione 2.

Adattamenti rispetto alla formula originale, dovuti ai dati realmente
disponibili in questa v1 (vedi conversazione di scoping):
  - non abbiamo i minuti giocati, solo le presenze: il sub-indice
    Titolarità usa `presenze/38` come proxy sia di continuità che di
    probabilità di titolarità attesa (placeholder, da correggere a mano
    vicino all'asta con dati di preseason reali).
  - non abbiamo età né storico infortuni: i rispettivi termini di penalità
    nel sub-indice Affidabilità sono a zero (nessuna informazione,
    nessuna penalità — non "nessun rischio").
  - il calendario iniziale non è ancora integrato in modo strutturato in
    questa v1 (il PDF fornito non ha testo estraibile in modo affidabile):
    la difficoltà calendario è un valore neutro fisso (0.5) per tutti,
    da sostituire con un calcolo reale in un secondo passaggio.
"""
from dataclasses import dataclass

from .io_stats import StatsRow

ROLE_WEIGHTS = {
    "P": {"titolarita": 0.40, "bonus": 0.30, "affidabilita": 0.30},
    "D": {"titolarita": 0.35, "bonus": 0.35, "affidabilita": 0.30},
    "C": {"titolarita": 0.30, "bonus": 0.45, "affidabilita": 0.25},
    "A": {"titolarita": 0.25, "bonus": 0.55, "affidabilita": 0.20},
}

CALENDARIO_DIFFICOLTA_PLACEHOLDER = 0.5
GIORNATE_STAGIONE = 38


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


@dataclass
class ScoreInputs:
    role: str
    stats: StatsRow | None


def continuity_ratio(stats: StatsRow | None) -> float:
    """Proxy di continuità/titolarità dalle sole presenze (vedi nota in testa al file)."""
    if stats is None or stats.presenze <= 0:
        return 0.0
    return clamp(stats.presenze / GIORNATE_STAGIONE, 0.0, 1.0)


def sub_index_titolarita(stats: StatsRow | None) -> float:
    return round(100 * continuity_ratio(stats), 1)


GIORNATE_STAGIONE_INTERA = 38

RIGORISTA_BONUS = {1: 4.0, 2: 2.0, 3: 1.0}  # usato da bonus_raw/astra_index (display), non dal pricing

# "Voto puro" di riferimento per ruolo: sotto questa soglia un giocatore
# non sta producendo bonus/malus rilevanti, sta solo "sufficiente".
# Fondamentale: la fantamedia assoluta oscilla in un range molto stretto
# (5.2-9.0 per gli attaccanti, ancora più stretto per gli altri ruoli) —
# usarla direttamente fa dominare il "voto base" (~6, presente per
# chiunque giochi) sul segnale che conta davvero, cioè il bonus. Sottrarre
# il voto puro isola esattamente la parte che il mercato reale premia.
BASE_VOTE = {"P": 4.7, "D": 5.6, "C": 5.7, "A": 5.9}

# Valore minimo per chi non ha storico: basso ma non zero, coerente con
# l'incertezza reale su questi giocatori (nuovi in Serie A o trasferiti).
NO_STATS_EXCESS_PER_GAME = 0.5

# Bonus di fantamedia per un rigorista designato: segnale "forward looking"
# che lo storico non può contenere per un neo-arrivato.
RIGORISTA_FANTAMEDIA_BONUS = {1: 0.15, 2: 0.07, 3: 0.03}


def expected_season_value(
    role: str,
    stats: StatsRow | None,
    continuity: float,
    rigorista_rank: int | None = None,
) -> float:
    """
    Valore Tecnico di un giocatore: eccesso di produzione fantacalcistica
    attesa sull'intera stagione, sopra il "voto puro" del ruolo — non un
    punteggio 0-100, una quantità reale (fantamedia in eccesso × partite
    attese) usata dal Budget Allocation Engine (vedi
    BUDGET_ALLOCATION_DESIGN.md, revisione Value Over Replacement v4).

    Deliberatamente NON normalizzato per ruolo (niente percentili): è la
    differenza di scala assoluta tra ruoli a permettere al Budget
    Allocation Engine di scoprire da solo quanto budget merita ogni
    ruolo, senza quote fisse imposte a priori.
    """
    if stats is None or stats.fantamedia <= 0:
        return NO_STATS_EXCESS_PER_GAME * continuity * GIORNATE_STAGIONE_INTERA

    fantamedia = stats.fantamedia + (
        RIGORISTA_FANTAMEDIA_BONUS.get(rigorista_rank, 0.0) if rigorista_rank else 0.0
    )
    excess = max(0.0, fantamedia - BASE_VOTE[role])
    partite_attese = continuity * GIORNATE_STAGIONE_INTERA
    return excess * partite_attese


def bonus_raw(
    role: str,
    stats: StatsRow | None,
    rigorista_rank: int | None = None,
    gol_per_90: float | None = None,
) -> float:
    """
    Allineato alla stessa metrica usata dal pricing (VOR, vedi
    expected_season_value): fantamedia in eccesso sopra il "voto puro"
    del ruolo. Prima di questo allineamento, bonus_raw usava una formula
    indipendente (gol/assist grezzi), che poteva produrre un Astra Index
    alto per un giocatore che il pricing VOR prezzava vicino al minimo —
    un'incoerenza scoperta osservando falsi "occasione" nel Reparto
    Intelligence Engine (indice alto, prezzo 1). Ora le due metriche
    raccontano sempre la stessa storia.

    `gol_per_90` non è più usato qui (l'eccesso di fantamedia lo cattura
    già indirettamente); resta come segnale accessorio solo per
    `rigorista_rank`, forward-looking e non presente nello storico.
    """
    rigorista_extra = RIGORISTA_BONUS.get(rigorista_rank, 0.0) if rigorista_rank else 0.0

    if stats is None or stats.fantamedia <= 0:
        return rigorista_extra

    excess = max(0.0, stats.fantamedia - BASE_VOTE[role])
    return excess * 10 + rigorista_extra


def sub_index_affidabilita(stats: StatsRow | None, difficolta_calendario: float = CALENDARIO_DIFFICOLTA_PLACEHOLDER) -> float:
    penalita_cartellini = 0.0
    if stats is not None:
        penalita_cartellini = stats.ammonizioni * 0.8 + stats.espulsioni * 5

    penalita_calendario = difficolta_calendario * 10
    # penalita_eta e penalita_infortuni: 0, nessuna fonte disponibile in v1

    return round(clamp(100 - (penalita_cartellini + penalita_calendario), 0, 100), 1)


def percentile_rank(values: list[float], value: float) -> float:
    """Percentile 0-1 di `value` all'interno di `values` (più alto = migliore)."""
    if not values:
        return 0.5
    below_or_equal = sum(1 for v in values if v <= value)
    return below_or_equal / len(values)


def astra_index(role: str, sub_titolarita: float, sub_bonus: float, sub_affidabilita: float) -> float:
    w = ROLE_WEIGHTS[role]
    return round(
        w["titolarita"] * sub_titolarita + w["bonus"] * sub_bonus + w["affidabilita"] * sub_affidabilita,
        1,
    )


def confidence(has_stats: bool, is_transfer: bool) -> float:
    disponibilita_dati = 1.0 if has_stats else 0.3
    stabilita_contesto = 0.6 if is_transfer else (1.0 if has_stats else 0.5)
    certezza_titolarita = disponibilita_dati  # proxy: senza dati reali di preseason, coincide
    return round(0.4 * disponibilita_dati + 0.3 * stabilita_contesto + 0.3 * certezza_titolarita, 2)
