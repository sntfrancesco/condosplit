# Guida utente — condosplit

condosplit è un plugin per Claude Code che ti permette di gestire la suddivisione delle spese condominiali direttamente in chat, senza scrivere nessun comando manualmente.

---

## Cosa puoi fare

- Visualizzare lo schema grafico del condominio
- Calcolare la suddivisione di qualsiasi spesa tra gli interni
- Salvare uno storico delle spese nel tempo
- Configurare qualsiasi tipo di spesa e criterio di ripartizione

---

## Come iniziare

### 1. Il file di configurazione

Nella stessa cartella di questo file trovi `condo.config.json`.
Aprilo con un editor di testo e compila i dati del tuo condominio:

- **`building.name`** — nome del condominio
- **`floors`** — lista dei piani, in qualsiasi ordine
- **`units`** — gli interni di ogni piano, con un `id` e il nome del proprietario come `label`
- **`staircaseAccess`** — `false` per i piani senza accesso alla scala (es. negozi al piano terra)
- **`occupied`** — `false` su una singola unità per indicare che è **non abitata** (default: `true`)
- **`expenseTypes`** — i tipi di spesa che usi, con la relativa regola di ripartizione

### 2. Verifica la configurazione

Chiedi a Claude:

```
Mostrami lo schema del condominio
```

Vedrai una rappresentazione grafica dell'edificio:
- **◌** — unità senza accesso alla scala
- **⊘** — unità non abitata

---

## Come calcolare una spesa

Basta chiedere a Claude in modo naturale:

```
Calcola la suddivisione della bolletta luce di gennaio-febbraio 2026 per €150,52
```

```
Dividi la pulizia scala di febbraio 2026 da €80,00
```

```
Ripartisci la quota ascensore del primo trimestre 2026 di €210,50
```

Claude sa già quali interni includere e con quale criterio, in base alla configurazione.

### Salvare la spesa nello storico

```
Calcola la suddivisione della bolletta luce gen-feb 2026 per €150,52 e salvala nello storico
```

---

## Consultare lo storico

```
Mostrami lo storico delle spese condominiali
```

---

## Aggiungere un nuovo tipo di spesa

Apri `condo.config.json` e aggiungi una voce all'array `expenseTypes`:

```json
{
  "id": "acqua",
  "name": "Bolletta Acqua",
  "description": "Quota annuale acqua condominiale",
  "splitRule": "equal_all"
}
```

Poi chiedi a Claude:

```
Dividi la bolletta acqua 2026 da €320,00
```

---

## Regole di ripartizione disponibili

| Regola | Quando usarla |
|--------|---------------|
| `equal_all` | Tutti gli interni pagano la stessa quota |
| `staircase_equal` | Solo chi ha accesso alla scala (indipendentemente dall'occupazione) |
| `occupied_equal` | Solo gli interni **abitati** |
| `occupied_staircase_equal` | Solo gli interni **abitati** con accesso alla scala |
| `utility_breakdown` | La spesa si divide per componenti, ognuno con % e gruppo di riferimento |

### Unità non abitate

Per escludere un interno dalle spese che richiedono occupazione, aggiungi `"occupied": false` all'unità in `condo.config.json`:

```json
{ "id": "I3.a", "label": "Proprietario A", "occupied": false }
```

Le unità non abitate compaiono con il simbolo **⊘** nello schema e vengono escluse automaticamente dalle spese con regola `occupied_*`. Continuano a pagare le spese con regola `equal_all` o `staircase_equal`.

Per segnare un interno come tornato abitato, basta rimuovere il campo o impostarlo a `true`.

### Esempio `utility_breakdown` — bolletta luce scala

La bolletta alimenta tre utenze: autoclave (beneficia tutti), ascensore e luce scala (beneficiano solo chi abita e usa la scala):

```json
{
  "id": "bolletta_luce",
  "name": "Bolletta Luce Scala",
  "splitRule": "utility_breakdown",
  "utilityComponents": [
    { "name": "Autoclave",  "percentage": 33, "splitGroup": "all" },
    { "name": "Ascensore",  "percentage": 34, "splitGroup": "occupied_staircase" },
    { "name": "Luce Scala", "percentage": 33, "splitGroup": "occupied_staircase" }
  ]
}
```

**Gruppi disponibili per `splitGroup`:**

| Gruppo | Chi include |
|--------|-------------|
| `all` | Tutti gli interni |
| `staircase` | Chi ha accesso alla scala |
| `occupied_all` | Solo gli interni abitati |
| `occupied_staircase` | Solo gli interni **abitati** con accesso alla scala |

Le percentuali devono sommare a 100.

---

## Problemi comuni

**"File di configurazione non trovato"**
Assicurati che `condo.config.json` sia nella directory di lavoro aperta in Claude Code.

**"Le percentuali non sommano a 100"**
Controlla che la somma di tutti i `percentage` in `utilityComponents` sia esattamente 100.

**"Tipo di spesa non trovato"**
Chiedi a Claude "quali tipi di spesa ho configurato?" per vedere gli ID disponibili.

---

*Guida generata automaticamente da condosplit_init.*
