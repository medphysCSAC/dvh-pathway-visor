/**
 * ntcp.ts — Types pour le module NTCP / TCP
 *
 * Modèles implémentés :
 *   NTCP : Lyman-Kutcher-Burman (LKB) — référence : Kutcher & Burman, Int J Radiat Oncol Biol Phys, 1989
 *   TCP  : Logistique de Niemierko — référence : Niemierko, Med Phys, 1997
 *
 * Paramètres biologiques : QUANTEC 2010 (Semin Radiat Oncol 20:1-301, 2010)
 *                          mis à jour avec données IMRT/VMAT post-2015 là où disponibles.
 */

// ─── Identifiants d'organes canoniques ───────────────────────────────────────

export type OARCanonicalId =
  | 'lung_total'
  | 'lung_ipsilateral'
  | 'lung_contralateral'
  | 'heart'
  | 'parotid'
  | 'parotid_ipsilateral'
  | 'parotid_contralateral'
  | 'submandibular'        // glandes sous-mandibulaires — non présentes dans QUANTEC original
  | 'spinal_cord'
  | 'brainstem'
  | 'rectum'
  | 'bladder'
  | 'esophagus'
  | 'liver'
  | 'kidney'
  | 'femoral_head'
  | 'cochlea'
  | 'larynx'
  | 'brachial_plexus'     // absent de QUANTEC 2010, paramètres issus de Marks 2010
  | 'hippocampus'         // RTOG 0933 / NRG CC001
  | 'lens'
  | 'optic_nerve'
  | 'chiasm'
  | 'mandible'
  | 'small_bowel';

export type TumorHistologyId =
  | 'prostate_adenocarcinoma'
  | 'head_neck_scc'             // carcinome épidermoïde ORL
  | 'breast_adenocarcinoma'
  | 'nsclc'                     // CBNPC (non-small cell lung cancer)
  | 'medulloblastoma'
  | 'glioblastoma'
  | 'cervix_squamous'
  | 'rectal_adenocarcinoma';

// ─── Paramètres LKB ──────────────────────────────────────────────────────────

/**
 * Paramètres du modèle LKB pour un OAR donné.
 *
 * TD50   : dose tolerance médiane (50% de complication) en Gy
 * m      : pente de la courbe sigmoïde (sans unité) — plus m est petit, plus la courbe est raide
 * n      : paramètre volume-effet (0 = série pure / "FSU en série", 1 = parallèle pur)
 * alphaBeta : rapport α/β du tissu sain en Gy (pour correction EQD2)
 * endpoint  : toxicité modélisée (ex. "Pneumonite grade ≥2")
 * source    : référence bibliographique des paramètres
 * notes     : avertissements cliniques importants
 * confidence: niveau de confiance dans les paramètres ('high' | 'moderate' | 'low')
 *             high     = validé sur cohortes IMRT ≥200 patients
 *             moderate = QUANTEC 2010 ou validation partielle IMRT
 *             low      = données limitées / extrapolées
 */
export interface LKBParameters {
  oarId: OARCanonicalId;
  organName: string;           // nom affiché
  td50: number;                // Gy
  m: number;
  n: number;
  alphaBeta: number;           // Gy, tissu sain
  endpoint: string;
  source: string;
  notes: string;
  confidence: 'high' | 'moderate' | 'low';
}

// ─── Paramètres TCP ───────────────────────────────────────────────────────────

/**
 * Paramètres du modèle TCP logistique de Niemierko.
 *
 * tcd50  : dose de contrôle tumoral à 50% en Gy (EUD)
 * gamma50: paramètre de pente normalisée (sans unité)
 * a      : paramètre d'hétérogénéité de dose (négatif pour tumeur → sensible aux points froids)
 *          typiquement a = −10 à −20 pour tumeurs solides
 * alphaBeta : rapport α/β tumoral en Gy
 *
 * Note clinique (certitude >95%) :
 *   Les valeurs de tcd50 sont très dépendantes du type histologique et de la technologie
 *   de traitement utilisée pour les dériver. Elles NE doivent PAS être utilisées comme
 *   prédiction absolue mais uniquement pour des comparaisons relatives ΔTCP entre plans.
 */
export interface TCPParameters {
  histologyId: TumorHistologyId;
  histologyName: string;
  tcd50: number;               // Gy
  gamma50: number;
  a: number;                   // paramètre gEUD tumeur (négatif)
  alphaBeta: number;           // Gy, tumeur
  fractionSize: number;        // Gy/fx de référence pour les paramètres
  source: string;
  notes: string;
  confidence: 'high' | 'moderate' | 'low';
}

// ─── Résultats de calcul ──────────────────────────────────────────────────────

export interface EUDResult {
  structureName: string;
  eud: number;                 // Gy (EUD générale, en EQD2 si correction appliquée)
  eudRaw: number;              // Gy (sans correction EQD2, pour débogage)
  eqd2Applied: boolean;        // true si correction fractionnement appliquée
  nFractions: number;
  dosePerFraction: number;     // Gy/fx
}

export interface NTCPResult {
  structureName: string;
  oarId: OARCanonicalId | null;
  parameters: LKBParameters;
  eudResult: EUDResult;
  ntcp: number;                // 0–1 (probabilité)
  ntcpPercent: number;         // 0–100 (%)
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  // low      : NTCP < 5%
  // moderate : 5% ≤ NTCP < 20%
  // high     : 20% ≤ NTCP < 40%
  // very_high: NTCP ≥ 40%
  isAboveConstraint: boolean;  // NTCP > seuil clinique recommandé
  constraintThreshold: number; // seuil de référence en % (ex. 20 pour poumon)
}

export interface TCPResult {
  structureName: string;
  histologyId: TumorHistologyId | null;
  parameters: TCPParameters;
  eudResult: EUDResult;
  tcp: number;                 // 0–1
  tcpPercent: number;          // %
  coldSpotWarning: boolean;    // true si EUD < 95% de la dose prescrite (zone froide critique)
}

// ─── Résultat global du module ────────────────────────────────────────────────

export interface NTCPTCPAnalysisResult {
  ntcpResults: NTCPResult[];
  tcpResults: TCPResult[];
  /** Protocole et fractionnemnt utilisés pour EQD2 */
  protocolName: string;
  totalDose: number;           // Gy
  nFractions: number;
  dosePerFraction: number;     // Gy/fx
  /** Avertissement si paramètres hors domaine de validité */
  globalWarnings: string[];
  computedAt: Date;
}

// ─── Configuration what-if (sliders) ─────────────────────────────────────────

export interface WhatIfConfig {
  /** Facteur multiplicatif sur la dose (ex. 1.10 = +10%) */
  doseFactor: number;
  /** Remplacement α/β OAR global pour test de sensibilité */
  alphaBetaOverride: number | null;
  /** Nombre de fractions alternatif (pour simulation hypofractionnement) */
  nFractionsOverride: number | null;
}

// ─── Mapping structure DVH → OAR/Tumeur ──────────────────────────────────────

export interface NTCPStructureAssignment {
  dvhStructureName: string;
  type: 'oar' | 'tumor';
  oarId?: OARCanonicalId;
  histologyId?: TumorHistologyId;
  /** true si assigné automatiquement via similarité de nom */
  isAutoAssigned: boolean;
}

// ─── Paramètres utilisateur (éditables, persistés localStorage) ──────────────

export type UserLKBOverrides = Record<OARCanonicalId, Partial<LKBParameters>>;
export type UserTCPOverrides = Record<TumorHistologyId, Partial<TCPParameters>>;
