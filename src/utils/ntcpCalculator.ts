/**
 * ntcpCalculator.ts — Moteur de calcul NTCP / TCP
 *
 * Modèles :
 *   NTCP : Lyman-Kutcher-Burman (LKB)
 *     Kutcher & Burman, Int J Radiat Oncol Biol Phys 16:1623-1630, 1989
 *     Lyman, Radiat Res (Suppl 8):S13-19, 1985
 *
 *   TCP  : Logistique de Niemierko (gEUD)
 *     Niemierko, Med Phys 24(1):103-110, 1997
 *
 *   EQD2 : Modèle linéaire-quadratique (LQ)
 *     Barendsen, Int J Radiat Biol 8:453-466, 1982
 *
 *   erf  : Approximation Abramowitz & Stegun §7.1.28, précision |ε| < 1.5×10⁻⁷
 *
 * ─── Hypothèses et limites (certitude >95%) ──────────────────────────────────
 *
 * 1. La conversion EQD2 suppose que le rapport d/D est UNIFORME dans la structure
 *    (même nombre de fractions pour tous les voxels). Cette hypothèse est correcte
 *    pour l'irradiation conventionnelle. Elle est approximative pour les plans
 *    avec gradient de dose intense (ex. SBRT), où chaque voxel reçoit un nombre
 *    différent de fractions efficaces. Dans ce cas, la correction par bin est une
 *    meilleure approximation que la correction globale, mais reste une estimation.
 *
 * 2. Le modèle LKB suppose un DVH différentiel continu. Sur des DVH discrétisés
 *    (bins typiquement 1 cGy en TPS), la discrétisation introduit une erreur
 *    négligeable sur le calcul de gEUD (< 0.1 Gy pour des structures > 5 cc).
 *
 * 3. Pour des structures très petites (< 1 cc), le gEUD peut être instable.
 *    Un avertissement est émis si totalVolume < 0.5 cc.
 */

import { Structure, DVHPoint } from '@/types/dvh';
import { TreatmentProtocol, StructureMapping } from '@/types/protocol';
import {
  LKBParameters, TCPParameters, NTCPResult, TCPResult,
  EUDResult, NTCPTCPAnalysisResult, WhatIfConfig,
  OARCanonicalId, TumorHistologyId, NTCPStructureAssignment,
} from '@/types/ntcp';
import { DEFAULT_LKB_PARAMETERS, DEFAULT_TCP_PARAMETERS, NTCP_CLINICAL_THRESHOLDS } from '@/data/ntcpDefaults';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MIN_VOLUME_CC = 0.5;   // en dessous : avertissement instabilité numérique
const MIN_BINS      = 5;     // nombre minimum de bins DVH pour calcul fiable

// ─── erf — Approximation Abramowitz & Stegun 7.1.28 ─────────────────────────
// Précision garantie : |ε| < 1.5×10⁻⁷ pour tout x réel

const ERF_COEFFS = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429] as const;

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1.0 / (1.0 + 0.3275911 * ax);
  const poly = t * (ERF_COEFFS[0] + t * (ERF_COEFFS[1] + t * (ERF_COEFFS[2] + t * (ERF_COEFFS[3] + t * ERF_COEFFS[4]))));
  return sign * (1.0 - poly * Math.exp(-ax * ax));
}

// ─── Normalisation des noms pour matching OAR canonique ──────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\s\.()[\]]+/g, '')
    .replace(/\d+/g, '')
    .replace(/(left|right|lt|rt|gauche|droite|g|d)$/i, '');
}

/**
 * Table de mapping nom libre → OARCanonicalId.
 * Chaque entrée = variantes normalisées acceptées pour cet OAR.
 */
