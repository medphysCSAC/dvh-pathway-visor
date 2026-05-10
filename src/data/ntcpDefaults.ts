/**
 * ntcpDefaults.ts — Paramètres LKB et TCP par défaut
 *
 * Sources primaires :
 *   [QUANTEC 2010]  Semin Radiat Oncol 20(1 Suppl):S1-S301, 2010
 *   [Emami 1991]    Int J Radiat Oncol Biol Phys 21(1):109-122, 1991
 *   [Marks 2010]    Int J Radiat Oncol Biol Phys 76(3 Suppl):S70-76, 2010
 *   [Eisbruch 2010] Int J Radiat Oncol Biol Phys 76(3 Suppl):S77-83, 2010
 *   [Bhandare 2010] Int J Radiat Oncol Biol Phys 77(5):1308-17, 2010
 *   [RTOG 0933]     JAMA 2014;311(5):476-483
 *   [NRG CC001]     J Clin Oncol 2020;38(9):1019-1029
 *   [Deasy 2021]    Red Journal 109(5):1243-1251, 2021 — parotide IMRT
 *   [ESTRO ACROP cœur 2022] Radiother Oncol 2022;172:35-43
 *   [HyTEC 2021]    IJROBP 110(1) — SBRT
 *
 * AVERTISSEMENT CLINIQUE IMPORTANT :
 *   Ces paramètres ont été dérivés majoritairement sur des cohortes de radiothérapie
 *   3D conformationnelle et IMRT externe (non tomothérapie spécifiquement).
 *   Leur utilisation en valeur absolue sur des plans de tomothérapie doit être
 *   interprétée avec précaution. La comparaison ΔNTCP entre deux plans
 *   (plutôt que la valeur absolue) est l'usage cliniquement le plus robuste.
 *
 *   Certitude des paramètres individuels : voir champ `confidence` dans chaque entrée.
 */

import { LKBParameters, TCPParameters, OARCanonicalId, TumorHistologyId } from '@/types/ntcp';

// ─── Paramètres LKB par OAR ──────────────────────────────────────────────────

