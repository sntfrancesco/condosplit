import fs from 'fs';
import path from 'path';

export function coordinatesPath(configPath) {
  return path.resolve(path.dirname(path.resolve(configPath)), 'condo.coordinates.json');
}

export function loadCoordinates(configPath) {
  const p = coordinatesPath(configPath);
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(parsed.coordinates) ? parsed.coordinates : [];
  } catch {
    return [];
  }
}

export function saveCoordinate(configPath, coordinate) {
  const p = coordinatesPath(configPath);
  const coords = loadCoordinates(configPath);
  const idx = coords.findIndex(c => c.id === coordinate.id);
  if (idx >= 0) {
    coords[idx] = coordinate;
  } else {
    coords.push(coordinate);
  }
  fs.writeFileSync(p, JSON.stringify({ coordinates: coords }, null, 2), 'utf8');
  return coords;
}

export function findCoordinate(coords, id) {
  return coords.find(c => c.id === id) || null;
}

export function buildCoordinatesText(coords) {
  if (!coords.length) {
    return (
      'Nessuna coordinata di pagamento configurata.\n' +
      'Usa il tool condosplit_coordinates_save per aggiungerne una.'
    );
  }
  const LINE = '─'.repeat(62);
  const lines = ['\nCOORDINATE DI PAGAMENTO DISPONIBILI:\n', LINE];
  for (const c of coords) {
    lines.push(`  ID           : ${c.id}`);
    lines.push(`  Nome         : ${c.label}`);
    if (c.intestatario) lines.push(`  Intestatario : ${c.intestatario}`);
    if (c.iban)         lines.push(`  IBAN         : ${c.iban}`);
    if (c.swift)        lines.push(`  SWIFT/BIC    : ${c.swift}`);
    if (c.banca)        lines.push(`  Banca        : ${c.banca}`);
    if (c.causale)      lines.push(`  Causale std  : ${c.causale}`);
    if (c.note)         lines.push(`  Note         : ${c.note}`);
    lines.push(LINE);
  }
  lines.push('');
  return lines.join('\n');
}
