import * as dicomParser from "dicom-parser";
import {
  DicomRTData,
  DicomRTStructure,
  DicomContour,
  DicomRTDose,
  DicomDVH,
  DicomRTPlan,
  DicomRTFileType,
} from "@/types/dicomRT";

const SOP_CLASS_UIDS = {
  RTSTRUCT: "1.2.840.10008.5.1.4.1.1.481.3",
  RTPLAN: "1.2.840.10008.5.1.4.1.1.481.5",
  RTDOSE: "1.2.840.10008.5.1.4.1.1.481.2",
  RTIMAGE: "1.2.840.10008.5.1.4.1.1.481.1",
  CT: "1.2.840.10008.5.1.4.1.1.2",
};

export async function parseDicomFile(file: File): Promise<DicomRTData> {
  const arrayBuffer = await file.arrayBuffer();
  const byteArray = new Uint8Array(arrayBuffer);
  const dataSet = dicomParser.parseDicom(byteArray);

  const sopClassUID = dataSet.string("x00080016") || "";
  const modality = dataSet.string("x00080060") || "";

  const baseData: DicomRTData = {
    patientId: dataSet.string("x00100020") || "Unknown",
    patientName: dataSet.string("x00100010") || "Unknown",
    studyDate: dataSet.string("x00080020") || "",
    modality,
  };

  // Détection robuste du type
  if (sopClassUID === SOP_CLASS_UIDS.RTSTRUCT || modality === "RTSTRUCT") {
    baseData.structures = parseRTStructure(dataSet);
  } else if (sopClassUID === SOP_CLASS_UIDS.RTDOSE || modality === "RTDOSE") {
    baseData.dose = parseRTDose(dataSet, byteArray);
  } else if (sopClassUID === SOP_CLASS_UIDS.RTPLAN || modality === "RTPLAN") {
    baseData.plan = parseRTPlan(dataSet);
  }

  return baseData;
}

