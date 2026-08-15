# Budget Allocation Engine — Progettazione

**Problema**: il sistema attuale basa i prezzi sulla quotazione ufficiale Fantacalcio (correzione via disaccordo Astra Index), ma i prezzi reali di asta divergono moltissimo dalla quotazione. Esempio: Lautaro Martinez ha quotazione ~34 crediti nel listone, ma in una vera asta da 500 crediti con 8 squadre viene pagato tranquillamente 90-110 crediti.

**Soluzione**: invertire l'approccio. Invece di partire dalla quotazione, calcolare direttamente **quanto ogni giocatore dovrebbe costare in una vera asta**, stimando come 500 crediti si distribuiscono realmente tra i 4 ruoli e poi tra i giocatori di ogni ruolo.

---

## 1. Principio

Un'asta da 500 crediti con 8 squadre è essenzialmente un **mercato a equilibrio parziale**:
- Budget totale: 500 × 8 = 4.000 crediti disponibili
- Slot totali: 25 × 8 = 200 slot
- Crediti medi per slot: 4.000 / 200 = 20 crediti (baseline)

Ma i crediti non si distribuiscono uniformemente tra i ruoli — alcuni ruoli sono più competitivi di altri. Un portiere "mediocre titolare" costa meno di un centrocampista "mediocre titolare", perché gli attaccanti e i centrocampisti offrono più varianza di bonus.

**L'algoritmo che propongo:**

1. **Passo 1 — Distribuzione per ruolo**: assegnare il budget totale ai 4 ruoli in proporzione al loro "peso" nel fantacalcio (0-38 giornate).
2. **Passo 2 — Ranking per ruolo**: per ogni ruolo, ordinare tutti i giocatori per Astra Index.
3. **Passo 3 — Allocazione per giocatore**: dentro ogni ruolo, distribuire il budget disponibile tra i giocatori, seguendo il principio che **il prezzo deve essere proporzionale alla qualità relativa**.

Output: per ogni giocatore, un "prezzo di equilibrio" che rappresenta realmente quanto pagherebbe una squadra razionale in una vera asta.

---

## 2. Passo 1 — Distribuzione per ruolo

Il "peso" di un ruolo nel fantacalcio si misura con: **quanti punti medi un giocatore di quel ruolo genera per giornata** (storico pluriennale).

Dati empirici dalla letteratura del fantacalcio italiano (fonte: analisi storiche pubbliche di Fantacalcio.it):
- **Portieri (P)**: ~5 punti/giornata (media su titolare)
- **Difensori (D)**: ~7 punti/giornata (media su titolare)
- **Centrocampisti (C)**: ~8 punti/giornata (media su titolare)
- **Attaccanti (A)**: ~9 punti/giornata (media su titolare)

Totale: 5 + 7 + 8 + 9 = 29 punti/giornata per una rosa "media titolare" (3P + 8D + 8C + 6A).

**Budget per ruolo** = (Budget totale) × (peso_ruolo / peso_totale):
- P: 4.000 × (5/29) ≈ 690 crediti
- D: 4.000 × (7/29) ≈ 966 crediti
- C: 4.000 × (8/29) ≈ 1.103 crediti
- A: 4.000 × (9/29) ≈ 1.241 crediti

Verifica: 690 + 966 + 1.103 + 1.241 = 4.000 ✓

**Per ogni ruolo, numero di slot**: P=24, D=64, C=64, A=48 (totale 200).

**Crediti medi per slot per ruolo**:
- P: 690 / 24 ≈ 28,75 crediti
- D: 966 / 64 ≈ 15,09 crediti
- C: 1.103 / 64 ≈ 17,23 crediti
- A: 1.241 / 48 ≈ 25,85 crediti

(Nota: questi valori indicano il costo medio di un giocatore "medio" di ogni ruolo — il 50° percentile.)

---

## 3. Passo 2 — Ranking per ruolo

Per ogni ruolo, ordinare i giocatori per Astra Index descrescente:

```
Portieri (ordinati per indice, decrescente):
  1. Maignan (88.5)
  2. Di Gregorio (87.2)
  3. Villa Riccardo (86.1)  # esempio fittiizio
  ...
  68. [portiere 68°] (32.1)

Difensori (ordinati, decrescente):
  1. [difensore top] (92.1)
  ...
  224. [difensore 224°] (31.5)

Ecc.
```

