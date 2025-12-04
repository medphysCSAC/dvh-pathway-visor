import * as dicomParser from 'dicom-parser';

// Types inline pour le worker (évite les problèmes d'import)
interface DicomContour {
  contourNumber: number;
  geometricType: string;
  numberOfPoints: number;
  points: Array<{ x: number; y: number; z: number }>;
  referencedSOPInstanceUID?: string;
}

interface DicomRTStructure {
  roiNumber: number;
  name: string;
  description?: string;
  generationAlgorithm?: string;
  color: [number, number, number] | null;
  contours: DicomContour[];
}

interface DicomDVH {
  dvhType: string;
  doseUnits: string;
  volumeUnits: string;
  doseScaling: number;
  minimumDose: number;
  maximumDose: number;
  meanDose: number;
  referencedROINumber?: number;
  data: {
    doses: number[];
    volumes: number[];
  };
}

interface DicomRTDose {
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

interface DicomRTPlan {
  planName: string;
  planDescription?: string;
  planDate?: string;
  planTime?: string;
  fractionGroups: Array<{
    fractionGroupNumber: number;
    numberOfFractionsPlanned: number;
    numberOfBeams: number;
    referencedBeams: Array<{
      beamNumber: number;
      beamDose: number;
      beamMeterset: number;
    }>;
  }>;
  beams: Array<{
    beamNumber: number;
    beamName: string;
    beamType: string;
    radiationType: string;
    treatmentMachineName: string;
  }>;
}

interface DicomRTData {
  patientId: string;
  patientName: string;
  studyDate: string;
  modality: string;
  structures?: DicomRTStructure[];
  dose?: DicomRTDose;
  plan?: DicomRTPlan;
}

// SOP Class UIDs
const SOP_CLASS_UIDS = {
  RTSTRUCT: '1.2.840.10008.5.1.4.1.1.481.3',
  RTPLAN: '1.2.840.10008.5.1.4.1.1.481.5',
  RTDOSE: '1.2.840.10008.5.1.4.1.1.481.2',
};

// Helper functions
function getSequence(dataSet: dicomParser.DataSet, tag: string): dicomParser.DataSet[] | null {
  const element = dataSet.elements[tag];
  if (!element || !element.items) return null;
  return element.items.map((item) => item.dataSet);
}

function parseFloatArray(str: string | undefined): number[] {
  if (!str) return [];
  return str.split('\\').map(Number).filter((n) => !isNaN(n));
}

function parsePixelSpacing(str: string | undefined): [number, number] {
  const arr = parseFloatArray(str);
  return [arr[0] || 1, arr[1] || 1];
}

function parseImagePosition(str: string | undefined): [number, number, number] {
  const arr = parseFloatArray(str);
  return [arr[0] || 0, arr[1] || 0, arr[2] || 0];
}

function parseContour(contourItem: dicomParser.DataSet): DicomContour | null {
  const numberOfPoints = contourItem.uint16('x30060046') || 0;
  const geometricType = contourItem.string('x30060042') || 'CLOSED_PLANAR';
  const contourNumber = contourItem.uint16('x30060048') || 0;

  const contourDataElement = contourItem.elements['x30060050'];
  if (!contourDataElement) return null;

  const contourDataString = contourItem.string('x30060050');
  if (!contourDataString) return null;

  const values = contourDataString.split('\\').map(Number);
  const points: Array<{ x: number; y: number; z: number }> = [];

  for (let i = 0; i < values.length; i += 3) {
    if (i + 2 < values.length) {
      points.push({ x: values[i], y: values[i + 1], z: values[i + 2] });
    }
  }

  let referencedSOPInstanceUID: string | undefined;
  const imageSeq = getSequence(contourItem, 'x30060016');
  if (imageSeq && imageSeq.length > 0) {
    referencedSOPInstanceUID = imageSeq[0].string('x00081155');
  }

  return { contourNumber, geometricType, numberOfPoints, points, referencedSOPInstanceUID };
}

function parseRTStructure(dataSet: dicomParser.DataSet): DicomRTStructure[] {
  const structures: DicomRTStructure[] = [];
  const roiSequence = getSequence(dataSet, 'x30060020');
  if (!roiSequence) return structures;

  const roiMap = new Map<number, { name: string; description: string; algorithm: string }>();
  for (const roiItem of roiSequence) {
    const roiNumber = roiItem.uint16('x30060022') || 0;
    roiMap.set(roiNumber, {
      name: roiItem.string('x30060026') || `ROI_${roiNumber}`,
      description: roiItem.string('x30060028') || '',
      algorithm: roiItem.string('x30060036') || '',
    });
  }

  const contourSequence = getSequence(dataSet, 'x30060080');
  if (!contourSequence) return structures;

  for (const contourItem of contourSequence) {
    const roiNumber = contourItem.uint16('x30060084') || 0;
    const roiInfo = roiMap.get(roiNumber);
    if (!roiInfo) continue;

    const colorString = contourItem.string('x3006002a');
    let color: [number, number, number] | null = null;
    if (colorString) {
      const colorParts = colorString.split('\\').map(Number);
      if (colorParts.length >= 3) {
        color = [colorParts[0], colorParts[1], colorParts[2]];
      }
    }

    const contours: DicomContour[] = [];
    const contourSeq = getSequence(contourItem, 'x30060040');
    if (contourSeq) {
      for (const contour of contourSeq) {
        const contourData = parseContour(contour);
        if (contourData) contours.push(contourData);
      }
    }

    structures.push({
      roiNumber,
      name: roiInfo.name,
      description: roiInfo.description,
      generationAlgorithm: roiInfo.algorithm,
      color,
      contours,
    });
  }

  return structures;
}

function parseDVH(dvhItem: dicomParser.DataSet): DicomDVH | null {
  const dvhType = dvhItem.string('x30040001') || 'CUMULATIVE';
  const doseUnits = dvhItem.string('x30040002') || 'GY';
  const volumeUnits = dvhItem.string('x30040004') || 'CM3';
  const doseScaling = dvhItem.floatString('x30040005') || 1.0;

  const dvhDataString = dvhItem.string('x30040058');
  if (!dvhDataString) return null;

  const values = dvhDataString.split('\\').map(Number);
  const doses: number[] = [];
  const volumes: number[] = [];

  let cumulativeDose = 0;
  for (let i = 0; i < values.length; i += 2) {
    if (i + 1 < values.length) {
      if (dvhType === 'DIFFERENTIAL') {
        cumulativeDose += values[i];
        doses.push(cumulativeDose * doseScaling);
      } else {
        doses.push(values[i] * doseScaling);
      }
      volumes.push(values[i + 1]);
    }
  }

  let referencedROINumber: number | undefined;
  const refROISeq = getSequence(dvhItem, 'x30040060');
  if (refROISeq && refROISeq.length > 0) {
    referencedROINumber = refROISeq[0].uint16('x30060084');
  }

  return {
    dvhType,
    doseUnits,
    volumeUnits,
    doseScaling,
    minimumDose: dvhItem.floatString('x30040070') || 0,
    maximumDose: dvhItem.floatString('x30040072') || Math.max(...doses),
    meanDose: dvhItem.floatString('x30040074') || 0,
    referencedROINumber,
    data: { doses, volumes },
  };
}

function parseRTDose(dataSet: dicomParser.DataSet): DicomRTDose {
  const dose: DicomRTDose = {
    doseUnits: dataSet.string('x30040002') || 'GY',
    doseType: dataSet.string('x30040004') || 'PHYSICAL',
    doseSummationType: dataSet.string('x3004000a') || 'PLAN',
    gridFrameOffsetVector: parseFloatArray(dataSet.string('x3004000c')),
    doseGridScaling: dataSet.floatString('x3004000e') || 1.0,
    rows: dataSet.uint16('x00280010') || 0,
    columns: dataSet.uint16('x00280011') || 0,
    pixelSpacing: parsePixelSpacing(dataSet.string('x00280030')),
    imagePositionPatient: parseImagePosition(dataSet.string('x00200032')),
    dvhs: [],
  };

  const dvhSequence = getSequence(dataSet, 'x30040050');
  if (dvhSequence) {
    for (const dvhItem of dvhSequence) {
      const dvh = parseDVH(dvhItem);
      if (dvh) dose.dvhs.push(dvh);
    }
  }

  return dose;
}

function parseRTPlan(dataSet: dicomParser.DataSet): DicomRTPlan {
  const plan: DicomRTPlan = {
    planName: dataSet.string('x300a0002') || '',
    planDescription: dataSet.string('x300a0003') || '',
    planDate: dataSet.string('x300a0006') || '',
    planTime: dataSet.string('x300a0007') || '',
    fractionGroups: [],
    beams: [],
  };

  const fractionSeq = getSequence(dataSet, 'x300a0070');
  if (fractionSeq) {
    for (const fgItem of fractionSeq) {
      const fg = {
        fractionGroupNumber: fgItem.uint16('x300a0071') || 1,
        numberOfFractionsPlanned: fgItem.uint16('x300a0078') || 1,
        numberOfBeams: fgItem.uint16('x300a0080') || 0,
        referencedBeams: [] as Array<{ beamNumber: number; beamDose: number; beamMeterset: number }>,
      };

      const refBeamSeq = getSequence(fgItem, 'x300c0004');
      if (refBeamSeq) {
        for (const rbItem of refBeamSeq) {
          fg.referencedBeams.push({
            beamNumber: rbItem.uint16('x300c0006') || 1,
            beamDose: rbItem.floatString('x300a0084') || 0,
            beamMeterset: rbItem.floatString('x300a0086') || 0,
          });
        }
      }
      plan.fractionGroups.push(fg);
    }
  }

  const beamSeq = getSequence(dataSet, 'x300a00b0');
  if (beamSeq) {
    for (const beamItem of beamSeq) {
      plan.beams.push({
        beamNumber: beamItem.uint16('x300a00c0') || 1,
        beamName: beamItem.string('x300a00c2') || '',
        beamType: beamItem.string('x300a00c4') || '',
        radiationType: beamItem.string('x300a00c6') || '',
        treatmentMachineName: beamItem.string('x300a00b2') || '',
      });
    }
  }

  return plan;
}

function parseDicomBuffer(arrayBuffer: ArrayBuffer, fileName: string): DicomRTData {
  const byteArray = new Uint8Array(arrayBuffer);
  const dataSet = dicomParser.parseDicom(byteArray);

  const sopClassUID = dataSet.string('x00080016') || '';
  const modality = dataSet.string('x00080060') || '';

  const baseData: DicomRTData = {
    patientId: dataSet.string('x00100020') || 'Unknown',
    patientName: dataSet.string('x00100010') || 'Unknown',
    studyDate: dataSet.string('x00080020') || '',
    modality,
  };

  if (sopClassUID === SOP_CLASS_UIDS.RTSTRUCT || modality === 'RTSTRUCT') {
    baseData.structures = parseRTStructure(dataSet);
  } else if (sopClassUID === SOP_CLASS_UIDS.RTDOSE || modality === 'RTDOSE') {
    baseData.dose = parseRTDose(dataSet);
  } else if (sopClassUID === SOP_CLASS_UIDS.RTPLAN || modality === 'RTPLAN') {
    baseData.plan = parseRTPlan(dataSet);
  }

  return baseData;
}

// Message types
export interface WorkerRequest {
  id: number;
  arrayBuffer: ArrayBuffer;
  fileName: string;
}

export interface WorkerResponse {
  id: number;
  success: boolean;
  data?: DicomRTData;
  error?: string;
}

// Worker message handler
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, arrayBuffer, fileName } = e.data;
  
  try {
    const data = parseDicomBuffer(arrayBuffer, fileName);
    const response: WorkerResponse = { id, success: true, data };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = { 
      id, 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown parsing error' 
    };
    self.postMessage(response);
  }
};
