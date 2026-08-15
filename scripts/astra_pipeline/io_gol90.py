"""
Gol ogni 90 minuti, stagione precedente — fonte fornita dall'utente.

Perché è utile in aggiunta ai gol totali già presenti nelle statistiche:
un giocatore con poche presenze ma alta resa per 90 minuti (subentrato
spesso, o rientrato tardi da un infortunio) viene sistematicamente
sottovalutato da una metrica basata sui gol totali. Qui misuriamo la
pericolosità "quando gioca", separata dalla domanda "quanto gioca"
(quella la cattura già il sub-indice Titolarità).

Il file usa nomi completi ("Nome Cognome"), diversi dal formato
"Cognome" o "Cognome InizialeNome" del listone quotazioni — il matching
è quindi per cognome, con l'iniziale del nome come disambiguante quando
serve (stessa strategia usata in injuries.py).
"""
import csv
import unicodedata
from rapidfuzz import fuzz, process


def _normalize(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.strip().lower().replace("'", "")
    return s


class Gol90Table:
    def __init__(self, path: str):
        self._by_name: dict[str, float] = {}
        with open(path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                nome = row.get("Giocatore", "").strip()
                gol90_raw = row.get("Gol ogni 90 min", "0").replace(",", ".")
                try:
                    gol90 = float(gol90_raw)
                except ValueError:
                    continue
                self._by_name[_normalize(nome)] = gol90

        self._all_names = list(self._by_name.keys())

    def lookup(self, nome_quotazioni: str) -> float | None:
        nq = _normalize(nome_quotazioni)
        tokens = nq.split()
        if not tokens:
            return None

        # Nel listone il cognome è quasi sempre il primo token (es. "Martinez L").
        surname = tokens[0]
        initial = tokens[1][0] if len(tokens) > 1 and len(tokens[1]) >= 1 else None

        candidates = [n for n in self._all_names if surname in n.split()]
        if initial is not None:
            with_initial = [n for n in candidates if any(t.startswith(initial) for t in n.split() if t != surname)]
            if with_initial:
                candidates = with_initial

        if len(candidates) == 1:
            return self._by_name[candidates[0]]

        if not candidates:
            found = process.extractOne(nq, self._all_names, scorer=fuzz.token_set_ratio)
            if found and found[1] >= 88:
                return self._by_name[found[0]]
            return None

        # più candidati ambigui: nessun dato piuttosto che un match rischioso
        return None
