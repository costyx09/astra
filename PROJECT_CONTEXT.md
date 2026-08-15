# Astra — Project Context

**Data ultimo aggiornamento**: 2026-08-07 (v2)
**Stato**: MVP funzionante con dati reali, pricing VOR v4 (fantamedia in eccesso) validato su Lautaro/Dimarco, suggeritore "Chi chiamare?" implementato

---

## Visione prodotto

Astra è un **copilota decisionale per l'asta del fantacalcio** — un assistente che aiuta l'utente a costruire una rosa vincente durante un'asta live, non prima. Il valore di Astra non è informativo (dati e statistiche), ma decisionale: in 5-15 secondi, mentre il giocatore è chiamato in asta, il sistema deve dirmi se RILANCIA, NON_RILANCIARE, oppure ASPETTA, con una motivazione trasparente.

---

## Vincoli di design fondamentali

1. **MVP personale, costo zero**: niente server sempre acceso, niente database remoto, niente API a pagamento. Tutto gira localmente nel browser (PWA). Backend Python per la preparazione dati, eseguito una volta (o poche volte) off-asta.

2. **Tempo di risposta critico**: il verdetto deve arrivare **istantaneamente** (<200ms), senza chiamate di rete durante l'asta. Tutta l'intelligenza "pesante" (calcoli ML, scoring) avviene offline, prima dell'asta. Durante l'asta c'è solo lookup + logica leggera.

3. **Decisione > informazione**: l'interfaccia deve mostrare RILANCIA/NON_RILANCIARE/ASPETTA in grande, non grafici o analisi testuali. L'utente decide di fidarsi del verdetto o no nel tempo che ci mette a toccare il pulsante "compra".

4. **Trasparenza obbligatoria**: ogni verdetto deve essere accompagnato da una riga di motivazione. Nessun numero magico black-box. Confidence score sempre visibile.

---

## Stato dei componenti

### ✅ Completati

- **Decision Engine** (`lib/engine/decision-engine.ts`): logica RILANCIA/NON_RILANCIARE/ASPETTA, guardrail di budget, sottoindici (titolarità, bonus, affidabilità). **Non deve essere toccato**, funziona correttamente.

- **Auction Intelligence Engine** (`lib/engine/auction-intelligence-engine.ts`): traccia inflazione per ruolo, scarsità, pressione di budget aggregata, profili avversari. Ricalcolato ad ogni acquisto registrato. **Non deve essere toccato**.

- **Pannello Rosa e Mercato**: 5 schermate (Asta Live, Squadre, Rosa, Mercato, Giocatori) + cronologia con modifica/eliminazione/annulla. Stato derivato sempre da `marketLog` (fonte unica di verità). **Stabile, non toccare**.

- **State management**: React Context + localStorage per persistenza. Riconciliazione via `deriveTeams()` che ricalcola budget e rose da `marketLog`. **Stabile**.

- **Modello dati Player**: schema TypeScript coerente con design, `age: number | null` (non disponibile), `market.fvmStimato500` opzionale (accessorio). **Stabile**.

- **Data pipeline completa** (`scripts/prepare_players.py` + `astra_pipeline/`): legge listone FVM + statistiche + rigoristi + gol/90 + calendario, calcola Astra Index e prezzi via Budget Allocation Engine. Output: `players.json` con **493 giocatori reali**. **Funzionante, riallanciabile quando necessario**.

- **Budget Allocation Engine v4 — VOR su fantamedia in eccesso** (`scripts/astra_pipeline/budget_allocation.py` + `scoring.expected_season_value`): **nessun budget fisso per ruolo, nessun fattore di correzione artificiale**. La v3 (fattore ROLE_POTENTIAL_FACTOR) è stata sostituita dopo che l'utente ha segnalato risultati ancora insoddisfacenti: causa radice trovata nella metrica di ingresso (fantamedia assoluta troppo compressa), risolta usando fantamedia **in eccesso** sopra un "voto puro" per ruolo. Risultato: Lautaro Martinez 149 crediti (target utente: 150-200 ✅), split per ruolo realistico emerso dai dati (P 8%, D 22%, C 31%, A 39%), Dimarco a 146 per una stagione reale eccezionale (7 gol, 17 assist) — caso trasparente, non corretto a mano. **Calibrazione (BASE_VOTE, GAMMA, REPLACEMENT_RANK) ancora basata su un solo riferimento reale — da validare a un'asta vera.**

- **Suggeritore "Chi chiamare?"** (`src/lib/engine/suggestion-engine.ts`): nuova funzionalità richiesta dall'utente. Suggerisce i migliori giocatori disponibili in base a qualità/prezzo, urgenza di ruolo e budget residuo, riusando Decision Engine e AIE senza modificarli. Integrato come vista di default nella schermata Giocatori (toggle "Chi chiamare?" / "Sfoglia listone").

- **Calendario** (`scripts/astra_pipeline/calendar.py`): parsa il testo del calendario (`input/calendario_raw.txt`), calcola forza squadra da fantamedia storica, produce `difficoltaCalendarioIniziale` reale per le prime 5 giornate (non più placeholder 0.5). **Funzionante**.

- **Rigoristi/tiratori e gol per 90'** (`io_rigoristi.py`, `io_gol90.py`): segnali aggiuntivi che alimentano `bonus_raw` — rigorista designato (rango 1/2/3) è un bonus indipendente dallo storico (utile per trasferiti), gol/90 sostituisce i gol totali per C/A misurando pericolosità "quando gioca" indipendentemente dal minutaggio. **Funzionante**.

