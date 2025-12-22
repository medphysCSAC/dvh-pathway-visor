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
  const roiMap = new Map<number, { name: string; description: string; algorithm: string; roiType: string }>();
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

    roiMap.set(roiNumber, { name, description, algorithm, roiType: "" });

    console.log(`[DEBUG RTStruct] ROI #${roiNumber}: "${name}" (${description || "no desc"}) [${algorithm}]`);
  }

  // 🔍 DEBUG 2: RT ROI Observations Sequence (3006,0080) - contient RTROIInterpretedType
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
      // RTROIInterpretedType (3006,00A4) - ex: PTV, CTV, GTV, OAR, EXTERNAL, AVOIDANCE, etc.
      const obsType = obs.string("x300600a4") || obs.string("x30060088") || "";
      console.log(`[DEBUG RTStruct] Observation ROI #${obsROINumber}: "${obsLabel}" type="${obsType}"`);
      
      // Mettre à jour roiMap avec le type interprété
      const existingRoi = roiMap.get(obsROINumber);
      if (existingRoi) {
        existingRoi.roiType = obsType;
      }
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
      roiInterpretedType: roiInfo.roiType || undefined,
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
  const dvhSequence = getSequence(dataSet, "x30040050");
  console.log("[DEBUG RTDose] DVH Sequence (x30040050):", dvhSequence ? `${dvhSequence.length} items` : "NOT FOUND");

  if (dvhSequence && dvhSequence.length > 0) {
    for (let idx = 0; idx < dvhSequence.length; idx++) {
      const dvhItem = dvhSequence[idx];
      console.log(`\n[DEBUG RTDose] ======= DVH ITEM ${idx + 1}/${dvhSequence.length} =======`);

      // Debug: afficher tous les tags de cet item DVH
      const dvhTags = Object.keys(dvhItem.elements);
      console.log(`[DEBUG RTDose] DVH item tags:`, dvhTags.join(", "));

      const dvh = parseDVH(dvhItem, byteArray);
      if (dvh) {
        dose.dvhs.push(dvh);
        console.log(
          `[DEBUG RTDose] ✅ DVH parsed for ROI #${dvh.referencedROINumber}: ${dvh.data.doses.length} points, Dmax=${dvh.maximumDose.toFixed(2)}Gy`,
        );
      } else {
        console.log(`[DEBUG RTDose] ❌ Failed to parse DVH item ${idx + 1}`);
      }
    }
  } else {
    console.log("[DEBUG RTDose] ⚠️ No DVH Sequence found in this RT Dose file");
  }

  console.log(`\n[DEBUG RTDose] === PARSING COMPLETE: ${dose.dvhs.length} DVH(s) extracted ===`);

  // Données 3D dose - OPTIONNEL et avec gestion d'erreur mémoire
  // On ne charge la grille 3D que si nécessaire (pas requis pour DVH pré-calculés)
  const pixelDataElement = dataSet.elements["x7fe00010"];
  if (pixelDataElement) {
    const rows = dataSet.uint16("x00280010") || 0;
    const columns = dataSet.uint16("x00280011") || 0;
    const frames = parseInt(dataSet.string("x00280008") || "1", 10);
    const totalPixels = rows * columns * frames;
    const estimatedMemoryMB = (totalPixels * 4) / (1024 * 1024);

    console.log(
      `[DICOM RT] Dose grid: ${rows}x${columns}x${frames} = ${totalPixels} voxels (~${estimatedMemoryMB.toFixed(1)} MB)`,
    );

    // Limiter à 500MB pour éviter crash navigateur
    if (estimatedMemoryMB < 500) {
      try {
        const bitsAllocated = dataSet.uint16("x00280100") || 16;
        dose.doseData = extractDoseData(dataSet, byteArray, bitsAllocated);
        console.log("[DICOM RT] ✅ Dose data extracted:", dose.doseData?.length, "voxels");
      } catch (memError) {
        console.warn("[DICOM RT] ⚠️ Could not load 3D dose grid (memory limit):", memError);
        console.log("[DICOM RT] DVH data is still available if present in file");
      }
    } else {
      console.log(`[DICOM RT] ⚠️ Skipping 3D dose grid (${estimatedMemoryMB.toFixed(0)} MB exceeds browser limit)`);
      console.log("[DICOM RT] DVH data will be used directly from DICOM if available");
    }
  }

  return dose;
}

