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
  console.log("[DEBUG RTStruct] === PARSING RT STRUCTURE FILE ===");

  const structures: DicomRTStructure[] = [];
  const roiSequence = getSequence(dataSet, "x30060020");

  if (!roiSequence) {
    console.warn("[DEBUG RTStruct] No ROI Sequence (3006,0020) found!");
    return structures;
  }

  console.log(`[DEBUG RTStruct] Found ${roiSequence.length} ROIs in Structure Set ROI Sequence`);

  // 🔍 DEBUG 1: Afficher TOUS les numéros ROI avec leurs noms
  console.log("[DEBUG RTStruct] === ALL ROI DEFINITIONS ===");
  const roiMap = new Map<number, { name: string; description: string; algorithm: string }>();
  for (const roiItem of roiSequence) {
    // Essayer plusieurs méthodes pour lire le ROI Number
    let roiNumber = roiItem.uint16("x30060022");
    if (roiNumber === undefined) {
      roiNumber = roiItem.int16("x30060022");
    }
    if (roiNumber === undefined) {
      const roiStr = roiItem.string("x30060022");
      roiNumber = roiStr ? parseInt(roiStr, 10) : 0;
    }
    roiNumber = roiNumber || 0;

    const name = roiItem.string("x30060026") || `ROI_${roiNumber}`;
    const description = roiItem.string("x30060028") || "";
    const algorithm = roiItem.string("x30060036") || "";

    roiMap.set(roiNumber, { name, description, algorithm });

    console.log(`[DEBUG RTStruct] ROI #${roiNumber}: "${name}" (${description || "no desc"}) [${algorithm}]`);
  }

  // 🔍 DEBUG 2: RT ROI Observations Sequence (3006,0080)
  const observationsSeq = getSequence(dataSet, "x30060080");
  if (observationsSeq) {
    console.log("[DEBUG RTStruct] === RT ROI OBSERVATIONS ===");
    for (const obs of observationsSeq) {
      let obsROINumber = obs.uint16("x30060084");
      if (obsROINumber === undefined) {
        obsROINumber = obs.int16("x30060084");
      }
      if (obsROINumber === undefined) {
        const obsStr = obs.string("x30060084");
        obsROINumber = obsStr ? parseInt(obsStr, 10) : 0;
      }
      const obsLabel = obs.string("x30060085") || obs.string("x30060026") || "unknown";
      const obsType = obs.string("x30060088") || "unknown";
      console.log(`[DEBUG RTStruct] Observation ROI #${obsROINumber}: "${obsLabel}" type=${obsType}`);
    }
  }

  // Contours
  const contourSequence = getSequence(dataSet, "x30060039");
  if (!contourSequence) {
    console.log("[DEBUG RTStruct] No ROI Contour Sequence (3006,0039) found, trying 3006,0080...");
  }

  // Le vrai tag pour ROI Contour Sequence est 3006,0039, pas 3006,0080
  const actualContourSeq = contourSequence || getSequence(dataSet, "x30060080");
  if (!actualContourSeq) {
    console.warn("[DEBUG RTStruct] No contour sequence found!");
    return structures;
  }

  console.log(`[DEBUG RTStruct] Processing ${actualContourSeq.length} contour items`);

  for (const contourItem of actualContourSeq) {
    let roiNumber = contourItem.uint16("x30060084");
    if (roiNumber === undefined) {
      roiNumber = contourItem.int16("x30060084");
    }
    if (roiNumber === undefined) {
      const roiStr = contourItem.string("x30060084");
      roiNumber = roiStr ? parseInt(roiStr, 10) : 0;
    }
    roiNumber = roiNumber || 0;

    const roiInfo = roiMap.get(roiNumber);
    if (!roiInfo) {
      console.warn(`[DEBUG RTStruct] No ROI info found for ROI #${roiNumber}`);
      continue;
    }

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

  console.log(`[DEBUG RTStruct] === PARSED ${structures.length} STRUCTURES ===`);
  structures.forEach((s) => {
    console.log(`[DEBUG RTStruct] Structure: "${s.name}" ROI#${s.roiNumber}, ${s.contours.length} contours`);
  });

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
  console.log("[DEBUG RTDose] === PARSING RT DOSE FILE ===");

  // 🔍 DEBUG: Lister TOUS les éléments du dataset
  const allTags = Object.keys(dataSet.elements);
  console.log("[DEBUG RTDose] Total tags found:", allTags.length);

  // Chercher spécifiquement les tags 3004,xxxx (RT Dose module)
  const rtDoseTags = allTags.filter((tag) => tag.startsWith("x3004"));
  console.log("[DEBUG RTDose] RT Dose specific tags (3004,xxxx):", rtDoseTags);

  // Afficher les détails de chaque tag 3004
  for (const tag of rtDoseTags) {
    const element = dataSet.elements[tag];
    console.log(
      `[DEBUG RTDose] Tag ${tag}: VR=${element.vr || "unknown"}, length=${element.length}, hasItems=${!!element.items}`,
    );
    if (element.items) {
      console.log(`[DEBUG RTDose]   -> Sequence with ${element.items.length} items`);
    }
  }

  // 🔍 DEBUG 2: Vérifier les RT Plans référencés
  const refPlanSeq = getSequence(dataSet, "x300c0002");
  if (refPlanSeq) {
    console.log("[DEBUG RTDose] === REFERENCED RT PLAN SEQUENCE ===");
    for (const plan of refPlanSeq) {
      const sopUID = plan.string("x00081155") || "unknown";
      const sopClass = plan.string("x00081150") || "unknown";
      console.log(`[DEBUG RTDose] Referenced Plan SOP UID: ${sopUID}`);
      console.log(`[DEBUG RTDose] Referenced Plan SOP Class: ${sopClass}`);
    }
  } else {
    console.log("[DEBUG RTDose] No Referenced RT Plan Sequence found");
  }

  const doseUnitsRaw = dataSet.string("x30040002") || "GY";
  const doseGridScalingRaw = dataSet.floatString("x3004000e") || 1.0;

  console.log(`[DEBUG RTDose] 🔥 CRITICAL VALUES:`);
  console.log(`[DEBUG RTDose]   DoseUnits (3004,0002): "${doseUnitsRaw}"`);
  console.log(`[DEBUG RTDose]   DoseGridScaling (3004,000E): ${doseGridScalingRaw}`);
  console.log(`[DEBUG RTDose]   DoseType (3004,0004): "${dataSet.string("x30040004") || "PHYSICAL"}"`);
  console.log(`[DEBUG RTDose]   DoseSummationType (3004,000A): "${dataSet.string("x3004000a") || "PLAN"}"`);

  const dose: DicomRTDose = {
    doseUnits: doseUnitsRaw,
    doseType: dataSet.string("x30040004") || "PHYSICAL",
    doseSummationType: dataSet.string("x3004000a") || "PLAN",
    gridFrameOffsetVector: parseFloatArray(dataSet.string("x3004000c")),
    doseGridScaling: doseGridScalingRaw,
    rows: dataSet.uint16("x00280010") || 0,
    columns: dataSet.uint16("x00280011") || 0,
    pixelSpacing: parsePixelSpacing(dataSet.string("x00280030")),
    imagePositionPatient: parseImagePosition(dataSet.string("x00200032")),
    dvhs: [],
  };

  console.log(`[DEBUG RTDose] Dose grid: ${dose.rows} x ${dose.columns}`);

  // 🔥 PARSING DVH - Tag (3004,0050) DVH Sequence
  function parseDVH(dvhItem: dicomParser.DataSet, originalByteArray: Uint8Array): DicomDVH | null {
    // ... (code existant)

    // 🔥 CORRECTION: Parsing robuste des données DVH
    const dvhDataElement = dvhItem.elements["x30040058"];

    if (!dvhDataElement) {
      console.warn("[DVH] No DVH data found");
      return null;
    }

    let doses: number[] = [];
    let volumes: number[] = [];

    // Essayer d'abord comme chaîne de caractères (DS VR)
    const dvhDataString = dvhItem.string("x30040058");

    if (dvhDataString && dvhDataString.length > 0) {
      const rawValues = dvhDataString
        .split("\\")
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !isNaN(v));

      // 🔥 CORRECTION: Logique de détection de format améliorée
      const numberOfBins = parseInt(dvhItem.string("x30040056")?.replace(/[^\d]/g, "") || "0");

      // Format volume-only (bin width)
      if (numberOfBins > 0 && rawValues.length === numberOfBins) {
        const binWidth = dvhItem.floatString("x30040070") || 0.01;
        const unitFactor = doseUnits === "CGY" ? 0.01 : 1.0;

        for (let i = 0; i < rawValues.length; i++) {
          const doseValue = i * binWidth * dvhDoseScaling * unitFactor;
          const volumeValue = rawValues[i];
          doses.push(doseValue);
          volumes.push(volumeValue);
        }

        // Conversion différentiel → cumulatif si nécessaire
        if (dvhType === "DIFFERENTIAL") {
          const cumulativeVolumes = new Array(volumes.length);
          let runningSum = 0;
          for (let i = volumes.length - 1; i >= 0; i--) {
            runningSum += volumes[i];
            cumulativeVolumes[i] = runningSum;
          }
          volumes = cumulativeVolumes;
        }
      }
      // Format paire (dose, volume)
      else if (rawValues.length >= 2 && rawValues.length % 2 === 0) {
        const unitFactor = doseUnits === "CGY" ? 0.01 : 1.0;

        for (let i = 0; i < rawValues.length - 1; i += 2) {
          const doseValue = rawValues[i] * dvhDoseScaling * unitFactor;
          const volumeValue = rawValues[i + 1];
          doses.push(doseValue);
          volumes.push(volumeValue);
        }

        // Conversion différentiel → cumulatif
        if (dvhType === "DIFFERENTIAL") {
          // Trier par dose croissante
          const sortedIndices = doses.map((d, i) => i).sort((a, b) => doses[a] - doses[b]);
          const sortedDoses = sortedIndices.map((i) => doses[i]);
          const sortedVolumes = sortedIndices.map((i) => volumes[i]);

          const cumulativeVolumes = new Array(sortedVolumes.length);
          let runningSum = 0;
          for (let i = sortedVolumes.length - 1; i >= 0; i--) {
            runningSum += sortedVolumes[i];
            cumulativeVolumes[i] = runningSum;
          }

          doses = sortedDoses;
          volumes = cumulativeVolumes;
        }
      }
      // Format inconnu - fallback
      else {
        console.warn("[DVH] Unknown DVH format, using fallback");
        const binWidth = dvhItem.floatString("x30040070") || 0.01;
        const unitFactor = doseUnits === "CGY" ? 0.01 : 1.0;

        for (let i = 0; i < rawValues.length; i++) {
          const doseValue = i * binWidth * dvhDoseScaling * unitFactor;
          const volumeValue = rawValues[i];
          doses.push(doseValue);
          volumes.push(volumeValue);
        }
      }
    }
    // Format binaire
    else {
      // ... (code binaire existant)
    }

    // 🔥 CORRECTION: Calcul du volume total correct
    let totalVolume = 0;
    if (volumes.length > 0) {
      // Trouver le volume maximal (volume total)
      totalVolume = Math.max(...volumes);

      // Si le volume maximal est 0, utiliser le premier volume non nul
      if (totalVolume === 0) {
        for (const volume of volumes) {
          if (volume > 0) {
            totalVolume = volume;
            break;
          }
        }
      }
    }

    // 🔥 CORRECTION: Calcul de Dmax correct
    let calculatedDmax = 0;
    for (let i = 0; i < doses.length; i++) {
      if (volumes[i] > 0.001 && doses[i] > calculatedDmax) {
        calculatedDmax = doses[i];
      }
    }

    // Si aucun volume > 0, utiliser la dose maximale
    if (calculatedDmax === 0 && doses.length > 0) {
      calculatedDmax = Math.max(...doses);
    }

    // 🔥 CORRECTION: Calcul du Dmean correct
    let finalMeanDose = 0;
    if (doses.length > 1 && totalVolume > 0) {
      let weightedSum = 0;
      for (let i = 0; i < doses.length - 1; i++) {
        const deltaVolume = volumes[i] - volumes[i + 1];
        const avgDoseInBin = (doses[i] + doses[i + 1]) / 2;
        weightedSum += avgDoseInBin * deltaVolume;
      }
      finalMeanDose = weightedSum / totalVolume;
    }

    // 🔥 CORRECTION: Référencement du ROI
    let referencedROINumber: number | undefined;
    const refROISeq = getSequence(dvhItem, "x30040060");

    if (refROISeq?.length) {
      const roiItem = refROISeq[0];
      referencedROINumber =
        roiItem.uint16("x30060084") || roiItem.int16("x30060084") || parseInt(roiItem.string("x30060084") || "0");
    }

    return {
      dvhType,
      doseUnits: "GY",
      volumeUnits: dvhItem.string("x30040054") || "CM3",
      doseScaling: dvhDoseScaling,
      minimumDose: Math.min(...doses),
      maximumDose: calculatedDmax,
      meanDose: finalMeanDose,
      totalVolume,
      referencedROINumber,
      data: { doses, volumes },
    };
  }
  export function convertDicomDVHToAppFormat(
    structures: DicomRTStructure[],
    dvhs: DicomDVH[],
  ): Array<{
    name: string;
    roiNumber: number;
    relativeVolume: Array<{ dose: number; volume: number }>;
    absoluteVolume?: number;
  }> {
    return dvhs.map((dvh) => {
      const structure = structures.find((s) => s.roiNumber === dvh.referencedROINumber);

      // 🔥 CORRECTION: Gestion correcte des unités de volume
      const isAbsoluteVolume = dvh.volumeUnits === "CM3";
      const totalVolume = dvh.totalVolume || 0;

      const relativeVolume = dvh.data.doses.map((dose, i) => {
        const volume = dvh.data.volumes[i];
        return {
          dose,
          volume:
            isAbsoluteVolume && totalVolume > 0
              ? (volume / totalVolume) * 100 // Conversion cm³ → %
              : volume, // Déjà en %
        };
      });

      return {
        name: structure?.name || `ROI_${dvh.referencedROINumber}`,
        roiNumber: dvh.referencedROINumber || -1,
        relativeVolume,
        absoluteVolume: totalVolume,
      };
    });
  }
  function validateDVHData(dvh: DicomDVH): boolean {
    if (!dvh.data.doses || !dvh.data.volumes) return false;
    if (dvh.data.doses.length !== dvh.data.volumes.length) return false;
    if (dvh.data.doses.length === 0) return false;

    // Vérifier que les doses sont dans un ordre logique
    const isSorted = dvh.data.doses.every((d, i) => i === 0 || d >= dvh.data.doses[i - 1]);
    if (!isSorted && dvh.dvhType === "CUMULATIVE") {
      console.warn("[DVH] Unsorted cumulative DVH data");
    }

    return true;
  }

  function debugDVH(dvh: DicomDVH) {
    console.log(`[DVH DEBUG] ROI #${dvh.referencedROINumber}`);
    console.log(`[DVH DEBUG] Type: ${dvh.dvhType}, Units: ${dvh.volumeUnits}`);
    console.log(`[DVH DEBUG] Doses: ${dvh.data.doses.length} points`);
    console.log(`[DVH DEBUG] Volume: ${dvh.totalVolume.toFixed(2)} ${dvh.volumeUnits}`);
    console.log(
      `[DVH DEBUG] Dose range: ${Math.min(...dvh.data.doses).toFixed(2)} - ${Math.max(...dvh.data.doses).toFixed(2)} Gy`,
    );
    console.log(
      `[DVH DEBUG] Volume range: ${Math.min(...dvh.data.volumes).toFixed(2)} - ${Math.max(...dvh.data.volumes).toFixed(2)} ${dvh.volumeUnits}`,
    );
  }

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

    // 🔥 CORRECTION #1: Utiliser totalVolume directement (volume à dose 0)
    const totalVolume = dvh.totalVolume || dvh.data.volumes[0] || 0;

    // 🔥 CORRECTION #3: Conversion conditionnelle cm³ → %
    // Si volumeUnits = "CM3", les volumes sont absolus → convertir en %
    // Si volumeUnits = "PERCENT", les volumes sont déjà en %
    const isAbsoluteVolume = dvh.volumeUnits === "CM3";

    const relativeVolume = dvh.data.doses.map((dose, i) => ({
      dose,
      volume:
        isAbsoluteVolume && totalVolume > 0
          ? (dvh.data.volumes[i] / totalVolume) * 100 // Conversion cm³ → %
          : dvh.data.volumes[i], // Déjà en %
    }));

    console.log(
      `[DVH Convert] ${structure?.name || `ROI_${dvh.referencedROINumber}`}: totalVolume=${totalVolume.toFixed(2)} cm³, volumeUnits=${dvh.volumeUnits}, converted=${isAbsoluteVolume}`,
    );

    return {
      name: structure?.name || `ROI_${dvh.referencedROINumber}`,
      roiNumber: dvh.referencedROINumber || -1,
      relativeVolume,
      absoluteVolume: totalVolume, // 🔥 CORRECTION: utiliser totalVolume, pas maxVolume
    };
  });
}
