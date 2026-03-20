import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_CONFIG = {
  building: {
    name: "Condominio",
    floors: [
      {
        level: 4,
        label: "Quarto Piano",
        staircaseAccess: true,
        units: [
          { id: "I4.a", label: "" },
          { id: "I4.b", label: "" }
        ]
      },
      {
        level: 3,
        label: "Terzo Piano",
        staircaseAccess: true,
        units: [
          { id: "I3.a", label: "" },
          { id: "I3.b", label: "" }
        ]
      },
      {
        level: 2,
        label: "Secondo Piano",
        staircaseAccess: true,
        units: [
          { id: "I2.a", label: "" },
          { id: "I2.b", label: "" }
        ]
      },
      {
        level: 1,
        label: "Primo Piano",
        staircaseAccess: true,
        units: [
          { id: "I1.a", label: "" },
          { id: "I1.b", label: "" }
        ]
      },
      {
        level: 0,
        label: "Piano Terra",
        staircaseAccess: false,
        units: [
          { id: "I0.a", label: "" },
          { id: "I0.b", label: "" }
        ]
      }
    ]
  },
  expenseTypes: [
    {
      id: "pulizia_scala",
      name: "Pulizia Scala",
      description: "Spese periodiche di pulizia della scala condominiale",
      splitRule: "staircase_equal",
      defaultPaymentCoordinatesId: null
    },
    {
      id: "ascensore",
      name: "Quota Assistenza Ascensore",
      description: "Quota periodica per manutenzione e assistenza ascensore",
      splitRule: "staircase_equal",
      defaultPaymentCoordinatesId: null
    },
    {
      id: "bolletta_luce",
      name: "Bolletta Luce Scala",
      description: "Bolletta energia elettrica scala (alimenta: autoclave, ascensore, luce scala)",
      splitRule: "utility_breakdown",
      defaultPaymentCoordinatesId: null,
      utilityComponents: [
        { name: "Autoclave",  percentage: 33, splitGroup: "all" },
        { name: "Ascensore",  percentage: 34, splitGroup: "staircase" },
        { name: "Luce Scala", percentage: 33, splitGroup: "staircase" }
      ]
    }
  ]
};

export function initProject(projectDir) {
  const configPath = path.resolve(projectDir, 'condo.config.json');
  const results = [];

  if (fs.existsSync(configPath)) {
    results.push('Attenzione: condo.config.json già esistente. Non sovrascritto.');
  } else {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
    results.push(`Creato: ${configPath}`);
  }

  const coordsPath = path.resolve(projectDir, 'condo.coordinates.json');
  if (!fs.existsSync(coordsPath)) {
    fs.writeFileSync(coordsPath, JSON.stringify({ coordinates: [] }, null, 2), 'utf8');
    results.push(`Creato: ${coordsPath}`);
  }

  // Copia la guida utente nella directory di progetto
  const guideSrc = path.join(__dirname, '..', 'README_GUIDE-condosplit.md');
  const guideDest = path.resolve(projectDir, 'README_GUIDE-condosplit.md');
  if (fs.existsSync(guideSrc) && !fs.existsSync(guideDest)) {
    fs.copyFileSync(guideSrc, guideDest);
    results.push(`Copiata guida: ${guideDest}`);
  }

  results.push('');
  results.push('Prossimi passi:');
  results.push('  1. Modifica condo.config.json con i dati reali del condominio');
  results.push('  2. Chiedi a Claude: "mostrami lo schema del condominio"');
  results.push('  3. Chiedi a Claude: "calcola la suddivisione della bolletta luce di gen-feb 2026 per €150,52"');

  return results.join('\n');
}