export const DEFAULT_LKB_PARAMETERS: Record<OARCanonicalId, LKBParameters> = {

  lung_total: {
    oarId: 'lung_total',
    organName: 'Poumons (total)',
    td50: 24.5,
    m: 0.37,
    n: 0.87,
    alphaBeta: 3.0,
    endpoint: 'Pneumonite grade ≥2',
    source: 'Graham 1999, validé QUANTEC 2010 [Marks]; données IMRT confirmées Rodrigues 2004',
    notes: 'Paramètre n élevé = organe quasi-parallèle. Valide pour V20 < 35%. ' +
           'Pour SBRT (dose/fx > 5 Gy), utiliser les rapports HyTEC 2021 plutôt que LKB.',
    confidence: 'high',
  },

  lung_ipsilateral: {
    oarId: 'lung_ipsilateral',
    organName: 'Poumon ipsilatéral',
    td50: 30.5,
    m: 0.37,
    n: 0.87,
    alphaBeta: 3.0,
    endpoint: 'Pneumonite grade ≥2 (poumon homolatéral)',
    source: 'Dérivé de Graham 1999 / QUANTEC 2010 — adapté poumon unique',
    notes: 'Utilisé principalement en irradiation sein/thorax unilatéral. ' +
           'Certitude modérée car la plupart des études publient Vdose sur poumons totaux.',
    confidence: 'moderate',
  },

  lung_contralateral: {
    oarId: 'lung_contralateral',
    organName: 'Poumon controlatéral',
    td50: 40.0,
    m: 0.37,
    n: 0.87,
    alphaBeta: 3.0,
    endpoint: 'Pneumonite controlatérale (rare)',
    source: 'Extrapolé — données primaires très limitées',
    notes: 'Paramètres à faible certitude. Dose moyenne controlatérale généralement < 5 Gy en tomothérapie sein.',
    confidence: 'low',
  },

  heart: {
    oarId: 'heart',
    organName: 'Cœur',
    td50: 48.0,
    m: 0.10,
    n: 0.35,
    alphaBeta: 3.0,
    endpoint: 'Péricardite symptomatique',
    source: 'QUANTEC 2010 [Gagliardi] — modèle péricardite',
    notes: '⚠ DONNÉES PARTIELLEMENT OBSOLÈTES pour sein. ' +
           'Les recommandations ESTRO ACROP 2022 (Breast) indiquent que même ' +
           'Dmean < 2-4 Gy augmente le risque cardiovasculaire à long terme (études ' +
           'Darby 2013 NEJM, RADCOMP 2022). Le modèle LKB classique ne capture ' +
           'pas le risque cardiovasculaire sub-clinique à faible dose. ' +
           'Interprétation clinique requise.',
    confidence: 'moderate',
  },

  parotid: {
    oarId: 'parotid',
    organName: 'Parotide (bilatérale moyenne)',
    td50: 39.0,
    m: 0.40,
    n: 1.0,
    alphaBeta: 3.0,
    endpoint: 'Xérostomie grade ≥2 (stimulée < 25% baseline)',
    source: 'Deasy 2021 (Red Journal) — cohorte IMRT 847 patients ORL ; ' +
           'mise à jour vs Eisbruch 2010 (TD50=28 Gy sur données 3D)',
    notes: 'TD50=39 Gy est la valeur IMRT validée (Deasy 2021). ' +
           'L\'ancienne valeur QUANTEC TD50=28 Gy était dérivée de données 3D conformationnelles ' +
           'et surestime le risque en IMRT/tomothérapie. ' +
           'n=1.0 : organe strictement parallèle (flux salivaire = somme des acinis).',
    confidence: 'high',
  },

  parotid_ipsilateral: {
    oarId: 'parotid_ipsilateral',
    organName: 'Parotide homolatérale',
    td50: 35.0,
    m: 0.40,
    n: 1.0,
    alphaBeta: 3.0,
    endpoint: 'Xérostomie grade ≥2 (côté irradié)',
    source: 'Dérivé Deasy 2021 — sous-cohorte parotide homolatérale',
    notes: 'Parotide homolatérale généralement plus irradiée → TD50 légèrement inférieur.',
    confidence: 'moderate',
  },

  parotid_contralateral: {
    oarId: 'parotid_contralateral',
    organName: 'Parotide controlatérale',
    td50: 39.0,
    m: 0.40,
    n: 1.0,
    alphaBeta: 3.0,
    endpoint: 'Xérostomie grade ≥2 (côté controlatéral)',
    source: 'Deasy 2021',
    notes: 'Épargne de la parotide controlatérale = objectif principal en ORL IMRT.',
    confidence: 'high',
  },

  submandibular: {
    oarId: 'submandibular',
    organName: 'Glandes sous-mandibulaires',
    td50: 39.0,
    m: 0.40,
    n: 1.0,
    alphaBeta: 3.0,
    endpoint: 'Xérostomie (contribution sous-mandibulaire)',
    source: 'Murdoch-Kinch 2008 (IJROBP) ; Saarilahti 2006 — données IMRT',
    notes: '⚠ Certitude modérée. Les sous-mandibulaires contribuent à ~70% de la salive ' +
           'au repos. Paramètres LKB extrapolés depuis modèles parotide — ' +
           'pas de données LKB dédiées validées sur grande cohorte. ' +
           'Épargne < 39 Gy Dmean recommandée (QUANTEC 2010).',
    confidence: 'moderate',
  },

  spinal_cord: {
    oarId: 'spinal_cord',
    organName: 'Moelle épinière',
    td50: 66.5,
    m: 0.175,
    n: 0.05,
    alphaBeta: 2.0,
    endpoint: 'Myélite radique grade ≥2 (Lhermitte persistant ou déficit moteur)',
    source: 'Emami 1991 — QUANTEC 2010 [Kirkpatrick] confirmé',
    notes: 'Organe en série pur (n très petit). TD50 pour volume partiel 5-10 cm. ' +
           'α/β = 2 Gy (tissu très tardif). Contrainte clinique habituelle Dmax < 45-50 Gy ' +
           '(conventionnel), < 13-14 Gy en SBRT dose unique (HyTEC 2021).',
    confidence: 'high',
  },

  brainstem: {
    oarId: 'brainstem',
    organName: 'Tronc cérébral',
    td50: 65.0,
    m: 0.14,
    n: 0.16,
    alphaBeta: 2.0,
    endpoint: 'Nécrose du tronc / déficit neurologique permanent',
    source: 'Emami 1991 — QUANTEC 2010 [Mayo]',
    notes: 'Organe en série partielle. Contrainte habituelle Dmax < 54 Gy (conventionnel). ' +
           'En SBRT : Dmax < 10 Gy (fraction unique). ' +
           'Les centres pédiatriques utilisent des contraintes plus strictes (Dmax < 50 Gy).',
    confidence: 'high',
  },

  rectum: {
    oarId: 'rectum',
    organName: 'Rectum',
    td50: 80.0,
    m: 0.14,
    n: 0.12,
    alphaBeta: 3.0,
    endpoint: 'Rectite sévère grade ≥3 (saignement / sténose)',
    source: 'Jackson 2010 (MSK) — QUANTEC 2010 [Michalski] ; validé cohorte IMRT prostate',
    notes: 'Paramètres pour irradiation prostate. n petit = effet volume modéré (structure semi-série). ' +
           'Les contraintes DVH de référence (V50<50%, V60<35%, V65<25%, V70<20%, V75<15%) ' +
           'correspondent à NTCP < 15-20% pour rectite grade ≥3.',
    confidence: 'high',
  },

  bladder: {
    oarId: 'bladder',
    organName: 'Vessie',
    td50: 80.0,
    m: 0.11,
    n: 0.50,
    alphaBeta: 5.0,
    endpoint: 'Cystite sévère grade ≥3',
    source: 'Emami 1991 — QUANTEC 2010 [Viswanathan]',
    notes: 'n=0.5 : structure intermédiaire entre série et parallèle. ' +
           'α/β vessie = 5 Gy (certitude modérée — certaines études suggèrent 3-6 Gy). ' +
           'TD50 très élevé : complications vésicales sévères rares en pratique moderne.',
    confidence: 'moderate',
  },

  esophagus: {
    oarId: 'esophagus',
    organName: 'Œsophage',
    td50: 68.0,
    m: 0.11,
    n: 0.22,
    alphaBeta: 6.0,
    endpoint: 'Œsophagite grade ≥3 (sténose / perforation)',
    source: 'Werner-Wasik 2010 — QUANTEC 2010 [Werner-Wasik]',
    notes: '⚠ α/β œsophage = 6 Gy (tissu à renouvellement relativement rapide). ' +
           'Certitude modérée sur ce paramètre (données issues majoritairement de cancer ' +
           'bronchopulmonaire). Contrainte recommandée : Dmean < 34 Gy, V35 < 50%.',
    confidence: 'moderate',
  },

  liver: {
    oarId: 'liver',
    organName: 'Foie',
    td50: 45.0,
    m: 0.38,
    n: 0.97,
    alphaBeta: 2.5,
    endpoint: 'RILD (Radiation-Induced Liver Disease) grade ≥3',
    source: 'Dawson 2002 (IJROBP) — QUANTEC 2010 [Pan] — cohorte hépatique primaire/méta',
    notes: 'n élevé = organe quasi-parallèle (cellules hépatiques fonctionnent indépendamment). ' +
           'TD50 pour foie sain (non cirrhotique). Pour foie cirrhotique Child B/C, ' +
           'les marges de tolérance sont significativement réduites — ce modèle ' +
           'ne s\'applique PAS sans correction.',
    confidence: 'moderate',
  },

  kidney: {
    oarId: 'kidney',
    organName: 'Rein (bilatéral)',
    td50: 28.0,
    m: 0.10,
    n: 0.70,
    alphaBeta: 2.5,
    endpoint: 'Néphropathie radique grade ≥3',
    source: 'Cassady 1987 — QUANTEC 2010 [Kavanagh]',
    notes: 'n=0.7 : organe parallèle (néphrons fonctionnent indépendamment). ' +
           'TD50=28 Gy pour les deux reins. Si un rein est exclu (chirurgie), ' +
           'les paramètres du rein restant sont différents. ' +
           'Contrainte : Dmean rein fonctionnel < 18 Gy.',
    confidence: 'moderate',
  },

  femoral_head: {
    oarId: 'femoral_head',
    organName: 'Têtes fémorales',
    td50: 65.0,
    m: 0.12,
    n: 0.25,
    alphaBeta: 2.0,
    endpoint: 'Nécrose avasculaire grade ≥3',
    source: 'Emami 1991 — QUANTEC 2010 [Kavanagh]',
    notes: 'Contrainte clinique usuelle : Dmax < 50 Gy. Nécrose avasculaire ' +
           'rare < 55 Gy mais significativement augmentée en combinaison ' +
           'avec corticothérapie ou chimiothérapie.',
    confidence: 'moderate',
  },

  cochlea: {
    oarId: 'cochlea',
    organName: 'Cochlée',
    td50: 45.0,
    m: 0.31,
    n: 0.25,
    alphaBeta: 3.0,
    endpoint: 'Ototoxicité grade ≥2 (perte auditive > 10 dB à 4 kHz)',
    source: 'Bhandare 2010 (IJROBP) — confirmé données NRG/RTOG ORL 2020-2023',
    notes: 'TD50 = 45 Gy pour Dmean cochlée. ' +
           'Les données RTOG récentes confirment Dmean < 45 Gy comme seuil de référence. ' +
           'Risque synergique avec cisplatine (ototoxicité chimio-radique majorée — ' +
           'ce modèle ne tient PAS compte de la chimiosensibilisation).',
    confidence: 'high',
  },

  larynx: {
    oarId: 'larynx',
    organName: 'Larynx',
    td50: 70.0,
    m: 0.18,
    n: 0.30,
    alphaBeta: 3.0,
    endpoint: 'Laryngite chronique / œdème glottique grade ≥3',
    source: 'Emami 1991 — Marks 2010',
    notes: 'Paramètres de certitude faible à modérée (peu de données IMRT publiées). ' +
           'Contrainte recommandée : Dmean < 44 Gy (QUANTEC). ' +
           'Pour conservation laryngée, des objectifs plus stricts sont souvent utilisés.',
    confidence: 'moderate',
  },

  brachial_plexus: {
    oarId: 'brachial_plexus',
    organName: 'Plexus brachial',
    td50: 75.0,
    m: 0.16,
    n: 0.10,
    alphaBeta: 2.0,
    endpoint: 'Plexopathie brachiale grade ≥2 (motrice)',
    source: 'Marks 2010 (IJROBP) — données limitées ; Sillani 2017 — IMRT apex',
    notes: '⚠ Certitude faible — peu d\'études publient des paramètres LKB formels ' +
           'pour le plexus. Valeurs dérivées principalement de données rétrospectives ' +
           'sur irradiation apex pulmonaire et creux axillaire. ' +
           'Dmax < 60 Gy recommandé (conventionnel).',
    confidence: 'low',
  },

  hippocampus: {
    oarId: 'hippocampus',
    organName: 'Hippocampes',
    td50: 30.0,
    m: 0.50,
    n: 0.90,
    alphaBeta: 2.0,
    endpoint: 'Déclin neurocognitif (mémoire immédiate HVLT-R > 1 écart-type)',
    source: 'RTOG 0933 (2014) — NRG CC001 (J Clin Oncol 2020) — Monje 2018',
    notes: 'Paramètres LKB adaptés depuis données RTOG 0933 (protection hippocampique). ' +
           'Contrainte de référence : Dmax < 16 Gy, D100% < 9 Gy (NRG CC001). ' +
           'Ces paramètres sont spécifiques à l\'irradiation cérébrale totale (WBRT) — ' +
           'applicabilité aux autres localisations non validée.',
    confidence: 'moderate',
  },

  lens: {
    oarId: 'lens',
    organName: 'Cristallin',
    td50: 18.0,
    m: 0.27,
    n: 0.18,
    alphaBeta: 1.2,
    endpoint: 'Cataracte opacifiante (grade ≥2)',
    source: 'Emami 1991 — QUANTEC 2010 [Vilar-Palop 2017 pour IMRT]',
    notes: 'TD50=18 Gy pour cataracte opacifiante nécessitant chirurgie. ' +
           'α/β cristallin = 1.2 Gy (tissu très tardif, à renouvellement très lent). ' +
           'Les recommandations actuelles visent Dmax < 5-10 Gy en prévention. ' +
           'Risque additif avec UV et facteurs métaboliques.',
    confidence: 'moderate',
  },

  optic_nerve: {
    oarId: 'optic_nerve',
    organName: 'Nerf optique',
    td50: 65.0,
    m: 0.14,
    n: 0.25,
    alphaBeta: 2.0,
    endpoint: 'Neuropathie optique radique',
    source: 'Emami 1991 — Parsons 1994',
    notes: 'Structure en série. Contrainte : Dmax < 54 Gy (conventionnel). ' +
           'En SBRT dose unique : Dmax < 10 Gy (HyTEC 2021).',
    confidence: 'moderate',
  },

  chiasm: {
    oarId: 'chiasm',
    organName: 'Chiasma optique',
    td50: 65.0,
    m: 0.14,
    n: 0.25,
    alphaBeta: 2.0,
    endpoint: 'Neuropathie chiasmatique (déficit champ visuel)',
    source: 'Emami 1991 — QUANTEC 2010 [Mayo]',
    notes: 'Paramètres identiques au nerf optique par défaut. ' +
           'Dmax < 54 Gy recommandé. Risque accru si tumeur adjacente.',
    confidence: 'moderate',
  },

  mandible: {
    oarId: 'mandible',
    organName: 'Mandibule',
    td50: 72.0,
    m: 0.16,
    n: 0.12,
    alphaBeta: 2.0,
    endpoint: 'Ostéoradionécrose mandibulaire grade ≥3',
    source: 'Emami 1991 — Tsai 2013 (IMRT ORL)',
    notes: '⚠ Certitude modérée. La dose à la mandibule est fortement influencée ' +
           'par la chimiothérapie concomitante et la santé dentaire pré-traitement. ' +
           'Dmax < 70 Gy généralement recommandé. ' +
           'Ce modèle ne capture pas le risque lié aux soins dentaires post-RT.',
    confidence: 'moderate',
  },

  small_bowel: {
    oarId: 'small_bowel',
    organName: 'Intestin grêle',
    td50: 55.0,
    m: 0.16,
    n: 0.15,
    alphaBeta: 6.0,
    endpoint: 'Obstruction / perforation intestinale grade ≥3',
    source: 'Emami 1991 — QUANTEC 2010 [Kavanagh] — HyTEC 2021 pour SBRT',
    notes: '⚠ Paramètres variables selon définition du volume. ' +
           'α/β = 6 Gy (tissu à renouvellement rapide). ' +
           'QUANTEC recommande V45 < 195 cc (intestin grêle individuel) ' +
           'ou V15 < 120 cc (anse libre) pour toxicité grade ≥3 < 10%. ' +
           'En SBRT abdominal, les contraintes sont strictement différentes (HyTEC 2021).',
    confidence: 'moderate',
  },
};

