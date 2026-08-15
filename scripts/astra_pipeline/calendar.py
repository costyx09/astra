"""
Difficoltà del calendario iniziale — vedi astra-decision-engine.md.

Parsa il testo estratto dal PDF del calendario (pdftotext -layout) e calcola,
per ogni squadra, la difficoltà media delle prime N giornate. La forza di
ogni avversario è stimata dalla fantamedia media della sua rosa nella
stagione precedente (statistiche già disponibili nella pipeline) — non
serve una fonte esterna di "forza squadra".
"""
import re
from collections import defaultdict

# Il testo estratto ha ricorrenti problemi di legatura tipografica (Ɵ/ti
# perso nella conversione): normalizziamo i nomi noti.
NAME_FIXES = {
    "fioren na": "fiorentina",
    "fiorenƟna": "fiorentina",
}

GIORNATE_INIZIALI_CONSIDERATE = 5


def _fix_team_name(name: str) -> str:
    # Rimuove punti elenco/caratteri speciali del PDF e spazi superflui,
    # poi normalizza eventuali problemi di legatura tipografica noti.
    cleaned = re.sub(r"^[^A-Za-zÀ-ÿ]+", "", name).strip()
    key = cleaned.lower()
    fixed = NAME_FIXES.get(key, cleaned)
    return fixed[:1].upper() + fixed[1:] if fixed else fixed


def parse_calendar(raw_text: str) -> dict[str, list[str]]:
    """Restituisce {squadra: [avversario_giornata1, avversario_giornata2, ...]}."""
    fixtures_by_team: dict[str, list[str]] = defaultdict(list)

    for line in raw_text.splitlines():
        line = line.strip()
        match = re.match(r"^(.+?)\s+vs\s+(.+)$", line, flags=re.IGNORECASE)
        if not match:
            continue
        home = _fix_team_name(match.group(1))
        away = _fix_team_name(match.group(2))
        fixtures_by_team[home].append(away)
        fixtures_by_team[away].append(home)

    return dict(fixtures_by_team)


def compute_team_strength(fantamedia_by_team: dict[str, list[float]]) -> dict[str, float]:
    """Forza approssimata di ogni squadra: fantamedia media della rosa (stagione precedente)."""
    return {
        team: (sum(values) / len(values) if values else 6.0)
        for team, values in fantamedia_by_team.items()
    }


def compute_difficulty_by_team(
    fixtures_by_team: dict[str, list[str]],
    team_strength: dict[str, float],
) -> dict[str, float]:
    """
    Difficoltà 0-1 delle prime GIORNATE_INIZIALI_CONSIDERATE giornate per
    ogni squadra, normalizzata sulla forza media dell'intera Serie A.
    """
    all_strengths = list(team_strength.values())
    avg_strength = sum(all_strengths) / len(all_strengths) if all_strengths else 6.0
    spread = max(max(all_strengths) - avg_strength, avg_strength - min(all_strengths), 0.5)

    difficulty: dict[str, float] = {}
    for team, opponents in fixtures_by_team.items():
        first_n = opponents[:GIORNATE_INIZIALI_CONSIDERATE]
        if not first_n:
            difficulty[team] = 0.5
            continue
        avg_opponent_strength = sum(team_strength.get(o, avg_strength) for o in first_n) / len(first_n)
        # più gli avversari sono forti rispetto alla media, più il calendario è difficile
        raw = 0.5 + (avg_opponent_strength - avg_strength) / (2 * spread)
        difficulty[team] = round(max(0.0, min(1.0, raw)), 2)
    return difficulty
