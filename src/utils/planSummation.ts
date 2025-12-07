import { PlanData, Structure, DVHPoint } from '@/types/dvh';

/**
 * Trouve une structure par nom dans un plan (correspondance exacte ou fuzzy)
 */
export const findStructureByName = (structures: Structure[], targetName: string): Structure | null => {
  // Correspondance exacte
  const exact = structures.find(s => s.name === targetName);
  if (exact) return exact;
  
  // Correspondance insensible à la casse
  const caseInsensitive = structures.find(
    s => s.name.toLowerCase() === targetName.toLowerCase()
  );
  if (caseInsensitive) return caseInsensitive;
  
  return null;
};

/**
 * Interpole un point de dose dans une courbe DVH
 */
const interpolateDoseAtVolume = (points: DVHPoint[], targetVolume: number): number => {
  // Si le volume cible est hors limites
  if (targetVolume >= points[0].volume) return points[0].dose;
  if (targetVolume <= points[points.length - 1].volume) return points[points.length - 1].dose;
  
  // Interpolation linéaire
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].volume >= targetVolume && points[i + 1].volume <= targetVolume) {
      const t = (targetVolume - points[i].volume) / (points[i + 1].volume - points[i].volume);
      return points[i].dose + t * (points[i + 1].dose - points[i].dose);
    }
  }
  
  return 0;
};

/**
 * Fusionne les courbes DVH de plusieurs structures en additionnant les doses
 */
const mergeDVHCurves = (structures: Structure[]): DVHPoint[] => {
  if (structures.length === 0) return [];
  if (structures.length === 1) return structures[0].relativeVolume;
  
  // Utiliser la première structure comme référence pour les points de volume
  const referenceVolumes = structures[0].relativeVolume.map(p => p.volume);
  
  const mergedPoints: DVHPoint[] = referenceVolumes.map(volume => {
    // Pour chaque point de volume, sommer les doses de tous les plans
    let totalDose = 0;
    
    structures.forEach(structure => {
      const dose = interpolateDoseAtVolume(structure.relativeVolume, volume);
      totalDose += dose;
    });
    
    return { volume, dose: totalDose };
  });
  
  return mergedPoints;
};

/**
 * Somme plusieurs plans en un seul plan combiné
 */
export const summatePlans = (
  plans: PlanData[],
  options: { patientId?: string; planName?: string } = {}
): PlanData => {
  if (plans.length === 0) {
    throw new Error('Aucun plan à sommer');
  }
  
  if (plans.length === 1) {
    return plans[0];
  }
  
  // Identifier toutes les structures communes
  const allStructureNames = new Set<string>();
  plans.forEach(plan => {
    plan.structures.forEach(s => allStructureNames.add(s.name));
  });
  
  const summatedStructures: Structure[] = [];
  const missingStructures: { structureName: string; missingInPlans: string[] }[] = [];
  
  allStructureNames.forEach(structureName => {
    const structuresAcrossPlans: Structure[] = [];
    const missingInPlans: string[] = [];
    
    // Collecter la structure depuis chaque plan
    plans.forEach(plan => {
      const structure = findStructureByName(plan.structures, structureName);
      if (structure) {
        structuresAcrossPlans.push(structure);
      } else {
        missingInPlans.push(plan.name);
      }
    });
    
    // Si la structure n'est pas présente dans tous les plans
    if (missingInPlans.length > 0) {
      missingStructures.push({ structureName, missingInPlans });
    }
    
    // Sommer les structures disponibles
    if (structuresAcrossPlans.length > 0) {
      const mergedRelativeVolume = mergeDVHCurves(structuresAcrossPlans);
      
      // Fusionner les volumes absolus si disponibles
      const hasAbsoluteVolume = structuresAcrossPlans.every(s => s.absoluteVolume && s.absoluteVolume.length > 0);
      const mergedAbsoluteVolume = hasAbsoluteVolume
        ? mergeDVHCurves(structuresAcrossPlans.map(s => ({ ...s, relativeVolume: s.absoluteVolume! })))
        : undefined;
      
      summatedStructures.push({
        name: structureName,
        type: structuresAcrossPlans[0].type,
        category: structuresAcrossPlans[0].category,
        relativeVolume: mergedRelativeVolume,
        absoluteVolume: mergedAbsoluteVolume,
        totalVolume: structuresAcrossPlans[0].totalVolume
      });
    }
  });
  
  // Logger les avertissements pour les structures manquantes
  if (missingStructures.length > 0) {
    console.warn('Structures manquantes dans certains plans:', missingStructures);
  }
  
  return {
    id: `summation_${plans.map(p => p.id).join('_')}`,
    name: options.planName || `Sommation de ${plans.length} plans`,
    patientId: options.patientId || plans[0].patientId,
    structures: summatedStructures,
    uploadDate: new Date()
  };
};

/**
 * Identifie les structures communes entre plusieurs plans
 */
export const findCommonStructures = (plans: PlanData[]): string[] => {
  if (plans.length === 0) return [];
  
  const firstPlanStructures = new Set(plans[0].structures.map(s => s.name));
  
  // Garder seulement les structures présentes dans tous les plans
  return (Array.from(firstPlanStructures) as string[]).filter((structureName: string) => 
    plans.every(plan => findStructureByName(plan.structures, structureName) !== null)
  );
};

/**
 * Identifie les structures manquantes par plan
 */
export const findMissingStructures = (plans: PlanData[]): Map<string, string[]> => {
  const allStructureNames = new Set<string>();
  plans.forEach(plan => {
    plan.structures.forEach(s => allStructureNames.add(s.name));
  });
  
  const missingByPlan = new Map<string, string[]>();
  
  plans.forEach(plan => {
    const missing: string[] = [];
    allStructureNames.forEach(structureName => {
      if (!findStructureByName(plan.structures, structureName)) {
        missing.push(structureName);
      }
    });
    
    if (missing.length > 0) {
      missingByPlan.set(plan.name, missing);
    }
  });
  
  return missingByPlan;
};
