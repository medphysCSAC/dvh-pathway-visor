import * as dicomParser from 'dicom-parser';
import {
  DicomRTData,
  DicomRTStructure,
  DicomContour,
  DicomRTDose,
  DicomDVH,
  DicomRTPlan,
  DicomRTFileType,
} from '@/types/dicomRT';

// DICOM SOP Class UIDs for RT objects
const SOP_CLASS_UIDS = {
  RTSTRUCT: '1.2.840.10008.5.1.4.1.1.481.3',
  RTPLAN: '1.2.840.10008.5.1.4.1.1.481.5',
  RTDOSE: '1.2.840.10008.5.1.4.1.1.481.2',
  RTIMAGE: '1.2.840.10008.5.1.4.1.1.481.1',
  CT: '1.2.840.10008.5.1.4.1.1.2',
};

/**
 * Parse a DICOM file and return typed data
 */
export async function parseDicomFile(file: File): Promise<DicomRTData> {
  const arrayBuffer = await file.arrayBuffer();
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

  // Parse based on SOP Class
  if (sopClassUID === SOP_CLASS_UIDS.RTSTRUCT || modality === 'RTSTRUCT') {
    baseData.structures = parseRTStructure(dataSet);
  } else if (sopClassUID === SOP_CLASS_UIDS.RTDOSE || modality === 'RTDOSE') {
    baseData.dose = parseRTDose(dataSet, byteArray);
  } else if (sopClassUID === SOP_CLASS_UIDS.RTPLAN || modality === 'RTPLAN') {
    baseData.plan = parseRTPlan(dataSet);
  }

  return baseData;
}

/**
 * Detect DICOM RT file type
 */
export function detectDicomRTType(dataSet: dicomParser.DataSet): DicomRTFileType {
  const sopClassUID = dataSet.string('x00080016') || '';
  const modality = dataSet.string('x00080060') || '';

  if (sopClassUID === SOP_CLASS_UIDS.RTSTRUCT || modality === 'RTSTRUCT') {
    return 'RTSTRUCT';
  }
  if (sopClassUID === SOP_CLASS_UIDS.RTDOSE || modality === 'RTDOSE') {
    return 'RTDOSE';
  }
  if (sopClassUID === SOP_CLASS_UIDS.RTPLAN || modality === 'RTPLAN') {
    return 'RTPLAN';
  }
  if (sopClassUID === SOP_CLASS_UIDS.CT || modality === 'CT') {
    return 'CT';
  }
  return 'UNKNOWN';
}

/**
 * Parse RT Structure Set
 */