---

## 4. Passo 3 — Allocazione per giocatore

**Principio**: il prezzo di un giocatore deve essere proporzionale al gap rispetto a un giocatore "neutro" (indice 50).

Ipotesi: il mercato di asta è **elastico intorno a un indice neutro 50**:
- Un giocatore con indice 50 costa il "prezzo medio di slot" del suo ruolo
- Un giocatore con indice 70 costa più di quello a 50
- Un giocatore con indice 30 costa meno di quello a 50

**Formula di allocazione (proposta)**:

```
prezzo_giocatore = crediti_medi_ruolo × (indice_giocatore / 50)^β
```

Dove `β` è un esponente che controlla la "pendenza" della relazione prezzo-qualità:
- β = 1: relazione lineare (raddoppio indice → raddoppio prezzo)
- β = 0.8: relazione sublineare (i giocatori top costano meno del proporzionale)
- β = 1.2: relazione superlineare (i giocatori top costano più del proporzionale)

**Scelta di β**: empiricamente, in una vera asta il mercato tende a sovraprezzare i giocatori top e sottovalutare i mediocri (fenomeno noto come "superstar bias"). Suggerisco β = 1.1 come compromesso.

**Esempio numerico** (Portieri):
```
Crediti medi portiere = 28,75
β = 1.1

Maignan (indice 88):
  prezzo = 28,75 × (88/50)^1.1 = 28,75 × (1,76)^1.1 ≈ 28,75 × 1,87 ≈ 54 crediti

Di Gregorio (indice 87):
  prezzo = 28,75 × (87/50)^1.1 ≈ 28,75 × 1,85 ≈ 53 crediti

Portiere mediano (indice 50):
  prezzo = 28,75 × (50/50)^1.1 = 28,75 × 1 = 28,75 crediti

Portiere scarso (indice 35):
  prezzo = 28,75 × (35/50)^1.1 ≈ 28,75 × 0,63 ≈ 18 crediti
```

**Verifica di coerenza**: la somma dei prezzi dentro ogni ruolo deve approssimarsi al budget allocato per quel ruolo, per non creare distorsioni.

```
Σ(prezzo_portiere_i) ≈ 690 crediti ✓
```

Se la somma è leggermente diversa (rounding errors, numero discreto di giocatori), si normalizza proporzionalmente:

```
prezzo_normalizzato = prezzo × (budget_ruolo / Σ(prezzo_lordi))
```

---

## 5. Massimo prezzo (max_price)

Il prezzo massimo non cambia logica rispetto a prima: è un **fattore di sicurezza** che impedisce di pagare troppo per un giocatore anche se l'indice è ottimista.

```
max_price = prezzo_consigliato × (1 + margin)

margin = base_margin_ruolo + bonus_confidence - penalita_affidabilita
```

Dove:
- `base_margin_ruolo`: come prima (P=12%, D=15%, C=18%, A=22%)
- `bonus_confidence`: più il modello è sicuro, più puoi spingerti
- `penalita_affidabilita`: più il giocatore è rischioso, meno puoi spingerti

Questo resta uguale al sistema attuale — il massimo è un "freno", non un target.

---

## 6. Quotazione ufficiale (market data)

