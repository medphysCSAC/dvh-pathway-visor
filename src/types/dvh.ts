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
