# condosplit

> Plugin MCP per Claude Code — suddivisione automatica delle spese condominiali.

condosplit è un **MCP server** che estende Claude Code con strumenti dedicati alla gestione e ripartizione delle spese condominiali. Una volta installato, basta chiedere a Claude in linguaggio naturale e lui calcola le quote, mostra lo schema dell'edificio e mantiene lo storico.

---

## Installazione

### 1. Clona e installa le dipendenze

```bash
git clone https://github.com/sntfrancesco/condosplit.git condosplit
cd condosplit
npm install
```

### 2. Registra il server in Claude Code

```bash
claude mcp add condosplit node /percorso/assoluto/condosplit/src/server.js
```

Oppure modifica manualmente `.claude/settings.json` (o `settings.local.json`):

```json
{
  "mcpServers": {
    "condosplit": {
      "command": "node",
      "args": ["/percorso/assoluto/condosplit/src/server.js"]
    }
  }
}
```

### 3. Verifica che il server sia attivo

```bash
claude mcp list
```

---

## Utilizzo

Dopo l'installazione, Claude dispone di questi strumenti che può chiamare autonomamente durante la conversazione.

### Inizializzare un progetto

```
Inizializza un progetto condosplit nella directory corrente
```

Crea `condo.config.json` e una copia di `README_GUIDE-condosplit.md` nella directory di lavoro.

### Visualizzare lo schema

```
Mostrami lo schema del condominio
```

### Calcolare una suddivisione

```
Calcola la suddivisione della bolletta luce di gen-feb 2026 per €150,52
Dividi la pulizia scala di febbraio 2026 da €80,00
Ripartisci la quota ascensore del primo trimestre 2026 di €210,50 e salvala nello storico
```

### Consultare lo storico

```
Mostrami lo storico delle spese condominiali
```

---

## Strumenti MCP esposti

| Strumento | Descrizione |
|-----------|-------------|
| `condosplit_init` | Crea `condo.config.json` nella directory specificata |
| `condosplit_schema` | Visualizza lo schema ASCII dell'edificio |
| `condosplit_types` | Elenca i tipi di spesa configurati |
| `condosplit_split` | Calcola la suddivisione di una spesa |
| `condosplit_history` | Mostra lo storico delle spese salvate |

---

## Struttura di `condo.config.json`

```jsonc
{
  "building": {
    "name": "Nome condominio",
    "floors": [
      {
        "level": 1,              // numero piano
        "label": "Primo Piano",  // etichetta leggibile
        "staircaseAccess": true, // false = nessun accesso scala (es. piano terra negozi)
        "units": [
          { "id": "I1.a", "label": "Proprietario A" },
          { "id": "I1.b", "label": "Proprietario B", "occupied": false }  // non abitato
        ]
      }
    ]
  },
  "expenseTypes": [
    {
      "id": "pulizia_scala",       // usato nel tool condosplit_split
      "name": "Pulizia Scala",
      "splitRule": "occupied_staircase_equal"  // solo abitati con accesso scala
    },
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
  ]
}
```

### Campo `occupied` per unità

Ogni unità accetta il campo opzionale `"occupied": false` per indicare che l'interno è **non abitato**.
Il default è `true` (abitato): omettere il campo equivale a `"occupied": true`.

Nello schema dell'edificio le unità non abitate sono marcate con **⊘**.

### Regole di ripartizione (`splitRule`)

| Valore | Comportamento |
|--------|---------------|
| `equal_all` | Quota uguale tra **tutte** le unità |
| `staircase_equal` | Quota uguale tra unità con `staircaseAccess: true` |
| `occupied_equal` | Quota uguale tra unità **abitate** |
| `occupied_staircase_equal` | Quota uguale tra unità **abitate** con `staircaseAccess: true` |
| `utility_breakdown` | Ripartizione per componenti, ognuno con percentuale e gruppo |

### Gruppi (`splitGroup`) — per `utility_breakdown`

| Valore | Unità incluse |
|--------|---------------|
| `all` | Tutte le unità |
| `staircase` | Unità con `staircaseAccess: true` |
| `occupied_all` | Unità **abitate** |
| `occupied_staircase` | Unità **abitate** con `staircaseAccess: true` |

---

## Struttura del progetto

```
condosplit/
├── src/
│   ├── server.js      ← entry point MCP server
│   ├── config.js      ← caricamento e validazione configurazione
│   ├── building.js    ← rendering schema ASCII
│   ├── expenses.js    ← logica di ripartizione
│   ├── report.js      ← formattazione report
│   ├── history.js     ← storico spese
│   └── init.js        ← inizializzazione progetto
├── examples/
│   └── condo.config.json
├── package.json
├── README.md
└── README_GUIDE-condosplit.md
```

---

## Requisiti

- Node.js >= 18
- Claude Code con supporto MCP

---

## Licenza

MIT