---

### 🔲 Non ancora integrato

- **`injuries.py`**: modulo già scritto (matching fuzzy nome con disambiguazione per iniziale, calcolo infortuni gravi ultimi 3 anni + età stimata), **ma il dataset reale (storico infortuni 2020/21-2024/25, top 5 campionati) non è ancora stato caricato dall'utente**. Il modulo si aspetta un CSV con colonne `player_name, Days, Season, player_age` (formato dataset pubblico standard). Non appena disponibile: wire in `prepare_players.py` (già predisposto per accettare un `--infortuni` opzionale, da aggiungere).

- **Titolarità preseason reale**: `probabilitaTitolarita` è ancora derivata dalla sola continuità storica (`presenze/38`), non da probabili formazioni/gerarchie reali di inizio stagione. Da aggiornare a mano o via fonte esterna ~1 settimana prima dell'asta.

- **Simulatore Monte Carlo Compra/Lascia**: progettato (astra-auction-intelligence-engine.md, sezione 6) ma non implementato.

---

## Input dati (aggiornato)

| File | Fonte | Uso |
|---|---|---|
| `Quotazioni_Fantacalcio_Stagione_2026_27.xlsx` | Fantacalcio.it ufficiale | **Fonte primaria attuale** — anagrafica, ruolo, sotto-ruolo Mantra, quotazione (accessoria), FVM (accessorio, dimezzato per lega da 500) |
| `Statistiche_Fantacalcio_Stagione_2025_26_Italia.xlsx` | Fantacalciopedia | Presenze, gol, assist, rigori, cartellini, fantamedia — alimenta Astra Index |
| `rigoristi_e_tiratori_serie_a.csv` | Fornito dall'utente | Rigorista/tiratore designato per squadra (rango 1-3), segnale forward-looking |
| `statistiche_gol_serie_a.csv` | Fornito dall'utente | Gol ogni 90 minuti stagione precedente, per C/A |
| `calendario_raw.txt` (da PDF calendario ufficiale) | Lega Serie A | Difficoltà calendario prime 5 giornate, per squadra |
| `quotazioni_fantamaster.xlsx` | FantaMaster | **Superseduto** dal file Quotazioni ufficiale con FVM, mantenuto solo per compatibilità/debug |
| Storico infortuni 2020/21-2024/25 (top 5 campionati) | Da fornire | **Ancora in attesa** — modulo `injuries.py` pronto ma non wired |

---

## Output dati

