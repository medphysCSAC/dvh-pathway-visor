import Papa from "papaparse";
import { DVHData, Structure, DVHPoint, StructureCategory } from "@/types/dvh";

// Custom error class for DVH parsing errors
export class DVHParseError extends Error {
  constructor(
    message: string,
    public readonly code: DVHErrorCode,
    public readonly details?: string
  ) {
    super(message);
    this.name = "DVHParseError";
  }
}

export type DVHErrorCode =
  | "EMPTY_CONTENT"
  | "INVALID_FORMAT"
  | "NO_STRUCTURES"
  | "INVALID_HEADER"
  | "NO_VALID_DATA"
  | "COLUMN_MISMATCH"
  | "PARSE_ERROR";

/**
 * Détecte si les doses sont en cGy et retourne le facteur de conversion
 * Heuristique: si Dmax > 150, probablement en cGy (150 cGy = 1.5 Gy)
 * Doses typiques en RT: 20-80 Gy, donc en cGy: 2000-8000 cGy
 */
export const detectDoseUnit = (doses: number[]): { unit: 'Gy' | 'cGy'; factor: number } => {
  if (doses.length === 0) return { unit: 'Gy', factor: 1 };
  
  const maxDose = Math.max(...doses);
  
  // Si Dmax > 150, très probablement en cGy (car 150 Gy serait extrême en clinique)
  if (maxDose > 150) {
    console.log(`[DVH Parser] Détection automatique: doses en cGy (max=${maxDose.toFixed(1)} cGy) → conversion vers Gy`);
    return { unit: 'cGy', factor: 0.01 };
  }
  
  return { unit: 'Gy', factor: 1 };
};

/**
 * Convertit une valeur de dose en Gy si nécessaire
 */
export const convertToGy = (dose: number, unit: 'Gy' | 'cGy'): number => {
  return unit === 'cGy' ? dose * 0.01 : dose;
};

export const classifyStructure = (name: string): StructureCategory => {
  const nameUpper = name.toUpperCase().trim();

  // ✅ PTV en priorité absolue
  if (/^(PTV|GTV|CTV)/.test(nameUpper)) {
    return "PTV";
  }

  // ✅ OAR avec mots-clés renforcés
  const oarKeywords = [
    "bladder",
    "vessie",
    "rectum",
    "femur",
    "femoral",
    "bowel",
    "intestin",
    "kidney",
    "rein",
    "liver",
    "foie",
    "lung",
    "poumon",
    "heart",
    "coeur",
    "spinal",
    "moelle",
    "brain",
    "cerveau",
    "parotid",
    "skin",
    "peau",
    "esophagus",
    "stomach",
    "cord",
    "lens",
    "optic",
    "chiasm",
    "mandible",
    "cochlea",
    "breast",
    "sein",
    "thyroid",
    "thymus",
    "trachea",
    "aorta",
  ];

  if (oarKeywords.some((k) => name.toLowerCase().includes(k))) {
    return "OAR";
  }

  return "OTHER";
};

export const findMaxDoseAcrossStructures = (structures: Structure[]): number => {
  return Math.max(
    ...structures.map((s) => (s.relativeVolume.length ? Math.max(...s.relativeVolume.map((p) => p.dose)) : 0)),
    0,
  );
};

// Validate CSV content structure
const validateCSVContent = (content: string): void => {
  if (!content || typeof content !== "string") {
    throw new DVHParseError(
      "Le contenu du fichier est vide ou invalide",
      "EMPTY_CONTENT"
    );
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new DVHParseError(
      "Le fichier DVH est vide",
      "EMPTY_CONTENT"
    );
  }

  // Check for minimum content (at least header + 1 data row)
  const lines = trimmed.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    throw new DVHParseError(
      "Le fichier DVH doit contenir au moins un en-tête et une ligne de données",
      "INVALID_FORMAT",
      `Lignes trouvées: ${lines.length}`
    );
  }
};

// Validate parsed header structure
const validateHeader = (header: any[]): void => {
  if (!header || !Array.isArray(header) || header.length === 0) {
    throw new DVHParseError(
      "En-tête du fichier DVH invalide ou manquant",
      "INVALID_HEADER"
    );
  }

  // Check for at least one structure (3 columns minimum: name, dose, volume)
  if (header.length < 3) {
    throw new DVHParseError(
      "Format d'en-tête invalide: au moins 3 colonnes requises (structure, dose, volume)",
      "INVALID_HEADER",
      `Colonnes trouvées: ${header.length}`
    );
  }

  // Warn if column count is not a multiple of 3
  if (header.length % 3 !== 0) {
    console.warn(`DVH Parser: Le nombre de colonnes (${header.length}) n'est pas un multiple de 3`);
  }
};

