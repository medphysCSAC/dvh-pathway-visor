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
import { calculateDx, calculateVx } from './planQualityMetrics';

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
  const { constraintType, value, target, priority } = constraint;
  let measuredValue = 0;
  let status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_EVALUATED' = 'NOT_EVALUATED';
  let message = '';
  
  try {
    switch (constraintType) {
      case 'Dmax':
        // Dmax ≈ D0.1% (dose reçue par 0.1% du volume)
        measuredValue = calculateDx(structure, 0.1);
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
        status = measuredValue <= value ? 'PASS' : 'FAIL';
        message = `V${target}Gy mesuré: ${measuredValue.toFixed(1)}%, seuil: ${value}%`;
        break;
        
      case 'Dx':
        // Dx = dose reçue par x% du volume
        if (target === undefined) {
          throw new Error('Target volume manquant pour contrainte Dx');
        }
        measuredValue = calculateDx(structure, target);
        status = measuredValue <= value ? 'PASS' : 'FAIL';
        message = `D${target}% mesuré: ${measuredValue.toFixed(1)} Gy, seuil: ${value} Gy`;
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
  
  // Normalisation du nom recherché
  const normalizedSearch = protocolStructureName.toLowerCase().trim();
  
  // Recherche exacte
  const exactMatch = availableStructures.find(
    s => s.name.toLowerCase().trim() === normalizedSearch
  );
  if (exactMatch) return exactMatch;
  
  // Recherche partielle (contient)
  const partialMatch = availableStructures.find(
    s => s.name.toLowerCase().includes(normalizedSearch) ||
         normalizedSearch.includes(s.name.toLowerCase())
  );
  if (partialMatch) return partialMatch;
  
  // Recherche avec variantes communes
  const variants = [
    normalizedSearch,
    normalizedSearch.replace(/[_-]/g, ' '),
    normalizedSearch.replace(/\s+/g, '_'),
    normalizedSearch.replace(/\s+/g, '-'),
  ];
  
  for (const variant of variants) {
    const match = availableStructures.find(
      s => s.name.toLowerCase().includes(variant) ||
           variant.includes(s.name.toLowerCase())
    );
    if (match) return match;
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
    unmatchedStructures
  };
}
