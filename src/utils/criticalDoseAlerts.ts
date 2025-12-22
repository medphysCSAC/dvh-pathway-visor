import { Structure } from "@/types/dvh";

export interface CriticalThreshold {
  structurePatterns: string[];
  metricType: 'Dmax' | 'Dmean' | 'V20' | 'V30' | 'V5';
  threshold: number;
  unit: string;
  risk: string;
  severity: 'critical' | 'warning';
}

export interface DoseAlert {
  structureName: string;
  metricType: string;
  value: number;
  threshold: number;
  unit: string;
  risk: string;
  severity: 'critical' | 'warning';
}

export const CRITICAL_THRESHOLDS: CriticalThreshold[] = [
  // Système nerveux central
  {
    structurePatterns: ['moelle', 'moelle epiniere', 'spinal', 'cord', 'medulla'],
    metricType: 'Dmax',
    threshold: 45,
    unit: 'Gy',
    risk: 'Myélopathie radique',
    severity: 'critical'
  },
  {
    structurePatterns: ['tronc', 'tronc cerebral ', 'TC' , 'brainstem', 'brain stem'],
    metricType: 'Dmax',
    threshold: 54,
    unit: 'Gy',
    risk: 'Nécrose du tronc cérébral',
    severity: 'critical'
  },
  {
    structurePatterns: ['nerf optique', 'optic nerve', 'n. optique'],
    metricType: 'Dmax',
    threshold: 54,
    unit: 'Gy',
    risk: 'Neuropathie optique',
    severity: 'critical'
  },
  {
    structurePatterns: ['chiasma', 'chiasma optique', 'chiasm'],
    metricType: 'Dmax',
    threshold: 54,
    unit: 'Gy',
    risk: 'Neuropathie optique',
    severity: 'critical'
  },
  // Yeux
  {
    structurePatterns: ['cristallin', 'lens'],
    metricType: 'Dmax',
    threshold: 10,
    unit: 'Gy',
    risk: 'Cataracte radio-induite',
    severity: 'warning'
  },
  {
    structurePatterns: ['retine', 'retina'],
    metricType: 'Dmax',
    threshold: 45,
    unit: 'Gy',
    risk: 'Rétinopathie',
    severity: 'critical'
  },
  // Poumons
  {
    structurePatterns: ['poumon', 'lung', 'pulm'],
    metricType: 'V20',
    threshold: 35,
    unit: '%',
    risk: 'Pneumopathie radique',
    severity: 'critical'
  },
  {
    structurePatterns: ['poumon', 'lung', 'pulm'],
    metricType: 'Dmean',
    threshold: 20,
    unit: 'Gy',
    risk: 'Pneumopathie radique',
    severity: 'warning'
  },
  // Cœur
  {
    structurePatterns: ['coeur', 'heart', 'cardiac'],
    metricType: 'Dmean',
    threshold: 26,
    unit: 'Gy',
    risk: 'Péricardite/Cardiopathie',
    severity: 'critical'
  },
  {
    structurePatterns: ['coeur', 'heart', 'cardiac'],
    metricType: 'V30',
    threshold: 46,
    unit: '%',
    risk: 'Péricardite',
    severity: 'warning'
  },
  // Reins
  {
    structurePatterns: ['rein', 'kidney', 'renal'],
    metricType: 'Dmean',
    threshold: 18,
    unit: 'Gy',
    risk: 'Néphropathie radique',
    severity: 'critical'
  },
  {
    structurePatterns: ['rein', 'kidney', 'renal'],
    metricType: 'V20',
    threshold: 32,
    unit: '%',
    risk: 'Néphropathie',
    severity: 'warning'
  },
  // Foie
  {
    structurePatterns: ['foie', 'liver', 'hepat'],
    metricType: 'Dmean',
    threshold: 30,
    unit: 'Gy',
    risk: 'Hépatite radique (RILD)',
    severity: 'critical'
  },
  // Œsophage
  {
    structurePatterns: ['oesophage', 'esophagus', 'oeso'],
    metricType: 'Dmean',
    threshold: 34,
    unit: 'Gy',
    risk: 'Œsophagite sévère',
    severity: 'warning'
  },
  // Parotides
  {
    structurePatterns: ['parotide', 'parotid'],
    metricType: 'Dmean',
    threshold: 26,
    unit: 'Gy',
    risk: 'Xérostomie',
    severity: 'warning'
  },
  // Rectum
  {
    structurePatterns: ['rectum', 'rectal'],
    metricType: 'V30',
    threshold: 60,
    unit: '%',
    risk: 'Rectite chronique',
    severity: 'warning'
  },
  // Vessie
  {
    structurePatterns: ['vessie', 'bladder'],
    metricType: 'V30',
    threshold: 50,
    unit: '%',
    risk: 'Cystite radique',
    severity: 'warning'
  },
  // Intestin grêle
  {
    structurePatterns: ['intestin', 'bowel', 'grele', 'small bowel'],
    metricType: 'V5',
    threshold: 50,
    unit: '%',
    risk: 'Entérite radique',
    severity: 'warning'
  },
  // Cochlée
  {
    structurePatterns: ['cochlee', 'cochlea'],
    metricType: 'Dmean',
    threshold: 45,
    unit: 'Gy',
    risk: 'Perte auditive',
    severity: 'warning'
  },
  // Plexus brachial
  {
    structurePatterns: ['plexus brachial', 'brachial plexus'],
    metricType: 'Dmax',
    threshold: 66,
    unit: 'Gy',
    risk: 'Plexopathie brachiale',
    severity: 'critical'
  },
];