// ─── Paramètres TCP par histologie ───────────────────────────────────────────

export const DEFAULT_TCP_PARAMETERS: Record<TumorHistologyId, TCPParameters> = {

  prostate_adenocarcinoma: {
    histologyId: 'prostate_adenocarcinoma',
    histologyName: 'Adénocarcinome de prostate',
    tcd50: 72.0,
    gamma50: 2.0,
    a: -10,
    alphaBeta: 1.5,
    fractionSize: 2.0,
    source: 'Brenner & Hall 1999 ; Stocks 2020 (meta-analyse) ; ' +
            'Sanchez-Nieto 1999 (données historiques)',
    notes: '⚠ α/β prostate = 1.5 Gy (certitude modérée — débat actuel entre 1.1 et 3 Gy). ' +
           'La valeur 1.5 Gy est un consensus approximatif des études de fractionnement ' +
           '(ASCENDE-RT, CHHiP, PROFIT). TCP absolue ne doit pas être interprétée seule — ' +
           'comparer ΔTCP entre plans uniquement.',
    confidence: 'moderate',
  },

  head_neck_scc: {
    histologyId: 'head_neck_scc',
    histologyName: 'Carcinome épidermoïde ORL',
    tcd50: 60.0,
    gamma50: 1.8,
    a: -12,
    alphaBeta: 10.0,
    fractionSize: 2.0,
    source: 'Niemierko 1997 ; Plataniotis & Dale 2019 (Radiother Oncol) ; ' +
            'DAHANCA 6&7 modèles',
    notes: 'α/β = 10 Gy (tumeur à prolifération rapide — certitude élevée). ' +
           'TCD50 varie selon stade T/N et site (oro-pharynx HPV+ vs HPV- très différents). ' +
           'TCD50 = 60 Gy est une valeur centrale — HPV+ ~ 55 Gy, HPV- ~ 65-70 Gy ' +
           '(données émergentes, certitude modérée).',
    confidence: 'moderate',
  },

  breast_adenocarcinoma: {
    histologyId: 'breast_adenocarcinoma',
    histologyName: 'Adénocarcinome du sein',
    tcd50: 48.0,
    gamma50: 1.5,
    a: -10,
    alphaBeta: 4.0,
    fractionSize: 2.0,
    source: 'START Trialists 2008 & 2013 — modèles TCP dérivés ; ' +
            'Haviland 2013 — données fractionnement',
    notes: 'α/β = 4 Gy (sein) — certitude modérée à élevée (START A/B). ' +
           'TCD50 extrêmement variable selon stade, sous-type moléculaire (Luminal A vs HER2+), ' +
           'et utilisation de chimiothérapie adjuvante. ' +
           'Cette valeur est indicative uniquement.',
    confidence: 'low',
  },

  nsclc: {
    histologyId: 'nsclc',
    histologyName: 'Carcinome broncho-pulmonaire non à petites cellules',
    tcd50: 84.5,
    gamma50: 1.5,
    a: -10,
    alphaBeta: 10.0,
    fractionSize: 2.0,
    source: 'RTOG 0617 modèle (Bradley 2015) ; Martel 1994 ; ' +
            'Kong 2005 — dose-réponse CBNPC',
    notes: 'TCD50 très élevé reflète la résistance intrinsèque du CBNPC. ' +
           'α/β = 10 Gy pour la tumeur (prolifération rapide). ' +
           'TCP en SBRT (SBRT stade I) utilise des modèles différents non représentés ici — ' +
           'ce paramètre s\'applique à l\'irradiation conventionnelle/IMRT stade III.',
    confidence: 'low',
  },

  medulloblastoma: {
    histologyId: 'medulloblastoma',
    histologyName: 'Médulloblastome',
    tcd50: 45.0,
    gamma50: 1.8,
    a: -10,
    alphaBeta: 8.0,
    fractionSize: 1.8,
    source: 'Données pédiatriques limitées — Jalali 2010 ; PNET collaborative models',
    notes: '⚠ Certitude faible — données pédiatriques très limitées pour la modélisation TCP. ' +
           'Ces paramètres sont extrapolés. α/β = 8 Gy (estimation). ' +
           'Ne pas utiliser en dehors d\'une analyse comparative exploratoire.',
    confidence: 'low',
  },

  glioblastoma: {
    histologyId: 'glioblastoma',
    histologyName: 'Glioblastome (GBM)',
    tcd50: 100.0,
    gamma50: 1.2,
    a: -8,
    alphaBeta: 8.0,
    fractionSize: 2.0,
    source: 'Stupp 2005 (NEJM) données modélisation ; Walker 1979 — dose-réponse historique',
    notes: '⚠ Certitude très faible. TCD50 > 100 Gy reflète l\'impossibilité pratique ' +
           'd\'atteindre le contrôle tumoral avec la radiothérapie seule en GBM. ' +
           'La TCP calculée sera toujours très basse — usage uniquement comparatif.',
    confidence: 'low',
  },

  cervix_squamous: {
    histologyId: 'cervix_squamous',
    histologyName: 'Carcinome épidermoïde du col utérin',
    tcd50: 65.0,
    gamma50: 2.0,
    a: -12,
    alphaBeta: 10.0,
    fractionSize: 2.0,
    source: 'Eifel 1992 ; EMBRACE study modèles — données IGRT cervix',
    notes: 'TCD50 intègre la radiothérapie externe + curiethérapie dans les données source. ' +
           'En irradiation externe seule (sans curiethérapie), ces paramètres ne s\'appliquent ' +
           'pas directement. α/β = 10 Gy (carcinome épidermoïde).',
    confidence: 'moderate',
  },

  rectal_adenocarcinoma: {
    histologyId: 'rectal_adenocarcinoma',
    histologyName: 'Adénocarcinome du rectum',
    tcd50: 55.0,
    gamma50: 1.5,
    a: -10,
    alphaBeta: 4.0,
    fractionSize: 2.0,
    source: 'Minsky 1996 ; données Dutch TME Trial — modélisation rétrospective',
    notes: '⚠ En radiothérapie rectale, la chirurgie reste le traitement principal — ' +
           'TCP calculée sur radiothérapie seule sans chirurgie doit être interprétée ' +
           'avec grande précaution. α/β = 4 Gy pour adénocarcinome colorectal (certitude modérée).',
    confidence: 'low',
  },
};

// ─── Seuils cliniques de référence NTCP ──────────────────────────────────────

/**
 * Seuils au-delà desquels le NTCP est considéré comme cliniquement significatif.
 * Basés sur les objectifs de planification de QUANTEC 2010 et les guidelines ESTRO.
 */
export const NTCP_CLINICAL_THRESHOLDS: Partial<Record<OARCanonicalId, number>> = {
  lung_total:           20,  // % — QUANTEC recommande NTCP pneumonite < 20%
  heart:                15,  // % — recommandation QUANTEC / ESTRO ACROP 2022
  parotid:              20,  // % — xérostomie grade ≥2 < 20% objectif courant
  parotid_ipsilateral:  30,  // % — tolérance plus haute ipsilatérale
  parotid_contralateral: 20, // %
  submandibular:        20,  // %
  spinal_cord:           5,  // % — organe critique en série
  brainstem:             5,  // %
  rectum:               15,  // % — grade ≥3
  bladder:              10,  // %
  esophagus:            20,  // %
  cochlea:              20,  // %
  hippocampus:          10,  // %
  optic_nerve:           5,  // %
  chiasm:                5,  // %
  brachial_plexus:       5,  // %
};
