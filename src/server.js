#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import fs from 'fs';

import { loadConfig, validateConfig } from './config.js';
import { buildSchemaText } from './building.js';
import { calculateSplit, applyRounding, buildTypesText, parseAmount } from './expenses.js';
import { buildReport } from './report.js';
import { saveExpense, buildHistoryText } from './history.js';
import { initProject } from './init.js';
import {
  loadCoordinates, saveCoordinate, findCoordinate,
  buildCoordinatesText,
} from './coordinates.js';

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'condosplit_init',
    description: 'Inizializza un progetto condominiale: crea condo.config.json con la struttura di default (4 piani + piano terra, 2 interni per piano, 3 tipi di spesa predefiniti) nella directory specificata.',
    inputSchema: {
      type: 'object',
      properties: {
        project_dir: {
          type: 'string',
          description: 'Percorso assoluto o relativo della directory di progetto. Default: directory corrente.',
        },
      },
    },
  },
  {
    name: 'condosplit_schema',
    description: 'Visualizza lo schema grafico ASCII dell\'edificio condominiale con piani, interni ed etichette. Mostra quali unità hanno accesso alla scala.',
    inputSchema: {
      type: 'object',
      properties: {
        config_path: {
          type: 'string',
          description: 'Percorso al file condo.config.json. Default: ./condo.config.json',
        },
      },
    },
  },
  {
    name: 'condosplit_types',
    description: 'Elenca tutti i tipi di spesa configurati in condo.config.json con le relative regole e criteri di ripartizione.',
    inputSchema: {
      type: 'object',
      properties: {
        config_path: {
          type: 'string',
          description: 'Percorso al file condo.config.json. Default: ./condo.config.json',
        },
      },
    },
  },
  {
    name: 'condosplit_split',
    description: 'Calcola la suddivisione di una spesa condominiale tra gli interni e restituisce il riepilogo dettagliato con la quota di ciascun interno. Se payment_coordinates_id non è specificato e sono presenti coordinate salvate, restituisce anche la lista delle coordinate disponibili così che l\'utente possa scegliere quale includere nel report.',
    inputSchema: {
      type: 'object',
      properties: {
        expense_type_id: {
          type: 'string',
          description: 'ID del tipo di spesa come definito in condo.config.json (es. "bolletta_luce", "pulizia_scala", "ascensore").',
        },
        label: {
          type: 'string',
          description: 'Etichetta descrittiva della spesa (es. "Bolletta luce gen-feb 2026").',
        },
        amount: {
          type: 'string',
          description: 'Importo totale della spesa. Accetta virgola o punto come separatore decimale (es. "150,52" o "150.52").',
        },
        config_path: {
          type: 'string',
          description: 'Percorso al file condo.config.json. Default: ./condo.config.json',
        },
        save: {
          type: 'boolean',
          description: 'Se true, salva la spesa nello storico (condosplit-history.json). Default: false.',
        },
        payment_coordinates_id: {
          type: 'string',
          description: 'ID della coordinata di pagamento (da condo.coordinates.json) da includere nel report. Se omesso e sono disponibili coordinate salvate, il tool restituisce la lista per consentire la scelta.',
        },
      },
      required: ['expense_type_id', 'label', 'amount'],
    },
  },
  {
    name: 'condosplit_history',
    description: 'Mostra lo storico delle spese salvate con il flag save=true.',
    inputSchema: {
      type: 'object',
      properties: {
        config_path: {
          type: 'string',
          description: 'Percorso al file condo.config.json. Default: ./condo.config.json',
        },
      },
    },
  },
  {
    name: 'condosplit_coordinates',
    description: 'Elenca tutte le coordinate di pagamento salvate in condo.coordinates.json (IBAN, banca, intestatario, ecc.).',
    inputSchema: {
      type: 'object',
      properties: {
        config_path: {
          type: 'string',
          description: 'Percorso al file condo.config.json. Default: ./condo.config.json',
        },
      },
    },
  },
  {
    name: 'condosplit_coordinates_save',
    description: 'Aggiunge o aggiorna una coordinata di pagamento in condo.coordinates.json. Se l\'ID esiste già, sovrascrive il record.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Identificatore univoco della coordinata (es. "enel_energia", "impresa_pulizie").',
        },
        label: {
          type: 'string',
          description: 'Nome leggibile della coordinata (es. "Enel Energia", "Impresa Pulizie Rossi").',
        },
        intestatario: {
          type: 'string',
          description: 'Intestatario del conto/beneficiario del pagamento.',
        },
        iban: {
          type: 'string',
          description: 'Codice IBAN.',
        },
        swift: {
          type: 'string',
          description: 'Codice SWIFT/BIC (opzionale, utile per bonifici internazionali).',
        },
        banca: {
          type: 'string',
          description: 'Nome della banca.',
        },
        causale: {
          type: 'string',
          description: 'Causale standard predefinita per questa coordinata (verrà usata se non specificato diversamente).',
        },
        note: {
          type: 'string',
          description: 'Note aggiuntive (es. "includere numero cliente in causale").',
        },
        config_path: {
          type: 'string',
          description: 'Percorso al file condo.config.json. Default: ./condo.config.json',
        },
      },
      required: ['id', 'label'],
    },
  },
];

