"""
Rigoristi e tiratori di punizioni designati per squadra, stagione 2026/27
(fonte: fornita dall'utente). Segnale "forward looking": non deriva dalle
statistiche storiche, quindi è prezioso soprattutto per giocatori appena
trasferiti che altrimenti non avrebbero questa informazione (es. un
rigorista designato nella nuova squadra ma senza rigori segnati nello
storico perché li tirava un altro alla squadra precedente).
"""
import csv
import unicodedata
from dataclasses import dataclass, field


def _normalize(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.strip().lower().replace("'", "")
    return s


@dataclass
class TeamSetPieces:
    rigoristi: list[str] = field(default_factory=list)  # in ordine di priorità
    tiratori: list[str] = field(default_factory=list)


def load_rigoristi(path: str) -> dict[str, TeamSetPieces]:
    """Ritorna {squadra_normalizzata: TeamSetPieces}."""
    result: dict[str, TeamSetPieces] = {}
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            squadra = _normalize(row["Squadra"])
            rigoristi = [row[f"Rigorista {i}"].strip() for i in (1, 2, 3) if row.get(f"Rigorista {i}", "").strip()]
            tiratori = [
                row[f"Tiratore Piazzati {i}"].strip()
                for i in (1, 2, 3)
                if row.get(f"Tiratore Piazzati {i}", "").strip()
            ]
            result[squadra] = TeamSetPieces(rigoristi=rigoristi, tiratori=tiratori)
    return result


def rigorista_rank(nome: str, squadra: str, table: dict[str, TeamSetPieces]) -> int | None:
    """Restituisce 1/2/3 se il giocatore è tra i rigoristi designati della
    sua squadra (in ordine di priorità), altrimenti None. Match sul nome
    per confronto diretto normalizzato — i nomi in questo file sono già
    nello stesso formato "Cognome" o "Cognome Iniziale" del listone."""
    entry = table.get(_normalize(squadra))
    if not entry:
        return None
    nq = _normalize(nome)
    for i, rigorista in enumerate(entry.rigoristi, start=1):
        if _normalize(rigorista) == nq:
            return i
    return None
