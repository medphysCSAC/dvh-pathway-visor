

# Plan : Sommation N-plans (jusqu'à 4) — DICOM RT

## Réponse à ta question préliminaire

**RTDOSE vs RTPLAN — l'ordre n'a pas d'importance pour la sommation** :
- **RTDOSE** = la grille 3D de dose (c'est ce qu'on additionne)
- **RTPLAN** = les paramètres de traitement (faisceaux, fractions). Utile pour afficher les métadonnées (nom du plan, nb fractions) mais **non requis** pour le calcul.
- **RTSTRUCT** = les contours (requis uniquement pour la méthode `dose_grid` afin de recalculer les DVH).

La sommation est **commutative et associative** : `A + B + C + D = D + C + B + A`. L'ordre d'upload est donc indifférent. On affichera juste un libellé "Plan 1, Plan 2, …" basé sur l'ordre d'ajout (renommable).

## Approche UI recommandée — la plus pratique

**Liste dynamique de slots** (au lieu de 2 slots fixes) :

```text
┌────────────────────────────────────────────────────┐
│ 📋 Sommation de plans (2 à 4 plans)                │
│                                                    │
│ [+] Ajouter un plan          Méthode : ◉ Grille    │
│                                       ◯ DVH direct │
│                                                    │
│ ┌── Plan 1 ──────────────────────── [✕] ──┐        │
│ │ 📄 RTDOSE_phase1.dcm    Patient: ABC123  │        │
│ │ 🏷  46 Gy / 23 fx (depuis RTPLAN)        │        │
│ │ [+ associer RTPLAN]                      │        │
│ └──────────────────────────────────────────┘        │
│ ┌── Plan 2 ──────────────────────── [✕] ──┐        │
│ │ 📄 RTDOSE_boost.dcm     Patient: ABC123  │        │
│ └──────────────────────────────────────────┘        │
│ ┌── Plan 3 ──────────────────────── [✕] ──┐        │
│ │ 📄 RTDOSE_sib.dcm       Patient: ABC123  │        │
│ └──────────────────────────────────────────┘        │
│ [+ Ajouter un plan]   (max 4 atteints → bouton off) │
│                                                    │
│ RTSTRUCT commun : 📄 struct.dcm  [✕]                │
│                                                    │
│ ✅ 3 plans · même patient · grilles compatibles     │
│ Dose max sommée estimée : 60 Gy                    │
│                                                    │
│ [ Calculer la sommation ]   [ Réinitialiser ]      │
└────────────────────────────────────────────────────┘
```

**Drag & drop multi-fichiers** également supporté : déposer 3 RTDOSE + 1 RTSTRUCT remplit automatiquement les slots (détection par `Modality` DICOM).

## Modifications techniques

### 1. `src/utils/planSummationDicom.ts`
- Généraliser `sumDoseGrids(buf1, buf2)` → `sumDoseGridsN(buffers: ArrayBuffer[])` : boucle de sommation N fois, validation géométrique deux à deux contre la 1ʳᵉ référence.
- Généraliser `sumDVHDirect(s1, s2)` → `sumDVHDirectN(structuresList: Structure[][])` : pour chaque structure commune, `V_sum(d) = max(V_i(d))` sur tous les plans.
- Étendre `SummationInput` :
  ```ts
  interface SummationInput {
    plans: Array<{
      name: string;
      rtDoseBuffer?: ArrayBuffer;
      structures?: Structure[];
      rtPlanInfo?: { fractions?: number; dosePerFraction?: number };
    }>;
    rtStructures?: DicomRTStructure[];
    preferredMethod: SummationMethod;
  }
  ```
- `SummedPlanResult.info` : remplacer `plan1Name/plan2Name` par `planNames: string[]`.

### 2. `src/components/PlanSummationManager.tsx`
- Remplacer `plan1`/`plan2` par `plans: PlanSlot[]` (state array).
- Ajouter `addPlan()` (limite 4), `removePlan(idx)`, `updatePlan(idx, ...)`.
- Détecter automatiquement la modalité DICOM à l'upload : RTDOSE → slot, RTSTRUCT → champ commun, RTPLAN → enrichit le slot RTDOSE correspondant (matching par `ReferencedSOPInstanceUID` ou par sélection manuelle si ambigu).
- Validation cross-plans : tous les patients identiques, toutes les géométries compatibles deux à deux.
- Conserver le drag & drop, mais accepter N fichiers d'un coup.

### 3. `src/pages/Index.tsx`
- Aucun changement de structure — `handleDicomSummationComplete` reste compatible (reçoit `DVHData` + `SummedPlanResult`).

## Points cliniques préservés
- Avertissement si patients différents.
- Avertissement si une géométrie ne matche pas → fallback `dvh_direct` automatique proposé.
- Recalcul DVH depuis la grille N-sommée via le RTSTRUCT commun (raycasting actuel inchangé).
- Le rapport PDF listera tous les plans sources (à étendre dans une étape suivante).

## Étapes d'implémentation
1. Refactor `planSummationDicom.ts` (sommation N).
2. Refactor `PlanSummationManager.tsx` (slots dynamiques + drag&drop multi).
3. Détection modalité DICOM (RTDOSE/RTSTRUCT/RTPLAN) à l'upload.
4. Test manuel avec 3 plans (45+15+5 Gy par exemple).

## Hors scope (à valider après)
- Pondération par nombre de fractions effectivement délivrées (ex : plan interrompu).
- Sommation EQD2/BED (nécessite α/β par structure).
- Affichage côte-à-côte des DVH individuels vs sommé.

