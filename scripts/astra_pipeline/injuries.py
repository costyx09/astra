"""
Storico infortuni — dataset esterno con eventi di infortunio per giocatore,
stagione 20/21-24/25, nei 5 principali campionati europei. Copre sia i
giocatori già in Serie A sia quelli appena trasferiti da un altro campionato
(gli stessi 197 "senza storico" del file statistiche, in parte recuperabili
qui almeno per età e rischio infortuni anche se non per rendimento).

Nota sui limiti (onestà sui dati, non solo sulla formula):
  - il dataset si ferma alla stagione 24/25: manca la stagione 25/26, quindi
    "giorni di assenza ultimi 12 mesi" è in realtà un'approssimazione basata
    sull'ultima stagione disponibile per il giocatore, non sui 12 mesi
    letterali. Da correggere a mano vicino all'asta per i casi più delicati.
  - l'età è stimata dall'età registrata nell'ultimo evento disponibile,
    proiettata in avanti di un anno per ogni stagione mancante fino ad oggi.
"""
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass

import pandas as pd
from rapidfuzz import fuzz, process

SEVERE_DAYS_THRESHOLD = 21  # infortunio "grave": almeno 3 settimane di stop
RECENT_SEASONS_FOR_GRAVI = {"22/23", "23/24", "24/25"}
CURRENT_YEAR = 2026


def _normalize(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.strip().lower().replace("'", "")
    return re.sub(r"\s+", " ", s)


def _parse_days(value: str) -> int:
    if not isinstance(value, str):
        return 0
    match = re.search(r"\d+", value)
    return int(match.group()) if match else 0


def _season_end_year(season: str) -> int:
    # "24/25" -> 2025
    try:
        return 2000 + int(season.split("/")[1])
    except (ValueError, IndexError):
        return CURRENT_YEAR


@dataclass
class InjuryProfile:
    storico_infortuni_gravi_3y: int
    giorni_assenza_ultima_stagione_disponibile: int
    eta_stimata: int | None


class InjuryHistory:
    def __init__(self, csv_path: str):
        df = pd.read_csv(csv_path)
        df["days_int"] = df["Days"].apply(_parse_days)
        df["name_norm"] = df["player_name"].apply(_normalize)

        self._by_name: dict[str, pd.DataFrame] = {
            name: group for name, group in df.groupby("name_norm")
        }
        # (nome_normalizzato, set di token) per ogni persona distinta nel dataset
        self._people: list[tuple[str, set[str]]] = [
            (name, set(name.split())) for name in self._by_name
        ]

    @staticmethod
    def _parse_query(nome: str) -> tuple[str, str | None]:
        """
        Le quotazioni usano quasi sempre 'Cognome' o 'Cognome InizialeNome'
        (es. 'Martinez L'). Separiamo l'eventuale iniziale per poterla usare
        come vincolo di disambiguazione — senza, cognomi comuni (Martinez,
        Rodriguez, Hernandez...) rischiano falsi positivi pericolosi, dato
        che qui non abbiamo il vincolo di squadra a fare da controllo
        incrociato (il giocatore può essere transitato da qualunque club).
        """
        tokens = _normalize(nome).split()
        if len(tokens) >= 2 and len(tokens[-1]) == 1:
            return " ".join(tokens[:-1]), tokens[-1]
        return " ".join(tokens), None

    def _find_group(self, nome: str) -> pd.DataFrame | None:
        surname, initial = self._parse_query(nome)
        surname_tokens = set(surname.split())

        candidates = []
        for name_norm, tokens in self._people:
            if not surname_tokens.issubset(tokens):
                continue
            if initial is not None:
                remaining = tokens - surname_tokens
                if not any(t.startswith(initial) for t in remaining):
                    continue
            candidates.append(name_norm)

        if len(candidates) == 1:
            return self._by_name[candidates[0]]

        if len(candidates) == 0:
            # nessun vincolo di iniziale soddisfatto: proviamo un fuzzy
            # più permissivo ma SOLO se il cognome intero (non i singoli
            # token) è quasi identico, per ridurre il rischio di falso
            # positivo su cognomi comuni.
            all_names = [n for n, _ in self._people]
            found = process.extractOne(surname, all_names, scorer=fuzz.ratio)
            if found and found[1] >= 92:
                return self._by_name[found[0]]
            return None

        # più di un candidato compatibile con cognome+iniziale: dato che
        # non abbiamo un altro segnale per disambiguare con sicurezza,
        # è più corretto non rispondere che rischiare di attribuire
        # l'infortunio alla persona sbagliata.
        return None

    def lookup(self, nome: str) -> InjuryProfile | None:
        group = self._find_group(nome)
        if group is None or group.empty:
            return None

        gravi_recenti = group[
            group["Season"].isin(RECENT_SEASONS_FOR_GRAVI) & (group["days_int"] >= SEVERE_DAYS_THRESHOLD)
        ]

        latest_season = max(group["Season"], key=_season_end_year)
        giorni_ultima_stagione = int(group[group["Season"] == latest_season]["days_int"].sum())

        latest_row = group[group["Season"] == latest_season].iloc[0]
        anni_trascorsi = max(CURRENT_YEAR - _season_end_year(latest_season), 0)
        eta_stimata = int(latest_row["player_age"]) + anni_trascorsi

        return InjuryProfile(
            storico_infortuni_gravi_3y=len(gravi_recenti),
            giorni_assenza_ultima_stagione_disponibile=giorni_ultima_stagione,
            eta_stimata=eta_stimata,
        )
