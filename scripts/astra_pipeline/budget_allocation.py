"""
Budget Allocation Engine v4 — Value Over Replacement (VOR) su fantamedia
in eccesso. Vedi BUDGET_ALLOCATION_DESIGN.md, sezione 16.

NESSUN budget fisso per ruolo, e — a differenza della v3 — NESSUN fattore
di correzione artificiale sul valore in ingresso. La v3 introduceva un
ROLE_POTENTIAL_FACTOR per compensare il fatto che la fantamedia assoluta
schiacciava il segnale utile; la v4 risolve il problema alla radice in
scoring.expected_season_value() (fantamedia in ECCESSO sopra un "voto
puro" di riferimento, non fantamedia assoluta), che da sola produce già
una separazione realistica tra ruoli e tra giocatori — senza bisogno di
correzioni a valle.

Cosa varia per ruolo qui dentro:
- REPLACEMENT_RANK: il rango usato per il "livello di rimpiazzo" (vedi
  sotto, necessario perché il mercato dei portieri è strutturalmente
  meno profondo degli altri ruoli — non è una scelta di quanto budget
  dare ai portieri, è quanti portieri esistono davvero in Serie A).

Tutto il resto — quanto budget finisce in un ruolo, quanto vale un
giocatore dentro il proprio ruolo — è un OUTPUT del modello.
"""
from dataclasses import dataclass

TOTAL_TEAMS = 8
CREDITS_PER_TEAM = 500
TOTAL_BUDGET = CREDITS_PER_TEAM * TOTAL_TEAMS  # 4.000

SLOTS_PER_TEAM = {"P": 3, "D": 8, "C": 8, "A": 6}
SLOTS_LEAGUE = {role: n * TOTAL_TEAMS for role, n in SLOTS_PER_TEAM.items()}  # P:24 D:64 C:64 A:48
TOTAL_SLOTS = sum(SLOTS_LEAGUE.values())  # 200
FLOOR_PRICE = 1

# Rango di rimpiazzo: la Serie A ha ~20 portieri titolari credibili, non
# 24+. Usare il rango pieno (come per gli altri ruoli) produce un
# rimpiazzo vicino a zero (terzo portiere che non gioca mai) e quindi un
# surplus artificialmente enorme per i titolari — vedi sezione 13 per il
# problema empirico osservato con questo bug.
REPLACEMENT_RANK = {"P": 18, "D": SLOTS_LEAGUE["D"], "C": SLOTS_LEAGUE["C"], "A": SLOTS_LEAGUE["A"]}

# Concentrazione top-heavy, applicata in un'unica normalizzazione globale
# (non per ruolo: un gamma diverso per ruolo rompe la comparabilità in
# un'unica somma — testato e scartato, vedi sezione 13).
# Calibrato su Lautaro Martinez ≈ 150-200 in un'asta Classic 500cr/8
# squadre — unico riferimento reale disponibile. Da ritarare dopo la
# prima asta vera.
GAMMA = 1.5


@dataclass
class AllocationResult:
    replacement_value_by_role: dict[str, float]
    role_share: dict[str, float]  # quota di budget per ruolo, OUTPUT del modello
    prices: dict[str, int]


def build_allocation(players: list[tuple[str, str, float]]) -> AllocationResult:
    """
    Input: (player_id, role, expected_value) — expected_value è il Valore
    Tecnico grezzo (scoring.expected_season_value, già in eccesso sopra
    il voto puro del ruolo).
    """
    by_role: dict[str, list[tuple[str, float]]] = {role: [] for role in SLOTS_LEAGUE}
    for player_id, role, value in players:
        if role in by_role:
            by_role[role].append((player_id, value))

    replacement_value_by_role: dict[str, float] = {}
    for role, pairs in by_role.items():
        values_sorted = sorted((v for _, v in pairs), reverse=True)
        idx = min(REPLACEMENT_RANK[role], len(values_sorted)) - 1 if values_sorted else 0
        replacement_value_by_role[role] = values_sorted[idx] if values_sorted else 0.0

    surplus_pool = max(0.0, TOTAL_BUDGET - TOTAL_SLOTS * FLOOR_PRICE)

    weighted: list[tuple[str, str, float]] = []  # (player_id, role, peso^gamma)
    for role, pairs in by_role.items():
        repl = replacement_value_by_role[role]
        for player_id, value in pairs:
            surplus = max(0.0, value - repl)
            weighted.append((player_id, role, surplus**GAMMA))

    total_weight = sum(w for _, _, w in weighted)

    prices: dict[str, float] = {}
    role_totals: dict[str, float] = {role: 0.0 for role in SLOTS_LEAGUE}
    for player_id, role, w in weighted:
        share = (w / total_weight) if total_weight > 0 else 0.0
        price = FLOOR_PRICE + share * surplus_pool
        prices[player_id] = price
        role_totals[role] += price

    # Normalizzazione finale: riporta la somma esattamente a TOTAL_BUDGET
    # (gli arrotondamenti possono far scostare il totale di qualche punto).
    raw_total = sum(prices.values())
    scale = TOTAL_BUDGET / raw_total if raw_total > 0 else 1.0
    final_prices = {pid: max(FLOOR_PRICE, round(p * scale)) for pid, p in prices.items()}

    role_share = {role: round(total / TOTAL_BUDGET, 3) for role, total in role_totals.items()}

    return AllocationResult(
        replacement_value_by_role=replacement_value_by_role,
        role_share=role_share,
        prices=final_prices,
    )