// Safe number parsing with validation
const safeParseFloat = (value: any): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  
  // Handle string values with comma decimal separator
  if (typeof value === "string") {
    value = value.replace(",", ".").trim();
  }
  
  const num = parseFloat(value);
  return isNaN(num) || !isFinite(num) ? null : num;
};

export const parseTomoTherapyDVH = (relContent: string, absContent?: string): DVHData => {
  // Step 1: Validate input content
  try {
    validateCSVContent(relContent);
  } catch (error) {
    if (error instanceof DVHParseError) throw error;
    throw new DVHParseError(
      "Erreur de validation du contenu DVH",
      "INVALID_FORMAT",
      String(error)
    );
  }

  // Step 2: Parse CSV with PapaParse
  let relParsed: Papa.ParseResult<any>;
  try {
    relParsed = Papa.parse(relContent.trim(), {
      header: false,
      dynamicTyping: true,
      skipEmptyLines: true,
    });
  } catch (error) {
    throw new DVHParseError(
      "Échec du parsing CSV du fichier DVH relatif",
      "PARSE_ERROR",
      String(error)
    );
  }

  if (relParsed.errors && relParsed.errors.length > 0) {
    const criticalErrors = relParsed.errors.filter(e => e.type === "Quotes" || e.type === "FieldMismatch");
    if (criticalErrors.length > 0) {
      console.warn("DVH Parser: Erreurs CSV non critiques:", relParsed.errors);
    }
  }

  // Step 3: Parse absolute content if provided
  let absParsed: Papa.ParseResult<any> | null = null;
  if (absContent) {
    try {
      validateCSVContent(absContent);
      absParsed = Papa.parse(absContent.trim(), {
        header: false,
        dynamicTyping: true,
        skipEmptyLines: true,
      });
    } catch (error) {
      console.warn("DVH Parser: Échec du parsing du fichier absolu, utilisation des données relatives uniquement:", error);
    }
  }

  const relData = relParsed.data as any[][];
  const absData = absParsed?.data as any[][] | null;

  if (!relData || relData.length === 0) {
    throw new DVHParseError(
      "Aucune donnée trouvée dans le fichier DVH",
      "NO_VALID_DATA"
    );
  }

  // Step 4: Validate and extract header
  const header = relData[0] as string[];
  try {
    validateHeader(header);
  } catch (error) {
    if (error instanceof DVHParseError) throw error;
    throw new DVHParseError(
      "En-tête du fichier DVH invalide",
      "INVALID_HEADER",
      String(error)
    );
  }

  const structures: Structure[] = [];
  const parsingWarnings: string[] = [];

  // Step 5: Process each structure (every 3 columns)
  for (let i = 0; i < header.length; i += 3) {
    const rawName = header[i];
    if (!rawName || typeof rawName !== "string") {
      parsingWarnings.push(`Colonne ${i}: nom de structure invalide ou manquant`);
      continue;
    }

    const structureName = rawName.replace("(STANDARD)", "").trim();
    if (!structureName) {
      parsingWarnings.push(`Colonne ${i}: nom de structure vide après nettoyage`);
      continue;
    }

    const relativeVolume: DVHPoint[] = [];
    const absoluteVolume: DVHPoint[] = [];
    let invalidPointCount = 0;

    // Process data rows
    for (let rowIdx = 1; rowIdx < relData.length; rowIdx++) {
      const row = relData[rowIdx];
      if (!row || !Array.isArray(row)) continue;

      // Check if we have enough columns for this structure
      if (row.length < i + 3) {
        // Don't count as error if row is just shorter (common in some exports)
        continue;
      }

      const dose = safeParseFloat(row[i + 1]);
      const relVol = safeParseFloat(row[i + 2]);

      if (dose !== null && relVol !== null) {
        // Validate reasonable ranges
        if (dose >= 0 && dose <= 10000 && relVol >= 0 && relVol <= 100) {
          relativeVolume.push({ dose, volume: relVol });
        } else {
          invalidPointCount++;
        }
      }

      // Process absolute volume if available
      if (absData && absData[rowIdx] && Array.isArray(absData[rowIdx])) {
        const absRow = absData[rowIdx];
        if (absRow.length >= i + 3) {
          const absVol = safeParseFloat(absRow[i + 2]);
          if (dose !== null && absVol !== null && absVol >= 0) {
            absoluteVolume.push({ dose, volume: absVol });
          }
        }
      }
    }

    if (invalidPointCount > 0) {
      parsingWarnings.push(`${structureName}: ${invalidPointCount} points avec valeurs hors limites ignorés`);
    }

    // Only add structure if we have valid data points
    if (relativeVolume.length > 0) {
      // Sort by dose to ensure proper curve
      relativeVolume.sort((a, b) => a.dose - b.dose);
      absoluteVolume.sort((a, b) => a.dose - b.dose);

      // ✅ Volume total harmonisé avec dicomRTParser: volume à la dose minimale
      let totalVolume: number | undefined = undefined;
      if (absoluteVolume.length > 0) {
        // Trouver le point avec la dose minimale (≈ 0)
        let minDoseIdx = 0;
        let minDose = absoluteVolume[0].dose;
        for (let i = 1; i < absoluteVolume.length; i++) {
          if (absoluteVolume[i].dose < minDose) {
            minDose = absoluteVolume[i].dose;
            minDoseIdx = i;
          }
        }
        totalVolume = absoluteVolume[minDoseIdx].volume;
        
        // Fallback: si volume à dose min est ≤ 0, prendre le max
        if (totalVolume <= 0) {
          totalVolume = Math.max(...absoluteVolume.map((p) => p.volume));
        }
      }

      structures.push({
        name: structureName,
        type: "STANDARD",
        category: classifyStructure(structureName),
        relativeVolume,
        absoluteVolume,
        totalVolume,
      });
    } else {
      parsingWarnings.push(`${structureName}: aucun point DVH valide, structure ignorée`);
    }
  }

  // Log warnings if any
  if (parsingWarnings.length > 0) {
    console.warn("DVH Parser - Avertissements:", parsingWarnings);
  }

  // Step 6: Validate final result
  if (structures.length === 0) {
    throw new DVHParseError(
      "Aucune structure valide trouvée dans le fichier DVH",
      "NO_STRUCTURES",
      `Vérifiez le format du fichier. ${parsingWarnings.length} avertissements générés.`
    );
  }

  // Step 7: Détection automatique et conversion cGy → Gy si nécessaire
  // Collecter toutes les doses pour détecter l'unité
  const allDoses: number[] = [];
  for (const s of structures) {
    for (const p of s.relativeVolume) {
      allDoses.push(p.dose);
    }
  }
  
  const { unit, factor } = detectDoseUnit(allDoses);
  
  // Appliquer la conversion si nécessaire
  if (unit === 'cGy') {
    for (const s of structures) {
      s.relativeVolume = s.relativeVolume.map(p => ({
        dose: p.dose * factor,
        volume: p.volume
      }));
      if (s.absoluteVolume) {
        s.absoluteVolume = s.absoluteVolume.map(p => ({
          dose: p.dose * factor,
          volume: p.volume
        }));
      }
    }
    console.log(`[DVH Parser] ✅ Conversion cGy→Gy appliquée à ${structures.length} structures`);
  }

  return {
    patientId: "Unknown",
    structures,
  };
};

