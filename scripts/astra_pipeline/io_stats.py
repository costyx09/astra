"""
Caricamento delle statistiche stagione precedente (foglio "Tutti").
Colonne attese: Id, R, Rm, Nome, Squadra, Pv, Mv, Fm, Gf, Gs, Rp, Rc, R+, R-,
Ass, Amm, Esp, Au.

Nota: questo dataset non include i minuti giocati, solo le presenze — la
formula di scoring adatta il calcolo di continuità di conseguenza
(vedi scoring.py).
"""
from dataclasses import dataclass

import openpyxl


@dataclass
class StatsRow:
    nome: str
    squadra: str
    ruolo: str
    sub_ruolo: str | None
    presenze: int
    media_voto: float
    fantamedia: float
    gol_fatti: int
    gol_subiti: int
    rigori_parati: int
    rigori_calciati: int
    rigori_segnati: int
    rigori_sbagliati: int
    assist: int
    ammonizioni: int
    espulsioni: int


def load_stats(path: str) -> list[StatsRow]:
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["Tutti"]

    rows: list[StatsRow] = []
    for row in ws.iter_rows(min_row=3, values_only=True):
        if not row[3]:  # colonna Nome
            continue
        try:
            rows.append(
                StatsRow(
                    nome=str(row[3]).strip(),
                    squadra=str(row[4]).strip(),
                    ruolo=str(row[1]).strip().upper(),
                    sub_ruolo=str(row[2]).strip() if row[2] else None,
                    presenze=int(row[5] or 0),
                    media_voto=float(row[6] or 0),
                    fantamedia=float(row[7] or 0),
                    gol_fatti=int(row[8] or 0),
                    gol_subiti=int(row[9] or 0),
                    rigori_parati=int(row[10] or 0),
                    rigori_calciati=int(row[11] or 0),
                    rigori_segnati=int(row[12] or 0),
                    rigori_sbagliati=int(row[13] or 0),
                    assist=int(row[14] or 0),
                    ammonizioni=int(row[15] or 0),
                    espulsioni=int(row[16] or 0),
                )
            )
        except (TypeError, ValueError):
            continue  # riga malformata, la saltiamo piuttosto che far cadere tutta la pipeline
    return rows
