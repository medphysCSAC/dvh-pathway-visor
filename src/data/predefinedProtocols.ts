import { TreatmentProtocol } from '@/types/protocol';

/**
 * Protocoles de radiothérapie prédéfinis
 * Basés sur les recommandations QUANTEC, RTOG et pratiques cliniques standards
 */

export const predefinedProtocols: TreatmentProtocol[] = [
  // ====================================
  // SEIN GAUCHE
  // ====================================
  {
    id: 'breast-left',
    name: 'Sein Gauche',
    location: 'Sein gauche',
    prescriptions: [
      {
        ptvName: 'PTV_Sein',
        totalDose: 45,
        numberOfFractions: 25,
        dosePerFraction: 1.8
      },
      {
        ptvName: 'PTV_Boost',
        totalDose: 15,
        numberOfFractions: 8,
        dosePerFraction: 1.875
      }
    ],
    oarConstraints: [
      // Cœur
      {
        organName: 'Coeur',
        constraintType: 'Dmean',
        value: 5,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dose moyenne au cœur < 5 Gy (QUANTEC)'
      },
      {
        organName: 'Coeur',
        constraintType: 'Vx',
        value: 10,
        target: 25,
        unit: '%',
        priority: 'optimal',
        description: 'V25Gy < 10% du volume cardiaque'
      },
      // Poumon gauche
      {
        organName: 'Poumon_G',
        constraintType: 'Vx',
        value: 15,
        target: 20,
        unit: '%',
        priority: 'mandatory',
        description: 'V20Gy < 15% du poumon gauche'
      },
      {
        organName: 'Poumon_G',
        constraintType: 'Dmean',
        value: 15,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dose moyenne poumon gauche < 15 Gy'
      },
      // Poumon droit
      {
        organName: 'Poumon_D',
        constraintType: 'Dmean',
        value: 5,
        unit: 'Gy',
        priority: 'desirable',
        description: 'Dose moyenne poumon droit < 5 Gy'
      },
      // Moelle épinière
      {
        organName: 'Moelle',
        constraintType: 'Dmax',
        value: 45,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax moelle < 45 Gy'
      }
    ],
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    isCustom: false
  },

  // ====================================
  // PROSTATE
  // ====================================
  {
    id: 'prostate',
    name: 'Prostate',
    location: 'Prostate',
    prescriptions: [
      {
        ptvName: 'PTV_Prostate',
        totalDose: 78,
        numberOfFractions: 39,
        dosePerFraction: 2
      }
    ],
    oarConstraints: [
      // Rectum
      {
        organName: 'Rectum',
        constraintType: 'Vx',
        value: 15,
        target: 70,
        unit: '%',
        priority: 'mandatory',
        description: 'V70Gy < 15% du rectum (QUANTEC)'
      },
      {
        organName: 'Rectum',
        constraintType: 'Vx',
        value: 25,
        target: 65,
        unit: '%',
        priority: 'optimal',
        description: 'V65Gy < 25% du rectum'
      },
      {
        organName: 'Rectum',
        constraintType: 'Vx',
        value: 50,
        target: 50,
        unit: '%',
        priority: 'optimal',
        description: 'V50Gy < 50% du rectum'
      },
      // Vessie
      {
        organName: 'Vessie',
        constraintType: 'Vx',
        value: 25,
        target: 70,
        unit: '%',
        priority: 'mandatory',
        description: 'V70Gy < 25% de la vessie'
      },
      {
        organName: 'Vessie',
        constraintType: 'Vx',
        value: 50,
        target: 65,
        unit: '%',
        priority: 'optimal',
        description: 'V65Gy < 50% de la vessie'
      },
      // Têtes fémorales
      {
        organName: 'Tete_Femorale_D',
        constraintType: 'Vx',
        value: 5,
        target: 50,
        unit: '%',
        priority: 'mandatory',
        description: 'V50Gy < 5% de la tête fémorale droite'
      },
      {
        organName: 'Tete_Femorale_G',
        constraintType: 'Vx',
        value: 5,
        target: 50,
        unit: '%',
        priority: 'mandatory',
        description: 'V50Gy < 5% de la tête fémorale gauche'
      },
      // Bulbe pénien
      {
        organName: 'Bulbe',
        constraintType: 'Dmean',
        value: 52.5,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dose moyenne bulbe < 52.5 Gy (fonction érectile)'
      }
    ],
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    isCustom: false
  },

  // ====================================
  // ENCÉPHALE (Métastases)
  // ====================================
  {
    id: 'brain-metastases',
    name: 'Encéphale - Métastases',
    location: 'Encéphale',
    prescriptions: [
      {
        ptvName: 'PTV_Cerveau',
        totalDose: 30,
        numberOfFractions: 10,
        dosePerFraction: 3
      }
    ],
    oarConstraints: [
      // Tronc cérébral
      {
        organName: 'Tronc_Cerebral',
        constraintType: 'Dmax',
        value: 54,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax tronc cérébral < 54 Gy'
      },
      // Chiasma optique
      {
        organName: 'Chiasma',
        constraintType: 'Dmax',
        value: 55,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax chiasma < 55 Gy'
      },
      // Nerfs optiques
      {
        organName: 'Nerf_Optique_D',
        constraintType: 'Dmax',
        value: 55,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax nerf optique droit < 55 Gy'
      },
      {
        organName: 'Nerf_Optique_G',
        constraintType: 'Dmax',
        value: 55,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax nerf optique gauche < 55 Gy'
      },
      // Cristallins
      {
        organName: 'Cristallin_D',
        constraintType: 'Dmax',
        value: 25,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dmax cristallin droit < 25 Gy'
      },
      {
        organName: 'Cristallin_G',
        constraintType: 'Dmax',
        value: 25,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dmax cristallin gauche < 25 Gy'
      },
      // Hippocampes (préservation cognitive)
      {
        organName: 'Hippocampe_D',
        constraintType: 'Dmax',
        value: 16,
        unit: 'Gy',
        priority: 'desirable',
        description: 'Dmax hippocampe droit < 16 Gy (préservation cognitive)'
      },
      {
        organName: 'Hippocampe_G',
        constraintType: 'Dmax',
        value: 16,
        unit: 'Gy',
        priority: 'desirable',
        description: 'Dmax hippocampe gauche < 16 Gy (préservation cognitive)'
      }
    ],
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    isCustom: false
  },

  // ====================================
  // MÉDULLOBLASTOME
  // ====================================
  {
    id: 'medulloblastoma',
    name: 'Médulloblastome',
    location: 'Fosse postérieure',
    prescriptions: [
      {
        ptvName: 'PTV_Neuroaxe',
        totalDose: 23.4,
        numberOfFractions: 13,
        dosePerFraction: 1.8
      },
      {
        ptvName: 'PTV_Fosse_Post',
        totalDose: 54,
        numberOfFractions: 30,
        dosePerFraction: 1.8
      }
    ],
    oarConstraints: [
      // Cochlées
      {
        organName: 'Cochlee_D',
        constraintType: 'Dmean',
        value: 45,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dose moyenne cochlée droite < 45 Gy (audition)'
      },
      {
        organName: 'Cochlee_G',
        constraintType: 'Dmean',
        value: 45,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dose moyenne cochlée gauche < 45 Gy (audition)'
      },
      // Cristallins
      {
        organName: 'Cristallin_D',
        constraintType: 'Dmax',
        value: 10,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dmax cristallin droit < 10 Gy'
      },
      {
        organName: 'Cristallin_G',
        constraintType: 'Dmax',
        value: 10,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dmax cristallin gauche < 10 Gy'
      },
      // Hypophyse
      {
        organName: 'Hypophyse',
        constraintType: 'Dmean',
        value: 45,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dose moyenne hypophyse < 45 Gy (fonction endocrinienne)'
      }
    ],
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    isCustom: false
  },

  // ====================================
  // CAVUM (Nasopharynx)
  // ====================================
  {
    id: 'nasopharynx',
    name: 'Cavum (Nasopharynx)',
    location: 'Nasopharynx',
    prescriptions: [
      {
        ptvName: 'PTV_70',
        totalDose: 70,
        numberOfFractions: 33,
        dosePerFraction: 2.12
      },
      {
        ptvName: 'PTV_60',
        totalDose: 60,
        numberOfFractions: 33,
        dosePerFraction: 1.82
      }
    ],
    oarConstraints: [
      // Tronc cérébral
      {
        organName: 'Tronc_Cerebral',
        constraintType: 'Dmax',
        value: 54,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax tronc cérébral < 54 Gy'
      },
      // Moelle épinière
      {
        organName: 'Moelle',
        constraintType: 'Dmax',
        value: 45,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax moelle < 45 Gy'
      },
      // Chiasma
      {
        organName: 'Chiasma',
        constraintType: 'Dmax',
        value: 54,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax chiasma < 54 Gy'
      },
      // Parotides
      {
        organName: 'Parotide_D',
        constraintType: 'Dmean',
        value: 26,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dose moyenne parotide droite < 26 Gy (xérostomie)'
      },
      {
        organName: 'Parotide_G',
        constraintType: 'Dmean',
        value: 26,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dose moyenne parotide gauche < 26 Gy (xérostomie)'
      },
      // Mandibule
      {
        organName: 'Mandibule',
        constraintType: 'Dmax',
        value: 70,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dmax mandibule < 70 Gy (ostéoradionécrose)'
      },
      // Cochlées
      {
        organName: 'Cochlee_D',
        constraintType: 'Dmean',
        value: 45,
        unit: 'Gy',
        priority: 'desirable',
        description: 'Dose moyenne cochlée droite < 45 Gy'
      },
      {
        organName: 'Cochlee_G',
        constraintType: 'Dmean',
        value: 45,
        unit: 'Gy',
        priority: 'desirable',
        description: 'Dose moyenne cochlée gauche < 45 Gy'
      }
    ],
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    isCustom: false
  },

  // ====================================
  // POUMON (SBRT)
  // ====================================
  {
    id: 'lung-sbrt',
    name: 'Poumon SBRT',
    location: 'Poumon',
    prescriptions: [
      {
        ptvName: 'PTV_Tumeur',
        totalDose: 60,
        numberOfFractions: 8,
        dosePerFraction: 7.5
      }
    ],
    oarConstraints: [
      // Poumon total - 2 poumons
      {
        organName: 'Poumons',
        constraintType: 'Vx',
        value: 15,
        target: 20,
        unit: '%',
        priority: 'mandatory',
        description: 'V20Gy < 15% des deux poumons (pneumopathie)'
      },
      {
        organName: 'Poumons',
        constraintType: 'Dmean',
        value: 13,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dose moyenne deux poumons < 13 Gy'
      },
      // Moelle épinière
      {
        organName: 'Moelle',
        constraintType: 'Dmax',
        value: 30,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax moelle < 30 Gy (SBRT)'
      },
      // Cœur
      {
        organName: 'Coeur',
        constraintType: 'Dmax',
        value: 38,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax cœur < 38 Gy'
      },
      {
        organName: 'Coeur',
        constraintType: 'Dmean',
        value: 16,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dose moyenne cœur < 16 Gy'
      },
      // Œsophage
      {
        organName: 'Oesophage',
        constraintType: 'Dmax',
        value: 35,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax œsophage < 35 Gy'
      },
      // Plexus brachial
      {
        organName: 'Plexus_Brachial',
        constraintType: 'Dmax',
        value: 32,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax plexus brachial < 32 Gy (neuropathie)'
      },
      // Paroi thoracique
      {
        organName: 'Paroi_Thoracique',
        constraintType: 'Vx',
        value: 30,
        target: 30,
        unit: '%',
        priority: 'optimal',
        description: 'V30Gy < 30 cc de la paroi thoracique (douleur)'
      }
    ],
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    isCustom: false
  },

  // ====================================
  // SEIN DROIT BOOST CMI SC
  // ====================================
  {
    id: 'breast-right-boost-45-50-66',
    name: 'Sein Droit Boost CMI SC (45-50-66Gy/25-33fx)',
    location: 'Sein droit',
    prescriptions: [
      {
        ptvName: 'PTV_Sein',
        totalDose: 45,
        numberOfFractions: 25,
        dosePerFraction: 1.8
      },
      {
        ptvName: 'PTV_Boost_CMI',
        totalDose: 50,
        numberOfFractions: 28,
        dosePerFraction: 1.79
      },
      {
        ptvName: 'PTV_Boost_SC',
        totalDose: 66,
        numberOfFractions: 33,
        dosePerFraction: 2
      }
    ],
    oarConstraints: [
      // Cœur
      {
        organName: 'Coeur',
        constraintType: 'Dmean',
        value: 5,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dose moyenne au cœur < 5 Gy'
      },
      {
        organName: 'Coeur',
        constraintType: 'Vx',
        value: 10,
        target: 25,
        unit: '%',
        priority: 'optimal',
        description: 'V25Gy < 10% du volume cardiaque'
      },
      // Poumon droit
      {
        organName: 'Poumon_D',
        constraintType: 'Vx',
        value: 15,
        target: 20,
        unit: '%',
        priority: 'mandatory',
        description: 'V20Gy < 15% du poumon droit'
      },
      {
        organName: 'Poumon_D',
        constraintType: 'Dmean',
        value: 15,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dose moyenne poumon droit < 15 Gy'
      },
      // Poumon gauche
      {
        organName: 'Poumon_G',
        constraintType: 'Dmean',
        value: 5,
        unit: 'Gy',
        priority: 'desirable',
        description: 'Dose moyenne poumon gauche < 5 Gy'
      },
      // Moelle épinière
      {
        organName: 'Moelle',
        constraintType: 'Dmax',
        value: 45,
        unit: 'Gy',
        priority: 'mandatory',
        description: 'Dmax moelle < 45 Gy'
      }
    ],
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    isCustom: false
  },

  // ====================================
  // RECTUM
  // ====================================
  {
    id: 'rectum-45-50',
    name: 'Rectum (45-50Gy/25fx)',
    location: 'Rectum',
    prescriptions: [
      {
        ptvName: 'PTV_Pelvis',
        totalDose: 45,
        numberOfFractions: 25,
        dosePerFraction: 1.8
      },
      {
        ptvName: 'PTV_Rectum',
        totalDose: 50,
        numberOfFractions: 25,
        dosePerFraction: 2
      }
    ],
    oarConstraints: [
      // Intestin grêle
      {
        organName: 'Intestin_Grele',
        constraintType: 'Vx',
        value: 195,
        target: 15,
        unit: 'cc',
        priority: 'mandatory',
        description: 'V15Gy < 195 cc (diarrhée aiguë)'
      },
      {
        organName: 'Intestin_Grele',
        constraintType: 'Vx',
        value: 120,
        target: 45,
        unit: 'cc',
        priority: 'mandatory',
        description: 'V45Gy < 120 cc (toxicité sévère)'
      },
      // Vessie
      {
        organName: 'Vessie',
        constraintType: 'Vx',
        value: 50,
        target: 50,
        unit: '%',
        priority: 'optimal',
        description: 'V50Gy < 50% de la vessie'
      },
      {
        organName: 'Vessie',
        constraintType: 'Dmean',
        value: 45,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dose moyenne vessie < 45 Gy'
      },
      // Têtes fémorales
      {
        organName: 'Tete_Femorale_D',
        constraintType: 'Vx',
        value: 5,
        target: 50,
        unit: '%',
        priority: 'mandatory',
        description: 'V50Gy < 5% de la tête fémorale droite'
      },
      {
        organName: 'Tete_Femorale_G',
        constraintType: 'Vx',
        value: 5,
        target: 50,
        unit: '%',
        priority: 'mandatory',
        description: 'V50Gy < 5% de la tête fémorale gauche'
      },
      // Canal anal
      {
        organName: 'Canal_Anal',
        constraintType: 'Dmax',
        value: 55,
        unit: 'Gy',
        priority: 'optimal',
        description: 'Dmax canal anal < 55 Gy'
      }
    ],
    createdAt: new Date('2024-01-01'),
    modifiedAt: new Date('2024-01-01'),
    isCustom: false
  },
  {
    id: 'prostate-chhip-44-60-20fx',
    name: 'Prostate CHHiP (44-57.6-60Gy/20fx)',
    location: 'Prostate',
    prescriptions: [
      { ptvName: 'PTV1', totalDose: 60.00, numberOfFractions: 20, dosePerFraction: 3.00 },
      { ptvName: 'PTV2', totalDose: 57.60, numberOfFractions: 20, dosePerFraction: 2.88 },
      { ptvName: 'PTV3', totalDose: 44.00, numberOfFractions: 20, dosePerFraction: 2.20 },
    ],
    oarConstraints: [
      { organName: 'Bulbe pénien', constraintType: 'Vx', target: 44, value: 90, unit: '%', priority: 'desirable' },
      { organName: 'Bulbe pénien', constraintType: 'Vx', target: 60, value: 70, unit: '%', priority: 'desirable' },
      { organName: 'Rectum', constraintType: 'Vx', target: 40.8, value: 60, unit: '%', priority: 'mandatory' },
      { organName: 'Rectum', constraintType: 'Vx', target: 48.6, value: 50, unit: '%', priority: 'mandatory' },
      { organName: 'Rectum', constraintType: 'Vx', target: 57, value: 15, unit: '%', priority: 'mandatory' },
      { organName: 'Rectum', constraintType: 'Vx', target: 60, value: 3, unit: '%', priority: 'mandatory' },
      { organName: 'Vessie', constraintType: 'Vx', target: 40.8, value: 50, unit: '%', priority: 'desirable' },
      { organName: 'Vessie', constraintType: 'Vx', target: 48.6, value: 25, unit: '%', priority: 'desirable' },
    ],
    createdAt: new Date(),
    modifiedAt: new Date(),
    isCustom: false
  },
  {
    id: 'prostate-54-66-76-38fx',
    name: 'Prostate (54-66-76Gy/38fx)',
    location: 'Prostate',
    prescriptions: [
      { ptvName: 'PTV T', totalDose: 76.00, numberOfFractions: 38, dosePerFraction: 2.00 },
      { ptvName: 'PTV VS', totalDose: 66.00, numberOfFractions: 38, dosePerFraction: 1.74 },
      { ptvName: 'PTV N', totalDose: 54.00, numberOfFractions: 38, dosePerFraction: 1.42 },
    ],
    oarConstraints: [
      { organName: 'Rectum', constraintType: 'Vx', target: 50, value: 50, unit: '%', priority: 'mandatory' },
      { organName: 'Rectum', constraintType: 'Vx', target: 60, value: 35, unit: '%', priority: 'mandatory' },
      { organName: 'Rectum', constraintType: 'Vx', target: 70, value: 20, unit: '%', priority: 'mandatory' },
      { organName: 'Vessie', constraintType: 'Vx', target: 50, value: 70, unit: '%', priority: 'desirable' },
      { organName: 'Vessie', constraintType: 'Vx', target: 60, value: 50, unit: '%', priority: 'desirable' },
    ],
    createdAt: new Date(),
    modifiedAt: new Date(),
    isCustom: false
  },
  {
    id: 'endometre-45-50-25fx-v2',
    name: 'Endomètre (45-50Gy/25fx) v2',
    location: 'Endomètre',
    prescriptions: [
      { ptvName: 'PTV T', totalDose: 50.00, numberOfFractions: 25, dosePerFraction: 2.00 },
      { ptvName: 'PTV N', totalDose: 45.00, numberOfFractions: 25, dosePerFraction: 1.80 },
    ],
    oarConstraints: [
      { organName: 'Intestin', constraintType: 'Vx', target: 30, value: 500, unit: 'cc', priority: 'mandatory' },
      { organName: 'Intestin', constraintType: 'Vx', target: 40, value: 200, unit: 'cc', priority: 'mandatory' },
      { organName: 'Rectum', constraintType: 'Vx', target: 35, value: 50, unit: '%', priority: 'mandatory' },
      { organName: 'Vessie', constraintType: 'Vx', target: 35, value: 50, unit: '%', priority: 'desirable' },
    ],
    createdAt: new Date(),
    modifiedAt: new Date(),
    isCustom: false
  },
  {
    id: 'glioblastome-60-30fx-v2',
    name: 'Glioblastome (60Gy/30fx) v2',
    location: 'Encéphale',
    prescriptions: [
      { ptvName: 'PTV T', totalDose: 60.00, numberOfFractions: 30, dosePerFraction: 2.00 },
    ],
    oarConstraints: [
      { organName: 'Chiasma optique', constraintType: 'Dmax', value: 54, unit: 'Gy', priority: 'mandatory' },
      { organName: 'Moelle épinière', constraintType: 'Dmax', value: 45, unit: 'Gy', priority: 'mandatory' },
      { organName: 'Tronc cérébral', constraintType: 'Dmax', value: 54, unit: 'Gy', priority: 'mandatory' },
      { organName: 'Encephale', constraintType: 'Vx', target: 60, value: 30, unit: '%', priority: 'desirable' },
    ],
    createdAt: new Date(),
    modifiedAt: new Date(),
    isCustom: false
  }
];

