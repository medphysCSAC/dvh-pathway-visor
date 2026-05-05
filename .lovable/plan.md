# Critique UX & Plan d'amélioration ergonomique

## 1. Critique de l'interface actuelle

### Ce qui fonctionne bien
- Séparation claire des deux états (sans plan / avec plan).
- WelcomeScreen orienté "cas d'usage" plutôt que "type de fichier" — bonne abstraction métier.
- Barre patient persistante avec infos clés (dose max, structures, protocole actif).

### Problèmes identifiés

**A. WelcomeScreen — surcharge cognitive**
- 3 cartes d'usage + 4 boutons "Accès direct" + zone d'import dépliée par défaut = trop d'éléments visibles en même temps.
- Le bouton "Accès direct → Protocoles" déclenche l'affichage d'un `ProtocolManager` complet **sous** le WelcomeScreen → l'utilisateur doit scroller, perd le contexte d'import.
- Les cartes "Comparer" et "Sommation" embarquent des sous-composants lourds (`MultiFileUpload`, `PlanSummationManager`) directement dans la carte → la page devient très longue dès qu'on clique.
- Hiérarchie visuelle floue : "le plus fréquent" est annoncé mais les 2 autres cartes sont visuellement aussi proéminentes.

**B. Navigation à plan chargé — duplication**
- `ProtocolManager` apparaît dans **deux** onglets différents : "Validation → Gérer les protocoles" ET "Outils → Protocoles". Source de confusion.
- 3 onglets principaux × sous-onglets = 9 vues à mémoriser. L'utilisateur ne sait jamais où aller pour une tâche donnée.
- Onglet "Comparaison" toujours visible mais grisé hors mode comparaison → bruit.

**C. Barre patient — densité**
- 4 stats + protocole actif + badge mode = ligne dense, peu lisible. Pas de hiérarchie entre infos critiques (patient, dose max) et secondaires (nb sélectionnées).
- Bouton "Changer de plan" dans le header, déconnecté de la barre patient.

**D. Feedback & guidage**
- Aucun "next step" suggéré après chargement (ex : "Associez un protocole pour valider").
- Le protocole actif peut être désactivé via un "✕" minuscule et silencieux.
- `CriticalDoseAlerts` apparaît seulement si protocole + violations → l'utilisateur découvre les alertes sans contexte.

**E. État "outils sans plan"**
- Cliquer "Accès direct" conserve le WelcomeScreen visible au-dessus → mélange import + outils sur la même page. Soit on importe, soit on bricole un protocole. Les deux ensemble sont rares.

---

## 2. Plan d'amélioration (par ordre d'impact)

### Étape 1 — Alléger le WelcomeScreen
- Cartes "Comparer" et "Sommation" : remplacer le déploiement inline par un **Dialog modal** plein écran. La carte devient un simple CTA, la page reste courte.
- Zone d'import "Analyser un plan" : reste dépliée par défaut (cas dominant), mais carte agrandie et les 2 autres cartes réduites visuellement (icône + titre uniquement, sans description tant qu'on ne survole pas).
- "Accès direct" : transformer en menu discret en haut à droite (icône engrenage → popover avec les 4 outils) plutôt qu'une rangée de boutons sous les cartes.

### Étape 2 — Outils sans plan dans une page dédiée
- Cliquer "Protocoles / Convertisseur / Historique / Aide" depuis l'accueil ouvre une **vue plein écran** qui remplace le WelcomeScreen (avec un breadcrumb "← Retour à l'accueil"), au lieu de s'afficher en dessous.
- Bénéfice : focus, pas de scroll, pas de mélange import/outils.

### Étape 3 — Simplifier la navigation à plan chargé
- Passer de **3 onglets + 9 sous-onglets** à **3 onglets simples** :
  - **Analyse** (DVH + métriques + tableau structures + évaluation, scrollable) — fusionner les sous-onglets actuels en sections.
  - **Validation** (ProtocolValidation seul ; sélection du protocole se fait via le bouton "Protocole actif" de la barre patient ou un sélecteur en tête de l'onglet).
  - **Plus** (Outils : Convertisseur, Historique, Aide). Protocoles n'apparaît plus ici.
- Retirer l'onglet "Comparaison" : afficher les courbes comparées directement dans Analyse (badge "Mode comparaison" déjà en barre patient).

### Étape 4 — Barre patient hiérarchisée
- Ligne 1 (grande) : Patient + Dose max + bouton "Changer de plan".
- Ligne 2 (petite, muted) : Structures · Sélectionnées · Source (CSV/DICOM) · Protocole actif (cliquable → ouvre sélecteur).
- Le bouton "Changer de plan" quitte le header global et rejoint la barre patient pour cohérence contextuelle.

### Étape 5 — Guidage post-chargement
- Si plan chargé sans protocole actif : afficher un **bandeau d'action** discret en haut de l'onglet Analyse : "Associez un protocole pour voir les contraintes de dose sur vos courbes [Choisir un protocole]".
- Si protocole actif : remplacer le bandeau par un résumé "X structures matchent / Y contraintes évaluées".

### Étape 6 — Sélection du protocole unifiée
- Un seul point d'entrée : `ProtocolSelectorStep` (déjà existant) ouvert en Dialog depuis :
  - le bandeau de guidage,
  - le clic sur le badge "Protocole actif" en barre patient,
  - le bouton "Choisir un protocole" dans Validation.
- Supprimer les deux endroits où `ProtocolManager` est inséré dans les onglets.

---

## 3. Détails techniques d'implémentation

Fichiers principalement touchés :
- `src/pages/Index.tsx` — refonte de la structure de rendu (state `mainTab` réduit, suppression `analyzeSubTab`/`validationSubTab`/`toolsSubTab` dupliqués).
- `src/components/WelcomeScreen.tsx` (à extraire de `Index.tsx` — actuellement défini inline lignes 39-194).
- Nouveau `src/components/PatientBar.tsx` extrait des lignes 492-536 d'Index.tsx, avec hiérarchie 2 lignes.
- Nouveau `src/components/ProtocolPromptBanner.tsx` pour le guidage post-chargement.
- `MultiFileUpload` et `PlanSummationManager` enveloppés dans `Dialog` au lieu d'inline dans les cartes.
- Pour la "vue outils plein écran sans plan" : nouvel état `toolsView: 'protocols' | 'converter' | 'history' | 'help' | null`. Quand non-null et `!dvhData` → rendre uniquement la vue outil + bouton retour.

Aucune modification de schéma DB, de RLS ou d'edge function n'est nécessaire — purement front-end.

---

## 4. Ordre de livraison suggéré

1. Extraire `WelcomeScreen` et `PatientBar` dans leurs propres fichiers (refactor sans changement visuel).
2. Étape 4 (barre patient hiérarchisée) — gain visuel immédiat, faible risque.
3. Étape 3 (simplification navigation) — gros gain, suppression de duplications.
4. Étape 1 + 2 (modals + vue outils plein écran) — refonte WelcomeScreen.
5. Étape 5 + 6 (bandeau guidage + sélecteur unifié) — polish UX.

Chaque étape est indépendante et peut être validée séparément.