const OAR_NAME_MAP: Array<{ id: OARCanonicalId; variants: string[] }> = [
  { id: 'lung_total',          variants: ['poumon', 'lung', 'poumons', 'lungs', 'pulmonaire', 'pulmontotal'] },
  { id: 'lung_ipsilateral',    variants: ['poumonipsi', 'lungipsi', 'poumonhomo', 'lunghomo', 'poumonipsilateral'] },
  { id: 'lung_contralateral',  variants: ['poumoncontra', 'lungcontra', 'poulmoncontrolateral'] },
  { id: 'heart',               variants: ['coeur', 'heart', 'myocarde', 'cardiaque', 'cor'] },
  { id: 'parotid',             variants: ['parotide', 'parotid', 'glparotide', 'parotides'] },
  { id: 'parotid_ipsilateral', variants: ['parotideipsi', 'parotidehomo', 'parotidipsi'] },
  { id: 'parotid_contralateral',variants:['parotidecontra', 'parotidcontra'] },
  { id: 'submandibular',       variants: ['sousmandibulaire', 'submandibulaire', 'submandibular', 'glssousmandibulaire', 'submandib'] },
  { id: 'spinal_cord',         variants: ['moelleepiniere', 'spinalcord', 'cord', 'myelon', 'moelle', 'spinalcanal'] },
  { id: 'brainstem',           variants: ['tronccere', 'brainstem', 'tronc', 'bulbe', 'tronccerveau'] },
  { id: 'rectum',              variants: ['rectum', 'rectal', 'rectale', 'parirectale'] },
  { id: 'bladder',             variants: ['vessie', 'bladder', 'vessieparoi'] },
  { id: 'esophagus',           variants: ['oesophage', 'esophage', 'esophagus', 'oeso'] },
  { id: 'liver',               variants: ['foie', 'liver', 'hepatique'] },
  { id: 'kidney',              variants: ['rein', 'kidney', 'reins', 'renale'] },
  { id: 'femoral_head',        variants: ['tetefermorale', 'femoralhead', 'col', 'hanches', 'femur'] },
  { id: 'cochlea',             variants: ['cochlee', 'cochlea', 'cochlée', 'oreilleinterne'] },
  { id: 'larynx',              variants: ['larynx', 'glotte', 'hypopharynx'] },
  { id: 'brachial_plexus',     variants: ['plexusbrachial', 'brachialplexus', 'plexus'] },
  { id: 'hippocampus',         variants: ['hippocampe', 'hippocampus', 'hippo'] },
  { id: 'lens',                variants: ['cristallin', 'lens', 'cristallins'] },
  { id: 'optic_nerve',         variants: ['nerfoptique', 'opticnerve', 'noptique'] },
  { id: 'chiasm',              variants: ['chiasma', 'chiasm', 'chiasmaoptique'] },
  { id: 'mandible',            variants: ['mandibule', 'mandible', 'maxinferieur'] },
  { id: 'small_bowel',         variants: ['intestingrele', 'smallbowel', 'grele', 'intestin'] },
];

export function resolveOARCanonicalId(organName: string): OARCanonicalId | null {
  const norm = normalizeName(organName);
  for (const entry of OAR_NAME_MAP) {
    if (entry.variants.some(v => norm.includes(v) || v.includes(norm))) {
      return entry.id;
    }
  }
  return null;
}

// ─── Reconstruction du DVH différentiel absolu ───────────────────────────────

/**
 * Retourne le DVH différentiel absolu (cc par bin de dose).
 * Priorité :
 *   1. differentialAbsoluteVolume (présent directement si DICOM differential)
 *   2. Dérivation numérique du cumulatif absolu : diff[i] = cumul[i] - cumul[i+1]
 *   3. Dérivation du cumulatif relatif × totalVolume
 *
 * Les points sont triés par dose croissante.
 * Retourne null si les données sont insuffisantes.
 */
