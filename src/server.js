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
    description: 'Calcola la suddivisione di una spesa condominiale tra gli interni e restituisce il riepilogo dettagliato con la quota di ciascun interno.',
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
];

// ── Handlers ──────────────────────────────────────────────────────────────────

function resolveConfigPath(configPath) {
  return configPath || './condo.config.json';
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

function handleSplit({ expense_type_id, label, amount, config_path, save = false }) {
  const config = loadConfig(resolveConfigPath(config_path));
  validateConfig(config);

  const expenseType = config.expenseTypes.find(et => et.id === expense_type_id);
  if (!expenseType) {
    const available = config.expenseTypes.map(et => `"${et.id}"`).join(', ');
    throw new Error(`Tipo di spesa non trovato: "${expense_type_id}". Disponibili: ${available}`);
  }

  const totalAmount = parseAmount(amount);
  const splits = applyRounding(calculateSplit(config, expenseType, totalAmount), totalAmount);
  const report = buildReport(config, expenseType, label, totalAmount, splits);

  if (save) {
    const historyPath = path.resolve(path.dirname(resolveConfigPath(config_path)), 'condosplit-history.json');
    saveExpense(historyPath, {
      date: new Date().toISOString().split('T')[0],
      expenseTypeId: expense_type_id,
      expenseTypeName: expenseType.name,
      label,
      total: totalAmount,
      splits: splits.map(s => ({ unitId: s.unit.id, amount: s.amount })),
    });
    return report + `\nSpesa salvata nello storico.`;
  }

  return report;
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
      case 'condosplit_init':    text = handleInit(args);    break;
      case 'condosplit_schema':  text = handleSchema(args);  break;
      case 'condosplit_types':   text = handleTypes(args);   break;
      case 'condosplit_split':   text = handleSplit(args);   break;
      case 'condosplit_history': text = handleHistory(args); break;
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
