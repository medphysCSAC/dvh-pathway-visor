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
    
    console.log(`[DEBUG RTStruct] ROI #${roiNumber}: "${name}" (${description || 'no desc'}) [${algorithm}]`);
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
  structures.forEach(s => {
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
  const rtDoseTags = allTags.filter(tag => tag.startsWith("x3004"));
  console.log("[DEBUG RTDose] RT Dose specific tags (3004,xxxx):", rtDoseTags);
  
  // Afficher les détails de chaque tag 3004
  for (const tag of rtDoseTags) {
    const element = dataSet.elements[tag];
    console.log(`[DEBUG RTDose] Tag ${tag}: VR=${element.vr || 'unknown'}, length=${element.length}, hasItems=${!!element.items}`);
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
  console.log(`[DEBUG RTDose]   DoseType (3004,0004): "${dataSet.string("x30040004") || 'PHYSICAL'}"`);
  console.log(`[DEBUG RTDose]   DoseSummationType (3004,000A): "${dataSet.string("x3004000a") || 'PLAN'}"`);

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
        console.log(`[DEBUG RTDose] ✅ DVH parsed for ROI #${dvh.referencedROINumber}: ${dvh.data.doses.length} points, Dmax=${dvh.maximumDose.toFixed(2)}Gy`);
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
    
    console.log(`[DICOM RT] Dose grid: ${rows}x${columns}x${frames} = ${totalPixels} voxels (~${estimatedMemoryMB.toFixed(1)} MB)`);
    
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
  
  // Number of Bins (3004,0056) - nombre de points DVH
  const numberOfBins = dvhItem.uint32("x30040056") || dvhItem.uint16("x30040056") || 0;
  
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
  
  // 🔍 DEBUG: Statistiques de dose DICOM (très important pour validation!)
  const dicomMinDose = dvhItem.floatString("x30040072");
  const dicomMaxDose = dvhItem.floatString("x30040074");
  const dicomMeanDose = dvhItem.floatString("x30040076");
  
  console.log(`[DEBUG DVH] 📊 DICOM STATISTICS (from file):`);
  console.log(`[DEBUG DVH]   DVH Minimum Dose (3004,0072): ${dicomMinDose}`);
  console.log(`[DEBUG DVH]   DVH Maximum Dose (3004,0074): ${dicomMaxDose}`);
  console.log(`[DEBUG DVH]   DVH Mean Dose (3004,0076): ${dicomMeanDose}`);
  
  if (!dvhDataElement) {
    console.warn("[DEBUG DVH] ❌ DVH Data element (3004,0058) not found!");
    return null;
  }
  
  console.log(`[DEBUG DVH] DVH Data element: offset=${dvhDataElement.dataOffset}, length=${dvhDataElement.length}, VR=${dvhDataElement.vr || 'unknown'}`);

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
    const rawValues = dvhDataString.split("\\").map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    
    console.log(`[DEBUG DVH] 🔍 RAW DVH VALUES (string format):`);
    console.log(`[DEBUG DVH]   Total values: ${rawValues.length}`);
    console.log(`[DEBUG DVH]   First 20 values: [${rawValues.slice(0, 20).join(", ")}]`);
    console.log(`[DEBUG DVH]   Last 10 values: [${rawValues.slice(-10).join(", ")}]`);
    console.log(`[DEBUG DVH]   Min raw value: ${Math.min(...rawValues)}`);
    console.log(`[DEBUG DVH]   Max raw value: ${Math.max(...rawValues)}`);
    
    // 🔥 DÉTECTION DU FORMAT DVH
    // Format 1: Paires dose/volume alternées (moins courant)
    // Format 2: Volumes seuls avec doses calculées par bin width (PLUS COURANT pour CUMULATIVE)
    
    if (dvhType === "CUMULATIVE" && numberOfBins > 0 && rawValues.length === numberOfBins) {
      // 🔥 FORMAT CUMULATIVE: Volumes seuls, doses calculées
      console.log(`[DICOM RT] Detected CUMULATIVE format with ${numberOfBins} bins`);
      
      // Calculer la largeur de bin
      const binWidth = dvhMinBinWidth || 0.01; // Défaut 1 cGy = 0.01 Gy
      
      for (let i = 0; i < rawValues.length; i++) {
        let doseValue = i * binWidth * dvhDoseScaling;
        
        // 🔥 CONVERSION cGy → Gy si nécessaire
        if (doseUnits === "CGY") {
          doseValue = doseValue / 100.0;
        }
        
        doses.push(doseValue);
        volumes.push(rawValues[i]); // Volume déjà en % ou cm³
      }
      
      console.log(`[DICOM RT] Generated ${doses.length} dose points from bin width ${binWidth}`);
    } else if (rawValues.length >= 2 && rawValues.length % 2 === 0) {
      // 🔥 FORMAT PAIRES: dose1, volume1, dose2, volume2, ...
      console.log(`[DICOM RT] Detected PAIRED format: ${rawValues.length / 2} points`);
      
      for (let i = 0; i < rawValues.length - 1; i += 2) {
        let doseValue = rawValues[i] * dvhDoseScaling;
        
        // 🔥 CONVERSION cGy → Gy si nécessaire
        if (doseUnits === "CGY") {
          doseValue = doseValue / 100.0;
        }
        
        doses.push(doseValue);
        volumes.push(rawValues[i + 1]);
      }
    } else {
      // Fallback: traiter comme des volumes seuls avec bin width supposé
      console.log(`[DICOM RT] Fallback: treating ${rawValues.length} values as volume bins`);
      
      const binWidth = dvhMinBinWidth || 0.01;
      
      for (let i = 0; i < rawValues.length; i++) {
        let doseValue = i * binWidth * dvhDoseScaling;
        
        if (doseUnits === "CGY") {
          doseValue = doseValue / 100.0;
        }
        
        doses.push(doseValue);
        volumes.push(rawValues[i]);
      }
    }
    
    console.log(`[DICOM RT] Parsed DVH: ${doses.length} points`);
    console.log(`[DICOM RT] Dose range: ${Math.min(...doses).toFixed(2)} - ${Math.max(...doses).toFixed(2)} Gy`);
    console.log(`[DICOM RT] Volume range: ${Math.min(...volumes).toFixed(2)} - ${Math.max(...volumes).toFixed(2)} ${volumeUnits}`);
  } else {
    // Format binaire (moins commun mais possible)
    const offset = dvhDataElement.dataOffset;
    const length = dvhDataElement.length;
    
    if (offset !== undefined && length > 0) {
      try {
        const numValues = length / 4; // Float32
        const dataView = new DataView(originalByteArray.buffer, offset, length);
        
        console.log(`[DICOM RT] Parsing binary DVH: ${numValues} float32 values`);
        
        // Même logique de détection de format
        if (dvhType === "CUMULATIVE" && numberOfBins > 0 && numValues === numberOfBins) {
          const binWidth = dvhMinBinWidth || 0.01;
          
          for (let i = 0; i < numValues; i++) {
            const volumeValue = dataView.getFloat32(i * 4, true);
            let doseValue = i * binWidth * dvhDoseScaling;
            
            if (doseUnits === "CGY") {
              doseValue = doseValue / 100.0;
            }
            
            if (!isNaN(volumeValue)) {
              doses.push(doseValue);
              volumes.push(volumeValue);
            }
          }
        } else {
          // Format paires
          for (let i = 0; i < numValues - 1; i += 2) {
            let doseValue = dataView.getFloat32(i * 4, true) * dvhDoseScaling;
            const volumeValue = dataView.getFloat32((i + 1) * 4, true);
            
            if (doseUnits === "CGY") {
              doseValue = doseValue / 100.0;
            }
            
            if (!isNaN(doseValue) && !isNaN(volumeValue)) {
              doses.push(doseValue);
              volumes.push(volumeValue);
            }
          }
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

  // 🔥 Statistiques de dose DICOM (pour validation)
  // Ces tags sont différents de dvhMinBinWidth!
  const minimumDose = dvhItem.floatString("x30040072") || Math.min(...doses); // DVH Minimum Dose
  const maximumDose = dvhItem.floatString("x30040074") || Math.max(...doses); // DVH Maximum Dose  
  const meanDose = dvhItem.floatString("x30040076") || 0; // DVH Mean Dose

  // Appliquer conversion cGy → Gy sur les statistiques aussi
  const doseConversionFactor = doseUnits === "CGY" ? 0.01 : 1.0;
  const finalMinDose = (typeof dvhItem.floatString("x30040072") === 'number') 
    ? minimumDose * doseConversionFactor 
    : Math.min(...doses);
  const finalMaxDose = (typeof dvhItem.floatString("x30040074") === 'number') 
    ? maximumDose * doseConversionFactor 
    : Math.max(...doses);
  const finalMeanDose = meanDose * doseConversionFactor;

  console.log(`[DICOM RT] DICOM stats: min=${finalMinDose.toFixed(2)}Gy, max=${finalMaxDose.toFixed(2)}Gy, mean=${finalMeanDose.toFixed(2)}Gy`);

  // 🔥 ROI référencé - via DVH Referenced ROI Sequence (3004,0060)
  let referencedROINumber: number | undefined;
  const refROISeq = getSequence(dvhItem, "x30040060");
  
  if (refROISeq?.length) {
    // Le tag Referenced ROI Number est (3006,0084) dans la séquence
    const roiItem = refROISeq[0];
    
    // Essayer plusieurs méthodes de lecture
    referencedROINumber = roiItem.uint16("x30060084");
    
    if (referencedROINumber === undefined) {
      // Essayer comme int16
      referencedROINumber = roiItem.int16("x30060084");
    }
    
    if (referencedROINumber === undefined) {
      // Essayer comme string puis convertir
      const roiString = roiItem.string("x30060084");
      if (roiString) {
        referencedROINumber = parseInt(roiString, 10);
      }
    }
    
    console.log(`[DICOM RT] Referenced ROI Number: ${referencedROINumber}`);
  } else {
    console.warn("[DICOM RT] No DVH Referenced ROI Sequence found");
  }

  return {
    dvhType,
    doseUnits: "GY", // Toujours retourner en Gy après conversion
    volumeUnits,
    doseScaling: dvhDoseScaling,
    minimumDose: finalMinDose,
    maximumDose: finalMaxDose,
    meanDose: finalMeanDose,
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