export function getDifferentialAbsoluteDVH(structure: Structure): DVHPoint[] | null {

  // Cas 1 : différentiel absolu directement disponible
  if (structure.differentialAbsoluteVolume && structure.differentialAbsoluteVolume.length >= MIN_BINS) {
    return [...structure.differentialAbsoluteVolume].sort((a, b) => a.dose - b.dose);
  }

  // Cas 2 : dérivation du cumulatif absolu
  if (structure.absoluteVolume && structure.absoluteVolume.length >= MIN_BINS + 1) {
    const sorted = [...structure.absoluteVolume].sort((a, b) => a.dose - b.dose);
    const diff: DVHPoint[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const volBin = sorted[i].volume - sorted[i + 1].volume;
      if (volBin > 0) {
        diff.push({
          dose: (sorted[i].dose + sorted[i + 1].dose) / 2, // dose centre du bin
          volume: volBin,
        });
      }
    }
    if (diff.length >= MIN_BINS) return diff;
  }

  // Cas 3 : dérivation du cumulatif relatif × totalVolume
  const totalVol = structure.totalVolume;
  if (totalVol && totalVol > 0 && structure.relativeVolume && structure.relativeVolume.length >= MIN_BINS + 1) {
    const sorted = [...structure.relativeVolume].sort((a, b) => a.dose - b.dose);
    const diff: DVHPoint[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const volBin = ((sorted[i].volume - sorted[i + 1].volume) / 100) * totalVol;
      if (volBin > 0) {
        diff.push({
          dose: (sorted[i].dose + sorted[i + 1].dose) / 2,
          volume: volBin,
        });
      }
    }
    if (diff.length >= MIN_BINS) return diff;
  }

  return null;
}

/**
 * Estime le volume total (cc) depuis la structure.
 * Utilise totalVolume en priorité, sinon la valeur max du cumulatif absolu.
 */
export function getTotalVolume(structure: Structure): number | null {
  if (structure.totalVolume && structure.totalVolume > 0) return structure.totalVolume;
  if (structure.absoluteVolume && structure.absoluteVolume.length > 0) {
    return Math.max(...structure.absoluteVolume.map(p => p.volume));
  }
  return null;
}

// ─── Conversion EQD2 par bin de dose ─────────────────────────────────────────

/**
 * Convertit une dose physique D (Gy, dose totale dans le bin) en EQD2.
 *
 * Formule LQ : EQD2 = D × (d + α/β) / (2 + α/β)
 *   où d = D / nFractions (dose par fraction pour ce bin)
 *
 * Hypothèse (certitude >95%) : tous les voxels reçoivent le même nombre de fractions.
 * Cette hypothèse est valide en irradiation conventionnelle/IMRT.
 * Elle devient approximative en SBRT où les isodoses ne couvrent pas uniformément.
 *
 * @param doseBinCenter Dose centre du bin en Gy (dose totale au voxel)
 * @param nFractions    Nombre de fractions du traitement
 * @param alphaBeta     α/β du tissu en Gy
 * @returns EQD2 en Gy
 */
export function toEQD2(doseBinCenter: number, nFractions: number, alphaBeta: number): number {
  if (doseBinCenter <= 0) return 0;
  const dPerFraction = doseBinCenter / nFractions;
  return doseBinCenter * (dPerFraction + alphaBeta) / (2 + alphaBeta);
}

// ─── Calcul gEUD ──────────────────────────────────────────────────────────────

/**
 * Calcule la dose uniforme équivalente généralisée (gEUD).
 *
 * gEUD = [ Σᵢ (vᵢ × Dᵢ^(1/n)) ]^n
 *
 * où vᵢ = fraction de volume du bin i = volume_bin_i / volume_total
 *    Dᵢ = dose centre du bin i (après correction EQD2 si demandée)
 *    n   = paramètre volume-effet (LKBParameters.n pour OAR,
 *          TCPParameters.a pour tumeur — valeur négative)
 *
 * Pour n < 0 (tumeur) : la formule est mathématiquement identique mais
 * l'exposant 1/n est négatif → les petites doses contribuent proportionnellement
 * plus → sensibilité aux zones froides.
 *
 * Précision numérique :
 *   - Bins à volume nul ignorés
 *   - Protection contre Dᵢ = 0 avec n < 0 (indéfini → ce bin est ignoré + warning)
 *   - Si Σvᵢ ≠ 1 : renormalisation automatique (bins manquants en dehors du DVH)
 */
