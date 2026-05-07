# Plan — Module NTCP / TCP intégré

## Objectif

Ajouter un module de modélisation des risques (NTCP — Normal Tissue Complication Probability) et TCP (Tumor Control Probability) qui exploite **directement les DVH déjà calculés** et le **protocole/mapping actif** — aucun re-calcul, aucune ressaisie.

## Modèles implémentés

1. **Lyman-Kutcher-Burman (LKB)** pour NTCP des OAR
   - Formule : `NTCP = 0.5 × [1 + erf(t/√2)]` avec `t = (EUD − TD50) / (m × TD50)`
   - EUD (gEUD) calculé depuis le DVH différentiel : `EUD = (Σ vᵢ × Dᵢ^(1/n))^n`
   - Correction de fractionnement LQ (α/β) appliquée sur chaque bin de dose (EQD2)

2. **Logistique (Niemierko)** pour TCP des PTV
   - `TCP = 1 / (1 + (TCD50/EUD)^(4·γ50))`
   - EUD avec n négatif (typiquement a = −10) pour mettre l'accent sur les zones froides

3. **Bibliothèque de paramètres cliniques par défaut** (QUANTEC / Emami / Burman) pour ~15 OAR courants : poumon, cœur, parotide, moelle, rectum, vessie, œsophage, foie, rein, tronc cérébral, cochlée, larynx, intestin grêle, têtes fémorales, cristallin. Éditable par l'utilisateur.

## Intégration ergonomique

### 1. Point d'entrée — Onglet dédié + entrée Outils

- Nouvel onglet `Modélisation NTCP/TCP` dans la barre principale (visible uniquement si `dvhData` existe), placé entre "Évaluation de plan" et "Validation Protocole".
- Ajout d'une entrée `ntcp-tcp` dans `ToolsMenu` qui bascule vers cet onglet (cohérent avec l'UX existante).

### 2. Aucun re-calcul

Le composant `NTCPTCPAnalysis` reçoit en props :
- `dvhData.structures` (DVH déjà parsé, contenant `differentialAbsoluteVolume` + `totalVolume`)
- `sharedProtocol` + `sharedMappings` (protocole + mapping déjà confirmés)

Logique :
- Pour chaque OAR mappé : récupère le DVH différentiel existant → calcule EUD → cherche les paramètres LKB du modèle (par nom mappé) → NTCP.
- Pour chaque PTV : EUD négatif → TCP avec α/β tumeur.
- Le nombre de fractions et la dose totale sont **lus depuis `protocol.prescriptions`** — pas de saisie.
- Si aucun protocole actif : affiche un bandeau "Sélectionnez un protocole" avec bouton qui ouvre le `ProtocolSelectorDialog` existant.

### 3. UI du composant

```text
┌──────────────────────────────────────────────────────────┐
│ Modélisation NTCP / TCP                                  │
│ Protocole : Sein Gauche — 50 Gy / 25 fx                  │
├──────────────────────────────────────────────────────────┤
│ [Tableau 1 : NTCP — risques OAR]                         │
│ Structure │ EUD (Gy) │ TD50 │ m │ n │ NTCP │ Sévérité   │
│ Poumon G  │  12.4    │  24  │0.37│ 1 │ 4.2% │ Pneumonite │
│ Cœur      │   3.1    │  48  │0.10│0.5│ <1%  │ Péricardite│
│                                                          │
│ [Tableau 2 : TCP — contrôle tumoral]                     │
│ Structure │ EUD (Gy) │ TCD50 │ γ50 │ TCP                 │
│ PTV 50    │  49.8    │  60   │ 1.5 │ 38%                 │
│                                                          │
│ [Graphique : NTCP vs dose prescrite (sliders ±10%)]      │
│                                                          │
│ [Disclaimer médical · Sources QUANTEC · Éditer params]   │
└──────────────────────────────────────────────────────────┘
```

- Sliders "Dose ±20%" et "α/β" permettent une simulation what-if **sans recharger le DVH**.
- Bouton "Éditer paramètres LKB" → modal pour ajuster TD50/m/n par structure (sauvegardé en `localStorage`).
- Code couleur sémantique (`--success` < 5%, `--warning` 5-20%, `--destructive` > 20%).
- Disclaimer obligatoire : "Outil de recherche / aide à la décision — ne remplace pas le jugement clinique."

### 4. Export

- Bouton "Inclure dans le rapport" : ajoute une section NTCP/TCP au PDF généré par `ExportReportDialog` (en réutilisant la structure existante).

## Fichiers touchés

- `src/types/ntcp.ts` (nouveau) — types `LKBParameters`, `TCPParameters`, `NTCPResult`, `TCPResult`.
- `src/data/ntcpDefaults.ts` (nouveau) — table QUANTEC/Emami par organe.
- `src/utils/ntcpCalculator.ts` (nouveau) — `computeEUD`, `computeNTCP_LKB`, `computeTCP_Logistic`, conversion EQD2.
- `src/components/NTCPTCPAnalysis.tsx` (nouveau) — composant principal contrôlé.
- `src/components/NTCPParametersEditor.tsx` (nouveau) — modal d'édition paramètres.
- `src/pages/Index.tsx` — ajouter l'onglet + brancher props (`dvhData`, `sharedProtocol`, `sharedMappings`, `onPickProtocol`).
- `src/components/ToolsMenu.tsx` — ajouter entrée `ntcp-tcp`.
- (optionnel) `src/components/ExportReportDialog.tsx` — case à cocher "Inclure NTCP/TCP".

## Détails techniques

- EUD utilise le **DVH différentiel absolu** déjà présent (`structure.differentialAbsoluteVolume`) — fallback par dérivation numérique du cumulatif si absent (logique déjà disponible dans `dvhParser`).
- Conversion EQD2 par bin : `EQD2 = D × (D/nFx + α/β) / (2 + α/β)`.
- `erf` implémentée avec l'approximation d'Abramowitz & Stegun (précision 1.5e-7) — pas de dépendance externe.
- Aucune modif Supabase, aucun appel réseau, purement front.
- Performance : O(n_bins × n_structures), instantané sur des DVH typiques.

## Tests manuels

1. Charger un plan + sélectionner protocole → onglet NTCP/TCP affiche immédiatement les risques sans saisie.
2. Modifier un paramètre TD50 dans l'éditeur → tableau et graph se mettent à jour.
3. Slider "Dose +10%" → courbes NTCP recalculées sans toucher au DVH.
4. Sans protocole actif → bandeau invitation, ouvre le sélecteur existant.
5. Changer de plan → reset cohérent avec le reste de l'app.
