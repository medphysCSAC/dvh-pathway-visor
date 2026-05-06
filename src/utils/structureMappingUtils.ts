// Utilitaires de mapping automatique entre noms de structures du protocole
// et structures DICOM/DVH disponibles.

export interface MappingResult {
  protocolStructureName: string;
  matchedDicomName: string | null;
  score: number;
  isAutoMatched: boolean;
}

/** Table d'alias anatomiques cliniques — élargir au besoin */
const ANATOMICAL_ALIASES: Record<string, string[]> = {
  spinalcord: ['moelleepiniere', 'medullaireepiniere', 'spinalcanal', 'cord', 'moelle'],
  brainstem: ['tronccerebral', 'tronccere', 'tronc', 'tc'],
  parotid: ['parotide', 'glparotide', 'parotidegl'],
  parotid_l: ['parotideg', 'parotidegauche', 'parotidleft', 'parotidegh'],
  parotid_r: ['parotided', 'parotidedroite', 'parotidright', 'parotidedt'],
  mandible: ['mandibule', 'maxillaireinferieur'],
  rectum: ['rectal', 'rectale', 'paroirectale'],
  bladder: ['vessie', 'bladderwall', 'paroivessie'],
  femoral_head: ['tetefemorale', 'colfemoral', 'tfg', 'tfd', 'tgd'],
  lung: ['poumon', 'pulmonaire'],
  heart: ['coeur', 'myocarde', 'cur'],
  esophagus: ['oesophage', 'esophage'],
  larynx: ['glotte'],
  cochlea: ['cochlee'],
  optic_nerve: ['nerfoptique', 'nopt'],
  optic_chiasm: ['chiasma', 'chiasmaoptique'],
  eye: ['oeil', 'globeoculaire'],
  lens: ['cristallin'],
  ptv: ['ptv', 'planningtargetvolume'],
  ctv: ['ctv'],
  gtv: ['gtv'],
};

/** Normalise : minuscules, sans accents, sans séparateurs / chiffres / latéralité */
export const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\s.]+/g, '')
    .replace(/\d+/g, '')
    .replace(/(left|right|lt|rt|gauche|droite|gh|dt)$/i, '');

const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

export const similarityScore = (a: string, b: string): number => {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.88;
  for (const [canonical, aliases] of Object.entries(ANATOMICAL_ALIASES)) {
    const inA = na === canonical || aliases.some(al => na === al || na.includes(al) || al.includes(na));
    const inB = nb === canonical || aliases.some(al => nb === al || nb.includes(al) || al.includes(nb));
    if (inA && inB) return 0.92;
  }
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
};

export const AUTO_MATCH_THRESHOLD = 0.72;

const GLOBAL_MEMORY_KEY = 'structure-mappings-global';

export const loadGlobalMemory = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(GLOBAL_MEMORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveGlobalMemory = (pairs: Array<{ protocolStructureName: string; dvhStructureName: string }>) => {
  try {
    const existing = loadGlobalMemory();
    for (const p of pairs) {
      if (p.dvhStructureName) existing[normalizeName(p.protocolStructureName)] = p.dvhStructureName;
    }
    localStorage.setItem(GLOBAL_MEMORY_KEY, JSON.stringify(existing));
  } catch {
    /* noop */
  }
};

export const autoMapStructures = (
  dicomStructureNames: string[],
  protocolStructureNames: string[]
): MappingResult[] => {
  const memory = loadGlobalMemory();
  return protocolStructureNames.map(protName => {
    // 1. mémoire utilisateur globale
    const memHit = memory[normalizeName(protName)];
    if (memHit && dicomStructureNames.includes(memHit)) {
      return {
        protocolStructureName: protName,
        matchedDicomName: memHit,
        score: 1,
        isAutoMatched: true,
      };
    }
    // 2. score
    const scored = dicomStructureNames
      .map(d => ({ dicomName: d, score: similarityScore(protName, d) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    return {
      protocolStructureName: protName,
      matchedDicomName: best && best.score >= AUTO_MATCH_THRESHOLD ? best.dicomName : null,
      score: best?.score ?? 0,
      isAutoMatched: (best?.score ?? 0) >= AUTO_MATCH_THRESHOLD,
    };
  });
};
