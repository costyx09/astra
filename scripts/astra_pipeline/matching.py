"""
Abbina ogni giocatore del listone quotazioni al proprio record di statistiche
stagione precedente, quando esiste.

Il matching è a più livelli, dal più affidabile al più incerto:
  1. nome normalizzato identico, stessa squadra
  2. nome normalizzato molto simile (fuzzy), stessa squadra
  3. nome normalizzato identico, squadra diversa (trasferimento)
  4. nome normalizzato molto simile (fuzzy), squadra diversa (trasferimento,
     soglia più alta per sicurezza)

Se nessuno dei quattro livelli produce un match, il giocatore è trattato
come privo di storico (nuovo in Serie A o proveniente da una categoria
non coperta dal dataset) — non è un errore, è un caso legittimo che lo
scoring gestisce con confidence più bassa.
"""
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass

from rapidfuzz import fuzz, process

from .io_stats import StatsRow

FUZZY_TEAM_THRESHOLD = 82
FUZZY_TRANSFER_THRESHOLD = 90


def normalize(s: str | None) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.strip().lower().replace("'", "")
    s = re.sub(r"[.\-]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


@dataclass
class MatchResult:
    stats: StatsRow | None
    match_type: str  # "exact_team" | "fuzzy_team" | "exact_transfer" | "fuzzy_transfer" | "none"
    is_transfer: bool


class StatsMatcher:
    def __init__(self, stats_rows: list[StatsRow]):
        self._by_team: dict[str, list[tuple[str, StatsRow]]] = defaultdict(list)
        self._all: list[tuple[str, StatsRow]] = []
        for row in stats_rows:
            key = normalize(row.nome)
            self._by_team[normalize(row.squadra)].append((key, row))
            self._all.append((key, row))

    def match(self, nome: str, squadra: str) -> MatchResult:
        nq = normalize(nome)
        team_pool = self._by_team.get(normalize(squadra), [])

        for key, row in team_pool:
            if key == nq:
                return MatchResult(row, "exact_team", is_transfer=False)

        if team_pool:
            choices = [key for key, _ in team_pool]
            found = process.extractOne(nq, choices, scorer=fuzz.token_set_ratio)
            if found and found[1] >= FUZZY_TEAM_THRESHOLD:
                _, row = team_pool[choices.index(found[0])]
                return MatchResult(row, "fuzzy_team", is_transfer=False)

        for key, row in self._all:
            if key == nq:
                return MatchResult(row, "exact_transfer", is_transfer=True)

        choices_all = [key for key, _ in self._all]
        found = process.extractOne(nq, choices_all, scorer=fuzz.token_set_ratio)
        if found and found[1] >= FUZZY_TRANSFER_THRESHOLD:
            _, row = self._all[choices_all.index(found[0])]
            return MatchResult(row, "fuzzy_transfer", is_transfer=True)

        return MatchResult(None, "none", is_transfer=False)