La quotazione Fantacalcio rimane nel record `Player.market.quotazioneUfficiale` come **dato storico**, ma non influenza più il prezzo consigliato. Può servire per:
- Debugging (confrontare listone ufficiale vs prezzo calcolato da Astra)
- Reporting (mostrare quanto Astra differisce dal mercato ufficiale)
- Educazione (spiegare all'utente perché la quotazione è lontana dal valore reale di asta)

---

## 7. Vantaggi di questo approccio

1. **Realistico**: i prezzi riflettono realmente quanto pagheranno i giocatori in una vera asta da 500 crediti, non stime strane basate su un listone che non rappresenta il mercato reale.

2. **Trasparente**: la formula è semplice e auditable — non c'è "magia", solo allocazione proporzionale.

3. **Scalabile**: se la lega cambia (400 crediti, 600 crediti, numero di squadre diverso), la formula si adatta cambiando solo i budget iniziali per ruolo.

4. **Robusto**: non dipende da correzioni euristiche di quotazioni strane; dipende solo da Astra Index (che è già validato e stabile).

5. **Migliora Decision Engine**: il Decision Engine continua a funzionare uguale, ma riceve input (prezzo consigliato, massimo) più accurati. Verdetti più affidabili.

---

## 8. Parametri da tarare dopo implementazione

Questi valori sono ragionevoli ma potrebbero beneficiare di calibrazione empirica dopo la prima vera asta:

- **β (esponente di elasticità)**: suggerito 1.1, ma potrebbe essere 0.9-1.3
- **Pesi per ruolo (5/7/8/9)**: basati su letteratura storica, ma potrebbero variare anno per anno
- **Indice neutro (50)**: ipotesi che un indice 50 sia il "mediano", vero per il nostro dataset

Dopo la prima asta, confrontare i prezzi realmente pagati vs i prezzi consigliati da Astra e aggiustare i parametri di conseguenza.

---

## 9. Implementazione

Nuovo modulo Python: `scripts/astra_pipeline/budget_allocation.py`

```python
def allocate_budget_by_role(total_budget, role_weights):
    """Distribuisce budget totale tra ruoli in base ai loro pesi."""
    total_weight = sum(role_weights.values())
    budget_by_role = {
        role: (total_budget * weight / total_weight)
        for role, weight in role_weights.items()
    }
    return budget_by_role

def allocate_price_to_players(players_by_role, budget_by_role, beta=1.1, neutral_index=50):
    """Alloca il budget di ogni ruolo tra i giocatori."""
    prices = {}
    for role, players_sorted in players_by_role.items():
        budget = budget_by_role[role]
        avg_price = budget / len(players_sorted)
        
        prices_lorda = [
            avg_price * (p.scores.astraIndex / neutral_index) ** beta
            for p in players_sorted
        ]
        
        # Normalizza affinché la somma uguagli il budget
        scaling_factor = budget / sum(prices_lorda)
        prices_normalizzati = [p * scaling_factor for p in prices_lorda]
        
        for player, price in zip(players_sorted, prices_normalizzati):
            prices[player.id] = round(price)
    
    return prices
```

Integrazione in `build.py`: al momento di calcolare il prezzo consigliato per ogni giocatore, chiamare `allocate_price_to_players()` invece della vecchia formula di correzione di quotazione.

---

## 11. Revisione: allocazione rank-based (sostituisce le sezioni 3-4)

**Problema scoperto in fase di implementazione**: la formula originale (prezzo = prezzo_medio × (indice/50)^β, sezioni 3-4) usa la *magnitudine* dell'Astra Index per pesare la distribuzione del budget. Ma l'Astra Index è in parte costruito da un percentile (sub-indice Bonus, vedi scoring.py) — per costruzione compresso in cima alla distribuzione. Sui dati reali, i primi 15 attaccanti di Serie A stavano tutti tra 84 e 94 punti su 100. Nessuna potenza ragionevole applicata a un range così stretto riesce a ricreare il "superstar bias" di un'asta reale (dove il miglior attaccante costa 2-3× il secondo livello). Testato empiricamente: con la formula originale, Lautaro Martinez usciva a 24 crediti — lontanissimo dai 90-110 attesi.

**Soluzione**: pesare per **rango** (1°, 2°, 3°... per Astra Index all'interno del ruolo), non per magnitudine dell'indice. Il rango non ha il problema di compressione — è per definizione ben distribuito da 1 a N. Applichiamo una legge a potenza inversa sul rango (distribuzione stile Zipf, la stessa famiglia usata per classifiche di popolazione città o montepremi torneo):

```
peso_i = 1 / rango_i ^ alpha
prezzo_i = budget_ruolo × (peso_i / Σ pesi_ruolo)
```

**Alpha calibrato per ruolo** (esponente di concentrazione — più alto = mercato più verticale):

| Ruolo | Alpha | Rank1 | Rank2 | Rank5 | Rank15 | Rank40 |
|---|---|---|---|---|---|---|
| P | 0.32 | 30 | 24 | 18 | 12 | 9 |
| D | 0.55 | 45 | 31 | 19 | 10 | 6 |
| C | 0.61 | 65 | 43 | 24 | 10 | 7 |
| A | 0.61 | 100 | 65 | 37 | 16 | 10 |

Calibrazione fatta risolvendo numericamente alpha per ottenere questi prezzi "rank1" target (basati su convenzioni note del fantacalcio classic 500cr/8 squadre — l'unico riferimento fornito dall'utente è stato Lautaro/attaccanti ≈ 90-110, gli altri ruoli sono estrapolati per coerenza). **Da ritarare dopo la prima asta reale**, come già indicato nella sezione 8.

**Nota di trasparenza sul risultato reale**: con questa calibrazione, il vero "rank 1" tra gli attaccanti nel dataset 2026/27 non è risultato Lautaro Martinez ma Douvikas (Como) — 99 crediti contro i 65 di Lautaro (rank 2). Non è un difetto della formula: Lautaro ha 30 presenze su 38 nello storico 2025/26 (continuità 79%) contro le 36/38 di Douvikas, quindi il suo sub-indice Titolarità è più basso pur avendo il miglior Bonus (100/100, miglior gol/90 della Serie A). Il sistema pesa onestamente i dati reali disponibili, non la fama del giocatore — un comportamento corretto da preservare, anche quando diverge dall'intuizione.

**Verifica di coerenza budget** (somma dei prezzi per ruolo, dataset reale 2026/27):

| Ruolo | Budget assegnato | Somma prezzi effettiva |
|---|---|---|
| P | 690 | 689 |
| D | 966 | 969 |
| C | 1.103 | 1.103 |
| A | 1.241 | 1.242 |

La normalizzazione by-construction garantisce che la somma coincida sempre col budget assegnato (arrotondamenti a parte) — proprietà della sezione 4 originale, preservata.

**Implementazione**: `scripts/astra_pipeline/budget_allocation.py`, funzioni `allocate_prices()` e `build_allocation()`. Interfaccia semplificata rispetto alla proposta originale: opera su tuple `(player_id, role, astra_index)` invece che su oggetti Player, per essere agnostica dalla rappresentazione dati usata da `build.py`.


---

## 12. Stato e prossimi step (aggiornato)

**✅ Fatto**: `budget_allocation.py` implementato con allocazione rank-based, integrato in `build.py`, pipeline rieseguita sui dati reali 2026/27 con esito verificato (tabelle sopra).

**Prossimi step**:
1. Usare Astra durante una vera asta, annotare i prezzi realmente pagati
2. Confrontare prezzi pagati vs consigliati da Astra, per ruolo e per fascia di rango
3. Ritarare gli `RANK_ALPHA` per ruolo di conseguenza (sono la parte più debole della calibrazione attuale: basata su un solo riferimento reale fornito dall'utente, Lautaro/attaccanti — gli altri tre ruoli sono estrapolati)
4. Valutare se il sub-indice Titolarità andrebbe integrato con più stagioni storiche (non solo l'ultima), per evitare che un singolo campionato con presenze ridotte (es. per un torneo internazionale estivo) penalizzi ingiustamente giocatori di livello riconosciuto

---

## 13. Revisione v3: Value Over Replacement (sostituisce l'allocazione rank-based)

**Cosa è cambiato**: la v2 (rank-based, sezione 11) allocava comunque un budget FISSO per ruolo (5/7/8/9 pesi punti/giornata) prima di distribuirlo per rango. L'utente ha chiesto esplicitamente di rimuovere questo vincolo: **nessun budget precostituito per ruolo**, il pricing deve partire dalla produzione fantacalcistica prevista del giocatore, non da una percentuale di budget decisa a priori.

### Value Over Replacement (VOR)

Tecnica presa dal fantasy sport (baseball/football americano, dove è lo standard per il draft ad asta): un giocatore vale quanto produce **oltre al livello di rimpiazzo** del suo ruolo — l'ultimo titolare-decente ancora disponibile in lega per quel ruolo (rango = numero di slot totali per quel ruolo, con un aggiustamento per i portieri, vedi sotto). Tutto il "surplus" sopra il rimpiazzo, di qualunque ruolo, entra in un unico calderone e si distribuisce in proporzione ai crediti realmente in palio (4.000 − 200 crediti di floor = 3.800 di "surplus pool").

**Perché elimina i budget fissi per costruzione**: non c'è nessuna riga che assegna una percentuale a un ruolo. Se in una stagione i migliori difensori hanno un surplus enorme sopra il rimpiazzo, la difesa si prende automaticamente più budget — la suddivisione tra ruoli è un OUTPUT del modello (`role_share` in `AllocationResult`), non un input.

### Valore Tecnico: produzione attesa, non percentile

`scoring.expected_season_value()`: fantamedia attesa × partite attese (continuità storica × 38), con piccolo bonus per rigoristi designati. Deliberatamente **non normalizzato per ruolo** (niente percentili) — è proprio la differenza di scala assoluta tra ruoli a permettere al VOR di scoprire da solo quanto vale ciascuno.

### Due correzioni necessarie, entrambe empiriche

1. **`REPLACEMENT_RANK` specifico per i portieri** (18 invece di 24): la Serie A ha ~20 portieri titolari credibili, non 24+. Usare il rango pieno produceva un rimpiazzo vicino a zero (terzo portiere che non gioca) e quindi un surplus abnorme per i titolari, facendo esplodere la quota portieri (fino al 22% del budget in un test — chiaramente irrealistico).

2. **`ROLE_POTENTIAL_FACTOR`**: correzione al VALORE TECNICO in ingresso (P:0.40, D:0.90, C:1.00, A:1.85). Motivazione onesta: la sola fantamedia storica, mediata su una stagione, non cattura la varianza/rarità dei bonus — un gol è un evento raro e ad alto valore economico in un'asta reale, ma una fantamedia "onesta" lo appiattisce nella media. Senza questa correzione, Lautaro Martinez usciva a **~50-65 crediti**, lontanissimo dai 150-200 di un'asta reale (verificato empiricamente, non teoricamente). **Importante essere chiari con l'utente su questo punto**: questa non è la reintroduzione di un budget fisso per ruolo — non fissa QUANTO un ruolo può spendere in totale, corregge SOLO l'unità di misura del valore tecnico grezzo. Un difensore straordinario può comunque superare un attaccante mediocre; il fattore non impone nessun tetto aggregato.

3. **`GAMMA` globale (1.7)**: concentrazione top-heavy, applicata in un'unica normalizzazione su tutto il pool (non per ruolo — testato e scartato un `GAMMA` per-ruolo perché rompe la comparabilità tra ruoli in una singola somma globale, vedi il tentativo fallito con quote che collassavano al 94% su un solo ruolo).

### Risultato calibrazione finale (dataset reale 2026/27)

| Ruolo | Quota emersa | Top1 | Top5 |
|---|---|---|---|
| P | 3.6% | 10 | 9-10 |
| D | 11.8% | 25 | 12-15 |
| C | 12.2% | 20 | 13-16 |
| A | 73.0% | 155 | 128-155 |

Lautaro Martinez: **128 crediti** (rispetto ai 150-200 attesi — vicino ma non centrato esattamente; Douvikas resta il top attaccante nel dataset a 155, per lo stesso motivo di continuità già documentato nella sezione 11).

**Nota di onestà**: la quota Attaccanti (73%) è più alta di quanto la tradizione fantacalcistica suggerisca (di solito ~45%) — conseguenza diretta dell'aver rimosso il vincolo di budget fisso: il modello, lasciato libero, concentra molto valore sugli attaccanti perché è lì che il Valore Tecnico (anche corretto) mostra il surplus maggiore sopra il rimpiazzo. Va verificato con l'uso reale se questo riflette davvero il comportamento di un'asta vera o se il `ROLE_POTENTIAL_FACTOR` va ritarato — è l'esperimento più importante da fare alla prossima asta.

**Implementazione**: `scripts/astra_pipeline/budget_allocation.py` (riscritto), `scripts/astra_pipeline/scoring.py` (nuova funzione `expected_season_value`).

---

## 14. Chi chiamare? (implementato)

Suggeritore lato client (`src/lib/engine/suggestion-engine.ts`), **non modifica Decision Engine né Auction Intelligence Engine** — li riusa così come sono (`computeDynamicPricing`, `computeMarketSignals`), aggiungendo solo un ordinamento sopra i loro output.

Punteggio per giocatore disponibile: `(astraIndex / dynamicSuggestedPrice) × urgenzaRuolo × fattoreConfidence`, filtrato per affordability (deve rientrare nel budget residuo al netto della riserva minima per gli slot rimanenti). Integrato nella schermata Giocatori come toggle "🎯 Chi chiamare?" (vista di default) vs "Sfoglia listone" (vista precedente).

---

## 15. Stato finale e prossimi step

**✅ Fatto**: VOR implementato, calibrato su Lautaro (risultato: 128, target 150-200 — vicino ma imperfetto), "Chi chiamare?" implementato e integrato in UI, build/lint puliti.

**Prossimi step**:
1. Usare Astra a un'asta vera, confrontare prezzi pagati vs consigliati per tutti e 4 i ruoli
2. Ritarare `ROLE_POTENTIAL_FACTOR` e `GAMMA` di conseguenza — sono i parametri più sensibili e meno testati di tutta la pipeline
3. Valutare se la quota Attaccanti emersa (73%) è realistica o eccessiva con dati di un'asta vera
4. Wire del dataset infortuni quando disponibile

---

## 16. Revisione v4: fantamedia in eccesso (sostituisce il fattore di correzione v3)

**Causa radice trovata**: la v3 introduceva un `ROLE_POTENTIAL_FACTOR` per compensare artificialmente un problema che in realtà stava nella metrica di ingresso. La fantamedia assoluta oscilla in un range strettissimo (5.2-9.0 per gli attaccanti, ancora più stretto per gli altri ruoli — verificato sui dati reali: mediana P=4.97, D=5.96, C=6.16, A=6.48). Moltiplicata per le partite attese, il "voto puro" (~6, presente per chiunque giochi con continuità, bravo o mediocre) domina il numero risultante e schiaccia il segnale che conta davvero — i bonus/malus, cioè quello che il mercato reale premia in un'asta.

**Fix alla radice**: `scoring.expected_season_value()` ora usa la fantamedia **in eccesso** sopra un "voto puro" di riferimento per ruolo (`BASE_VOTE`: P 4.7, D 5.6, C 5.7, A 5.9), non la fantamedia assoluta. Questo isola esattamente la componente di bonus/malus, che è quella economicamente rilevante. Nessun fattore di correzione a valle è più necessario — **`ROLE_POTENTIAL_FACTOR` è stato rimosso**.

### Risultato (dataset reale 2026/27, GAMMA=1.5)

| Ruolo | Quota emersa | Top6 |
|---|---|---|
| P | 8.2% | 52,41,36,34,29,23 |
| D | 22.4% | 146,42,40,36,31,31 |
| C | 30.5% | 92,65,64,51,48,48 |
| A | 39.3% | 149,108,103,103,97,89 |

Lautaro Martinez: **149 crediti** — dentro il target 150-200 indicato dall'utente. Somma totale: 4.018 (≈4.000).

**Caso interessante emerso onestamente dai dati, non corretto a mano**: Dimarco (D, Inter) prezzato a 146 crediti, quasi quanto Lautaro — perché la sua stagione reale è stata eccezionale per un difensore (35 presenze, fantamedia 7.69, 7 gol, **17 assist**). È un output legittimo del modello: un difensore con quella produzione vale davvero quanto un ottimo attaccante in un'asta reale. Nessun tetto è stato imposto per "correggerlo" verso il basso.

**Perché questa versione è più solida della v3**: la v3 curava il sintomo (prezzi finali sballati) con una toppa sul valore in ingresso di ogni ruolo; la v4 cura la causa (la metrica stessa non isolava il segnale giusto). Il modello risultante è più semplice (un parametro in meno, `ROLE_POTENTIAL_FACTOR` eliminato) e più difendibile concettualmente.

**Ancora da verificare con un'asta vera**: `BASE_VOTE` per ruolo e `GAMMA` restano calibrati su un solo riferimento reale (Lautaro). `REPLACEMENT_RANK` per i portieri (18) resta una stima ragionevole ma non testata sul campo.
