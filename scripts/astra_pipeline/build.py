"""
Assembla, per ogni giocatore del listone, il record completo nel formato
del tipo TypeScript `Player` (vedi src/types/player.ts).

Pricing: il prezzo consigliato viene ora dal Budget Allocation Engine
(vedi BUDGET_ALLOCATION_DESIGN.md), non più da una correzione della
quotazione ufficiale. La quotazione e il FVM del listone restano nel
record come dati accessori (debug/confronto), non guidano più il prezzo.
"""
import re
import unicodedata
from datetime import datetime, timezone

from .io_quotazioni import QuotazioneFvmRow
from .io_stats import StatsRow
from .io_rigoristi import TeamSetPieces, rigorista_rank as lookup_rigorista_rank
from .io_gol90 import Gol90Table
from .matching import MatchResult, StatsMatcher
from . import scoring, pricing, budget_allocation


def slugify(nome: str, squadra: str) -> str:
    s = unicodedata.normalize("NFKD", f"{nome}-{squadra}").encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


def explanation_short(
    role: str,
    has_stats: bool,
    is_transfer: bool,
    continuity: float,
    bonus_raw: float,
    rig_rank: int | None,
) -> str:
    if not has_stats and not rig_rank:
        return "Nessuno storico Serie A disponibile: nuovo arrivo o promozione dalla categoria inferiore."
    parts = []
    if is_transfer:
        parts.append("cambio squadra rispetto alla scorsa stagione")
    if rig_rank == 1:
        parts.append("rigorista designato della squadra")
    elif rig_rank in (2, 3):
        parts.append("rigorista di riserva della squadra")
    if continuity >= 0.8:
        parts.append("titolare con continuità nella stagione precedente")
    elif has_stats and continuity <= 0.4:
        parts.append("minutaggio limitato nella stagione precedente")
    if bonus_raw > 0 and role in ("A", "C") and not parts:
        parts.append("buon rendimento offensivo storico")
    if not parts:
        parts.append("rendimento nella media del ruolo")
    return "; ".join(parts).capitalize() + "."


