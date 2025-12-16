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
  
  let totalDose = 0;
  let totalWeight = 0;
  
  for (let i = 0; i < data.length - 1; i++) {
    const doseStep = data[i + 1].dose - data[i].dose;
    const avgVolume = (data[i].volume + data[i + 1].volume) / 2;
    const volumeDiff = Math.abs(data[i].volume - data[i + 1].volume);
    
    if (volumeDiff > 0) {
      totalDose += ((data[i].dose + data[i + 1].dose) / 2) * volumeDiff;
      totalWeight += volumeDiff;
    }
  }
  
  return totalWeight > 0 ? totalDose / totalWeight : 0;
}

function calculateVx(structure: Structure, doseThreshold: number): number {
  const data = structure.relativeVolume;
  if (!data || data.length === 0) return 0;
  
  for (let i = 0; i < data.length; i++) {
    if (data[i].dose >= doseThreshold) {
      if (i === 0) return data[0].volume;
      
      const d1 = data[i - 1].dose;
      const d2 = data[i].dose;
      const v1 = data[i - 1].volume;
      const v2 = data[i].volume;
      
      return v1 + (v2 - v1) * (doseThreshold - d1) / (d2 - d1);
    }
  }
  
  return 0;
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
