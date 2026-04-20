
User approved plan + wants Markdown version too. Generate both files in /mnt/documents/.

# Plan : Génération du prompt JSON + version Markdown

## Livrables
Deux fichiers déposés dans `/mnt/documents/` :

1. **`dvh-analyzer-prompt.json`** — Prompt structuré machine-readable pour agents IA
2. **`dvh-analyzer-prompt.md`** — Version humaine lisible, structurée en sections avec titres, listes, blocs de code

## Contenu (identique pour les 2 formats)

**Sections couvertes** :
- Identité projet & objectif clinique (Tomotherapy validation)
- Stack technique (React/Vite/TS/Tailwind/shadcn/Cloud/AI)
- Deux méthodes d'entrée détaillées :
  - **TXT TomoTherapy** : format REL + ABS, détection cGy/Gy, parsing CSV
  - **DICOM RT** : RTSTRUCT/RTDOSE/RTPLAN, cumsum incremental, point artificiel (0Gy,100%)
- 12 features prioritaires (ordre de build MVP → avancé)
- Calculs DVH exacts (Dmax, Dmean, Dmin, Dx%, Vx, HI, CI, CN)
- Règle critique : DVH Parser = référence, précision décimale
- Système de protocoles (predefined JSON + custom + extraction IA)
- Design system (tokens HSL sémantiques, dark/light, badges)
- Validation plan vs protocole (mapping fuzzy)
- Pièges à éviter (tokens couleurs, RLS, CHECK constraints)

## Format Markdown spécifique
- Titres hiérarchiques (#, ##, ###)
- Tableaux pour features et calculs
- Blocs de code pour exemples de structures de données
- Listes à puces pour features
- Section "Quick Start" en début pour usage rapide

## Étapes
1. Générer le JSON structuré (~20 KB)
2. Générer le Markdown équivalent (~25 KB) avec mise en forme lecture humaine
3. Émettre 2 balises `presentation-artifact` pour téléchargement

Aucune modification du codebase — uniquement génération de fichiers artefacts.