export const calculateMetrics = (structure: Structure) => {
  if (!structure.relativeVolume?.length) return null;

  const { relativeVolume } = structure;
  const doses = relativeVolume.map((p) => p.dose);
  const volumes = relativeVolume.map((p) => p.volume);

  // ✅ Calcul Dmean harmonisé avec protocolValidator (intégration trapézoïdale)
  let dmean = 0;
  for (let i = 0; i < relativeVolume.length - 1; i++) {
    const dose1 = doses[i];
    const dose2 = doses[i + 1];
    const vol1 = volumes[i];
    const vol2 = volumes[i + 1];
    // Math.abs() pour robustesse si DVH non-monotone
    dmean += ((dose1 + dose2) / 2) * Math.abs(vol2 - vol1);
  }
  // Normalisation par 100 car volumes sont en % (0-100)
  dmean = dmean / 100;

  return {
    structureName: structure.name,
    volume: structure.totalVolume || 0,
    dmax: Math.max(...doses),
    dmean,
    v20Gy: interpolateVolume(relativeVolume, 20),
    v40Gy: interpolateVolume(relativeVolume, 40),
  };
};

const interpolateVolume = (points: DVHPoint[], targetDose: number): number => {
  if (!points || points.length === 0) return 0;
  
  // Trier par dose croissante pour assurer une interpolation correcte
  const sortedPoints = [...points].sort((a, b) => a.dose - b.dose);
  
  // ✅ FIX: Si targetDose < Dmin, retourner le volume max (souvent ~100%)
  // Car si toute la structure reçoit au moins Dmin, alors elle reçoit aussi targetDose
  if (targetDose <= sortedPoints[0].dose) {
    return sortedPoints[0].volume;
  }
  
  // Si targetDose >= Dmax, retourner le volume min (souvent ~0%)
  if (targetDose >= sortedPoints[sortedPoints.length - 1].dose) {
    return sortedPoints[sortedPoints.length - 1].volume;
  }
  
  // Interpolation linéaire entre les deux points encadrant targetDose
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    if (sortedPoints[i].dose <= targetDose && sortedPoints[i + 1].dose >= targetDose) {
      const t = (targetDose - sortedPoints[i].dose) / (sortedPoints[i + 1].dose - sortedPoints[i].dose);
      return sortedPoints[i].volume + t * (sortedPoints[i + 1].volume - sortedPoints[i].volume);
    }
  }

  return sortedPoints[sortedPoints.length - 1].volume;
};