// ── Handlers ──────────────────────────────────────────────────────────────────

function resolveConfigPath(configPath) {
  return configPath || './condo_eu58/condo.config.json';
}

function handleInit({ project_dir = '.' }) {
  const result = initProject(project_dir);
  return result;
}

function handleSchema({ config_path }) {
  const config = loadConfig(resolveConfigPath(config_path));
  validateConfig(config);
  return buildSchemaText(config);
}

function handleTypes({ config_path }) {
  const config = loadConfig(resolveConfigPath(config_path));
  validateConfig(config);
  return buildTypesText(config);
}

function handleSplit({ expense_type_id, label, amount, config_path, save = false, payment_coordinates_id }) {
  const resolved = resolveConfigPath(config_path);
  const config = loadConfig(resolved);
  validateConfig(config);

  const expenseType = config.expenseTypes.find(et => et.id === expense_type_id);
  if (!expenseType) {
    const available = config.expenseTypes.map(et => `"${et.id}"`).join(', ');
    throw new Error(`Tipo di spesa non trovato: "${expense_type_id}". Disponibili: ${available}`);
  }

  const totalAmount = parseAmount(amount);
  const splits = applyRounding(calculateSplit(config, expenseType, totalAmount), totalAmount);

  // Resolve coordinate di pagamento
  const coords = loadCoordinates(resolved);
  let coordinate = null;

  if (payment_coordinates_id) {
    coordinate = findCoordinate(coords, payment_coordinates_id);
    if (!coordinate) {
      throw new Error(`Coordinata di pagamento non trovata: "${payment_coordinates_id}". Usa condosplit_coordinates per vedere quelle disponibili.`);
    }
  }

  const report = buildReport(config, expenseType, label, totalAmount, splits, coordinate);

  let result = report;

  if (save) {
    const historyPath = path.resolve(path.dirname(resolved), 'condosplit-history.json');
    saveExpense(historyPath, {
      date: new Date().toISOString().split('T')[0],
      expenseTypeId: expense_type_id,
      expenseTypeName: expenseType.name,
      label,
      total: totalAmount,
      splits: splits.map(s => ({ unitId: s.unit.id, amount: s.amount })),
    });
    result += '\nSpesa salvata nello storico.';
  }

  // Se non è stata specificata una coordinata ma ce ne sono disponibili → chiedi
  if (!payment_coordinates_id && coords.length > 0) {
    const LINE = '─'.repeat(62);
    const defaultId = expenseType.defaultPaymentCoordinatesId;
    let prompt = `\n${LINE}\n  COORDINATE DI PAGAMENTO\n${LINE}\n`;
    prompt += '  Scegli le coordinate da includere nel report richiamando\n';
    prompt += '  condosplit_split con payment_coordinates_id=<ID>.\n';
    if (defaultId) {
      const def = findCoordinate(coords, defaultId);
      if (def) prompt += `\n  Predefinita per questa spesa: ${def.label}  [${defaultId}]\n`;
    }
    result += prompt + buildCoordinatesText(coords);
  }

  return result;
}

function handleCoordinates({ config_path }) {
  const coords = loadCoordinates(resolveConfigPath(config_path));
  return buildCoordinatesText(coords);
}

function handleCoordinatesSave({ config_path, id, label, intestatario, iban, swift, banca, causale, note }) {
  const coord = { id, label };
  if (intestatario !== undefined) coord.intestatario = intestatario;
  if (iban !== undefined)         coord.iban = iban;
  if (swift !== undefined)        coord.swift = swift;
  if (banca !== undefined)        coord.banca = banca;
  if (causale !== undefined)      coord.causale = causale;
  if (note !== undefined)         coord.note = note;

  const coords = saveCoordinate(resolveConfigPath(config_path), coord);
  return (
    `Coordinata "${label}" [${id}] salvata.\n` +
    `Totale coordinate nel file: ${coords.length}.\n\n` +
    'Puoi associarla a un tipo di spesa in condo.config.json aggiungendo:\n' +
    `  "defaultPaymentCoordinatesId": "${id}"`
  );
}

function handleHistory({ config_path }) {
  const config = loadConfig(resolveConfigPath(config_path));
  const historyPath = path.resolve(
    path.dirname(path.resolve(resolveConfigPath(config_path))),
    'condosplit-history.json'
  );
  return buildHistoryText(historyPath, config.building?.name);
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'condosplit', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let text;
    switch (name) {
      case 'condosplit_init':               text = handleInit(args);             break;
      case 'condosplit_schema':             text = handleSchema(args);           break;
      case 'condosplit_types':              text = handleTypes(args);            break;
      case 'condosplit_split':              text = handleSplit(args);            break;
      case 'condosplit_history':            text = handleHistory(args);          break;
      case 'condosplit_coordinates':        text = handleCoordinates(args);      break;
      case 'condosplit_coordinates_save':   text = handleCoordinatesSave(args);  break;
      default:
        return {
          content: [{ type: 'text', text: `Strumento sconosciuto: ${name}` }],
          isError: true,
        };
    }
    return { content: [{ type: 'text', text }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Errore: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
