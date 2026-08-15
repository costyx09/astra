#!/usr/bin/env python3
"""
Script di preparazione dati di Astra — vedi PROJECT_CONTEXT.md.

Uso:
    python prepare_players.py \
        --quotazioni input/Quotazioni_Fantacalcio_Stagione_2026_27.xlsx \
        --stats input/Statistiche_Fantacalcio_Stagione_2025_26_Italia.xlsx \
        --rigoristi input/rigoristi_e_tiratori_serie_a.csv \
        --gol90 input/statistiche_gol_serie_a.csv \
        --calendario input/calendario_raw.txt \
        --out output/players.json

Rilancio: lo script può essere eseguito più volte (es. la mattina
dell'asta con un file quotazioni aggiornato). Ogni esecuzione rigenera
players.json da zero.
"""
import argparse
import json
from pathlib import Path

from astra_pipeline.build import build_players
from astra_pipeline.calendar import compute_difficulty_by_team, compute_team_strength, parse_calendar
from astra_pipeline.io_gol90 import Gol90Table
from astra_pipeline.io_quotazioni import load_quotazioni_fvm
from astra_pipeline.io_rigoristi import load_rigoristi
from astra_pipeline.io_stats import load_stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera players.json per Astra")
    parser.add_argument("--quotazioni", required=True, help="Listone ufficiale con FVM (.xlsx)")
    parser.add_argument("--stats", required=True, help="Statistiche stagione precedente (.xlsx)")
    parser.add_argument("--rigoristi", help="CSV rigoristi/tiratori per squadra (opzionale)")
    parser.add_argument("--gol90", help="CSV gol ogni 90 minuti stagione precedente (opzionale)")
    parser.add_argument("--calendario", help="Testo grezzo del calendario, una partita per riga 'Squadra1 vs Squadra2' (opzionale)")
    parser.add_argument("--out", default="output/players.json")
    parser.add_argument("--report", default="output/match_report.csv")
    args = parser.parse_args()

    print(f"Leggo quotazioni da {args.quotazioni}...")
    quotazioni = load_quotazioni_fvm(args.quotazioni)
    print(f"  {len(quotazioni)} giocatori nel listone")

    print(f"Leggo statistiche da {args.stats}...")
    stats = load_stats(args.stats)
    print(f"  {len(stats)} giocatori con statistiche stagione precedente")

    rigoristi_table = {}
    if args.rigoristi:
        print(f"Leggo rigoristi/tiratori da {args.rigoristi}...")
        rigoristi_table = load_rigoristi(args.rigoristi)
        print(f"  {len(rigoristi_table)} squadre")

    gol90_table = None
    if args.gol90:
        print(f"Leggo gol/90 da {args.gol90}...")
        gol90_table = Gol90Table(args.gol90)

    difficolta_by_team = {}
    if args.calendario:
        print(f"Leggo calendario da {args.calendario}...")
        raw = Path(args.calendario).read_text(encoding="utf-8")
        fixtures = parse_calendar(raw)
        fantamedia_by_team: dict[str, list[float]] = {}
        for s in stats:
            fantamedia_by_team.setdefault(s.squadra, []).append(s.fantamedia)
        team_strength = compute_team_strength(fantamedia_by_team)
        difficolta_by_team = compute_difficulty_by_team(fixtures, team_strength)
        print(f"  difficoltà calendario calcolata per {len(difficolta_by_team)} squadre")

    print("Calcolo Astra Index, allocazione budget e prezzi...")
    players, match_report = build_players(
        quotazioni,
        stats,
        rigoristi_table=rigoristi_table,
        gol90_table=gol90_table,
        difficolta_calendario_by_team=difficolta_by_team,
    )

    matched = sum(1 for r in match_report if r["matchType"] != "none")
    transfers = sum(1 for r in match_report if r["matchType"] in ("exact_transfer", "fuzzy_transfer"))
    rigoristi_trovati = sum(1 for r in match_report if r["rigoristaRank"])
    print(f"  {matched}/{len(players)} giocatori abbinati a statistiche storiche")
    print(f"  di cui {transfers} trasferimenti rilevati")
    print(f"  {len(players) - matched} senza storico")
    print(f"  {rigoristi_trovati} rigoristi designati riconosciuti")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(players, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Scritto {out_path} ({len(players)} giocatori)")

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("w", encoding="utf-8") as f:
        f.write("nome,squadra,ruolo,matchType,rigoristaRank,gol90,prezzoConsigliato,fvmStimato500\n")
        for r in match_report:
            f.write(
                f'"{r["nome"]}","{r["squadra"]}",{r["ruolo"]},{r["matchType"]},'
                f'{r["rigoristaRank"] or ""},{r["gol90"] or ""},{r["prezzoConsigliato"]},{r["fvmStimato500"] or ""}\n'
            )
    print(f"Scritto report di matching in {report_path}")


if __name__ == "__main__":
    main()