def build_players(
    quotazioni: list[QuotazioneFvmRow],
    stats_rows: list[StatsRow],
    rigoristi_table: dict[str, TeamSetPieces] | None = None,
    gol90_table: Gol90Table | None = None,
    difficolta_calendario_by_team: dict[str, float] | None = None,
    computed_at: datetime | None = None,
) -> tuple[list[dict], list[dict]]:
    """Restituisce (players, match_report)."""

    computed_at = computed_at or datetime.now(timezone.utc)
    rigoristi_table = rigoristi_table or {}
    difficolta_calendario_by_team = difficolta_calendario_by_team or {}
    matcher = StatsMatcher(stats_rows)

    # --- Passo 1: match + id + segnali aggiuntivi (rigorista, gol/90) ---
    drafts = []
    seen_ids: dict[str, int] = {}
    for q in quotazioni:
        result: MatchResult = matcher.match(q.nome, q.squadra)
        role = q.ruolo if q.ruolo in ("P", "D", "C", "A") else (result.stats.ruolo if result.stats else "C")

        base_id = slugify(q.nome, q.squadra)
        n = seen_ids.get(base_id, 0)
        seen_ids[base_id] = n + 1
        player_id = base_id if n == 0 else f"{base_id}-{n + 1}"

        rig_rank = lookup_rigorista_rank(q.nome, q.squadra, rigoristi_table)
        gol90 = gol90_table.lookup(q.nome) if gol90_table and role in ("A", "C") else None

        drafts.append(
            {"quotazione": q, "match": result, "role": role, "id": player_id, "rig_rank": rig_rank, "gol90": gol90}
        )

    # --- Passo 2: bonus_raw + percentili per ruolo (quotazione e bonus) ---
    quotazioni_by_role: dict[str, list[int]] = {}
    bonus_by_role: dict[str, list[float]] = {}
    for d in drafts:
        role = d["role"]
        quotazioni_by_role.setdefault(role, []).append(d["quotazione"].quotazione)
        b = scoring.bonus_raw(role, d["match"].stats, d["rig_rank"], d["gol90"])
        d["bonus_raw"] = b
        bonus_by_role.setdefault(role, []).append(b)

    for d in drafts:
        q: QuotazioneFvmRow = d["quotazione"]
        m: MatchResult = d["match"]
        role = d["role"]
        stats = m.stats
        has_stats = stats is not None

        difficolta = difficolta_calendario_by_team.get(q.squadra, 0.5)

        sub_titolarita = scoring.sub_index_titolarita(stats)
        bonus_percentile = scoring.percentile_rank(bonus_by_role[role], d["bonus_raw"])
        sub_bonus = round(bonus_percentile * 100, 1)
        sub_affidabilita = scoring.sub_index_affidabilita(stats, difficolta)
        idx = scoring.astra_index(role, sub_titolarita, sub_bonus, sub_affidabilita)
        conf = scoring.confidence(has_stats, m.is_transfer)

        percentile_prezzo = scoring.percentile_rank(quotazioni_by_role[role], q.quotazione)
        d.update(
            sub_titolarita=sub_titolarita,
            sub_bonus=sub_bonus,
            sub_affidabilita=sub_affidabilita,
            astra_index=idx,
            confidence=conf,
            percentile_prezzo=percentile_prezzo,
            has_stats=has_stats,
            difficolta_calendario=difficolta,
        )

    # --- Passo 3: Budget Allocation Engine (VOR) — prezzo consigliato reale d'asta ---
    # Usa il Valore Tecnico (produzione attesa), non l'Astra Index 0-100:
    # è la differenza di scala assoluta tra ruoli a permettere al motore
    # di scoprire da solo quanto budget merita ciascun ruolo.
    allocation_input = [
        (
            d["id"],
            d["role"],
            scoring.expected_season_value(
                d["role"], d["match"].stats, scoring.continuity_ratio(d["match"].stats), d["rig_rank"]
            ),
        )
        for d in drafts
    ]
    allocation = budget_allocation.build_allocation(allocation_input)

    players: list[dict] = []
    match_report: list[dict] = []

    for d in drafts:
        q: QuotazioneFvmRow = d["quotazione"]
        m: MatchResult = d["match"]
        role = d["role"]
        stats = m.stats

        sugg = allocation.prices[d["id"]]
        margin = pricing.margin_pct(role, d["confidence"], d["sub_affidabilita"])
        mx = pricing.max_price(sugg, margin)

        fvm_500 = round(q.fvm / 2) if q.fvm else None
        continuity = scoring.continuity_ratio(stats)

        player = {
            "id": d["id"],
            "name": q.nome,
            "team": q.squadra,
            "role": role,
            "subRole": q.sub_ruolo or (stats.sub_ruolo if stats and stats.sub_ruolo else None),
            "age": None,  # nessuna fonte disponibile in v1
            "market": {
                "quotazioneUfficiale": q.quotazione,
                "quotazioneUfficialePercentileRuolo": round(d["percentile_prezzo"], 3),
                "fvmStimato500": fvm_500,  # accessorio: FVM del listone dimezzato per lega da 500, NON usato per il prezzo
            },
            "stats": {
                "presenzePrev": stats.presenze if stats else 0,
                "minutiPrev": round((stats.presenze if stats else 0) * 90 * continuity),
                "mediaVoto": stats.media_voto if stats else 0,
                "fantamedia": stats.fantamedia if stats else 0,
                "golPrev": stats.gol_fatti if stats else 0,
                "assistPrev": stats.assist if stats else 0,
                "rigoriCalciati": stats.rigori_calciati if stats else 0,
                "rigoriSegnati": stats.rigori_segnati if stats else 0,
                "ammonizioni": stats.ammonizioni if stats else 0,
                "espulsioni": stats.espulsioni if stats else 0,
                "cleanSheetPrev": None,
            },
            "status": {
                "titolarePrevisto": continuity >= 0.6,
                "probabilitaTitolarita": round(continuity, 2),
                "infortunioCorrente": None,  # placeholder: da aggiornare a mano vicino all'asta
                "rigoristaRank": d["rig_rank"],
                "storicoInfortuniGravi3y": 0,  # in attesa del dataset infortuni top 5 campionati
                "giorniAssenzaUltimi12m": 0,
                "nuovoAcquisto": m.is_transfer or not d["has_stats"],
                "cambioRuoloTattico": False,
                "difficoltaCalendarioIniziale": d["difficolta_calendario"],
            },
            "scores": {
                "subIndexTitolarita": d["sub_titolarita"],
                "subIndexBonus": d["sub_bonus"],
                "subIndexAffidabilita": d["sub_affidabilita"],
                "astraIndex": d["astra_index"],
                "confidence": d["confidence"],
            },
            "pricing": {
                "suggestedPrice": sugg,
                "maxPrice": mx,
                "marginPct": margin,
            },
            "explanationShort": explanation_short(
                role, d["has_stats"], m.is_transfer, continuity, d["bonus_raw"], d["rig_rank"]
            ),
            "meta": {
                "computedAt": computed_at.isoformat(),
                "sourceFreshnessDays": 0,
            },
        }
        players.append(player)

        match_report.append(
            {
                "nome": q.nome,
                "squadra": q.squadra,
                "ruolo": role,
                "matchType": m.match_type,
                "statsNomeTrovato": stats.nome if stats else None,
                "statsSquadraTrovata": stats.squadra if stats else None,
                "rigoristaRank": d["rig_rank"],
                "gol90": d["gol90"],
                "prezzoConsigliato": sugg,
                "fvmStimato500": fvm_500,
            }
        )

    return players, match_report
