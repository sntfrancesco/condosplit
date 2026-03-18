import fs from 'fs';
import { fmt } from './report.js';

export function loadHistory(historyPath) {
  if (!fs.existsSync(historyPath)) return { expenses: [] };
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  } catch {
    return { expenses: [] };
  }
}

export function saveExpense(historyPath, entry) {
  const history = loadHistory(historyPath);
  entry.id = `${Date.now()}`;
  history.expenses.push(entry);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
}

export function buildHistoryText(historyPath, buildingName) {
  const history = loadHistory(historyPath);
  if (history.expenses.length === 0) return 'Nessuna spesa salvata nello storico.';

  const LINE = '─'.repeat(62);
  const lines = [`\nStorico spese — ${buildingName || 'Condominio'}\n`, LINE];
  for (const e of history.expenses) {
    lines.push(`  Data       : ${e.date}`);
    lines.push(`  Tipo       : ${e.expenseTypeName}  [${e.expenseTypeId}]`);
    lines.push(`  Etichetta  : ${e.label}`);
    lines.push(`  Totale     : ${fmt(e.total)}`);
    lines.push(LINE);
  }
  lines.push('');
  return lines.join('\n');
}
