import { Structure } from '@/types/dvh';
import {
  TreatmentProtocol,
  PrescriptionDose,
  PrescriptionValidationResult,
  OARConstraint,
  ConstraintValidationResult,
  ValidationReport,
  StructureMapping
} from '@/types/protocol';
import { calculateDx, calculateVx, calculatePTVQualityMetrics, findPrimaryPTV } from './planQualityMetrics';

/**
 * Valide la cohérence d'une prescription de dose
 * Vérifie que totalDose ≈ numberOfFractions × dosePerFraction
 */
export function validatePrescription(prescription: PrescriptionDose): PrescriptionValidationResult {
  const { totalDose, numberOfFractions, dosePerFraction } = prescription;
  const warnings: string[] = [];
  
  // Calcul de la dose totale attendue
  const expectedTotalDose = numberOfFractions * dosePerFraction;
  const difference = Math.abs(totalDose - expectedTotalDose);
  
  // Tolérance de ±0.5 Gy
  const isCoherent = difference <= 0.5;
  
  if (!isCoherent) {
    warnings.push(
      `Incohérence détectée : ${totalDose} Gy ≠ ${numberOfFractions} fx × ${dosePerFraction} Gy/fx (attendu: ${expectedTotalDose.toFixed(1)} Gy, écart: ${difference.toFixed(1)} Gy)`
    );
  }
  
  // Détection de valeurs aberrantes
  if (dosePerFraction > 10) {
    warnings.push(
      `⚠️ Dose par fraction élevée : ${dosePerFraction} Gy/fx (hypofractionné ou SBRT ?)`
    );
  }
  
  if (dosePerFraction < 1.5 && numberOfFractions > 1) {
    warnings.push(
      `⚠️ Dose par fraction très faible : ${dosePerFraction} Gy/fx (hyperfractionné ?)`
    );
  }
  
  if (totalDose > 100) {
    warnings.push(
      `⚠️ Dose totale très élevée : ${totalDose} Gy`
    );
  }
  
  return {
    prescription,
    isCoherent,
    warnings
  };
}

/**
 * Calcule la dose moyenne d'une structure par intégration trapézoïdale
 */
function calculateDmean(structure: Structure): number {
  const points = structure.relativeVolume;
  if (!points || points.length === 0) return 0;
  
  let integral = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dose1 = points[i].dose;
    const dose2 = points[i + 1].dose;
    const vol1 = points[i].volume;
    const vol2 = points[i + 1].volume;
    
    // Intégration trapézoïdale : aire = (dose1 + dose2) / 2 * |vol2 - vol1|
    integral += ((dose1 + dose2) / 2) * Math.abs(vol2 - vol1);
  }
  
  return integral / 100; // Normaliser par le volume total (100%)
}

/**
 * Valide une contrainte OAR sur une structure
 */
