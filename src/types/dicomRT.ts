// Types for DICOM RT objects

export interface DicomRTStructure {
  roiNumber: number;
  name: string;
  description: string;
  generationAlgorithm: string;
  roiInterpretedType?: string; // PTV, CTV, GTV, OAR, EXTERNAL, etc.
  color: [number, number, number] | null;
  contours: DicomContour[];
  volume?: number;
}

// Types de fichiers avec métadonnées pour l'affichage
export interface ParsedFileInfo {
  name: string;
  type: DicomRTFileType;
  size: number;
}

// Résumé des composants RT trouvés
export interface RTComponentsSummary {
  hasRTSTRUCT: boolean;
  hasRTDOSE: boolean;
  hasRTPLAN: boolean;
  structureCount: number;
  dvhCount: number;
  isEmpty: {
    structures: boolean;
    dose: boolean;
    plan: boolean;
  };
}

export interface DicomContour {
  contourNumber: number;
  geometricType: string;
  numberOfPoints: number;
  points: Array<{ x: number; y: number; z: number }>;
  referencedSOPInstanceUID?: string;
}

export interface DicomRTDose {
  doseUnits: string;
  doseType: string;
  doseSummationType: string;
  gridFrameOffsetVector: number[];
  doseGridScaling: number;
  rows: number;
  columns: number;
  pixelSpacing: [number, number];
  imagePositionPatient: [number, number, number];
  doseData?: Float32Array;
  dvhs: DicomDVH[];
}

export interface DicomDVH {
  dvhType: string;
  doseUnits: string;
  volumeUnits: string;
  doseScaling: number;
  minimumDose: number;
  maximumDose: number;
  meanDose: number;
  totalVolume: number; // Volume total de la structure (volume à dose 0 pour DVH cumulatif)
  referencedROINumber?: number;
  data: {
    doses: number[];
    volumes: number[];
  };
}

export interface DicomRTPlan {
  planName: string;
  planDescription: string;
  planDate: string;
  planTime: string;
  fractionGroups: DicomFractionGroup[];
  beams: DicomBeam[];
}

export interface DicomFractionGroup {
  fractionGroupNumber: number;
  numberOfFractionsPlanned: number;
  numberOfBeams: number;
  referencedBeams: Array<{
    beamNumber: number;
    beamDose: number;
    beamMeterset: number;
  }>;
}

export interface DicomBeam {
  beamNumber: number;
  beamName: string;
  beamType: string;
  radiationType: string;
  treatmentMachineName: string;
}

export interface DicomRTData {
  patientId: string;
  patientName: string;
  studyDate: string;
  modality: string;
  structures?: DicomRTStructure[];
  dose?: DicomRTDose;
  plan?: DicomRTPlan;
}

export type DicomRTFileType = 'RTSTRUCT' | 'RTDOSE' | 'RTPLAN' | 'CT' | 'UNKNOWN';
