import { getFloorsDesc } from './config.js';

const CELL_INNER = 16;

export function buildSchemaText(config) {
  const building = config.building;
  const floors = getFloorsDesc(config);
  const maxUnits = Math.max(...floors.map(f => f.units.length));
  const lines = [];

  const hr = (left, mid, right, fill) =>
    left + Array(maxUnits).fill(fill.repeat(CELL_INNER)).join(mid) + right;

  const totalWidth = maxUnits * (CELL_INNER + 1) + 1;
  lines.push('');
  lines.push('═'.repeat(totalWidth));
  lines.push(` ${building.name || 'Condominio'}`);
  lines.push('═'.repeat(totalWidth));

  for (let i = 0; i < floors.length; i++) {
    const floor = floors[i];
    const hasAccess = floor.staircaseAccess !== false;
    const floorName = floor.label || `Piano ${floor.level}`;
    const noAccessTag = hasAccess ? '' : '  ◌ nessun accesso scala';

    lines.push(i === 0 ? hr('╔', '╦', '╗', '═') : hr('╠', '╬', '╣', '═'));

    // Riga ID unità
    let idRow = '║';
    for (let j = 0; j < maxUnits; j++) {
      const unit = floor.units[j];
      if (unit) {
        const noMark = hasAccess ? '' : ' ◌';
        const vacantMark = unit.occupied === false ? ' ⊘' : '';
        idRow += padCell(` ${unit.id}${noMark}${vacantMark}`, CELL_INNER) + '║';
      } else {
        idRow += ' '.repeat(CELL_INNER) + '║';
      }
    }
    lines.push(idRow + `  ${floorName}${noAccessTag}`);

    // Riga etichette
    const hasLabels = floor.units.some(u => u.label && u.label.trim() !== '');
    if (hasLabels) {
      let labelRow = '║';
      for (let j = 0; j < maxUnits; j++) {
        const unit = floor.units[j];
        labelRow += padCell(unit && unit.label ? ` ${unit.label}` : '', CELL_INNER) + '║';
      }
      lines.push(labelRow);
    }

    if (i === floors.length - 1) {
      lines.push(hr('╚', '╩', '╝', '═'));
    }
  }
  // Legenda
  const anyVacant = config.building.floors.some(f => f.units.some(u => u.occupied === false));
  const anyNoAccess = config.building.floors.some(f => f.staircaseAccess === false);
  if (anyNoAccess || anyVacant) {
    lines.push(' Legenda:' + (anyNoAccess ? '  ◌ nessun accesso scala' : '') + (anyVacant ? '  ⊘ non abitato' : ''));
  }
  lines.push('');
  return lines.join('\n');
}

function padCell(text, width) {
  if (text.length >= width) return text.substring(0, width);
  return text + ' '.repeat(width - text.length);
}
