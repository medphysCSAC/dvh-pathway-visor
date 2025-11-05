export interface DVHPoint {
  dose: number;
  volume: number;
}

export type StructureCategory = 'PTV' | 'OAR' | 'OTHER';

export interface Structure {
  name: string;
  type: string;
  category: StructureCategory;
  relativeVolume: DVHPoint[];
  absoluteVolume?: DVHPoint[];
  totalVolume?: number;
}

export interface DVHData {
  patientId: string;
  structures: Structure[];
}

export interface DVHMetrics {
  structureName: string;
  volume: number;
  dmax: number;
  dmean: number;
  v20Gy?: number;
  v40Gy?: number;
}

// Multi-plan types
export interface PlanData {
  id: string;
  name: string;
  patientId: string;
  structures: Structure[];
  uploadDate: Date;
}

export interface MultiPlanSession {
  sessionId: string;
  patientIds: string[];
  plans: PlanData[];
  mode: 'summation' | 'comparison' | 'multi-patient';
}

export interface FilePair {
  relFile: File;
  absFile: File;
  planName: string;
  detected: boolean;
}
