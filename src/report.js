import { ruleLabel } from './expenses.js';

const LINE = '─'.repeat(62);
const DLINE = '═'.repeat(62);

export function buildReport(config, expenseType, label, totalAmount, splits) {
  const lines = [];

  lines.push('');
  lines.push(DLINE);
  lines.push('  RIEPILOGO SPESA CONDOMINIALE');
  lines.push(DLINE);
  lines.push(`  Condominio  : ${config.building.name || 'N/D'}`);
  lines.push(`  Tipo spesa  : ${expenseType.name}`);
  lines.push(`  Etichetta   : ${label}`);
  lines.push(`  Totale      : ${fmt(totalAmount)}`);
  lines.push(`  Criterio    : ${ruleLabel(expenseType.splitRule)}`);

  if (expenseType.splitRule === 'utility_breakdown') {
    lines.push(LINE);
    lines.push('  RIPARTIZIONE PER COMPONENTE:');
    for (const comp of expenseType.utilityComponents) {
      const compAmt = totalAmount * (comp.percentage / 100);
      lines.push(
        `    • ${comp.name.padEnd(20)} ${(comp.percentage + '%').padStart(4)}  →  ${fmt(compAmt).padStart(9)}  (gruppo: ${comp.splitGroup})`
      );
    }
  }

  lines.push(LINE);
  lines.push('  SUDDIVISIONE PER UNITÀ:');
  lines.push('');

  const sorted = [...splits].sort((a, b) => {
    if (b.unit.floor !== a.unit.floor) return b.unit.floor - a.unit.floor;
    return a.unit.id.localeCompare(b.unit.id);
  });

  for (const s of sorted) {
    const name = s.unit.label ? `${s.unit.id} — ${s.unit.label}` : s.unit.id;
    const noAccess = s.unit.staircaseAccess ? '' : '  [no scala]';
    if (s.amount > 0) {
      lines.push(`  ${name.padEnd(32)} ${fmt(s.amount).padStart(9)}   ${s.unit.floorLabel}${noAccess}`);
      if (s.components && s.components.length > 1) {
        for (const c of s.components) {
          lines.push(`    ↳ ${c.name.padEnd(20)} ${(c.percentage + '%').padStart(4)}  →  ${fmt(c.amount).padStart(9)}`);
        }
      }
    } else {
      const reason = !s.unit.occupied ? 'non abitato' : 'escluso';
      lines.push(`  ${name.padEnd(32)} ${'---'.padStart(9)}   ${s.unit.floorLabel}${noAccess}  (${reason})`);
    }
  }

  const calcTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  lines.push('');
  lines.push(LINE);
  lines.push(`  TOTALE VERIFICATO: ${fmt(calcTotal)}`);
  lines.push(DLINE);
  lines.push('');

  return lines.join('\n');
}

export function fmt(amount) {
  return `€${amount.toFixed(2).replace('.', ',')}`;
}
