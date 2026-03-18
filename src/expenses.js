import { getAllUnits, getUnitsByGroup } from './config.js';

export function parseAmount(str) {
  const cleaned = str.replace(/[€$£\s]/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  if (isNaN(val) || val <= 0) {
    throw new Error(`Importo non valido: "${str}". Usa il formato "150,52" o "150.52".`);
  }
  return val;
}

export function calculateSplit(config, expenseType, totalAmount) {
  const allUnits = getAllUnits(config);

  if (expenseType.splitRule === 'equal_all') {
    const share = totalAmount / allUnits.length;
    return allUnits.map(u => ({ unit: u, amount: share, components: [] }));
  }

  if (expenseType.splitRule === 'staircase_equal') {
    const eligible = allUnits.filter(u => u.staircaseAccess);
    if (eligible.length === 0) throw new Error('Nessuna unità con accesso alla scala trovata nella configurazione.');
    const share = totalAmount / eligible.length;
    return allUnits.map(u => ({
      unit: u,
      amount: u.staircaseAccess ? share : 0,
      components: [],
    }));
  }

  if (expenseType.splitRule === 'occupied_equal') {
    const eligible = allUnits.filter(u => u.occupied);
    if (eligible.length === 0) throw new Error('Nessuna unità abitata trovata nella configurazione.');
    const share = totalAmount / eligible.length;
    return allUnits.map(u => ({
      unit: u,
      amount: u.occupied ? share : 0,
      components: [],
    }));
  }

  if (expenseType.splitRule === 'occupied_staircase_equal') {
    const eligible = allUnits.filter(u => u.occupied && u.staircaseAccess);
    if (eligible.length === 0) throw new Error('Nessuna unità abitata con accesso alla scala trovata nella configurazione.');
    const share = totalAmount / eligible.length;
    return allUnits.map(u => ({
      unit: u,
      amount: (u.occupied && u.staircaseAccess) ? share : 0,
      components: [],
    }));
  }

  if (expenseType.splitRule === 'utility_breakdown') {
    const unitAmounts = {};
    const unitComponents = {};
    for (const u of allUnits) {
      unitAmounts[u.id] = 0;
      unitComponents[u.id] = [];
    }
    for (const comp of expenseType.utilityComponents) {
      const compAmount = totalAmount * (comp.percentage / 100);
      const eligible = getUnitsByGroup(config, comp.splitGroup);
      if (eligible.length === 0) continue;
      const share = compAmount / eligible.length;
      for (const u of eligible) {
        unitAmounts[u.id] += share;
        unitComponents[u.id].push({ name: comp.name, percentage: comp.percentage, amount: share });
      }
    }
    return allUnits.map(u => ({ unit: u, amount: unitAmounts[u.id], components: unitComponents[u.id] }));
  }

  return [];
}

export function applyRounding(splits, totalAmount) {
  const rounded = splits.map(s => ({
    ...s,
    amount: Math.round(s.amount * 100) / 100,
    components: s.components.map(c => ({ ...c, amount: Math.round(c.amount * 100) / 100 })),
  }));
  const diff = Math.round((totalAmount - rounded.reduce((sum, s) => sum + s.amount, 0)) * 100) / 100;
  if (diff !== 0) {
    for (let i = rounded.length - 1; i >= 0; i--) {
      if (rounded[i].amount > 0) {
        rounded[i].amount = Math.round((rounded[i].amount + diff) * 100) / 100;
        break;
      }
    }
  }
  return rounded;
}

export function buildTypesText(config) {
  const lines = ['\nTipi di spesa configurati:\n'];
  for (const et of config.expenseTypes) {
    lines.push(`  ┌─ ${et.name}  [id: ${et.id}]`);
    if (et.description) lines.push(`  │  ${et.description}`);
    lines.push(`  │  Regola: ${ruleLabel(et.splitRule)}`);
    if (et.splitRule === 'utility_breakdown') {
      for (const c of et.utilityComponents) {
        lines.push(`  │    • ${c.name.padEnd(18)} ${String(c.percentage + '%').padStart(4)}  →  split: ${c.splitGroup}`);
      }
    }
    lines.push('  └─');
    lines.push('');
  }
  return lines.join('\n');
}

export function ruleLabel(rule) {
  const labels = {
    equal_all:                  'Suddivisione equa tra tutte le unità',
    staircase_equal:            'Suddivisione equa tra unità con accesso scala',
    occupied_equal:             'Suddivisione equa tra unità abitate',
    occupied_staircase_equal:   'Suddivisione equa tra unità abitate con accesso scala',
    utility_breakdown:          'Ripartizione percentuale per componenti',
  };
  return labels[rule] || rule;
}
