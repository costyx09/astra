"""
Prezzo consigliato e prezzo massimo — vedi astra-decision-engine.md,
sezione 3. Stessa logica del design originale, invariata: qui non ci sono
adattamenti dovuti ai dati mancanti (quotazione e Astra Index sono sempre
disponibili per ogni giocatore del listone).
"""
from .scoring import clamp

MARGIN_BASE_BY_ROLE = {"P": 0.12, "D": 0.15, "C": 0.18, "A": 0.22}
DISAGREEMENT_SENSITIVITY = 0.5
MAX_ADJUSTMENT = 0.35


def suggested_price(quotazione: int, percentile_prezzo: float, percentile_indice: float) -> int:
    disaccordo = percentile_indice - percentile_prezzo
    adjustment = clamp(DISAGREEMENT_SENSITIVITY * disaccordo, -MAX_ADJUSTMENT, MAX_ADJUSTMENT)
    return max(1, round(quotazione * (1 + adjustment)))


def margin_pct(role: str, confidence: float, sub_index_affidabilita: float) -> float:
    base = MARGIN_BASE_BY_ROLE[role]
    confidence_bonus = (confidence - 0.5) * 0.10
    affidabilita_penalty = (100 - sub_index_affidabilita) / 100 * 0.08
    return round(clamp(base + confidence_bonus - affidabilita_penalty, 0.05, 0.30), 2)


def max_price(suggested: int, margin: float) -> int:
    return round(suggested * (1 + margin))