- **players.json** (493 giocatori): generato da script Python, incluso in `src/data/players.json` e `public/players.json`. Contiene anagrafica, market (quotazione+FVM accessori), stats, status, scores (Astra Index + sotto-indici + confidence), **pricing** (ora dal Budget Allocation Engine — riflette il vero valore atteso in un'asta da 500 crediti, non una correzione della quotazione), spiegazione breve.

---

## Flusso della decisione (immutato)

```
Durante l'asta, utente chiama un giocatore:
  ↓
[PlayerSearch] → ricerca istantanea nel listone (autocomplete)
  ↓
[RosterSummary] → mostra crediti residui + slot mancanti per ruolo
  ↓
[Auction Intelligence Engine] ricalcola:
  - inflazione per ruolo (osservata dal marketLog)
  - scarsità di ruolo nel pool residuo
  - pressione di budget aggregata della lega
  - profili avversari (aggressività, sotto_pressione)
  ↓
[Decision Engine] applica:
  - guardrail di budget (priorità assoluta)
  - logica RILANCIA/NON_RILANCIARE/ASPETTA
  - usa i prezzi (consigliato e massimo, ora da Budget Allocation Engine) come base
  ↓
[DecisionPanel] mostra:
  - VERDETTO in grande (colore distinto per azione)
  - Motivazione in una riga
  - Sub-indici del giocatore
  - Prezzo consigliato e massimo (dinamici, aggiornati dall'AIE)
  - Confidence score
  ↓
Utente preme "compra a X crediti" → stato asta aggiornato
```

---

## Architettura software

### Frontend (Next.js, TypeScript, Tailwind)
```
src/
  types/              Player (age nullable, market.fvmStimato500 opzionale), AuctionState, DecisionResult, DynamicPricing
  lib/
    engine/
      decision-engine.ts                      ✅ Stabile, non toccare
      auction-intelligence-engine.ts          ✅ Stabile, non toccare
      auction-context.ts                      Helper per slot liberi, riserva budget
      pool.ts                                 Conteggio giocatori per ruolo
    state/
      auction-store.tsx                       React Context, localStorage, deriveTeams()
      team-status.ts                          Badge di stato squadre (helper UI)
      derive-teams.ts                         Ricalcolo da marketLog (fonte unica di verità)
  components/
    auction/                                  Componenti UI schermate (5 tab)
    ui/                                       VerdictBadge, TabBar, ecc.
  data/
    load-players.ts                           Loader che legge players.json (fetch con fallback mock)
    players.json                              493 giocatori con dati reali + pricing da Budget Allocation Engine
  app/
    auction/
      live/page.tsx                           Asta Live (ricerca, decision panel)
      teams/page.tsx                          Dashboard squadre
      roster/page.tsx                         Rosa mia
      market/page.tsx                         Cronologia + modifica/elimina/annulla
      players/page.tsx                        Listone giocatori disponibili
```

### Backend (Python, esecuzione locale off-asta)
```
scripts/
  prepare_players.py                          Entry point (--quotazioni --stats --rigoristi --gol90 --calendario)
  astra_pipeline/
    io_quotazioni.py                          load_quotazioni (vecchio) + load_quotazioni_fvm (attuale, con FVM)
    io_stats.py                               Carica statistiche stagione precedente
    io_rigoristi.py                           Rigoristi/tiratori designati per squadra
    io_gol90.py                               Gol ogni 90 minuti (fuzzy match per cognome+iniziale)
    calendar.py                               Parsing calendario + difficoltà per squadra
    injuries.py                               🔲 Pronto ma non wired (dataset non ancora fornito)
    matching.py                               Matching fuzzy nomi quotazioni↔statistiche
    scoring.py                                ✅ Astra Index + sotto-indici (ora con rigorista/gol90/calendario reali)
    budget_allocation.py                      ✅ Budget Allocation Engine (rank-based, calibrato)
    pricing.py                                Solo più margin_pct/max_price (il suggested_price ora viene da budget_allocation)
    build.py                                  Assembla record finali Player, orchestратор pipeline
  input/                                      File Excel/CSV di input
  output/
    players.json                              Output principale (493 giocatori)
    match_report.csv                          Report matching + rigoristi + gol90 + prezzi (controllo manuale)
```

---

## Decisioni di design critiche

1. **marketLog come fonte unica di verità**: budget e rose non sono mutati incrementalmente, vengono sempre ricalcolati da `deriveTeams()`. Questo rende modifica/eliminazione/annulla completamente sicure, senza rischio di stati incoerenti.

2. **Astra Index indipendente dal prezzo**: l'indice 0-100 misura "qualità intrinseca del giocatore", non "quanto costa". Il prezzo ora viene dal Budget Allocation Engine (allocazione di budget reale), non da una correzione dell'indice — separazione ancora più netta di prima.

3. **Confidence score obbligatorio**: ogni giocatore ha un confidence 0-1 che accompagna sempre l'Astra Index. Giocatori nuovi in Serie A o senza storico hanno confidence bassa, anche se l'indice è ottimista sulla carta.

4. **Decision Engine indipendente da pricing**: il verdetto usa prezzo consigliato e massimo come input, ma la logica di RILANCIA/ASPETTA/NON_RILANCIARE è invariante. Il pricing è stato riprogettato due volte (correzione quotazione → Budget Allocation Engine) senza toccare una riga del Decision Engine.

5. **Prezzo per rango, non per magnitudine di indice**: il Budget Allocation Engine distribuisce il budget in base al *rango* di un giocatore nel proprio ruolo (1°, 2°, 3°...), non al valore assoluto dell'Astra Index. Motivo: l'indice è in parte un percentile, quindi compresso in cima alla distribuzione — nessuna formula a potenza sull'indice riesce a ricreare il vero "superstar bias" di un'asta reale. Il rango invece è per definizione ben distribuito. Vedi BUDGET_ALLOCATION_DESIGN.md sezione 11.

6. **Dati onesti anche quando controintuitivi**: il sistema non forza il risultato a corrispondere all'intuizione/fama (es. Lautaro non è il attaccante più caro nel dataset attuale, perché ha meno presenze storiche di altri) — preferiamo un modello trasparente e spiegabile a uno "aggiustato a mano" per sembrare più familiare.

---

## Testing

- **Decision Engine**: testato su 5 scenari reali (vedi astra-decision-engine.md, sezione 6), verdetti coerenti
- **AIE**: testato ricalcolo da marketLog modificato/eliminato/annullato, stati sempre corretti
- **Budget Allocation Engine**: calibrato numericamente (ricerca di alpha per ruolo) e verificato su dataset reale — somma prezzi per ruolo coerente col budget assegnato, decadimento rank1→rankN plausibile per tutti e 4 i ruoli
- **Build**: `npm run build` passa senza errori, 493 giocatori reali caricati correttamente
- **Lint**: `npx eslint .` pulito

---

## TODO (priorità)

1. **🟠 ALTA — Storico infortuni**: caricare il dataset 2020/21-2024/25 top 5 campionati, wire `injuries.py` in `prepare_players.py`
2. **🟠 ALTA — Titolarità preseason**: aggiungere modo di aggiornare `probabilitaTitolarita` ~1 settimana prima asta (da Fantacalciopedia)
3. **🟡 MEDIA — Ricalibrazione Budget Allocation Engine**: dopo la prima asta reale, confrontare prezzi pagati vs consigliati e ritarare `RANK_ALPHA` per ruolo (attualmente calibrato solo su Lautaro/attaccanti)
4. **🟢 BASSA — Simulatore Monte Carlo**: completare confronto Compra/Lascia (già progettato, non implementato)

---

## Prossimo step

In attesa di input dall'utente: dataset storico infortuni, oppure via libera per un'asta di prova con i dati attuali per iniziare a raccogliere prezzi reali da confrontare con i consigliati.

---

## Aggiornamento 2026-08-07 (v2): pricing v4 + Simulatore Monte Carlo

**Pricing**: sostituito il Budget Allocation Engine v3 (fattore di correzione artificiale) con la v4 — causa radice risolta nella metrica di ingresso (fantamedia in eccesso sopra il "voto puro" del ruolo, non fantamedia assoluta). Nessun fattore di correzione a valle. Lautaro Martinez ora a 149 crediti (target utente 150-200 ✅). Dettagli completi in BUDGET_ALLOCATION_DESIGN.md sezione 16.

**Nuovo componente — Simulatore Monte Carlo Compra/Lascia** (`src/lib/engine/simulator.ts` + `src/components/auction/ScenarioComparison.tsx`): implementato per la prima volta (era solo progettato). Simula il resto dell'asta per tutte le 8 squadre, stocasticamente, N volte (default 80 iterazioni, ~150-200ms), confronta "potenza rosa" attesa comprando vs lasciando il giocatore chiamato. Integrato in `DecisionPanel`, visibile solo quando il verdetto è ASPETTA (i casi ambigui, come da design originale).

**Comportamento verificato e importante da capire**: a prezzo pieno (= prezzo consigliato), il simulatore è sostanzialmente neutro tra Compra/Lascia — comportamento corretto, non un bug: se il pricing VOR riflette davvero il valore equo, pagare esattamente quel prezzo non dovrebbe sistematicamente aiutare né danneggiare la rosa. Il simulatore diventa utile soprattutto nei casi di reale disaccordo tra prezzo corrente e valore (verificato: a metà prezzo, la raccomandazione passa correttamente a COMPRA).

**Non ancora fatto**: Web Worker per il simulatore (per ora gira sul thread principale — già abbastanza veloce con 80 iterazioni, ma da rivedere se in futuro si aumentano le iterazioni per maggiore precisione).

---

## Aggiornamento 2026-08-07 (v3): Reparto Intelligence Engine

**Nuovo motore** (`src/lib/engine/reparto-intelligence-engine.ts`): l'asta si svolge un reparto alla volta (P → D → C → A, si completa un reparto in tutta la lega — 24/64/64/48 slot — prima di passare al successivo). Il reparto attivo è **dedotto automaticamente** dal `marketLog` (`getActiveDepartment`), nessuno stato aggiuntivo da gestire manualmente. Non modifica Decision Engine, AIE, simulatore o suggeritore — li riusa.

Cosa fa:
1. **Analisi qualitativa del reparto** (`analyzeDepartment`): report narrativo generato a blocchi componibili (stesso pattern di `explanation_short` in Python), non un template fisso — qualità media, affidabilità, bonus, titolari affidabili, rischiosi.
2. **Gap analysis data-driven** (7 tipi: manca_top, manca_titolare, troppi_rischiosi, troppi_simili, manca_rigorista, manca_bonus, puoi_scommettere) — basata sulla rosa reale, non su regole fisse generiche.
3. **Classifica giocatori disponibili con badge** (🔥 Occasione, ⭐ Top, 💎 Sottovalutato, ⚠️ Rischioso).
4. **Occasioni del momento**: alert proattivi, limitati (max 3) per evitare rumore.
5. **Dashboard sempre visibile**: acquistati/mancanti, qualità media, top rimasti, inflazione, budget, riferimento di spesa (esplicitamente non vincolante).

Nuova schermata `/auction/reparto` (tab "Reparto" in TabBar).

**Bug scoperto e corretto durante l'implementazione, non cosmetico**: il primo smoke test ha rivelato che `astraIndex` (usato per il badge "Top") e il pricing VOR erano calcolati con **formule scollegate** — `bonus_raw` in scoring.py usava ancora gol/assist grezzi, mentre il pricing usava fantamedia in eccesso. Risultato: giocatori con indice alto (78-84) prezzati a 1 credito, segnalati come falsi "occasione". **Fix alla radice**: `bonus_raw` ora usa la stessa metrica del pricing (fantamedia in eccesso sopra il voto puro del ruolo) — astraIndex e prezzo raccontano di nuovo la stessa storia. Rieseguita la pipeline, verificato che i top per indice hanno ora prezzi coerenti in scala.

**Secondo fix**: la logica del badge "Occasione" confrontava inizialmente il rapporto qualità/prezzo con la media generale del ruolo — penalizzava sistematicamente i profili affidabili-ma-poco-offensivi (che il VOR prezza correttamente basso). Corretto con un **confronto tra pari indice** (±6 punti Astra Index, stesso ruolo): un'occasione vera è un giocatore prezzato molto sotto la mediana di chi ha la sua stessa qualità, non semplicemente "indice alto, prezzo basso" in assoluto.

**players.json rigenerato** con `status.rigoristaRank` ora persistito esplicitamente (prima viveva solo dentro il testo di `explanationShort`), usato dal gap "manca_rigorista".

**Non ancora fatto**: nessuna correlazione ancora verificata con un'asta reale per i gap identificati o le occasioni — come per il pricing, la vera prova è sul campo.

---

## Aggiornamento 2026-08-08: Department Plan Engine ("Piano del Reparto")

**Nuovo motore** (`src/lib/engine/department-plan-engine.ts`), additivo: non ha toccato Decision Engine, AIE, simulatore, Reparto Intelligence Engine — li riusa (in particolare `rankRemainingPlayers` e `computeMarketSignals`). Nessun secondo stato: legge sempre `AuctionState` fresco.

**Concetto chiave, esplicitamente richiesto dall'utente**: il piano è un'ipotesi strategica, mai un vincolo. Le fasce (Top/Semi-top/Titolare/Scommessa) sono calcolate su percentili dell'Astra Index nel pool reale (non soglie fisse), il profilo-target si ricalcola ad ogni acquisto.

1. **Profilo reparto dinamico** (`computeDepartmentPlan`): parte da un archetipo-seed per ruolo (solo un punto di partenza, mostrato per trasparenza), sottrae le fasce già raggiunte, si aggiusta per scarsità/inflazione del pool (se i top scarseggiano o costano troppo, declassa dinamicamente a semi-top).
2. **Reparto Fit** (`computeRepartoFit`): non "quanto è forte il giocatore" ma "quanto migliora la mia situazione rispetto alla migliore alternativa realistica nella stessa fascia" — un secondo top pesa strutturalmente meno di un primo (`needFactor` crolla da 1.3 a 0.55 se la fascia è già coperta), la scarsità di alternative aumenta l'urgenza.
3. **Prossimo obiettivo** (`computeNextObjective`): testo generato dalla fascia prioritaria ancora scoperta; se i top sono scarsi/inflazionati, declassa automaticamente l'obiettivo a semi-top con motivazione esplicita. Ultimo slot → messaggio dedicato ("miglior completamento", non più "cerca la fascia X").
4. **Costo-opportunità cross-reparto** (`crossDepartmentOpportunity`): confronta il rapporto qualità/prezzo dei top del reparto attivo con quelli del reparto successivo (ancora non iniziato, quindi tutto il suo pool è disponibile per il confronto) — nota qualitativa, mai una cifra di riserva.
5. **Fine reparto** (`computeDepartmentCompletion`): forza reparto, investimento, efficienza (valore equo VOR / speso — >100% = affare) quando lo slot è l'ultimo riempito.
6. **Integrazione "Chi chiamare?"**: `suggestNextCalls` ora pesa con `repartoFit` **solo per il reparto attivo** — un cambiamento di comportamento vero, non solo un peso aggiuntivo (vedi bug sotto).

**UI**: nuova card `DepartmentPlanCard` nella schermata Reparto già esistente, formato compatto come da schema fornito dall'utente (profilo con ✓/→, prossimo obiettivo, miglior fit, nota costo-opportunità).

**Bug reale scoperto dallo smoke test, corretto prima della consegna**: `suggestNextCalls` suggeriva giocatori di **reparti non ancora iniziati** (es. centrocampisti mentre l'asta era ancora nella fase Difensori) — impossibile nella realtà, dato che l'asta è strutturalmente sequenziale. Il suggeritore ora **restringe le candidature al reparto attivo** (`getActiveDepartment`), non solo le pesa. Verificato: dopo la correzione, "Chi chiamare?" suggerisce esclusivamente giocatori del reparto in corso.

**Verificato anche**: comprare un top a prezzo di saldo aggiorna correttamente `remainingTarget.top` a 0 nello stesso render (il piano "si accorge" dell'acquisto), e un secondo top disponibile riceve immediatamente un fit più basso con motivazione "fascia già coperta, meno prioritario".

**Non ancora fatto**: integrazione esplicita del Monte Carlo nel Piano (punto 9 della richiesta — "il Piano può usare i risultati del Monte Carlo per motivare la propria raccomandazione") — il simulatore resta disponibile come prima (bottone nei casi ASPETTA) ma non è ancora richiamato automaticamente dal Department Plan Engine.

---

## Aggiornamento 2026-08-08 (v2): Simulation Trigger — integrazione Monte Carlo/Piano/Decision Engine

**Pricing**: verificato prima di procedere (Lautaro 149, Dimarco 146, somma 4018≈4000, split invariato) — nessuna modifica necessaria in questa sessione.

**Nuovo motore** (`src/lib/engine/simulation-trigger.ts`), additivo, non esegue mai il Monte Carlo da solo — decide solo SE proporlo:

- **Casi netti (fast path, nessun calcolo di ambiguità)**: `currentBid > dynamicMaxPrice × 1.15` → mai simulare (hard stop, protezione esplicitamente richiesta: il Monte Carlo non può mai ribaltare un NON_RILANCIARE netto). Bid ben sotto consigliato + fascia scoperta + molte alternative → mai simulare (RILANCIA netto).
- **Zona grigia**: `ambiguityScore` pesato da vicinanza al prezzo massimo (32%), importanza per il Piano del Reparto via `RepartoFit` (25%), scarsità di alternative nella stessa fascia (20%), incertezza sui dati/confidence (13%), rischio di assorbire budget rilevante (10%). Soglia 0.5, oppure verdetto già ASPETTA.

**Simulatore esteso** (`simulator.ts`): `ComparisonResult` ora include `deltaTop3`, `pianoNota` (se comprare completa una fascia che il Piano segna ancora mancante — calcolato deterministicamente confrontando `computeDepartmentPlan` prima/dopo, non nella parte stocastica) e `spiegazione` testuale. **Costo-opportunità cross-reparto già strutturalmente presente**: il simulatore simula sempre TUTTI i reparti residui per tutte le 8 squadre nello stesso run, quindi spendere di più ora limita già correttamente cosa la simulazione stessa può permettersi dopo — non è stato necessario aggiungere un modello separato.

**Cache Monte Carlo** (`getCachedComparison`, in `simulator.ts`): risultati già calcolati vengono salvati in memoria (solo sessione, nessuna persistenza) e riusati come segnale opzionale in "Chi chiamare?" — mai ricalcolati per ogni candidato (troppo lento), solo se già disponibili da un confronto fatto manualmente in Asta Live.

**UI**: `DecisionPanel` ora usa `computeSimulationTrigger` invece del precedente `verdict === "ASPETTA"`. `ScenarioComparison` mostra l'indicatore discreto "⚖️ Decisione equilibrata" solo quando il trigger scatta, output riformattato (Top 3%, Posizione media, Forza rosa, Δ Top3, banner 🟢/🟡, spiegazione, nota piano) più vicino al formato richiesto.

**Performance verificata, non presunta**: 80 iterazioni ~150-210ms, testato anche a 300 iterazioni (~280-345ms) su uno scenario realistico a metà asta con pool ridotto. **Web Worker non necessario** a questi volumi — decisione basata su misurazione reale, non teorica.

**Test A-F eseguiti** (RILANCIA netto, NON_RILANCIARE netto, ASPETTA con scarsità, confronto Compra/Lascia con impatto sul piano, costo-opportunità budget-limitato, Monte Carlo favorevole ma bid oltre il massimo) — tutti confermano il comportamento atteso, incluso il caso critico F: **il trigger non propone mai la simulazione quando il Decision Engine ha già dato un hard stop**, indipendentemente da quanto il resto del contesto sembri favorevole.

**Nota emersa dal test D**: in uno scenario reale, il Monte Carlo ha raccomandato LASCIA anche per un giocatore che completa la fascia "top" del piano — la simulazione non approva automaticamente ogni acquisto coerente col piano, softens l'appeal del piano stesso quando il prezzo pagato eroderebbe troppo la forza attesa altrove. Comportamento corretto, non un bug: dimostra che il sistema non si limita a razionalizzare le decisioni del piano.

---

## Aggiornamento 2026-08-09: League Intelligence / Opponent Tracker

Nuovo livello di CONTESTO sulle altre 7 squadre — non un secondo Decision Engine. Il verdetto RILANCIA/ASPETTA/NON_RILANCIARE resta sempre e solo del Decision Engine.

### File nuovi
- `src/lib/engine/league-intelligence-engine.ts` — dashboard 8 squadre, pressione budget (🟢/🟡/🔴), competitor reali per un giocatore, threat ranking, insight
- `src/types/league.ts` — tipi (`TeamLeagueStatus`, `CompetitorInfo`, `ThreatRankingEntry`, `LeagueInsight`, `PlayerCompetitionContext`)
- `src/components/auction/CompetitorPanel.tsx` — sezione Competitor nel DecisionPanel, mostrata solo con reale informazione strategica

### File modificati
- `auction-context.ts`: aggiunta `CREDITO_PER_SLOT_INIZIALE` (consolidata, era duplicata) e `roleObligationRatio` (nuovo helper condiviso)
- `auction-intelligence-engine.ts`: estratto `computeTeamAggressivita` (helper condiviso, funziona per qualsiasi squadra inclusa "me"), `OpponentProfile` ora ha `confidence`; `computeOpponentProfiles` lo riusa invece di ricalcolare
- `simulator.ts`: `simulateRestOfAuction` ora pesa la scelta dell'acquirente anche con aggressività osservata reale e obbligo di ruolo dinamico (oltre al solo budget, come prima); `ROLE_POWER_WEIGHT` e `rosterPower` esportati per riuso
- `team-status.ts`: **riscritto come wrapper sottile** sopra `computeLeagueStatus` — prima duplicava la logica di aggressività/pressione già presente in AIE
- `TeamsDashboard.tsx`: arricchita con % completamento, spesa media, forza stimata, pressione (era già la dashboard richiesta al punto 1, non ne è stata creata una seconda)
- `DecisionPanel.tsx`: integra `CompetitorPanel`, mostrato solo se il giocatore appartiene al reparto attivo
- `suggestion-engine.ts`: fattore additivo basato su competitor reali (non una regola rigida)
- `types/dynamic-pricing.ts`: `OpponentProfile.confidence` (additivo)

### Riutilizzato, non duplicato
`computeOpponentProfiles`, `computeMarketSignals`, `computeCompetitionPressure` (AIE) · `getMyTeam`/`slotsFree`/`totalSlotsFree`/`minReserve` (auction-context) · `classifyTier` (Department Plan Engine) · `rosterPower` (simulator, ora esportata) · `getActiveDepartment` (Reparto Intelligence Engine)

### Duplicazioni eliminate
1. `CREDITO_PER_SLOT_INIZIALE` era definita due volte (AIE + team-status.ts) → ora una sola fonte in `auction-context.ts`
2. La logica di aggressività/pressione esisteva in due implementazioni indipendenti (AIE per gli avversari, team-status.ts per la UI) → ora `computeTeamAggressivita` condivisa, `team-status.ts` è un wrapper

### Estensione Monte Carlo — verificata prima e dopo, come richiesto
Baseline catturato su scenario fisso (8 run × 150 iterazioni) prima della modifica: `compraCount=7/8, deltaTop3=3, posCompro=4.84, posLascio=4.99`. Dopo l'estensione (aggressività + obbligo di ruolo nel peso di scelta acquirente): `compraCount=7/8, deltaTop3=4, posCompro=4.78, posLascio=4.85`. **Nessun cambiamento significativo** (variazioni entro il rumore stocastico atteso, raccomandazione invariata) — procedo senza fermarmi, come da istruzione.

### Test eseguiti
- Regressione Simulation Trigger A/B/F (RILANCIA netto, NON_RILANCIARE netto, MC favorevole ma bid oltre massimo) — tutti confermati invariati dopo l'estensione del Monte Carlo
- League Intelligence A-J (tutti gli scenari richiesti): A (molti crediti+molti slot non necessariamente pericoloso), B (pochi crediti+molti slot → forte pressione, confermato), C (reparto quasi completo → bassa competizione, confermato), D (competition pressure 6/7 con più avversari obbligati), E (avversario senza budget escluso dai competitor reali, confermato), F (confidence aggressività coerente con `clamp(acquisti/5,0,1)`, confermato — corretto uno scenario di test malformato, non il motore), G (guardia `player.role === activeRole` verificata nel codice sorgente del DecisionPanel), H (reparto attivo passa correttamente a C dopo D completo, slot D=0 per tutte le squadre), I (budget/pressione coerenti in fase avanzata), J (dati insufficienti → incertezza dichiarata esplicitamente, non conclusioni inventate — corretto uno scenario di test malformato)

### Problemi trovati durante l'implementazione
Due assert di test inizialmente falliti (F e J) — **non erano bug del motore**, erano scenari di test costruiti in modo da non esercitare davvero la condizione "pochi dati" (es. 24 acquisti totali non è "asta appena iniziata" per la soglia scelta). Corretti gli scenari di test, non le soglie di produzione.

### Decisioni architetturali prese
1. Non creata una tab "Lega" separata — la dashboard "Squadre" già esistente arricchita copre lo stato lega richiesto, evitando una schermata ridondante
2. `computeCompetitorsForPlayer` filtra sempre a `canAfford === true`: un avversario senza budget sufficiente non è mai un "competitor reale", per definizione (non un'aggiunta a parte)
3. Soglie di pressione (🟢/🟡/🔴) derivate esplicitamente dalla soglia 0.5× già stabilita in AIE per `sottoPressione`, con una sola fascia intermedia aggiunta (0.85×) — nessuna soglia nuova inventata senza spiegazione
4. Aggressività osservata nel Monte Carlo calcolata una sola volta dal `marketLog` reale prima della simulazione, mai ricalcolata dentro il loop stocastico (sarebbe stato concettualmente sbagliato: l'aggressività è un dato storico osservato, non qualcosa da dedurre dalle rose sintetiche generate durante la simulazione)

---

## Aggiornamento 2026-08-10: Live Auction Flow — console unica per l'asta reale

Obiettivo di questa fase: **nessun nuovo motore, nessuna nuova formula** — solo collegamento e gerarchia visiva, per rendere la schermata Asta Live realmente utilizzabile in 5-10 secondi durante un'asta vera.

### File nuovi
- `src/lib/engine/live-decision-context.ts` — orchestratore puro (`LiveDecisionContext`): compone in un'unica chiamata gli output già esistenti di AIE, Decision Engine, Simulation Trigger, Department Plan Engine, League Intelligence. **Non introduce nessun calcolo nuovo** — verificato con test di regressione (vedi sotto).
- `src/components/auction/ActiveDepartmentBanner.tsx` — indicatore reparto attivo, sempre visibile in cima alla Live
- `src/components/auction/NextCallCard.tsx` — suggerimento "prossima chiamata" inline, riusa `suggestNextCalls()` così com'è

### File modificati
- `PlayerSearch.tsx`: **priorità assoluta** — filtro per `activeRole` (prop, nessuna logica duplicata: `getActiveDepartment` resta l'unica fonte)
- `DecisionPanel.tsx`: riscritto per consumare `LiveDecisionContext` invece di calcolare autonomamente `poolSizeByRole`/`marketSignals`/`dynamicPricing`/`decision`/`trigger`; aggiunta riga "Listone → Astra (±%)", confidence (Alta/Media/Bassa), riga sintetica dal Piano, tooltip su "Massimo" dinamico
- `live/page.tsx`: integra banner reparto attivo + `NextCallCard` prima della ricerca
- `suggestion-engine.ts`: motivazione di fallback riformulata (era `"...indice X"`, ora `"Buon rapporto valore/prezzo per un ruolo che ti manca ancora"`) — nella pratica quasi sempre sovrascritta dalla motivazione del Department Plan Engine, già ben formulata

### Cosa NON è cambiato (per costruzione)
Nessuna formula di pricing/VOR, AIE, Decision Engine, Simulation Trigger, Monte Carlo, Department Plan, League Intelligence è stata toccata — solo composizione e presentazione.

### Test di regressione (obbligatori prima del refactoring)
Confrontato `vecchio calcolo` (chiamate separate, come faceva `DecisionPanel` prima) vs `computeLiveDecisionContext` su 4 scenari (RILANCIA netto, NON_RILANCIARE netto, borderline, reparto non attivo) con `assert.deepStrictEqual` su `dynamicPricing`/`decision`/`trigger`/`marketSignals`/`poolSizeByRole` — **identici in tutti i casi**, come richiesto prima di procedere con il refactoring.

### Test A-M eseguiti (tutti confermati)
A-D (ricerca filtrata correttamente per P/D/C/A, nessuna fuoriuscita di reparto) · E (budget/rosa aggiornati dopo acquisto) · F (contesto coerente dopo cambio reparto) · G/H/I (verdetto, dynamic pricing, trigger identici a prima del refactoring) · J ("Chi chiamare?" mai fuori dal reparto attivo) · K (`probabilitaRosaIncompleta` presente in entrambi gli scenari Monte Carlo) · L (suggerimento disponibile subito dopo un acquisto, stesso reparto) · M (nessuna duplicazione di calcolo nel nuovo contesto, verificato a livello di codice sorgente)

### Problemi trovati
Nessun bug — solo il gap architetturale già previsto nell'analisi (ricerca non filtrata per reparto), ora chiuso.

### Prossimi step suggeriti
1. Validare la gerarchia visiva con un uso reale (l'auto-verifica UX richiesta è stata fatta a tavolino, non con un utente reale sotto pressione)
2. Valutare se il tooltip "ⓘ" sul prezzo massimo è sufficientemente scopribile su iPad (tap vs hover) — da confermare in uso reale
3. Pulizia periodica della cache Monte Carlo (`comparisonCache` in `simulator.ts`) per le voci di giocatori ormai venduti — non urgente, memoria di sessione, ma da tenere a mente

---

## Aggiornamento 2026-08-11: Pass UX/UI completo — nessuna logica toccata

Obiettivo: rendere Astra visivamente premium e velocissima da leggere, senza modificare alcun motore. Confermato: **nessuna formula, soglia o funzione di pricing/AIE/Decision Engine/Monte Carlo/League Intelligence/Department Plan/suggestion-engine è stata modificata** — verificato con test di regressione dedicato (vedi sotto).

### Design system (`globals.css`)
Palette semantica completa: verde=opportunità, giallo=attenzione, rosso=rischio/stop, **blu=informazione neutra (nuovo, mancava)**, viola=brand/azione. Tre livelli di elevazione (`--color-surface` → `--color-surface-raised` → `--color-surface-overlay`) invece di grigi intercambiabili. Classi condivise `.card-primary`/`.card-secondary` per una gerarchia visiva coerente tra contenitore primario e sotto-sezione (prima ogni pannello aveva lo stesso peso visivo). `.touch-target` (44px minimo) per l'uso su iPad. Micro-animazioni essenziali (`animate-pop-in`, `animate-fade-in`, `animate-flash`) con `prefers-reduced-motion` rispettato.

### Nuovi componenti UI
- **`PriceScale.tsx`**: scala visiva 0—consigliato—massimo con il bid posizionato e colorato per zona — sostituisce la lettura mentale di tre numeri separati (richiesta esplicita).
- **`Disclosure.tsx`**: componente di progressive disclosure riusabile — sub-indici, spiegazione, dettaglio competitor sono ora dietro un tap "Dettagli", mai sopra il verdetto.

### DecisionPanel — riscritto secondo la gerarchia richiesta
1. Verdetto (dominante, animato al cambio con `key={verdict}`)
2. Scala prezzo visiva
3. 4 stat essenziali: Consigliato, Massimo, Movimento mercato (↑/↓ %), Confidence (%)
4. Riga Piano + riga Competizione (compatte, sempre visibili)
5. Dettagli avanzati dietro `Disclosure` (sub-indici, spiegazione, competitor completo, nota sul massimo dinamico)
6. Monte Carlo, solo se il Simulation Trigger lo richiede (invariato)

Aggiunto stepper +/− sul bid per uso touch senza tastiera.

### Altri componenti aggiornati (solo visuale)
`VerdictBadge` (icone, animazione), `ActiveDepartmentBanner` (animazione al cambio reparto), `NextCallCard` (fascia del giocatore suggerito, riusa `computeRepartoFit` in sola lettura), `CompetitorPanel` (chip di minaccia colorati), `ScenarioComparison` (testa a testa COMPRO/LASCIO con VS centrale, verdetto in evidenza, nessun tecnicismo — es. "80 iterazioni" — mai mostrato in primo piano), `TeamsDashboard` (bordo colorato per pressione, scansione immediata), `PlayerSearch` (touch target 44px+), `TabBar`, `RosterSummary`, e i 4 componenti della schermata Reparto (`DepartmentDashboardBar`, `DepartmentReportCard`, `DepartmentOpportunities`, `DepartmentPlayerList`) allineati alle nuove classi di card.

### Verifica "nessuna regressione nei motori"
Test dedicato: Decision Engine, Dynamic Pricing, Simulation Trigger, "Chi chiamare?", League Intelligence, Department Plan, Monte Carlo — tutti confrontati con `assert.deepStrictEqual` sugli stessi input di prima del pass UI. **Tutti identici.**

### Autovalutazione "5 secondi" (richiesta esplicitamente prima di concludere)
Aprendo `/auction/live` con un giocatore selezionato: nome+ruolo in alto, bid grande al centro, verdetto enorme e colorato subito sotto, scala prezzo che mostra a colpo d'occhio se il bid è nella zona verde/gialla/rossa, 4 numeri essenziali, una riga di piano. Tutto il resto è dietro un tap. **Risposta: sì, il verdetto e la posizione rispetto a consigliato/massimo si leggono in meno di 5 secondi senza scrollare oltre la piega su iPad landscape.**

### Non fatto in questa fase (onestamente dichiarato)
- Le schermate Market/Roster/Players (non esplicitamente elencate dall'utente) mantengono lo stile precedente — ancora coerente con la palette (nessuna variabile CSS rimossa), ma non hanno ricevuto lo stesso trattamento premium (card-primary/secondary, animazioni). Da considerare per un prossimo pass se serve coerenza totale.
- Nessun test reale su dispositivo iPad — l'ottimizzazione touch è stata fatta a codice (dimensioni, target 44px) ma non verificata fisicamente.