function parseDVH(dvhItem: dicomParser.DataSet, originalByteArray: Uint8Array): DicomDVH | null {
  console.log("[DEBUG DVH] --- Parsing single DVH item ---");

  // Type de DVH: DIFFERENTIAL ou CUMULATIVE
  const dvhType = dvhItem.string("x30040001") || "CUMULATIVE";
  // Unités de dose: GY ou CGY
  const doseUnits = dvhItem.string("x30040002") || "GY";
  // Type de dose pour le DVH (PHYSICAL, EFFECTIVE, ERROR)
  const doseType = dvhItem.string("x30040004") || "PHYSICAL";

  // DVH Dose Scaling (3004,0052) - factor to multiply dose values
  const dvhDoseScaling = dvhItem.floatString("x30040052") || 1.0;

  // DVH Volume Units (3004,0054) - CM3 or PERCENT
  const volumeUnits = dvhItem.string("x30040054") || "CM3";

  // Number of Bins (3004,0056) - VR=IS (Integer String) selon DICOM
  // ⚠️ NE PAS utiliser uint32/uint16 qui interprète mal les octets ASCII!
  let numberOfBins = 0;
  try {
    const numberOfBinsStr = dvhItem.string("x30040056");
    if (numberOfBinsStr) {
      // Nettoyer tous les espaces et caractères non-numériques
      const cleaned = numberOfBinsStr.replace(/[^\d]/g, "");
      numberOfBins = parseInt(cleaned, 10) || 0;
    }
    // Fallback: essayer intString si string échoue
    if (numberOfBins === 0) {
      numberOfBins = dvhItem.intString("x30040056") || 0;
    }
  } catch (e) {
    console.warn("[DVH] Failed to parse numberOfBins:", e);
  }

  // 🔥 DVH Minimum Dose Bin Width (3004,0070) - CRITICAL for dose calculation!
  const dvhMinBinWidth = dvhItem.floatString("x30040070");

  // DVH Data element (3004,0058) - contient les données DVH
  const dvhDataElement = dvhItem.elements["x30040058"];

  console.log(`[DEBUG DVH] 🔥 CRITICAL DVH PARAMETERS:`);
  console.log(`[DEBUG DVH]   DVH Type (3004,0001): "${dvhType}"`);
  console.log(`[DEBUG DVH]   Dose Units (3004,0002): "${doseUnits}"`);
  console.log(`[DEBUG DVH]   Dose Type (3004,0004): "${doseType}"`);
  console.log(`[DEBUG DVH]   DVH Dose Scaling (3004,0052): ${dvhDoseScaling}`);
  console.log(`[DEBUG DVH]   Volume Units (3004,0054): "${volumeUnits}"`);
  console.log(`[DEBUG DVH]   Number of Bins (3004,0056): ${numberOfBins}`);
  console.log(`[DEBUG DVH]   DVH Minimum Dose Bin Width (3004,0070): ${dvhMinBinWidth}`);

  // 🔍 DEBUG: Statistiques de dose DICOM brutes (avant conversion d'unités)
  const debugMinDose = dvhItem.floatString("x30040072");
  const debugMaxDose = dvhItem.floatString("x30040074");
  const debugMeanDose = dvhItem.floatString("x30040076");

  console.log(`[DEBUG DVH] 📊 DICOM STATISTICS (raw from file, before unit conversion):`);
  console.log(`[DEBUG DVH]   DVH Minimum Dose (3004,0072): ${debugMinDose} ${doseUnits}`);
  console.log(`[DEBUG DVH]   DVH Maximum Dose (3004,0074): ${debugMaxDose} ${doseUnits}`);
  console.log(`[DEBUG DVH]   DVH Mean Dose (3004,0076): ${debugMeanDose} ${doseUnits}`);

  if (!dvhDataElement) {
    console.warn("[DEBUG DVH] ❌ DVH Data element (3004,0058) not found!");
    return null;
  }

  console.log(
    `[DEBUG DVH] DVH Data element: offset=${dvhDataElement.dataOffset}, length=${dvhDataElement.length}, VR=${dvhDataElement.vr || "unknown"}`,
  );

  // 🔥 DEBUG 3: Valeurs DVH brutes
  console.log(`[DEBUG DVH] 🔍 RAW DVH BUFFER INFO:`);
  console.log(`[DEBUG DVH]   dataOffset: ${dvhDataElement.dataOffset}`);
  console.log(`[DEBUG DVH]   length: ${dvhDataElement.length} bytes`);

  // 🔥 LECTURE CORRECTE DES DONNÉES DVH
  let doses: number[] = [];
  let volumes: number[] = [];

  // Essayer d'abord comme chaîne de caractères (DS VR - le plus commun)
  const dvhDataString = dvhItem.string("x30040058");

  if (dvhDataString && dvhDataString.length > 0) {
    // Format DS: valeurs séparées par des backslashes
    const rawValues = dvhDataString
      .split("\\")
      .map((v) => parseFloat(v.trim()))
      .filter((v) => !isNaN(v));

    console.log(`[DEBUG DVH] 🔍 RAW DVH VALUES (string format):`);
    console.log(`[DEBUG DVH]   Total values: ${rawValues.length}`);
    console.log(`[DEBUG DVH]   First 20 values: [${rawValues.slice(0, 20).join(", ")}]`);
    console.log(`[DEBUG DVH]   Last 10 values: [${rawValues.slice(-10).join(", ")}]`);
    console.log(`[DEBUG DVH]   Min raw value: ${Math.min(...rawValues)}`);
    console.log(`[DEBUG DVH]   Max raw value: ${Math.max(...rawValues)}`);

    // 🔥 DÉTECTION DU FORMAT DVH - ORDRE CORRIGÉ
    // 1. D'abord vérifier VOLUME-ONLY si numberOfBins correspond
    // 2. Ensuite PAIRED si nombre pair >= 2
    // Référence: DICOM PS3.3 C.8.8.3.3

    console.log(`[DEBUG DVH] Format detection: ${rawValues.length} values, type=${dvhType}, bins=${numberOfBins}`);

    // 🔥 BUG #1 FIX: Vérifier VOLUME-ONLY EN PREMIER
    if (numberOfBins > 0 && rawValues.length === numberOfBins) {
      // Format alternatif: Volumes seuls avec doses calculées par bin width
      console.log(`[DICOM RT] Detected VOLUME-ONLY format with ${numberOfBins} bins`);

      const binWidth = dvhMinBinWidth || 0.01;
      const tempDoses: number[] = [];
      const tempVolumes: number[] = [];

      const unitFactor = doseUnits === "CGY" ? 0.01 : 1.0;

      for (let i = 0; i < rawValues.length; i++) {
        const doseValue = i * binWidth * dvhDoseScaling * unitFactor;
        tempDoses.push(doseValue);
        tempVolumes.push(rawValues[i]);
      }

      // Conversion DIFFERENTIAL si nécessaire
      if (dvhType === "DIFFERENTIAL") {
        console.log(`[DICOM RT] 🔄 Converting DIFFERENTIAL (volume-only) to CUMULATIVE...`);
        const cumulativeVolumes: number[] = new Array(tempVolumes.length);
        let runningSum = 0;

        for (let i = tempVolumes.length - 1; i >= 0; i--) {
          runningSum += tempVolumes[i];
          cumulativeVolumes[i] = runningSum;
        }

        doses = tempDoses;
        volumes = cumulativeVolumes;
      } else {
        doses = tempDoses;
        volumes = tempVolumes;
      }

      console.log(`[DICOM RT] Generated ${doses.length} dose points from bin width ${binWidth}`);
    }
    // Format PAIRES: dose1, volume1, dose2, volume2, ... (standard DICOM)
    else if (rawValues.length >= 2 && rawValues.length % 2 === 0) {
      console.log(`[DICOM RT] Detected PAIRED format: ${rawValues.length / 2} points, type=${dvhType}`);

      // 🔥 CRITICAL FIX - dicompyler-core/dvh.py:220
      // En format PAIRED, les doses sont stockées comme INCRÉMENTS (bin widths), PAS comme valeurs absolues!
      // dicompyler-core fait TOUJOURS: bins = cumsum(raw_doses) * DVHDoseScaling
      
      const rawDoseBins: number[] = [];
      const tempVolumes: number[] = [];
      const unitFactor = doseUnits === "CGY" ? 0.01 : 1.0;

      // Étape 1: Extraire les valeurs brutes SANS scaling pour analyse
      for (let i = 0; i < rawValues.length - 1; i += 2) {
        rawDoseBins.push(rawValues[i]);
        tempVolumes.push(rawValues[i + 1]);
      }

      console.log(`[DEBUG DVH] 📊 Raw dose bins (before processing):`);
      console.log(`[DEBUG DVH]   First 10: [${rawDoseBins.slice(0, 10).map(d => d.toFixed(4)).join(", ")}]`);
      console.log(`[DEBUG DVH]   Unique values count: ${new Set(rawDoseBins.map(d => d.toFixed(6))).size}`);

      // 🔥 ÉTAPE 2: Détecter si les doses sont des incréments réguliers
      // Critère dicompyler-core: toutes les valeurs de dose brutes sont identiques (= bin width constant)
      const uniqueRawDoses = new Set(rawDoseBins.map(d => d.toFixed(6)));
      const allDosesSameOrSimilar = uniqueRawDoses.size <= 5; // Tolère petites variations numériques
      
      // Vérifier aussi: toutes les valeurs sont proches de la première
      const firstRawDose = rawDoseBins[0];
      const incrementsAreConstant = rawDoseBins.length > 2 && firstRawDose > 0 &&
        rawDoseBins.slice(0, Math.min(50, rawDoseBins.length)).every(d => 
          Math.abs(d - firstRawDose) / firstRawDose < 0.01 // 1% tolérance
        );

      let tempDoses: number[] = [];

      if (allDosesSameOrSimilar || incrementsAreConstant) {
        // 🔥 FORMAT INCRÉMENTS: appliquer CUMSUM comme dicompyler-core
        console.log(`[DICOM RT] 🔄 INCREMENTAL dose format detected - applying CUMSUM`);
        console.log(`[DICOM RT]   Raw bin width: ${firstRawDose.toFixed(6)}`);
        console.log(`[DICOM RT]   DVHDoseScaling: ${dvhDoseScaling}`);
        console.log(`[DICOM RT]   Unit factor (CGY->GY): ${unitFactor}`);
        console.log(`[DICOM RT]   Scaled bin width: ${(firstRawDose * dvhDoseScaling * unitFactor).toFixed(6)} Gy`);
        
        // cumsum: [a, a, a, a] -> [a, 2a, 3a, 4a] puis scaling
        let cumulativeDose = 0;
        for (let i = 0; i < rawDoseBins.length; i++) {
          cumulativeDose += rawDoseBins[i];
          tempDoses.push(cumulativeDose * dvhDoseScaling * unitFactor);
        }
        
        console.log(`[DICOM RT]   After cumsum+scaling: first=${tempDoses[0].toFixed(4)}, last=${tempDoses[tempDoses.length-1].toFixed(4)} Gy`);
      } else {
        // FORMAT ABSOLU: les doses sont déjà des valeurs absolues
        console.log(`[DICOM RT] 📊 ABSOLUTE dose format detected - no cumsum needed`);
        console.log(`[DICOM RT]   DVHDoseScaling: ${dvhDoseScaling}, unitFactor: ${unitFactor}`);
        
        for (let i = 0; i < rawDoseBins.length; i++) {
          tempDoses.push(rawDoseBins[i] * dvhDoseScaling * unitFactor);
        }
        
        console.log(`[DICOM RT]   Dose range: ${tempDoses[0].toFixed(4)} - ${tempDoses[tempDoses.length-1].toFixed(4)} Gy`);
      }

      // 🔥 ÉTAPE 3: Conversion DIFFERENTIAL -> CUMULATIVE si nécessaire
      if (dvhType === "DIFFERENTIAL") {
        console.log(`[DICOM RT] 🔄 Converting DIFFERENTIAL to CUMULATIVE DVH...`);

        // Détecter si déjà trié
        const isAscending = tempDoses.every((d, i) => i === 0 || d >= tempDoses[i - 1]);
        const isDescending = tempDoses.every((d, i) => i === 0 || d <= tempDoses[i - 1]);

        let sortedDoses: number[];
        let sortedDiffVolumes: number[];

        if (isAscending) {
          sortedDoses = tempDoses;
          sortedDiffVolumes = tempVolumes;
        } else if (isDescending) {
          sortedDoses = [...tempDoses].reverse();
          sortedDiffVolumes = [...tempVolumes].reverse();
        } else {
          const sortedIndices = tempDoses.map((d, i) => i).sort((a, b) => tempDoses[a] - tempDoses[b]);
          sortedDoses = sortedIndices.map((i) => tempDoses[i]);
          sortedDiffVolumes = sortedIndices.map((i) => tempVolumes[i]);
        }

        // dicompyler-core: cumsum from high dose to low dose
        const cumulativeVolumes: number[] = new Array(sortedDiffVolumes.length);
        let runningSum = 0;

        for (let i = sortedDiffVolumes.length - 1; i >= 0; i--) {
          runningSum += sortedDiffVolumes[i];
          cumulativeVolumes[i] = runningSum;
        }

        doses = sortedDoses;
        volumes = cumulativeVolumes;

        console.log(`[DICOM RT] ✅ Converted to CUMULATIVE: ${doses.length} points`);
        console.log(`[DICOM RT]   Dose range: ${doses[0].toFixed(2)} - ${doses[doses.length - 1].toFixed(2)} Gy`);
      } else {
        // CUMULATIVE: s'assurer que c'est trié par dose croissante
        const isAscending = tempDoses.every((d, i) => i === 0 || d >= tempDoses[i - 1]);
        if (!isAscending) {
          const sortedIndices = tempDoses.map((d, i) => i).sort((a, b) => tempDoses[a] - tempDoses[b]);
          doses = sortedIndices.map((i) => tempDoses[i]);
          volumes = sortedIndices.map((i) => tempVolumes[i]);
        } else {
          doses = tempDoses;
          volumes = tempVolumes;
        }
      }
    } else {
      // Fallback: traiter comme des volumes seuls
      console.log(`[DICOM RT] Fallback: treating ${rawValues.length} values as volume bins`);

      const binWidth = dvhMinBinWidth || 0.01;
      const unitFactor = doseUnits === "CGY" ? 0.01 : 1.0;

      for (let i = 0; i < rawValues.length; i++) {
        const doseValue = i * binWidth * dvhDoseScaling * unitFactor;
        doses.push(doseValue);
        volumes.push(rawValues[i]);
      }
    }

    console.log(`[DICOM RT] Parsed DVH: ${doses.length} points`);
    console.log(`[DICOM RT] Dose range: ${Math.min(...doses).toFixed(2)} - ${Math.max(...doses).toFixed(2)} Gy`);
    console.log(
      `[DICOM RT] Volume range: ${Math.min(...volumes).toFixed(2)} - ${Math.max(...volumes).toFixed(2)} ${volumeUnits}`,
    );
  } else {
    // Format binaire (moins commun mais possible)
    const offset = dvhDataElement.dataOffset;
    const length = dvhDataElement.length;

    if (offset !== undefined && length > 0) {
      try {
        const numValues = length / 4; // Float32
        const dataView = new DataView(originalByteArray.buffer, offset, length);

        console.log(`[DICOM RT] Parsing binary DVH: ${numValues} float32 values`);

        // Format standard: paires [dose, volume]
        const tempDoses: number[] = [];
        const tempVolumes: number[] = [];

        for (let i = 0; i < numValues - 1; i += 2) {
          let doseValue = dataView.getFloat32(i * 4, true) * dvhDoseScaling;
          const volumeValue = dataView.getFloat32((i + 1) * 4, true);

          if (doseUnits === "CGY") {
            doseValue = doseValue / 100.0;
          }

          if (!isNaN(doseValue) && !isNaN(volumeValue)) {
            tempDoses.push(doseValue);
            tempVolumes.push(volumeValue);
          }
        }

        // 🔥 CONVERSION DIFFERENTIAL → CUMULATIVE pour format binaire
        if (dvhType === "DIFFERENTIAL" && tempDoses.length > 0) {
          console.log(`[DICOM RT] 🔄 Converting binary DIFFERENTIAL to CUMULATIVE...`);

          const sortedIndices = tempDoses.map((d, i) => i).sort((a, b) => tempDoses[a] - tempDoses[b]);
          const sortedDoses = sortedIndices.map((i) => tempDoses[i]);
          const sortedDiffVolumes = sortedIndices.map((i) => tempVolumes[i]);

          const cumulativeVolumes: number[] = new Array(sortedDiffVolumes.length);
          let runningSum = 0;

          for (let i = sortedDiffVolumes.length - 1; i >= 0; i--) {
            runningSum += sortedDiffVolumes[i];
            cumulativeVolumes[i] = runningSum;
          }

          doses = sortedDoses;
          volumes = cumulativeVolumes;
        } else {
          doses = tempDoses;
          volumes = tempVolumes;
        }

        console.log(`[DICOM RT] Parsed binary DVH: ${doses.length} points`);
      } catch (err) {
        console.warn("[DICOM RT] Failed to parse binary DVH data:", err);
      }
    }
  }

  if (doses.length === 0) {
    console.warn("[DICOM RT] No DVH data points extracted");
    return null;
  }

  // 🔥 BUG #2 FIX: Volume total = volume à la dose la plus proche de 0
  // Trouver l'index de la dose minimale (la plus proche de 0)
  let totalVolume = 0;
  if (doses.length > 0 && volumes.length > 0) {
    // Trouver l'index de la dose la plus basse
    let minDoseIdx = 0;
    let minDose = doses[0];
    for (let i = 1; i < doses.length; i++) {
      if (doses[i] < minDose) {
        minDose = doses[i];
        minDoseIdx = i;
      }
    }
    totalVolume = volumes[minDoseIdx];

    // Fallback: si le volume à dose min est 0, prendre le max des volumes
    if (totalVolume <= 0) {
      totalVolume = Math.max(...volumes);
    }
  }

  console.log(`[DEBUG DVH] 🔥 VOLUME CALCULATION (BUG #2 FIXED):`);
  console.log(`[DEBUG DVH]   Min dose: ${Math.min(...doses).toFixed(2)} Gy`);
  console.log(`[DEBUG DVH]   Volume at min dose: ${totalVolume.toFixed(4)} ${volumeUnits}`);
  console.log(`[DEBUG DVH]   → Total Volume = ${totalVolume.toFixed(4)} ${volumeUnits}`);

  // ✅ HARMONISÉ avec dvhParser: Dmax = Math.max(...doses)
  const calculatedDmax = doses.length > 0 ? Math.max(...doses) : 0;

  console.log(`[DEBUG DVH] ✅ DMAX CALCULATION (harmonisé dvhParser):`);
  console.log(`[DEBUG DVH]   Dose range: ${Math.min(...doses).toFixed(2)} - ${Math.max(...doses).toFixed(2)} Gy`);
  console.log(`[DEBUG DVH]   → Dmax = ${calculatedDmax.toFixed(2)} Gy`);

  // 🔥 Statistiques de dose DICOM (pour validation/comparaison)
  const doseConversionFactor = doseUnits === "CGY" ? 0.01 : 1.0;

  const dicomMinDoseRaw = dvhItem.floatString("x30040072");
  const dicomMaxDoseRaw = dvhItem.floatString("x30040074");
  const dicomMeanDoseRaw = dvhItem.floatString("x30040076");

  const dicomMinDose = dicomMinDoseRaw !== undefined ? dicomMinDoseRaw * doseConversionFactor : null;
  const dicomMaxDose = dicomMaxDoseRaw !== undefined ? dicomMaxDoseRaw * doseConversionFactor : null;
  const dicomMeanDose = dicomMeanDoseRaw !== undefined ? dicomMeanDoseRaw * doseConversionFactor : 0;

  // Utiliser les valeurs DICOM si disponibles, sinon nos calculs
  const finalMinDose = dicomMinDose !== null ? dicomMinDose : Math.min(...doses);
  const finalMaxDose = dicomMaxDose !== null ? dicomMaxDose : calculatedDmax;

  // ✅ CALCUL DMEAN harmonisé avec dvhParser: intégration trapézoïdale
  let finalMeanDose = dicomMeanDose;
  if (finalMeanDose === 0 && doses.length > 1) {
    // Méthode identique à dvhParser.ts: intégration trapézoïdale
    let dmean = 0;
    for (let i = 0; i < doses.length - 1; i++) {
      const dose1 = doses[i];
      const dose2 = doses[i + 1];
      const vol1 = volumes[i];
      const vol2 = volumes[i + 1];
      // Math.abs() pour robustesse si DVH non-monotone
      dmean += ((dose1 + dose2) / 2) * Math.abs(vol2 - vol1);
    }
    // Normalisation par 100 car volumes sont en % (0-100)
    finalMeanDose = dmean / 100;
    
    console.log(`[DEBUG DVH]   ✅ Mean Dose CALCULATED (harmonisé dvhParser):`);
    console.log(`[DEBUG DVH]      → Dmean = ${finalMeanDose.toFixed(2)} Gy`);
  }

  // 🔥 VALIDATION CROISÉE: comparer nos calculs avec les valeurs DICOM
  const discrepancyThreshold = 0.1; // 10% de différence acceptable
  if (dicomMaxDose !== null && calculatedDmax > 0) {
    const discrepancy = Math.abs(dicomMaxDose - calculatedDmax) / dicomMaxDose;
    if (discrepancy > discrepancyThreshold) {
      console.warn(`[DEBUG DVH] ⚠️ DMAX DISCREPANCY: DICOM=${dicomMaxDose.toFixed(2)} vs Calculated=${calculatedDmax.toFixed(2)} (${(discrepancy * 100).toFixed(1)}% diff)`);
    }
  }

  console.log(`[DEBUG DVH] 📊 FINAL VALUES:`);
  console.log(`[DEBUG DVH]   Min Dose: ${finalMinDose.toFixed(2)} Gy (DICOM: ${dicomMinDose?.toFixed(2) || "N/A"})`);
  console.log(
    `[DEBUG DVH]   Max Dose: ${finalMaxDose.toFixed(2)} Gy (DICOM: ${dicomMaxDose?.toFixed(2) || "N/A"}, Calculated: ${calculatedDmax.toFixed(2)})`,
  );
  console.log(
    `[DEBUG DVH]   Mean Dose: ${finalMeanDose.toFixed(2)} Gy ${dicomMeanDose === 0 ? "(calculated)" : "(DICOM)"}`,
  );
  console.log(`[DEBUG DVH]   Total Volume: ${totalVolume.toFixed(4)} ${volumeUnits}`);

  // 🔥 ROI référencé - via DVH Referenced ROI Sequence (3004,0060)
  let referencedROINumber: number | undefined;
  const refROISeq = getSequence(dvhItem, "x30040060");

  if (refROISeq?.length) {
    const roiItem = refROISeq[0];

    // Essayer plusieurs méthodes de lecture
    referencedROINumber = roiItem.uint16("x30060084");

    if (referencedROINumber === undefined) {
      referencedROINumber = roiItem.int16("x30060084");
    }

    if (referencedROINumber === undefined) {
      const roiString = roiItem.string("x30060084");
      if (roiString) {
        referencedROINumber = parseInt(roiString, 10);
      }
    }

    console.log(`[DEBUG DVH] Referenced ROI Number: ${referencedROINumber}`);
  } else {
    console.warn("[DEBUG DVH] No DVH Referenced ROI Sequence found");
  }

  return {
    dvhType,
    doseUnits: "GY",
    volumeUnits,
    doseScaling: dvhDoseScaling,
    minimumDose: finalMinDose,
    maximumDose: finalMaxDose,
    meanDose: finalMeanDose,
    totalVolume,
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