function parseRTStructure(dataSet: dicomParser.DataSet): DicomRTStructure[] {
  const structures: DicomRTStructure[] = [];

  // Parse StructureSetROISequence (3006,0020)
  const roiSequence = getSequence(dataSet, 'x30060020');
  if (!roiSequence) return structures;

  // Build ROI map
  const roiMap = new Map<number, { name: string; description: string; algorithm: string }>();
  for (const roiItem of roiSequence) {
    const roiNumber = roiItem.uint16('x30060022') || 0;
    roiMap.set(roiNumber, {
      name: roiItem.string('x30060026') || `ROI_${roiNumber}`,
      description: roiItem.string('x30060028') || '',
      algorithm: roiItem.string('x30060036') || '',
    });
  }

  // Parse ROIContourSequence (3006,0080)
  const contourSequence = getSequence(dataSet, 'x30060080');
  if (!contourSequence) return structures;

  for (const contourItem of contourSequence) {
    const roiNumber = contourItem.uint16('x30060084') || 0;
    const roiInfo = roiMap.get(roiNumber);

    if (!roiInfo) continue;

    // Get ROI Display Color (3006,002A)
    const colorString = contourItem.string('x3006002a');
    let color: [number, number, number] | null = null;
    if (colorString) {
      const colorParts = colorString.split('\\').map(Number);
      if (colorParts.length >= 3) {
        color = [colorParts[0], colorParts[1], colorParts[2]];
      }
    }

    // Parse contours
    const contours: DicomContour[] = [];
    const contourSeq = getSequence(contourItem, 'x30060040');

    if (contourSeq) {
      for (const contour of contourSeq) {
        const contourData = parseContour(contour);
        if (contourData) {
          contours.push(contourData);
        }
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

/**
 * Parse individual contour data
 */
function parseContour(contourItem: dicomParser.DataSet): DicomContour | null {
  const numberOfPoints = contourItem.uint16('x30060046') || 0;
  const geometricType = contourItem.string('x30060042') || 'CLOSED_PLANAR';
  const contourNumber = contourItem.uint16('x30060048') || 0;

  // Get ContourData (3006,0050) - array of x,y,z triplets
  const contourDataElement = contourItem.elements['x30060050'];
  if (!contourDataElement) return null;

  const contourDataString = contourItem.string('x30060050');
  if (!contourDataString) return null;

  const values = contourDataString.split('\\').map(Number);
  const points: Array<{ x: number; y: number; z: number }> = [];

  for (let i = 0; i < values.length; i += 3) {
    if (i + 2 < values.length) {
      points.push({
        x: values[i],
        y: values[i + 1],
        z: values[i + 2],
      });
    }
  }

  // Get referenced SOP Instance UID
  let referencedSOPInstanceUID: string | undefined;
  const imageSeq = getSequence(contourItem, 'x30060016');
  if (imageSeq && imageSeq.length > 0) {
    referencedSOPInstanceUID = imageSeq[0].string('x00081155');
  }

  return {
    contourNumber,
    geometricType,
    numberOfPoints,
    points,
    referencedSOPInstanceUID,
  };
}

/**
 * Parse RT Dose
 */
function parseRTDose(dataSet: dicomParser.DataSet, byteArray: Uint8Array): DicomRTDose {
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

  // Parse pixel data for dose grid
  const pixelDataElement = dataSet.elements['x7fe00010'];
  if (pixelDataElement) {
    const bitsAllocated = dataSet.uint16('x00280100') || 16;
    dose.doseData = extractDoseData(dataSet, byteArray, bitsAllocated);
  }

  // Parse DVH Sequence (3004,0050)
  const dvhSequence = getSequence(dataSet, 'x30040050');
  if (dvhSequence) {
    for (const dvhItem of dvhSequence) {
      const dvh = parseDVH(dvhItem);
      if (dvh) {
        dose.dvhs.push(dvh);
      }
    }
  }

  return dose;
}

/**
 * Parse DVH data from sequence item
 */
function parseDVH(dvhItem: dicomParser.DataSet): DicomDVH | null {
  const dvhType = dvhItem.string('x30040001') || 'CUMULATIVE';
  const doseUnits = dvhItem.string('x30040002') || 'GY';
  const volumeUnits = dvhItem.string('x30040004') || 'CM3';
  const doseScaling = dvhItem.floatString('x30040005') || 1.0;

  // DVH Data (3004,0058) - pairs of (dose bin width or dose, volume)
  const dvhDataString = dvhItem.string('x30040058');
  if (!dvhDataString) return null;

  const values = dvhDataString.split('\\').map(Number);
  const doses: number[] = [];
  const volumes: number[] = [];

  // For cumulative DVH, format is (dose, volume) pairs
  // For differential DVH, format is (bin width, volume) pairs
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

  // Get referenced ROI number
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

/**
 * Parse RT Plan
 */
function parseRTPlan(dataSet: dicomParser.DataSet): DicomRTPlan {
  const plan: DicomRTPlan = {
    planName: dataSet.string('x300a0002') || '',
    planDescription: dataSet.string('x300a0003') || '',
    planDate: dataSet.string('x300a0006') || '',
    planTime: dataSet.string('x300a0007') || '',
    fractionGroups: [],
    beams: [],
  };

  // Parse FractionGroupSequence (300A,0070)
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

  // Parse BeamSequence (300A,00B0)
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

function extractDoseData(
  dataSet: dicomParser.DataSet,
  byteArray: Uint8Array,
  bitsAllocated: number
): Float32Array | undefined {
  const pixelDataElement = dataSet.elements['x7fe00010'];
  if (!pixelDataElement) return undefined;

  const rows = dataSet.uint16('x00280010') || 0;
  const columns = dataSet.uint16('x00280011') || 0;
  const frames = dataSet.uint16('x00280008') || 1;
  const totalPixels = rows * columns * frames;

  const doseGridScaling = dataSet.floatString('x3004000e') || 1.0;
  const doseData = new Float32Array(totalPixels);

  const offset = pixelDataElement.dataOffset;

  if (bitsAllocated === 32) {
    const pixelData = new Uint32Array(byteArray.buffer, offset, totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      doseData[i] = pixelData[i] * doseGridScaling;
    }
  } else if (bitsAllocated === 16) {
    const pixelData = new Uint16Array(byteArray.buffer, offset, totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      doseData[i] = pixelData[i] * doseGridScaling;
    }
  }

  return doseData;
}

/**
 * Convert DICOM RT DVH data to the app's DVH format
 */
export function convertDicomDVHToAppFormat(
  structures: DicomRTStructure[],
  dvhs: DicomDVH[]
): { name: string; relativeVolume: Array<{ dose: number; volume: number }> }[] {
  return dvhs.map((dvh) => {
    const structure = structures.find((s) => s.roiNumber === dvh.referencedROINumber);
    const maxVolume = Math.max(...dvh.data.volumes);

    return {
      name: structure?.name || `ROI_${dvh.referencedROINumber}`,
      relativeVolume: dvh.data.doses.map((dose, i) => ({
        dose,
        volume: maxVolume > 0 ? (dvh.data.volumes[i] / maxVolume) * 100 : 0,
      })),
    };
  });
}