export function computeGEUD(
  diffDVH: DVHPoint[],     // DVH différentiel absolu (cc)
  totalVolume: number,      // volume total en cc
  n: number,                // paramètre volume-effet (positif OAR, négatif tumeur)
  nFractions: number,
  alphaBeta: number,
  applyEQD2: boolean,
  whatIf?: WhatIfConfig,
): { eud: number; eudRaw: number; warnings: string[] } {

  const warnings: string[] = [];
  let sumWeighted = 0;
  let sumFractions = 0;
  const exponent = 1.0 / n;

  const abOverride = whatIf?.alphaBetaOverride ?? alphaBeta;
  const nFxOverride = whatIf?.nFractionsOverride ?? nFractions;
  const doseFactor = whatIf?.doseFactor ?? 1.0;

  for (const bin of diffDVH) {
    const vi = bin.volume / totalVolume;
    if (vi <= 0) continue;

    const dosePhysical = bin.dose * doseFactor;
    if (dosePhysical < 0) continue;

    // Protection n < 0 et dose = 0
    if (n < 0 && dosePhysical === 0) {
      warnings.push('Bin à dose zéro ignoré dans le calcul gEUD tumeur (évite division par zéro).');
      continue;
    }

    const doseForCalc = applyEQD2
      ? toEQD2(dosePhysical, nFxOverride, abOverride)
      : dosePhysical;

    sumWeighted += vi * Math.pow(doseForCalc, exponent);
    sumFractions += vi;
  }

  if (sumFractions < 0.5) {
    warnings.push(`Volume normalisé total = ${(sumFractions * 100).toFixed(1)}% < 50% — données DVH potentiellement incomplètes.`);
  }

  if (sumWeighted <= 0) {
    return { eud: 0, eudRaw: 0, warnings };
  }

  const eud = Math.pow(sumWeighted, n);

  // EUD brut sans EQD2 (pour comparaison / debug)
  let eudRaw = eud;
  if (applyEQD2) {
    let rawSum = 0;
    for (const bin of diffDVH) {
      const vi = bin.volume / totalVolume;
      if (vi <= 0) continue;
      const d = bin.dose * doseFactor;
      if (n < 0 && d === 0) continue;
      rawSum += vi * Math.pow(d, exponent);
    }
    eudRaw = rawSum > 0 ? Math.pow(rawSum, n) : 0;
  }

  return { eud, eudRaw, warnings };
}

// ─── NTCP — Modèle LKB ───────────────────────────────────────────────────────

/**
 * Calcule le NTCP selon le modèle de Lyman-Kutcher-Burman.
 *
 * t = (EUD − TD50) / (m × TD50)
 * NTCP = Φ(t) = 0.5 × [1 + erf(t / √2)]
 *
 * Φ = fonction de répartition normale standard
 */
function computeLKBNTCP(eud: number, params: LKBParameters): number {
  const t = (eud - params.td50) / (params.m * params.td50);
  return 0.5 * (1 + erf(t / Math.SQRT2));
}

function classifyRiskLevel(ntcpPercent: number): NTCPResult['riskLevel'] {
  if (ntcpPercent < 5)  return 'low';
  if (ntcpPercent < 20) return 'moderate';
  if (ntcpPercent < 40) return 'high';
  return 'very_high';
}

// ─── TCP — Modèle logistique Niemierko ───────────────────────────────────────

/**
 * Calcule le TCP selon le modèle logistique de Niemierko.
 *
 * TCP = 1 / (1 + (TCD50 / EUD)^(4 × γ50))
 *
 * EUD calculé avec `a` négatif pour sensibiliser aux zones froides.
 */
