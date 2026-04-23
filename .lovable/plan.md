

# Plan : Upload unifié dans "Charger un plan" + suppression de l'onglet DICOM RT

## Objectif
Fusionner les onglets **"Charger un plan"** (CSV TomoTherapy) et **"DICOM RT"** en une seule zone d'upload intelligente avec détection automatique du format. Supprimer l'onglet DICOM RT redondant.

## Comportement cible

Une zone de drop **unifiée** dans "Charger un plan" qui accepte :
- **CSV TomoTherapy** : `*_REL.txt/csv` (+ `*_ABS.txt/csv` optionnel) — appariement auto
- **DICOM RT** : `RTSTRUCT.dcm` + `RTDOSE.dcm` (+ `RTPLAN.dcm` optionnel) — détection IOD auto
- **Modes d'upload** :
  - Glisser-déposer fichier(s)
  - Sélectionner fichier(s) via bouton
  - Glisser-déposer un **dossier entier** (lecture récursive — déjà supporté par `DicomRTUpload`)

## Logique de détection

1. **Tri par extension** :
   - `.txt` / `.csv` → branche CSV (réutilise la détection REL/ABS existante de `FileUpload`)
   - `.dcm` → branche DICOM (réutilise la détection IOD de `DicomRTUpload`)
2. **Affichage unifié** : liste des fichiers détectés avec badge `CSV REL`, `CSV ABS`, `RTSTRUCT`, `RTDOSE`, `RTPLAN`
3. **Validation** :
   - CSV : au minimum un REL
   - DICOM : au minimum 1 RTSTRUCT + 1 RTDOSE
   - Erreur claire si mélange ambigu (ex. 2 RTSTRUCT sans appariement clair)
4. **Routing** : selon le type majoritaire détecté → appel à `parseTomoTherapyDVH` ou à `parseDicomFile` + `convertDicomDVHToAppFormat`

## Aperçu visuel

```text
┌──────────────────────────────────────────────────────────┐
│  📤 Charger un plan                                      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │   Glissez fichiers ou dossier ici                  │  │
│  │   (CSV TomoTherapy ou DICOM RT — détection auto)   │  │
│  │   [ Sélectionner fichiers ] [ Sélectionner dossier ]│  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Fichiers détectés (3) :                                 │
│   ✅ patient1_REL.txt        [CSV REL]                   │
│   ✅ patient1_ABS.txt        [CSV ABS]                   │
│   → Plan TomoTherapy détecté                             │
│                                                          │
│  [ Analyser le plan ]                                    │
└──────────────────────────────────────────────────────────┘
```

Si DICOM détecté à la place :
```text
   ✅ RS.dcm    [RTSTRUCT]    Patient: Dupont
   ✅ RD.dcm    [RTDOSE]      45 Gy
   ✅ RP.dcm    [RTPLAN]      25 fractions
   → Plan DICOM RT détecté
```

## Fichiers à modifier

1. **Nouveau composant `src/components/UnifiedPlanUpload.tsx`** :
   - Fusionne la logique de `FileUpload.tsx` (CSV REL/ABS) et `DicomRTUpload.tsx` (DICOM + dossiers)
   - Détection automatique par extension + parsing IOD pour les `.dcm`
   - UI unifiée avec badges de type, drag&drop fichiers ET dossiers
   - Callbacks : `onCsvLoaded(relFile, absFile?)` et `onDicomLoaded(data)` — réutilise les handlers existants de `Index.tsx`

2. **`src/pages/Index.tsx`** :
   - Remplacer l'onglet "Charger un plan" (`FileUpload`) par `UnifiedPlanUpload`
   - **Supprimer l'onglet "DICOM RT"** de la liste des `TabsTrigger`
   - Réutiliser tels quels `handleFilesUploaded` et `handleDicomRTLoaded`

3. **`src/components/HelpGuide.tsx`** :
   - Mettre à jour les références à "DICOM RT" comme onglet séparé → mentionner que tout passe par "Charger un plan"

4. **Conservation** :
   - `FileUpload.tsx` et `DicomRTUpload.tsx` restent dans le projet (toujours utilisés par `DVHSourceComparison` pour le mode debug)
   - Aucun changement aux parseurs (`dvhParser.ts`, `dicomRTParser.ts`)

## Avantages
- **Interface allégée** : 1 onglet au lieu de 2 pour l'entrée principale
- **UX plus fluide** : l'utilisateur n'a plus à savoir à l'avance quel format il a
- **Cohérence** : même approche que celle adoptée pour "Comparer plans"

## Hors scope
- Modification du composant `DVHSourceComparison` (debug parsers — garde ses 2 zones séparées par design)
- Refonte du `PlanSummationManager` (workflow multi-plans DICOM spécifique)