function normalizeStructureName(name: string): string {
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]/g, ' ');
}

function matchesPattern(structureName: string, patterns: string[]): boolean {
  const normalized = normalizeStructureName(structureName);
  return patterns.some(pattern => normalized.includes(pattern.toLowerCase()));
}

function calculateDmax(structure: Structure): number {
  const data = structure.relativeVolume;
  if (!data || data.length === 0) return 0;
  
  // Méthode harmonisée: Math.max(...doses) sans filtrage du bruit
  const doses = data.map(p => p.dose);
  return Math.max(...doses);
}

function calculateDmean(structure: Structure): number {
  const data = structure.relativeVolume;
  if (!data || data.length < 2) return 0;
  
  // ✅ Méthode harmonisée avec dvhParser: intégration trapézoïdale
  let dmean = 0;
  for (let i = 0; i < data.length - 1; i++) {
    const dose1 = data[i].dose;
    const dose2 = data[i + 1].dose;
    const vol1 = data[i].volume;
    const vol2 = data[i + 1].volume;
    // Math.abs() pour robustesse si DVH non-monotone
    dmean += ((dose1 + dose2) / 2) * Math.abs(vol2 - vol1);
  }
  // Normalisation par 100 car volumes sont en % (0-100)
  return dmean / 100;
}

function calculateVx(structure: Structure, doseThreshold: number): number {
  const data = structure.relativeVolume;
  if (!data || data.length === 0) return 0;
  
  // ✅ Méthode harmonisée avec planQualityMetrics/dvhParser
  // Assurer un tri croissant par dose pour une interpolation fiable
  const points = [...data].sort((a, b) => a.dose - b.dose);
  
  // Gestion des bornes
  if (doseThreshold <= points[0].dose) {
    return points[0].volume; // tout le volume reçoit au moins cette dose
  }
  if (doseThreshold >= points[points.length - 1].dose) {
    return points[points.length - 1].volume; // souvent ~0%
  }
  
  // Interpolation linéaire entre les deux points encadrant la dose cible
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    
    if (curr.dose <= doseThreshold && next.dose >= doseThreshold) {
      const t = (doseThreshold - curr.dose) / (next.dose - curr.dose);
      return curr.volume + t * (next.volume - curr.volume);
    }
  }
  
  return points[points.length - 1].volume;
}

export function checkCriticalDoses(structures: Structure[]): DoseAlert[] {
  const alerts: DoseAlert[] = [];
  
  for (const structure of structures) {
    if (structure.category === 'PTV') continue;
    
    for (const threshold of CRITICAL_THRESHOLDS) {
      if (!matchesPattern(structure.name, threshold.structurePatterns)) continue;
      
      let value: number;
      
      switch (threshold.metricType) {
        case 'Dmax':
          value = calculateDmax(structure);
          break;
        case 'Dmean':
          value = calculateDmean(structure);
          break;
        case 'V20':
          value = calculateVx(structure, 20);
          break;
        case 'V30':
          value = calculateVx(structure, 30);
          break;
        case 'V5':
          value = calculateVx(structure, 5);
          break;
        default:
          continue;
      }
      
      if (value > threshold.threshold) {
        alerts.push({
          structureName: structure.name,
          metricType: threshold.metricType,
          value: Math.round(value * 100) / 100,
          threshold: threshold.threshold,
          unit: threshold.unit,
          risk: threshold.risk,
          severity: threshold.severity
        });
      }
    }
  }
  
  // Sort by severity (critical first)
  return alerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return 0;
  });
}
