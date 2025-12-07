export type DicomRTFileType = "RTSTRUCT" | "RTDOSE" | "RTPLAN" | "CT" | "UNKNOWN";

export interface DicomRTData {
  patientId?: string;
  patientName?: string;
  studyDate?: string;
  modality?: string;
  structures?: DicomRTStructure[];
  dose?: DicomRTDose;
  plan?: DicomRTPlan;
}

export interface DicomRTStructure {
  roiNumber: number;
  name: string;
  description?: string;
  generationAlgorithm?: string;
  color?: [number, number, number] | null;
  contours: DicomContour[];
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
  referencedROINumber?: number;
  data: { doses: number[]; volumes: number[] };
}

export interface DicomRTPlan {
  planName: string;
  planDescription: string;
  planDate: string;
  planTime: string;
  fractionGroups: Array<{
    fractionGroupNumber: number;
    numberOfFractionsPlanned: number;
    numberOfBeams: number;
    referencedBeams: Array<{ beamNumber: number; beamDose: number; beamMeterset: number }>;
  }>;
  beams: Array<{
    beamNumber: number;
    beamName: string;
    beamType: string;
    radiationType: string;
    treatmentMachineName: string;
  }>;
}