export function validateConstraint(
  constraint: OARConstraint,
  structure: Structure
): ConstraintValidationResult {
  const { constraintType, value, target, targetUnit, priority } = constraint;
  let measuredValue = 0;
  let status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_EVALUATED' = 'NOT_EVALUATED';
  let message = '';
  
  try {
    switch (constraintType) {
      case 'Dmax':
        // Dmax = dose maximale réelle (chercher la plus grande valeur dans tous les points DVH)
        const doses = structure.relativeVolume.map(p => p.dose);
        measuredValue = doses.length > 0 ? Math.max(...doses) : 0;
        status = measuredValue <= value ? 'PASS' : 'FAIL';
        message = `Dmax mesuré: ${measuredValue.toFixed(1)} Gy, seuil: ${value} Gy`;
        break;
        
      case 'Dmean':
        measuredValue = calculateDmean(structure);
        status = measuredValue <= value ? 'PASS' : 'FAIL';
        message = `Dmean mesuré: ${measuredValue.toFixed(1)} Gy, seuil: ${value} Gy`;
        break;
        
      case 'Vx':
        // Vx = volume recevant au moins target Gy
        if (target === undefined) {
          throw new Error('Target dose manquant pour contrainte Vx');
        }
        measuredValue = calculateVx(structure, target);
        // Pour Vx, la contrainte est souvent "<= valeur"; si vos protocoles utilisent 
        // des contraintes de type "Vx doit être proche de 100%", ajuster au besoin.
        status = measuredValue <= value ? 'PASS' : 'FAIL';
        message = `V${target}Gy mesuré: ${measuredValue.toFixed(1)}%, seuil: ${value}%`;
        break;
        
      case 'Dx':
        // Dx = dose reçue par x% ou x cc du volume
        if (target === undefined) {
          throw new Error('Target volume manquant pour contrainte Dx');
        }
        const unit = targetUnit || '%';
        measuredValue = calculateDx(structure, target, unit);
        status = measuredValue <= value ? 'PASS' : 'FAIL';
        message = `D${target}${unit} mesuré: ${measuredValue.toFixed(1)} Gy, seuil: ${value} Gy`;
        break;
    }
    
    // Gestion des priorités (pour status seulement, pas d'affichage)
    if (status === 'FAIL' && priority !== 'mandatory') {
      status = 'WARNING';
    }
    
  } catch (error) {
    status = 'NOT_EVALUATED';
    message = `Erreur lors du calcul: ${error instanceof Error ? error.message : 'Erreur inconnue'}`;
  }
  
  return {
    constraint,
    structureName: structure.name,
    measuredValue,
    status,
    message
  };
}

/**
 * Recherche fuzzy d'une structure par nom
 * Retourne la structure la plus proche ou null
 */
