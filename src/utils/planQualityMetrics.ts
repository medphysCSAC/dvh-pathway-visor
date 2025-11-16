import { Structure, DVHPoint } from '@/types/dvh';

/**
 * Calcule la dose reçue par x% du volume (Dx%) OU par x cc du volume
 * Par exemple: D95% = dose reçue par 95% du volume
 *              D2cc = dose reçue par 2 cc du volume
 */
export const calculateDx = (structure: Structure, volumeValue: number, unit: '%' | 'cc' = '%'): number => {
  if (!structure.relativeVolume.length) return 0;
  
  const points = structure.relativeVolume;
  
  // Convertir en pourcentage si l'unité est en cc
  let volumePercent = volumeValue;
  if (unit === 'cc' && structure.totalVolume && structure.totalVolume > 0) {
    volumePercent = (volumeValue / structure.totalVolume) * 100;
  } else if (unit === 'cc') {
    // Pas de volume total disponible, impossible de calculer
    return 0;
  }
  
  // DVH décroissant: si le volume cherché est >= au volume max (premier point),
  // cela signifie que tout le volume reçoit au moins cette dose
  if (volumePercent >= points[0].volume) {
    return points[0].dose;
  }
  
  // Si le volume cherché est <= au volume min (dernier point),
  // retourner la dose maximale (dernier point)
  if (volumePercent <= points[points.length - 1].volume) {
    return points[points.length - 1].dose;
  }
  
  // Trouver les deux points qui encadrent le volume cible
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    
    // DVH décroissant: volume diminue quand dose augmente
    if (curr.volume >= volumePercent && next.volume <= volumePercent) {
      // Interpolation linéaire
      const t = (volumePercent - curr.volume) / (next.volume - curr.volume);
      return curr.dose + t * (next.dose - curr.dose);
    }
  }
  
  // Fallback: retourner la dernière dose
  return points[points.length - 1].dose;
};

/**
 * Calcule le pourcentage de volume recevant au moins une dose donnée (Vx)
 * Par exemple: V20Gy = pourcentage du volume recevant au moins 20 Gy
 */
export const calculateVx = (structure: Structure, targetDose: number): number => {
  if (!structure.relativeVolume.length) return 0;
  
  const points = structure.relativeVolume;
  
  // Trouver les deux points qui encadrent la dose cible
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    
    if (curr.dose <= targetDose && next.dose >= targetDose) {
      // Interpolation linéaire
      const t = (targetDose - curr.dose) / (next.dose - curr.dose);
      return curr.volume + t * (next.volume - curr.volume);
    }
  }
  
  // Si la dose cible est au-delà de la courbe
  if (targetDose >= points[points.length - 1].dose) {
    return points[points.length - 1].volume;
  }
  
  return 0;
};

/**
 * Calcule l'indice d'homogénéité (Homogeneity Index)
 * HI = (D2% - D98%) / D50%
 * Valeur idéale proche de 0 (dose homogène dans le volume cible)
 */
export const calculateHomogeneityIndex = (structure: Structure): number => {
  const d2 = calculateDx(structure, 2);
  const d98 = calculateDx(structure, 98);
  const d50 = calculateDx(structure, 50);
  
  if (d50 === 0) return 0;
  
  return (d2 - d98) / d50;
};

/**
 * Calcule l'indice de conformité (Conformity Index)
 * CI = Volume recevant la dose de prescription / Volume du PTV
 * Valeur idéale = 1 (parfaite conformité)
 */
export const calculateConformityIndex = (
  structure: Structure,
  prescriptionDose: number
): number => {
  const v95 = calculateVx(structure, prescriptionDose * 0.95);
  
  if (v95 === 0) return 0;
  
  // CI simplifié: V95% / 95%
  return v95 / 95;
};

/**
 * Calcule le nombre de conformation (Conformation Number)
 * CN = (Volume du PTV recevant dose Rx / Volume du PTV) × (Volume du PTV recevant dose Rx / Volume total recevant dose Rx)
 * Valeur idéale = 1
 */
export const calculateConformationNumber = (
  ptv: Structure,
  allStructures: Structure[],
  prescriptionDose: number
): number => {
  const ptvVolumeRx = calculateVx(ptv, prescriptionDose);
  
  // Calculer le volume total recevant la dose de prescription
  let totalVolumeRx = 0;
  allStructures.forEach(structure => {
    const vx = calculateVx(structure, prescriptionDose);
    if (structure.totalVolume) {
      totalVolumeRx += (vx / 100) * structure.totalVolume;
    }
  });
  
  if (ptvVolumeRx === 0 || totalVolumeRx === 0 || !ptv.totalVolume) return 0;
  
  const ptvVolumeRxAbsolute = (ptvVolumeRx / 100) * ptv.totalVolume;
  
  return (ptvVolumeRx / 100) * (ptvVolumeRxAbsolute / totalVolumeRx);
};

/**
 * Trouve le PTV principal (celui avec le D50 le plus élevé)
 */
export const findPrimaryPTV = (structures: Structure[]): Structure | null => {
  const ptvs = structures.filter(s => s.category === 'PTV');
  
  if (ptvs.length === 0) return null;
  
  let maxD50 = 0;
  let primaryPTV: Structure | null = null;
  
  ptvs.forEach(ptv => {
    const d50 = calculateDx(ptv, 50);
    if (d50 > maxD50) {
      maxD50 = d50;
      primaryPTV = ptv;
    }
  });
  
  return primaryPTV;
};

/**
 * Interface pour les métriques de qualité d'un PTV
 */
export interface PTVQualityMetrics {
  structureName: string;
  d95: number;
  d98: number;
  d50: number;
  d2: number;
  v95: number;
  hi: number;
  ci: number;
  cn: number;
}

/**
 * Calcule toutes les métriques de qualité pour un PTV
 */
export const calculatePTVQualityMetrics = (
  ptv: Structure,
  allStructures: Structure[],
  prescriptionDose: number
): PTVQualityMetrics => {
  return {
    structureName: ptv.name,
    d95: calculateDx(ptv, 95),
    d98: calculateDx(ptv, 98),
    d50: calculateDx(ptv, 50),
    d2: calculateDx(ptv, 2),
    v95: calculateVx(ptv, prescriptionDose * 0.95),
    hi: calculateHomogeneityIndex(ptv),
    ci: calculateConformityIndex(ptv, prescriptionDose),
    cn: calculateConformationNumber(ptv, allStructures, prescriptionDose)
  };
};

/**
 * Interface pour les métriques d'un OAR
 */
export interface OARMetrics {
  structureName: string;
  dmax: number;
  dmean: number;
  v20Gy: number;
  v30Gy: number;
  v40Gy: number;
  volume: number;
}

/**
 * Calcule les métriques pour un OAR
 */
export const calculateOARMetrics = (oar: Structure): OARMetrics => {
  const doses = oar.relativeVolume.map(p => p.dose);
  const volumes = oar.relativeVolume.map(p => p.volume);
  
  const dmax = Math.max(...doses);
  
  // Calcul Dmean par intégration trapézoïdale
  let dmean = 0;
  for (let i = 1; i < oar.relativeVolume.length; i++) {
    const dv = volumes[i - 1] - volumes[i];
    const avgDose = (doses[i - 1] + doses[i]) / 2;
    dmean += avgDose * dv;
  }
  dmean = dmean / 100;
  
  return {
    structureName: oar.name,
    dmax,
    dmean,
    v20Gy: calculateVx(oar, 20),
    v30Gy: calculateVx(oar, 30),
    v40Gy: calculateVx(oar, 40),
    volume: oar.totalVolume || 0
  };
};
