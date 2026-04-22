// Types pour la prescription de dose
export interface PrescriptionDose {
  ptvName: string;
  totalDose: number;          // Dose totale en Gy
  numberOfFractions: number;  // Nombre de fractions
  dosePerFraction: number;    // Dose par fraction en Gy
}

// Types pour les contraintes OAR
export type ConstraintType = 'Dmax' | 'Dmean' | 'Vx' | 'Dx';

export interface OARConstraint {
  organName: string;
  constraintType: ConstraintType;
  value: number;           // Valeur de la contrainte (seuil)
  unit: string;            // 'Gy' ou '%'
  target?: number;         // Pour Vx (dose en Gy) ou Dx (volume en %)
  targetUnit?: '%' | 'cc'; // Unité pour le volume cible (% ou cc)
  priority: 'mandatory' | 'optimal' | 'desirable';
  description?: string;
}

// Type pour un protocole complet
export interface TreatmentProtocol {
  id: string;
  name: string;                          // Ex: "Sein Gauche"
  location: string;                       // Localisation anatomique
  prescriptions: PrescriptionDose[];      // Prescriptions pour chaque PTV
  oarConstraints: OARConstraint[];        // Contraintes pour chaque OAR
  createdAt: Date;
  modifiedAt: Date;
  isCustom: boolean;                      // true si créé par l'utilisateur
}

// Résultat de validation d'une contrainte
export interface ConstraintValidationResult {
  constraint: OARConstraint;
  structureName: string;                  // Nom réel de la structure trouvée
  measuredValue: number;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_EVALUATED';
  message?: string;
}

// Résultat de validation de prescription
export interface PrescriptionValidationResult {
  prescription: PrescriptionDose;
  isCoherent: boolean;
  warnings: string[];
}

// Informations sur la sommation multi-plans
export interface SummationReportInfo {
  planNames: string[];
  planDetails?: Array<{
    name: string;
    fractions?: number;
    dosePerFraction?: number;
    dose?: number;        // dose totale Gy (depuis RTPLAN si dispo)
    label?: string;       // label du plan depuis RTPLAN
  }>;
  method: 'dose_grid' | 'dvh_direct';
  totalDose?: number;
  warnings: string[];
  matchedStructures?: number;
  unmatchedStructures?: string[];
}

// Rapport de validation complet
export interface ValidationReport {
  protocolName: string;
  patientId: string;
  evaluationDate: Date;
  prescriptionResults: PrescriptionValidationResult[];
  constraintResults: ConstraintValidationResult[];
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  unmatchedStructures: string[];  // Structures du protocole non trouvées
  // Nouvelles informations du plan
  planSummary?: {
    primaryPTV: string;
    prescriptionDose: number;
    ptvCount: number;
    oarCount: number;
  };
  ptvQualityMetrics?: Array<{
    structureName: string;
    d95: number;
    d98: number;
    d50: number;
    d2: number;
    v95: number;
    hi: number;
    ci: number;
    cn: number;
  }>;
  // Informations de sommation multi-plans (uniquement si applicable)
  summationInfo?: SummationReportInfo;
}

// Mapping manuel de structures
export interface StructureMapping {
  protocolStructureName: string;
  dvhStructureName: string;
}