export function findBestStructureMatch(
  protocolStructureName: string,
  availableStructures: Structure[],
  mappings: StructureMapping[] = []
): Structure | null {
  // D'abord, chercher dans les mappings manuels
  const mapping = mappings.find(m => m.protocolStructureName === protocolStructureName);
  if (mapping) {
    const mapped = availableStructures.find(s => s.name === mapping.dvhStructureName);
    if (mapped) return mapped;
  }
  
  // Normalisation avancée qui gère les PTVs
  const normalizeForComparison = (str: string) => {
    return str
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // enlever les accents
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  const normalizedSearch = normalizeForComparison(protocolStructureName);
  
  // 1. Recherche exacte après normalisation
  const exactMatch = availableStructures.find(
    s => normalizeForComparison(s.name) === normalizedSearch
  );
  if (exactMatch) return exactMatch;
  
  // 2. Pour les PTVs : recherche intelligente
  // Si le nom du protocole commence par "PTV", chercher parmi les structures PTV
  if (protocolStructureName.toLowerCase().startsWith('ptv')) {
    // Filtrer d'abord les structures qui sont des PTVs (catégorie ou nom commence par PTV)
    const ptvStructures = availableStructures.filter(s => 
      s.category === 'PTV' || s.name.toLowerCase().startsWith('ptv')
    );
    
    // Extraire les parties significatives du nom recherché
    // Ex: "PTV_Sein" -> ["sein"], "PTV 50" -> ["50"], "PTV_SC" -> ["sc"]
    const searchParts = normalizedSearch
      .replace(/^ptv[\s_-]*/i, '') // Enlever le préfixe PTV
      .split(/[\s_-]+/)             // Diviser par espaces, underscores, tirets
      .filter(part => part.length > 0);
    
    // Chercher une structure PTV qui contient toutes les parties significatives
    for (const ptvStruct of ptvStructures) {
      const structNormalized = normalizeForComparison(ptvStruct.name);
      const structParts = structNormalized
        .replace(/^ptv[\s_-]*/i, '')
        .split(/[\s_-]+/)
        .filter(part => part.length > 0);
      
      // Vérifier si toutes les parties du protocole sont dans la structure
      const allPartsMatch = searchParts.every(searchPart => 
        structParts.some(structPart => 
          structPart.includes(searchPart) || searchPart.includes(structPart)
        )
      );
      
      if (allPartsMatch) return ptvStruct;
    }
    
    // Si pas de match exact, chercher une correspondance partielle
    for (const ptvStruct of ptvStructures) {
      const structNormalized = normalizeForComparison(ptvStruct.name);
      
      // Vérifier si au moins une partie significative correspond
      const hasPartialMatch = searchParts.some(searchPart => 
        structNormalized.includes(searchPart)
      );
      
      if (hasPartialMatch && searchParts.length > 0) return ptvStruct;
    }
  }
  
  // 3. Recherche partielle générique avec variantes
  const variants = [
    protocolStructureName.toLowerCase(),
    normalizedSearch,
    normalizedSearch.replace(/\s+/g, ''),
    normalizedSearch.replace(/\s+/g, '_'),
    normalizedSearch.replace(/\s+/g, '-'),
  ];
  
  for (const variant of variants) {
    const partialMatch = availableStructures.find(s => {
      const sNormalized = normalizeForComparison(s.name);
      const sVariants = [
        s.name.toLowerCase(),
        sNormalized,
        sNormalized.replace(/\s+/g, ''),
      ];
      
      return sVariants.some(sv => 
        sv.includes(variant) || variant.includes(sv)
      );
    });
    
    if (partialMatch) return partialMatch;
  }
  
  return null;
}

/**
 * Génère un rapport de validation complet
 */
export function generateValidationReport(
  protocol: TreatmentProtocol,
  structures: Structure[],
  patientId: string,
  mappings: StructureMapping[] = []
): ValidationReport {
  // Validation des prescriptions
  const prescriptionResults = protocol.prescriptions.map(prescription =>
    validatePrescription(prescription)
  );
  
  // Validation des contraintes OAR
  const constraintResults: ConstraintValidationResult[] = [];
  const unmatchedStructures: string[] = [];
  
  for (const constraint of protocol.oarConstraints) {
    const structure = findBestStructureMatch(constraint.organName, structures, mappings);
    
    if (!structure) {
      unmatchedStructures.push(constraint.organName);
      constraintResults.push({
        constraint,
        structureName: constraint.organName,
        measuredValue: 0,
        status: 'NOT_EVALUATED',
        message: `Structure "${constraint.organName}" non trouvée dans le fichier DVH`
      });
      continue;
    }
    
    const result = validateConstraint(constraint, structure);
    constraintResults.push(result);
  }
  
  // Calcul du résumé du plan
  const primaryPTV = findPrimaryPTV(structures);
  const prescriptionDose = primaryPTV ? calculateDx(primaryPTV, 50) : 0;
  const ptvCount = structures.filter(s => s.category === 'PTV').length;
  const oarCount = structures.filter(s => s.category === 'OAR').length;
  
  // Calcul des métriques de qualité PTV
  const ptvQualityMetrics = protocol.prescriptions.map(prescription => {
    const ptvStructure = findBestStructureMatch(prescription.ptvName, structures, mappings);
    if (!ptvStructure) return null;
    
    return calculatePTVQualityMetrics(ptvStructure, structures, prescription.totalDose);
  }).filter(m => m !== null);
  
  // Calcul du statut global
  let overallStatus: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
  
  // Si au moins une prescription incohérente
  if (prescriptionResults.some(p => !p.isCoherent)) {
    overallStatus = 'WARNING';
  }
  
  // Si au moins une contrainte FAIL
  if (constraintResults.some(c => c.status === 'FAIL')) {
    overallStatus = 'FAIL';
  } else if (constraintResults.some(c => c.status === 'WARNING')) {
    overallStatus = 'WARNING';
  }
  
  return {
    protocolName: protocol.name,
    patientId,
    evaluationDate: new Date(),
    prescriptionResults,
    constraintResults,
    overallStatus,
    unmatchedStructures,
    planSummary: {
      primaryPTV: primaryPTV?.name || 'N/A',
      prescriptionDose,
      ptvCount,
      oarCount
    },
    ptvQualityMetrics
  };
}
