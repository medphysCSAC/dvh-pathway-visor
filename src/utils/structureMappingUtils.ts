/**
 * structureMappingUtils.ts
 * Algorithme de mapping structures protocole ↔ structures DVH
 * Niveaux : exact → inclusion → alias anatomiques → Levenshtein normalisé
 */

import { Structure } from '@/types/dvh';
import { TreatmentProtocol, StructureMapping } from '@/types/protocol';

// ─── Table d'alias anatomiques cliniques ──────────────────────────────────────
// Clé = nom canonique normalisé, valeurs = variantes connues (normalisées)
const ANATOMICAL_ALIASES: Record<string, string[]> = {
  spinalcord:    ['moelleepiniere', 'medullaireepiniere', 'spinalcanal', 'cord', 'myelon', 'spinalmoelle'],
  brainstem:     ['tronccere', 'tronccerbral', 'tronc', 'tronccerveau', 'bulbe'],
  parotid:       ['parotide', 'glparotide', 'parotidgl', 'glandeparotide'],
  parotidl:      ['parotidegauche', 'parotideleft', 'parotideg', 'parotidgl'],
  parotidr:      ['parotidedroite', 'parotideright', 'parotided', 'parotidr'],
  mandible:      ['mandibule', 'maxinferieur', 'maxinfr'],
  rectum:        ['rectal', 'rectale', 'parirectale', 'rectalwall'],
  bladder:       ['vessie', 'bladderwall', 'vessieparoi'],
  femoralhead:   ['tetefermorale', 'colsfmoraux', 'hanches', 'femur'],
  femoralheadl:  ['tetefermoraleg', 'fetchgl', 'hancheg'],
  femoralheadr:  ['tetefermoraled', 'fetchgd', 'hanched'],
  lung:          ['poumon', 'pulmonaire', 'poumons'],
  lungl:         ['poumong', 'pulmonairegg', 'lungltotal'],
  lungr:         ['poumond', 'pulmonairedroit', 'lungrtotal'],
  heart:         ['coeur', 'myocarde', 'cardiaque'],
  esophagus:     ['oesophage', 'esophage', 'oeso'],
  larynx:        ['larynx', 'glotte', 'hypopharynx'],
  cochlea:       ['cochlee', 'cochlée', 'oreilleinterne', 'organecortiorg'],
  lens:          ['cristallin', 'lens', 'cristallindroit', 'cristallingauche'],
  opticnerve:    ['nerfoptique', 'noptique', 'opticnerve'],
  chiasm:        ['chiasma', 'chiasmaoptique'],
  brainn:        ['cerveau', 'brainonly', 'cerveau-gtvgtv'],
  kidney:        ['rein', 'reing', 'reind'],
  liver:         ['foie', 'hepatique'],
  stomach:       ['estomac'],
  bowel:         ['intestin', 'grele', 'intestingrele', 'colon'],
  femalegenitalia: ['vagin', 'utrus', 'ovaires'],
};

// ─── Normalisation ────────────────────────────────────────────────────────────
const normalize = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // accents → base
    .replace(/[_\-\s\.()[\]]+/g, '')      // séparateurs
    .replace(/\d+/g, '')                   // numéros (PTV1 → PTV, Parotide_D1 → ParotideD)
    .replace(/(left|right|lt|rt|gauche|droite|_g|_d)$/i, ''); // latéralité finale

// ─── Distance de Levenshtein ──────────────────────────────────────────────────
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
};

// ─── Score de similarité composite (0→1) ─────────────────────────────────────
export const similarityScore = (nameA: string, nameB: string): number => {
  const na = normalize(nameA);
  const nb = normalize(nameB);

  // Niveau 1 — exact
  if (na === nb) return 1.0;

  // Niveau 2 — inclusion
  if (na.includes(nb) || nb.includes(na)) return 0.88;

  // Niveau 3 — alias anatomiques
  for (const [, aliases] of Object.entries(ANATOMICAL_ALIASES)) {
    const allVariants = [...aliases];
    // ajouter la clé elle-même comme variante
    const inA = allVariants.some(v => v === na) || Object.keys(ANATOMICAL_ALIASES).includes(na);
    const inB = allVariants.some(v => v === nb) || Object.keys(ANATOMICAL_ALIASES).includes(nb);
    if (inA && inB) return 0.93;
  }

  // Niveau 4 — Levenshtein normalisé
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshtein(na, nb) / maxLen;
};

export interface MappingCandidate {
  dvhStructureName: string;
  score: number;
}

export interface AutoMappingResult {
  protocolStructureName: string;
  bestMatch: string | null;    // null = sous le seuil → mapping manuel requis
  score: number;
  alternatives: MappingCandidate[]; // top 3 alternatives pour le dialog
  isAutoMatched: boolean;
}

/** Seuil en dessous duquel on demande confirmation manuelle */
export const AUTO_MATCH_THRESHOLD = 0.72;

/**
 * Mappe automatiquement toutes les structures d'un protocole
 * vers les structures DVH disponibles.
 *
 * Règle : appelé TOUJOURS après sélection protocole, AVANT affichage DVH.
 */
export const autoMapStructures = (
  dvhStructures: Structure[],
  protocol: TreatmentProtocol
): AutoMappingResult[] => {
  const oarNames = protocol.oarConstraints.map(c => c.structure);
  const ptvNames = protocol.prescriptions.map(p => p.ptvName);
  const allProtocolNames = [...new Set([...oarNames, ...ptvNames])];
  const dvhNames = dvhStructures.map(s => s.name);

  return allProtocolNames.map(protName => {
    const scored: MappingCandidate[] = dvhNames
      .map(dvhName => ({ dvhStructureName: dvhName, score: similarityScore(protName, dvhName) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const isAutoMatched = (best?.score ?? 0) >= AUTO_MATCH_THRESHOLD;

    return {
      protocolStructureName: protName,
      bestMatch: isAutoMatched ? best.dvhStructureName : null,
      score: best?.score ?? 0,
      alternatives: scored.slice(0, 3),
      isAutoMatched,
    };
  });
};

/**
 * Convertit AutoMappingResult[] → StructureMapping[] (format attendu par ProtocolValidation)
 * N'inclut que les structures auto-matchées (les autres restent pour le dialog manuel).
 */
export const toStructureMappings = (results: AutoMappingResult[]): StructureMapping[] =>
  results
    .filter(r => r.isAutoMatched && r.bestMatch !== null)
    .map(r => ({
      protocolStructureName: r.protocolStructureName,
      dvhStructureName: r.bestMatch!,
    }));

/**
 * Retourne les noms des structures protocole qui n'ont PAS été auto-matchées.
 * Ce sont celles à présenter à l'utilisateur pour mapping manuel.
 */
export const getUnresolvedStructures = (results: AutoMappingResult[]): string[] =>
  results.filter(r => !r.isAutoMatched).map(r => r.protocolStructureName);
