

# Plan : Affichage des plans sources dans le rapport PDF

## Objectif
Lorsque l'analyse provient d'une **sommation DICOM multi-plans**, le rapport PDF doit afficher clairement :
- La liste des plans sources additionnés
- La méthode de sommation utilisée (`dose_grid` précis ou `dvh_direct` approximatif)
- Les éventuels avertissements (patients différents, géométries incompatibles, fallback)
- Une mention claire si méthode approximative → "à confirmer avec export TPS"

## Aperçu visuel (nouvelle section rapport)

```text
┌─────────────────────────────────────────────────────────────┐
│  📊 SOMMATION DOSIMÉTRIQUE                                  │
│  Ce rapport est basé sur la sommation de 3 plans :          │
│                                                             │
│   • Plan 1 : RTDOSE_phase1.dcm   — 46 Gy / 23 fx            │
│   • Plan 2 : RTDOSE_boost.dcm    — 14 Gy / 7 fx             │
│   • Plan 3 : RTDOSE_sib.dcm      — 5 Gy  / 5 fx             │
│                                                             │
│   Dose totale estimée : 65 Gy                               │
│   Méthode : ✅ Sommation sur grille de dose (précis)         │
│                                                             │
│   ⚠️ Moelle épinière absente du Plan 2                       │
└─────────────────────────────────────────────────────────────┘
```

Si méthode = `dvh_direct` : encadré orange + mention :
> ⚠️ Validation par sommation approchée (DVH direct). Confirmer avec l'export sommation du TPS avant validation clinique.

## Modifications techniques

### 1. `src/types/protocol.ts`
Ajouter un champ optionnel `summationInfo` à `ValidationReport` :

```ts
export interface SummationReportInfo {
  planNames: string[];
  planDetails?: Array<{ 
    name: string; 
    fractions?: number; 
    dose?: number;        // dose totale Gy
    label?: string;       // depuis RTPLAN si dispo
  }>;
  method: 'dose_grid' | 'dvh_direct';
  totalDose?: number;
  warnings: string[];
  matchedStructures?: number;
  unmatchedStructures?: string[];
}

export interface ValidationReport {
  // ... existant
  summationInfo?: SummationReportInfo;
}
```

### 2. Propagation depuis la sommation
- **`src/pages/Index.tsx`** — `handleDicomSummationComplete(data, result)` : stocker `result` dans un state `lastSummationResult: SummedPlanResult | null`.
- **`src/components/ProtocolValidation.tsx`** : accepter en prop optionnelle `summationResult?: SummedPlanResult`. Au moment de `generateValidationReport(...)`, injecter `summationInfo` dans le rapport produit (mapping depuis `result.info` + `result.summationMethod` + `result.warnings` + `plans` slots).
- **`src/utils/protocolValidator.ts`** : `generateValidationReport` accepte un paramètre optionnel `summationInfo` et le pose tel quel sur le rapport.
- **`PlanSummationManager`** : déjà fournit `result` au callback — exposer aussi `planDetails` (nom fichier + fractions + dose) en enrichissant `SummedPlanResult.info.planDetails` (déjà partiellement présent via `rtPlanInfo` des slots).

### 3. Génération PDF — 3 endroits
- **`src/utils/reportGeneratorTest.ts`** (rapport Officiel) : ajouter une **section dédiée** "Sommation Dosimétrique" entre l'en-tête institutionnel et la section Patient.
- **`src/utils/reportGeneratorTest2.ts`** (rapport Essentiel) : ajouter un **encadré compact** entre le Résumé et la table PTV (3-4 lignes maxi pour rester ultra-compact).
- **`src/components/ReportHTMLPreview.tsx`** : afficher la même section dans la prévisualisation pour cohérence visuelle.

### 4. Style conditionnel selon méthode
- `dose_grid` → fond vert clair, badge "✅ Précis"
- `dvh_direct` → fond orange, badge "⚠️ Approché", message d'avertissement explicite

### 5. Cas sans sommation
Si `report.summationInfo` est absent (analyse mono-plan classique), aucune section n'est ajoutée — rapport identique à aujourd'hui.

## Fichiers modifiés
1. `src/types/protocol.ts` — nouvelle interface `SummationReportInfo`
2. `src/utils/planSummationDicom.ts` — enrichir `SummedPlanResult.info.planDetails`
3. `src/utils/protocolValidator.ts` — accepter et propager `summationInfo`
4. `src/pages/Index.tsx` — mémoriser `lastSummationResult`, le passer à `ProtocolValidation`
5. `src/components/ProtocolValidation.tsx` — recevoir et injecter dans le rapport
6. `src/utils/reportGeneratorTest.ts` — section "Sommation" complète
7. `src/utils/reportGeneratorTest2.ts` — encadré compact
8. `src/components/ReportHTMLPreview.tsx` — preview cohérent

## Hors scope (étape suivante possible)
- Ajout de la **dose biologique cumulée (EQD2/BED)** par structure
- **Graphique miniature** des DVH individuels superposés au DVH sommé dans le rapport
- Export structuré JSON des plans sources pour audit qualité

