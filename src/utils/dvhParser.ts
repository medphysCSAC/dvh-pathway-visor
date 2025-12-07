import { DVHData, Structure, DVHPoint, StructureCategory } from "@/types/dvh";
import { parseCSV } from "./csvParser"; // ✅ Notre parser autonome

export const classifyStructure = (name: string): StructureCategory => {
  const nameUpper = name.toUpperCase().trim();

  if (/^(PTV|GTV|CTV)/.test(nameUpper)) {
    return "PTV";
  }

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
  ];

  if (oarKeywords.some((k) => name.toLowerCase().includes(k))) {
    return "OAR";
  }

  return "OTHER";
};

export const parseTomoTherapyDVH = (relContent: string, absContent?: string): DVHData => {
  if (!relContent?.trim()) {
    throw new Error("Contenu DVH vide");
  }

  // ✅ Utilisation du parser CSV autonome
  const { data: relData, errors: relErrors } = parseCSV(relContent);
  const { data: absData, errors: absErrors } = absContent ? parseCSV(absContent) : { data: [], errors: [] };

  if (relErrors.length > 0) {
    console.warn("Erreurs parsing CSV REL:", relErrors);
  }
  if (absErrors.length > 0) {
    console.warn("Erreurs parsing CSV ABS:", absErrors);
  }

  if (!relData?.length) {
    throw new Error("Aucune donnée DVH valide");
  }

  const structures: Structure[] = [];
  const header = relData[0] as string[];

  for (let i = 0; i < header.length; i += 3) {
    const structureName = (header[i] || "").replace("(STANDARD)", "").trim();
    if (!structureName) continue;

    const relativeVolume: DVHPoint[] = [];
    const absoluteVolume: DVHPoint[] = [];

    for (let rowIdx = 1; rowIdx < relData.length; rowIdx++) {
      const row = relData[rowIdx];
      if (!row || row.length < i + 3) continue;

      const dose = typeof row[i + 1] === "number" ? row[i + 1] : parseFloat(row[i + 1]);
      const relVol = typeof row[i + 2] === "number" ? row[i + 2] : parseFloat(row[i + 2]);

      if (typeof dose === "number" && !isNaN(dose) && typeof relVol === "number" && !isNaN(relVol)) {
        relativeVolume.push({ dose, volume: relVol });
      }

      if (absData[rowIdx]) {
        const absRow = absData[rowIdx];
        const absVol = typeof absRow[i + 2] === "number" ? absRow[i + 2] : parseFloat(absRow[i + 2]);
        if (typeof absVol === "number" && !isNaN(absVol)) {
          absoluteVolume.push({ dose, volume: absVol });
        }
      }
    }

    const totalVolume = absoluteVolume.length > 0 ? Math.max(...absoluteVolume.map((p) => p.volume)) : undefined;

    structures.push({
      name: structureName,
      type: "STANDARD",
      category: classifyStructure(structureName),
      relativeVolume,
      absoluteVolume,
      totalVolume,
    });
  }

  return {
    patientId: "Unknown",
    structures: structures.filter((s) => s.relativeVolume.length > 0),
  };
};

export const calculateMetrics = (structure: Structure) => {
  if (!structure.relativeVolume?.length) return null;

  const { relativeVolume } = structure;
  const doses = relativeVolume.map((p) => p.dose);

  let dmean = 0;
  for (let i = 1; i < relativeVolume.length; i++) {
    const dv = relativeVolume[i - 1].volume - relativeVolume[i].volume;
    const avgDose = (relativeVolume[i - 1].dose + relativeVolume[i].dose) / 2;
    dmean += avgDose * dv;
  }

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
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].dose <= targetDose && points[i + 1].dose >= targetDose) {
      const t = (targetDose - points[i].dose) / (points[i + 1].dose - points[i].dose);
      return points[i].volume + t * (points[i + 1].volume - points[i].volume);
    }
  }

  return targetDose >= points[points.length - 1].dose ? points[points.length - 1].volume : 0;
};

export const findMaxDoseAcrossStructures = (structures: Structure[]): number => {
  return Math.max(
    ...structures.map((s) => (s.relativeVolume.length ? Math.max(...s.relativeVolume.map((p) => p.dose)) : 0)),
    0,
  );
};
