import fs from 'fs';
import path from 'path';

const VALID_RULES = ['equal_all', 'staircase_equal', 'occupied_equal', 'occupied_staircase_equal', 'utility_breakdown'];
const VALID_GROUPS = ['all', 'staircase', 'occupied_all', 'occupied_staircase'];

export function loadConfig(configPath) {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File di configurazione non trovato: ${resolved}\nEsegui il tool condosplit_init per crearlo.`);
  }
  let raw;
  try {
    raw = fs.readFileSync(resolved, 'utf8');
  } catch (err) {
    throw new Error(`Errore nella lettura del file: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Errore nel parsing JSON: ${err.message}`);
  }
}

export function validateConfig(config) {
  if (!config.building) die('Manca il blocco "building" nella configurazione.');
  if (!Array.isArray(config.building.floors) || config.building.floors.length === 0)
    die('building.floors deve essere un array non vuoto.');
  for (const floor of config.building.floors) {
    if (floor.level === undefined) die('Ogni piano deve avere un campo "level".');
    if (!Array.isArray(floor.units) || floor.units.length === 0)
      die(`Il piano ${floor.level} deve avere almeno un'unità in "units".`);
    for (const unit of floor.units) {
      if (!unit.id) die(`Un'unità al piano ${floor.level} manca del campo "id".`);
    }
  }
  if (!Array.isArray(config.expenseTypes) || config.expenseTypes.length === 0)
    die('expenseTypes deve essere un array non vuoto.');
  for (const et of config.expenseTypes) {
    if (!et.id) die('Un tipo di spesa manca del campo "id".');
    if (!et.name) die(`Il tipo di spesa "${et.id}" manca del campo "name".`);
    if (!VALID_RULES.includes(et.splitRule))
      die(`splitRule non valida per "${et.id}": "${et.splitRule}". Valori ammessi: ${VALID_RULES.join(', ')}.`);
    if (et.splitRule === 'utility_breakdown') {
      if (!Array.isArray(et.utilityComponents) || et.utilityComponents.length === 0)
        die(`"${et.id}" con splitRule "utility_breakdown" richiede "utilityComponents".`);
      let total = 0;
      for (const c of et.utilityComponents) {
        if (!c.name) die(`Un componente di "${et.id}" manca del campo "name".`);
        if (typeof c.percentage !== 'number') die(`Il componente "${c.name}" di "${et.id}" deve avere "percentage" numerico.`);
        if (!VALID_GROUPS.includes(c.splitGroup))
          die(`splitGroup non valido per il componente "${c.name}" di "${et.id}": "${c.splitGroup}". Valori ammessi: ${VALID_GROUPS.join(', ')}.`);
        total += c.percentage;
      }
      if (Math.abs(total - 100) > 0.5)
        die(`Le percentuali dei componenti di "${et.id}" non sommano a 100 (totale: ${total.toFixed(2)}).`);
    }
  }
}

function die(msg) {
  throw new Error(`Configurazione non valida: ${msg}`);
}

export function getFloorsDesc(config) {
  return [...config.building.floors].sort((a, b) => b.level - a.level);
}

export function getAllUnits(config) {
  const units = [];
  for (const floor of config.building.floors) {
    const hasAccess = floor.staircaseAccess !== false;
    for (const unit of floor.units) {
      units.push({
        id: unit.id,
        label: unit.label || '',
        floor: floor.level,
        floorLabel: floor.label || `Piano ${floor.level}`,
        staircaseAccess: hasAccess,
        occupied: unit.occupied !== false,  // default: true
      });
    }
  }
  return units;
}

export function getUnitsByGroup(config, group) {
  const all = getAllUnits(config);
  if (group === 'all')                return all;
  if (group === 'staircase')          return all.filter(u => u.staircaseAccess);
  if (group === 'occupied_all')       return all.filter(u => u.occupied);
  if (group === 'occupied_staircase') return all.filter(u => u.occupied && u.staircaseAccess);
  throw new Error(`Gruppo sconosciuto: "${group}"`);
}