/**
 * Récupère un protocole par son ID
 */
export function getProtocolById(id: string): TreatmentProtocol | undefined {
  return predefinedProtocols.find(p => p.id === id);
}

/**
 * Récupère tous les protocoles (prédéfinis + personnalisés du localStorage)
 */
export function getAllProtocols(): TreatmentProtocol[] {
  const customProtocols = loadCustomProtocols();
  return [...predefinedProtocols, ...customProtocols];
}

/**
 * Charge les protocoles personnalisés depuis localStorage
 */
export function loadCustomProtocols(): TreatmentProtocol[] {
  try {
    const stored = localStorage.getItem('custom-protocols');
    if (!stored) return [];
    
    const protocols = JSON.parse(stored) as TreatmentProtocol[];
    // Reconvertir les dates
    return protocols.map(p => ({
      ...p,
      createdAt: new Date(p.createdAt),
      modifiedAt: new Date(p.modifiedAt)
    }));
  } catch (error) {
    console.error('Erreur lors du chargement des protocoles personnalisés:', error);
    return [];
  }
}

/**
 * Sauvegarde un protocole personnalisé
 */
export function saveCustomProtocol(protocol: TreatmentProtocol): void {
  const customProtocols = loadCustomProtocols();
  const existingIndex = customProtocols.findIndex(p => p.id === protocol.id);
  
  if (existingIndex >= 0) {
    customProtocols[existingIndex] = { ...protocol, modifiedAt: new Date() };
  } else {
    customProtocols.push(protocol);
  }
  
  localStorage.setItem('custom-protocols', JSON.stringify(customProtocols));
}

/**
 * Supprime un protocole personnalisé
 */
export function deleteCustomProtocol(id: string): void {
  const customProtocols = loadCustomProtocols();
  const filtered = customProtocols.filter(p => p.id !== id);
  localStorage.setItem('custom-protocols', JSON.stringify(filtered));
}