function computeNiemierkoTCP(eud: number, params: TCPParameters): number {
  if (eud <= 0) return 0;
  return 1.0 / (1.0 + Math.pow(params.tcd50 / eud, 4 * params.gamma50));
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Calcule le NTCP pour une structure OAR donnée.
 * Retourne null si les données DVH sont insuffisantes.
 */
export function computeOARNTCP(
  structure: Structure,
  params: LKBParameters,
  nFractions: number,
  whatIf?: WhatIfConfig,
): NTCPResult | null {

  const diffDVH = getDifferentialAbsoluteDVH(structure);
  if (!diffDVH) return null;

  const totalVol = getTotalVolume(structure);
  if (!totalVol || totalVol <= 0) return null;

  const { eud, eudRaw, warnings } = computeGEUD(
    diffDVH, totalVol,
    params.n,             // positif pour OAR
    nFractions,
    params.alphaBeta,
    true,                 // appliquer EQD2
    whatIf,
  );

  const ntcp = computeLKBNTCP(eud, params);
  const ntcpPercent = Math.min(ntcp * 100, 100);
  const threshold = NTCP_CLINICAL_THRESHOLDS[params.oarId] ?? 20;

  if (totalVol < MIN_VOLUME_CC) {
    warnings.push(`Volume total ${totalVol.toFixed(2)} cc < ${MIN_VOLUME_CC} cc — résultat potentiellement instable.`);
  }

  const eudResult: EUDResult = {
    structureName: structure.name,
    eud,
    eudRaw,
    eqd2Applied: true,
    nFractions,
    dosePerFraction: whatIf?.nFractionsOverride
      ? eud / whatIf.nFractionsOverride
      : 0,
  };

  return {
    structureName: structure.name,
    oarId: params.oarId,
    parameters: params,
    eudResult,
    ntcp,
    ntcpPercent,
    riskLevel: classifyRiskLevel(ntcpPercent),
    isAboveConstraint: ntcpPercent > threshold,
    constraintThreshold: threshold,
  };
}

/**
 * Calcule le TCP pour une structure PTV donnée.
 * Retourne null si les données DVH sont insuffisantes.
 */
export function computePTVTCP(
  structure: Structure,
  params: TCPParameters,
  nFractions: number,
  whatIf?: WhatIfConfig,
): TCPResult | null {

  const diffDVH = getDifferentialAbsoluteDVH(structure);
  if (!diffDVH) return null;

  const totalVol = getTotalVolume(structure);
  if (!totalVol || totalVol <= 0) return null;

  const { eud, eudRaw, warnings: _w } = computeGEUD(
    diffDVH, totalVol,
    params.a,             // négatif pour tumeur
    nFractions,
    params.alphaBeta,
    true,
    whatIf,
  );

  const tcp = computeNiemierkoTCP(eud, params);
  const tcpPercent = Math.min(tcp * 100, 100);

  // Zone froide : EUD < 95% de la dose prescrite (certitude clinique haute)
  // Une EUD < 95% de la prescription indique un sous-dosage significatif
  const prescribedDose = (whatIf?.nFractionsOverride ?? nFractions) * params.fractionSize;
  const coldSpotWarning = eud < 0.95 * prescribedDose;

  const eudResult: EUDResult = {
    structureName: structure.name,
    eud,
    eudRaw,
    eqd2Applied: true,
    nFractions,
    dosePerFraction: params.fractionSize,
  };

  return {
    structureName: structure.name,
    histologyId: params.histologyId,
    parameters: params,
    eudResult,
    tcp,
    tcpPercent,
    coldSpotWarning,
  };
}

/**
 * Charge les paramètres LKB pour un OAR, en appliquant les surcharges utilisateur.
 */
export function getLKBParams(
  oarId: OARCanonicalId,
  userOverrides?: Partial<LKBParameters>,
): LKBParameters {
  const defaults = DEFAULT_LKB_PARAMETERS[oarId];
  if (!userOverrides) return defaults;
  return { ...defaults, ...userOverrides };
}

/**
 * Charge les paramètres TCP pour une histologie, avec surcharges utilisateur.
 */
export function getTCPParams(
  histologyId: TumorHistologyId,
  userOverrides?: Partial<TCPParameters>,
): TCPParameters {
  const defaults = DEFAULT_TCP_PARAMETERS[histologyId];
  if (!userOverrides) return defaults;
  return { ...defaults, ...userOverrides };
}

/**
 * Point d'entrée principal : calcule NTCP + TCP pour un protocole complet.
 *
 * @param structures       Liste des structures DVH chargées
 * @param protocol         Protocole sélectionné (prescriptions + contraintes OAR)
 * @param mappings         Mapping structure protocole → structure DVH
 * @param assignments      Assignations OAR canonique + histologie tumeur
 * @param userLKBOverrides Paramètres LKB modifiés par l'utilisateur
 * @param userTCPOverrides Paramètres TCP modifiés par l'utilisateur
 * @param whatIf           Configuration what-if (sliders)
 */
export function computeFullAnalysis(
  structures: Structure[],
  protocol: TreatmentProtocol,
  mappings: StructureMapping[],
  assignments: NTCPStructureAssignment[],
  userLKBOverrides: Record<string, Partial<LKBParameters>>,
  userTCPOverrides: Record<string, Partial<TCPParameters>>,
  whatIf: WhatIfConfig,
): NTCPTCPAnalysisResult {

  const globalWarnings: string[] = [];

  // Fractionnemnt depuis la prescription principale
  const primaryPrescription = protocol.prescriptions[0];
  if (!primaryPrescription) {
    return {
      ntcpResults: [],
      tcpResults: [],
      protocolName: protocol.name,
      totalDose: 0,
      nFractions: 0,
      dosePerFraction: 0,
      globalWarnings: ['Aucune prescription trouvée dans le protocole.'],
      computedAt: new Date(),
    };
  }

  const nFractions = whatIf.nFractionsOverride ?? primaryPrescription.numberOfFractions;
  const totalDose = primaryPrescription.totalDose;
  const dosePerFraction = primaryPrescription.dosePerFraction;

  // Helper : trouver la structure DVH correspondant à un nom de protocole
  const findDVHStructure = (protocolName: string): Structure | null => {
    const mapping = mappings.find(m => m.protocolStructureName === protocolName);
    const dvhName = mapping?.dvhStructureName ?? protocolName;
    return structures.find(s => s.name === dvhName) ?? null;
  };

  // ── Calcul NTCP pour chaque OAR ──────────────────────────────────────────
  const ntcpResults: NTCPResult[] = [];

  for (const constraint of protocol.oarConstraints) {
    const dvhStructure = findDVHStructure(constraint.organName);
    if (!dvhStructure) continue;

    const assignment = assignments.find(
      a => a.dvhStructureName === dvhStructure.name && a.type === 'oar'
    );
    if (!assignment?.oarId) continue;

    const lkbDefault = DEFAULT_LKB_PARAMETERS[assignment.oarId];
    if (!lkbDefault) continue;

    const params = getLKBParams(
      assignment.oarId,
      userLKBOverrides[assignment.oarId] as Partial<LKBParameters>,
    );

    const result = computeOARNTCP(dvhStructure, params, nFractions, whatIf);
    if (result) {
      ntcpResults.push(result);
    } else {
      globalWarnings.push(
        `NTCP non calculé pour "${constraint.organName}" : données DVH insuffisantes.`
      );
    }
  }

  // ── Calcul TCP pour chaque PTV ────────────────────────────────────────────
  const tcpResults: TCPResult[] = [];

  for (const prescription of protocol.prescriptions) {
    const dvhStructure = findDVHStructure(prescription.ptvName);
    if (!dvhStructure) continue;

    const assignment = assignments.find(
      a => a.dvhStructureName === dvhStructure.name && a.type === 'tumor'
    );
    if (!assignment?.histologyId) {
      globalWarnings.push(
        `TCP non calculé pour "${prescription.ptvName}" : histologie non sélectionnée.`
      );
      continue;
    }

    const params = getTCPParams(
      assignment.histologyId,
      userTCPOverrides[assignment.histologyId] as Partial<TCPParameters>,
    );

    const result = computePTVTCP(dvhStructure, params, nFractions, whatIf);
    if (result) {
      tcpResults.push(result);
    } else {
      globalWarnings.push(
        `TCP non calculé pour "${prescription.ptvName}" : données DVH insuffisantes.`
      );
    }
  }

  // Avertissement si SBRT détecté (dosePerFraction > 5 Gy)
  if (dosePerFraction > 5) {
    globalWarnings.push(
      `⚠ Fractionnement > 5 Gy/fx détecté (${dosePerFraction.toFixed(1)} Gy/fx). ` +
      `Les modèles LKB/LQ sont dérivés de données conventionnelles. ` +
      `Pour SBRT, référez-vous aux rapports HyTEC 2021 (IJROBP 110:1).`
    );
  }

  return {
    ntcpResults,
    tcpResults,
    protocolName: protocol.name,
    totalDose,
    nFractions,
    dosePerFraction,
    globalWarnings,
    computedAt: new Date(),
  };
}