function parseRTStructure(dataSet: dicomParser.DataSet): DicomRTStructure[] {
  const structures: DicomRTStructure[] = [];
  const roiSequence = getSequence(dataSet, "x30060020");
  if (!roiSequence) return structures;

  // Map ROI -> Nom
  const roiMap = new Map<number, { name: string; description: string; algorithm: string }>();
  for (const roiItem of roiSequence) {
    const roiNumber = roiItem.uint16("x30060022") || 0;
    roiMap.set(roiNumber, {
      name: roiItem.string("x30060026") || `ROI_${roiNumber}`,
      description: roiItem.string("x30060028") || "",
      algorithm: roiItem.string("x30060036") || "",
    });
  }

  // Contours
  const contourSequence = getSequence(dataSet, "x30060080");
  if (!contourSequence) return structures;

  for (const contourItem of contourSequence) {
    const roiNumber = contourItem.uint16("x30060084") || 0;
    const roiInfo = roiMap.get(roiNumber);
    if (!roiInfo) continue;

    // Couleur
    const colorString = contourItem.string("x3006002a");
    let color: [number, number, number] | null = null;
    if (colorString) {
      const parts = colorString.split("\\").map(Number);
      if (parts.length >= 3) color = [parts[0], parts[1], parts[2]];
    }

    // Contours géométriques
    const contours: DicomContour[] = [];
    const contourSeq = getSequence(contourItem, "x30060040");
    if (contourSeq) {
      for (const contour of contourSeq) {
        const data = parseContour(contour);
        if (data) contours.push(data);
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

function parseContour(contourItem: dicomParser.DataSet): DicomContour | null {
  const numberOfPoints = contourItem.uint16("x30060046") || 0;
  const geometricType = contourItem.string("x30060042") || "CLOSED_PLANAR";
  const contourNumber = contourItem.uint16("x30060048") || 0;

  const contourDataString = contourItem.string("x30060050");
  if (!contourDataString) return null;

  const values = contourDataString.split("\\").map(Number);
  const points: Array<{ x: number; y: number; z: number }> = [];

  for (let i = 0; i < values.length; i += 3) {
    if (i + 2 < values.length) {
      points.push({ x: values[i], y: values[i + 1], z: values[i + 2] });
    }
  }

  // Référence image
  let referencedSOPInstanceUID: string | undefined;
  const imageSeq = getSequence(contourItem, "x30060016");
  if (imageSeq?.length) {
    referencedSOPInstanceUID = imageSeq[0].string("x00081155");
  }

  return {
    contourNumber,
    geometricType,
    numberOfPoints,
    points,
    referencedSOPInstanceUID,
  };
}

function parseRTDose(dataSet: dicomParser.DataSet, byteArray: Uint8Array): DicomRTDose {
  console.log("[DICOM RT] === PARSING RT DOSE FILE ===");
  
  // 🔍 DEBUG: Lister TOUS les éléments du dataset pour trouver les DVH
  console.log("[DICOM RT] All elements in RT Dose file:");
  const allTags = Object.keys(dataSet.elements);
  console.log("[DICOM RT] Tags found:", allTags.join(", "));
  
  // Chercher spécifiquement les tags 3004,xxxx (RT Dose module)
  const rtDoseTags = allTags.filter(tag => tag.startsWith("x3004"));
  console.log("[DICOM RT] RT Dose specific tags (3004,xxxx):", rtDoseTags);
  
  // Afficher les détails de chaque tag 3004
  for (const tag of rtDoseTags) {
    const element = dataSet.elements[tag];
    console.log(`[DICOM RT] Tag ${tag}: VR=${element.vr || 'unknown'}, length=${element.length}, hasItems=${!!element.items}`);
    if (element.items) {
      console.log(`[DICOM RT]   -> Sequence with ${element.items.length} items`);
    }
  }

  const dose: DicomRTDose = {
    doseUnits: dataSet.string("x30040002") || "GY",
    doseType: dataSet.string("x30040004") || "PHYSICAL",
    doseSummationType: dataSet.string("x3004000a") || "PLAN",
    gridFrameOffsetVector: parseFloatArray(dataSet.string("x3004000c")),
    doseGridScaling: dataSet.floatString("x3004000e") || 1.0,
    rows: dataSet.uint16("x00280010") || 0,
    columns: dataSet.uint16("x00280011") || 0,
    pixelSpacing: parsePixelSpacing(dataSet.string("x00280030")),
    imagePositionPatient: parseImagePosition(dataSet.string("x00200032")),
    dvhs: [],
  };

  console.log("[DICOM RT] Dose grid:", dose.rows, "x", dose.columns);
  console.log("[DICOM RT] Dose scaling:", dose.doseGridScaling);

  // Données 3D dose
  const pixelDataElement = dataSet.elements["x7fe00010"];
  if (pixelDataElement) {
    console.log("[DICOM RT] Pixel data found, length:", pixelDataElement.length);
    const bitsAllocated = dataSet.uint16("x00280100") || 16;
    dose.doseData = extractDoseData(dataSet, byteArray, bitsAllocated);
    console.log("[DICOM RT] Dose data extracted:", dose.doseData?.length, "voxels");
  }

  // 🔥 PARSING DVH - Tag (3004,0050) DVH Sequence
  const dvhSequence = getSequence(dataSet, "x30040050");
  console.log("[DICOM RT] DVH Sequence (x30040050):", dvhSequence ? `${dvhSequence.length} items` : "NOT FOUND");
  
  if (dvhSequence && dvhSequence.length > 0) {
    for (let idx = 0; idx < dvhSequence.length; idx++) {
      const dvhItem = dvhSequence[idx];
      console.log(`[DICOM RT] Processing DVH item ${idx + 1}/${dvhSequence.length}`);
      
      // Debug: afficher tous les tags de cet item DVH
      const dvhTags = Object.keys(dvhItem.elements);
      console.log(`[DICOM RT] DVH item tags:`, dvhTags);
      
      const dvh = parseDVH(dvhItem, byteArray);
      if (dvh) {
        dose.dvhs.push(dvh);
        console.log(`[DICOM RT] ✅ Parsed DVH for ROI #${dvh.referencedROINumber}: ${dvh.data.doses.length} points`);
      } else {
        console.log(`[DICOM RT] ❌ Failed to parse DVH item ${idx + 1}`);
      }
    }
  } else {
    console.log("[DICOM RT] ⚠️ No DVH Sequence found - DVH may not be included in this RT Dose file");
    console.log("[DICOM RT] Note: Some TPS export DVH separately or don't include it in RT Dose");
  }

  console.log(`[DICOM RT] === PARSING COMPLETE: ${dose.dvhs.length} DVH(s) extracted ===`);
  return dose;
}

function parseDVH(dvhItem: dicomParser.DataSet, originalByteArray: Uint8Array): DicomDVH | null {
  // Type de DVH: DIFFERENTIAL ou CUMULATIVE
  const dvhType = dvhItem.string("x30040001") || "CUMULATIVE";
  // Unités de dose: GY ou CGY
  const doseUnits = dvhItem.string("x30040002") || "GY";
  // Type de dose pour le DVH (PHYSICAL, EFFECTIVE, ERROR)
  const doseType = dvhItem.string("x30040004") || "PHYSICAL";
  // Scaling de dose (optionnel)
  const doseScaling = dvhItem.floatString("x30040052") || 1.0;

  // DVH Dose Scaling (3004,0052) - factor to multiply dose values
  const dvhDoseScaling = dvhItem.floatString("x30040052") || 1.0;
  
  // DVH Volume Units (3004,0054) - CM3 or PERCENT
  const volumeUnits = dvhItem.string("x30040054") || "CM3";
  
  // Number of Bins (3004,0056) - nombre de points DVH
  const numberOfBins = dvhItem.uint32("x30040056") || 0;
  
  // DVH Data element (3004,0058) - contient les paires dose/volume
  const dvhDataElement = dvhItem.elements["x30040058"];
  
  if (!dvhDataElement) {
    console.warn("[DICOM RT] DVH Data element (3004,0058) not found");
    return null;
  }

  // 🔥 LECTURE CORRECTE DES DONNÉES DVH
  // Les données sont des DS (Decimal String) OU des binaires selon l'implémentation
  let doses: number[] = [];
  let volumes: number[] = [];

  // Essayer d'abord comme chaîne de caractères (DS VR - le plus commun)
  const dvhDataString = dvhItem.string("x30040058");
  
  if (dvhDataString && dvhDataString.length > 0) {
    // Format DS: valeurs séparées par des backslashes
    const values = dvhDataString.split("\\").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    
    // Les données sont en paires: dose1, volume1, dose2, volume2, ...
    for (let i = 0; i < values.length - 1; i += 2) {
      doses.push(values[i] * dvhDoseScaling);
      volumes.push(values[i + 1]);
    }
    
    console.log(`[DICOM RT] Parsed DVH from DS string: ${doses.length} points`);
  } else {
    // Format binaire (moins commun mais possible)
    // Utiliser le byteArray original avec l'offset de l'élément
    const offset = dvhDataElement.dataOffset;
    const length = dvhDataElement.length;
    
    if (offset !== undefined && length > 0) {
      try {
        // Les données peuvent être en float32 ou float64
        const numValues = length / 4; // Supposer float32 d'abord
        
        // Créer un DataView pour gérer l'endianness
        const dataView = new DataView(originalByteArray.buffer, offset, length);
        
        for (let i = 0; i < numValues - 1; i += 2) {
          const doseValue = dataView.getFloat32(i * 4, true); // little-endian
          const volumeValue = dataView.getFloat32((i + 1) * 4, true);
          
          if (!isNaN(doseValue) && !isNaN(volumeValue)) {
            doses.push(doseValue * dvhDoseScaling);
            volumes.push(volumeValue);
          }
        }
        
        console.log(`[DICOM RT] Parsed DVH from binary: ${doses.length} points`);
      } catch (err) {
        console.warn("[DICOM RT] Failed to parse binary DVH data:", err);
      }
    }
  }

  if (doses.length === 0) {
    console.warn("[DICOM RT] No DVH data points extracted");
    return null;
  }

  // Statistiques de dose
  const minimumDose = dvhItem.floatString("x30040070") || Math.min(...doses);
  const maximumDose = dvhItem.floatString("x30040072") || Math.max(...doses);
  const meanDose = dvhItem.floatString("x30040074") || 0;

  // ROI référencé - via DVH Referenced ROI Sequence (3004,0060)
  let referencedROINumber: number | undefined;
  const refROISeq = getSequence(dvhItem, "x30040060");
  if (refROISeq?.length) {
    referencedROINumber = refROISeq[0].uint16("x30060084");
  }

  return {
    dvhType,
    doseUnits,
    volumeUnits,
    doseScaling: dvhDoseScaling,
    minimumDose,
    maximumDose,
    meanDose,
    referencedROINumber,
    data: { doses, volumes },
  };
}

function parseRTPlan(dataSet: dicomParser.DataSet): DicomRTPlan {
  const plan: DicomRTPlan = {
    planName: dataSet.string("x300a0002") || "",
    planDescription: dataSet.string("x300a0003") || "",
    planDate: dataSet.string("x300a0006") || "",
    planTime: dataSet.string("x300a0007") || "",
    fractionGroups: [],
    beams: [],
  };

  // Fractions
  const fractionSeq = getSequence(dataSet, "x300a0070");
  if (fractionSeq) {
    for (const fgItem of fractionSeq) {
      const fg = {
        fractionGroupNumber: fgItem.uint16("x300a0071") || 1,
        numberOfFractionsPlanned: fgItem.uint16("x300a0078") || 1,
        numberOfBeams: fgItem.uint16("x300a0080") || 0,
        referencedBeams: [] as Array<{ beamNumber: number; beamDose: number; beamMeterset: number }>,
      };

      const refBeamSeq = getSequence(fgItem, "x300c0004");
      if (refBeamSeq) {
        for (const rbItem of refBeamSeq) {
          fg.referencedBeams.push({
            beamNumber: rbItem.uint16("x300c0006") || 1,
            beamDose: rbItem.floatString("x300a0084") || 0,
            beamMeterset: rbItem.floatString("x300a0086") || 0,
          });
        }
      }

      plan.fractionGroups.push(fg);
    }
  }

  // Faisceaux
  const beamSeq = getSequence(dataSet, "x300a00b0");
  if (beamSeq) {
    for (const beamItem of beamSeq) {
      plan.beams.push({
        beamNumber: beamItem.uint16("x300a00c0") || 1,
        beamName: beamItem.string("x300a00c2") || "",
        beamType: beamItem.string("x300a00c4") || "",
        radiationType: beamItem.string("x300a00c6") || "",
        treatmentMachineName: beamItem.string("x300a00b2") || "",
      });
    }
  }

  return plan;
}

// Helpers
function getSequence(dataSet: dicomParser.DataSet, tag: string): dicomParser.DataSet[] | null {
  const element = dataSet.elements[tag];
  if (!element?.items) return null;
  return element.items.map((item) => item.dataSet);
}

function parseFloatArray(str: string | undefined): number[] {
  if (!str) return [];
  return str
    .split("\\")
    .map(Number)
    .filter((n) => !isNaN(n));
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
  bitsAllocated: number,
): Float32Array | undefined {
  const pixelDataElement = dataSet.elements["x7fe00010"];
  if (!pixelDataElement) return undefined;

  const rows = dataSet.uint16("x00280010") || 0;
  const columns = dataSet.uint16("x00280011") || 0;
  const frames = dataSet.uint16("x00280008") || 1;
  const totalPixels = rows * columns * frames;

  const doseGridScaling = dataSet.floatString("x3004000e") || 1.0;
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
 * 🔥 CONVERSION CORRECTE DVH DICOM → Format App
 */
export function convertDicomDVHToAppFormat(
  structures: DicomRTStructure[],
  dvhs: DicomDVH[],
): Array<{
  name: string;
  roiNumber: number;
  relativeVolume: Array<{ dose: number; volume: number }>;
  absoluteVolume?: number;
}> {
  if (!dvhs?.length) return [];

  return dvhs.map((dvh) => {
    const structure = structures.find((s) => s.roiNumber === dvh.referencedROINumber);
    const maxVolume = Math.max(...dvh.data.volumes);

    // ✅ Les volumes DICOM sont DÉJÀ en % pour les DVH cumulatifs
    const relativeVolume = dvh.data.doses.map((dose, i) => ({
      dose,
      volume: dvh.data.volumes[i], // Direct DICOM value
    }));

    return {
      name: structure?.name || `ROI_${dvh.referencedROINumber}`,
      roiNumber: dvh.referencedROINumber || -1,
      relativeVolume,
      absoluteVolume: maxVolume, // Volume total en cm³
    };
  });
}
