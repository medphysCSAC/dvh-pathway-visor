# Plan — corriger les 3 défauts de sélection / mapping de protocole

## Constat (validé sur le code actuel)

- `Index.tsx` ne stocke que `activeProtocol` (sans mapping). `ProtocolValidation` gère son propre `selectedProtocolId` et ses propres `mappings` (en silo + localStorage par protocole).
- `ProtocolSelectorDialog` (utilisé depuis `PatientBar` / `ProtocolPromptBanner`) ferme la boîte dès qu'un protocole est choisi → l'utilisateur n'a aucune occasion de mapper avant l'affichage du DVH.
- Le composant `StructureMapping` existe, mais il est encapsulé dans `ProtocolValidation` et ne peut pas être réutilisé tel quel après le sélecteur.
- `findBestStructureMatch` fait déjà une normalisation + recherche partielle, mais il n'a ni table d'alias anatomiques, ni score Levenshtein, ni mémoire utilisateur globale.

## Décisions

- Source unique de vérité dans `Index.tsx` : `activeProtocol` + `structureMappings` (typé `StructureMapping[]`). Tous les onglets lisent ce store.
- Règle absolue : tout choix de protocole passe par `ProtocolSelectorDialog` qui chaîne **automatiquement** une étape mapping avant de fermer (deux étapes internes : *select* → *map*).
- `ProtocolValidation` devient contrôlé : reçoit `protocol` + `mappings` + `onMappingsChange` au lieu de gérer son propre état.
- `StructureMapping` existant est réutilisé dans le dialog (pas de duplication).
- L'algorithme de matching est enrichi par étapes (alias → normalisation forte → Levenshtein) en restant rétro‑compatible.

## Étapes

### 1. État partagé dans `Index.tsx`
- Ajouter `structureMappings: StructureMapping[]` à côté de `activeProtocol`.
- Remplacer `handleProtocolPicked(p)` par `handleProtocolConfirmed(p, mappings)` qui set les deux et toaste un récap (`N structures mappées`).
- `handleChangePlan` : reset aussi `structureMappings` et `activeProtocol`.

### 2. `ProtocolSelectorDialog` en deux étapes (select → map)
- Ajouter un état interne `step: 'select' | 'map'` + `pickedProtocol`.
- Étape 1 : `ProtocolSelectorStep` → ne ferme plus le dialog, passe à `step='map'`.
- Étape 2 : autoMap initial via le nouvel utilitaire (cf. étape 4) → afficher le composant `StructureMapping` existant (ou variante simplifiée) avec bouton **Confirmer & analyser**.
- À la confirmation : appel `onConfirm(protocol, mappings)` + close. Bouton **Retour** pour rechoisir le protocole.
- Si l'auto‑mapping résout 100 % des structures, on peut afficher un état compact avec un bouton "Tout est correct, confirmer".

### 3. Brancher tous les consommateurs
- `Index.tsx` : remplacer `onSelect={handleProtocolPicked}` par `onConfirm={handleProtocolConfirmed}` et passer aussi `initialMappings={structureMappings}` au dialog.
- `ProtocolValidation` (contrôlé) :
  - nouvelles props : `controlledProtocol?: TreatmentProtocol | null`, `controlledMappings?: StructureMapping[]`, `onProtocolConfirmed?: (p, m) => void`.
  - si `controlledProtocol` est défini : pré‑sélectionner, désactiver la sélection (afficher une bannière *Plan chargé : <nom> — N structures mappées ✓ — Modifier*), pré‑remplir les mappings, et propager les changements via `onProtocolConfirmed`.
  - le bouton "Modifier" rouvre le `ProtocolSelectorDialog` (réutilisation).
- `ProtocolPromptBanner` continue d'ouvrir le dialog ; aucune duplication.

### 4. Améliorer l'auto‑mapping
- Nouveau fichier `src/utils/structureMappingUtils.ts` avec :
  - normalisation forte (accents, séparateurs, chiffres, latéralité L/R/G/D).
  - table `ANATOMICAL_ALIASES` (parotide, moelle, tronc, rectum, vessie, têtes fémorales, poumons, cœur, œsophage, larynx, cochlée…).
  - distance de Levenshtein + `similarityScore`.
  - `autoMapStructures(dicomNames, protocolNames): MappingResult[]` avec seuil `AUTO_MATCH_THRESHOLD = 0.72`.
- `findBestStructureMatch` : déléguer à `similarityScore` en fallback (garder le chemin PTV existant qui fonctionne bien) et conserver la priorité aux mappings manuels.
- Mémoire utilisateur globale : à la confirmation, écrire les paires `protocolName → dicomName` validées dans `localStorage` (clé `structure-mappings-global`). Au prochain auto‑map, ces paires sont injectées en priorité, tous protocoles confondus. (Conserve aussi la clé existante par protocole pour rétro‑compat.)

### 5. Garde‑fou
- Tant que `activeProtocol` est défini mais que `structureMappings` est vide ET qu'il existe au moins une structure non résolue côté protocole, afficher un petit bandeau dans l'onglet *Analyse* invitant à compléter le mapping (ouvre le dialog directement à `step='map'`).

## Détails techniques

- Aucune modif Supabase / RLS / edge function ; purement front.
- Types : ajouter `MappingResult` dans le nouvel utilitaire ; ne pas toucher `StructureMapping` existant pour éviter la cascade.
- Tests manuels :
  1. Importer DICOM, cliquer *Choisir un protocole* → voir étape mapping → confirmer → DVH affiche les contraintes du premier coup.
  2. Aller dans *Validation* → protocole et mappings déjà sélectionnés, bannière "Plan chargé".
  3. *Modifier le protocole* → dialog rouvre à l'étape select.
  4. Changer de plan → tout reset.
- Performance : Levenshtein O(n·m) sur des noms < 40 chars, négligeable.

## Fichiers touchés

- `src/pages/Index.tsx` (état + handler + props ProtocolValidation/Dialog)
- `src/components/ProtocolSelectorDialog.tsx` (machine à 2 étapes)
- `src/components/ProtocolValidation.tsx` (mode contrôlé + bannière)
- `src/utils/protocolValidator.ts` (déléguer fallback à similarityScore)
- `src/utils/structureMappingUtils.ts` (nouveau)
- éventuellement `src/components/StructureMapping.tsx` (rendre `protocolId` optionnel pour réutilisation hors validation, sinon laisser tel quel)
