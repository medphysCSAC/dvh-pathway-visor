import Papa from "papaparse";
import { DVHData, Structure, DVHPoint, StructureCategory } from "@/types/dvh";

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

export const parseTomoTherapyDVH = (relContent: string, absContent?: string): DVHData => {
  if (!relContent?.trim()) throw new Error("Contenu DVH vide");

  // ✅ Parsing CSV robuste avec PapaParse
  const relParsed = Papa.parse(relContent.trim(), {
    header: false,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  const absParsed = absContent
    ? Papa.parse(absContent.trim(), {
        header: false,
        dynamicTyping: true,
        skipEmptyLines: true,
      })
    : null;

  const relData = relParsed.data as any[][];
  const absData = absParsed?.data as any[][] | null;

  if (!relData?.length) throw new Error("Aucune donnée DVH valide");

  const structures: Structure[] = [];
  const header = relData[0] as string[];

  // ✅ Indexation robuste des colonnes
  for (let i = 0; i < header.length; i += 3) {
    const structureName = (header[i] || "").replace("(STANDARD)", "").trim();
    if (!structureName) continue;

    const relativeVolume: DVHPoint[] = [];
    const absoluteVolume: DVHPoint[] = [];

    // ✅ Vérification des lignes complètes
    for (let rowIdx = 1; rowIdx < relData.length; rowIdx++) {
      const row = relData[rowIdx];
      if (!row || row.length < i + 3) continue;

      const dose = parseFloat(row[i + 1]);
      const relVol = parseFloat(row[i + 2]);

      if (!isNaN(dose) && !isNaN(relVol)) {
        relativeVolume.push({ dose, volume: relVol });
      }

      if (absData && absData[rowIdx]) {
        const absRow = absData[rowIdx];
        const absVol = parseFloat(absRow[i + 2]);
        if (!isNaN(dose) && !isNaN(absVol)) {
          absoluteVolume.push({ dose, volume: absVol });
        }
      }
    }

    // ✅ Volume total = maximum du volume absolu
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
  const volumes = relativeVolume.map((p) => p.volume);

  // ✅ Calcul Dmean correct (intégration trapézoïdale)
  let dmean = 0;
  for (let i = 1; i < relativeVolume.length; i++) {
    const dv = volumes[i - 1] - volumes[i];
    const avgDose = (doses[i - 1] + doses[i]) / 2;
    dmean += avgDose * dv;
  }
  // ❌ SUPPRIMÉ: dmean = dmean / 100; (normalisation incorrecte)

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
