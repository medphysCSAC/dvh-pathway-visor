/**
 * ============================================================
 * SECTION 16 : SOMMATION DOSIMÉTRIQUE MULTI-PLANS (DICOM RT)
 * ============================================================
 *
 * Deux méthodes :
 *   - dose_grid : sommation voxel-par-voxel des grilles de dose RTDOSE
 *                 (précis, recommandé). Nécessite que les deux grilles
 *                 partagent dimensions / origine / spacing.
 *   - dvh_direct : sommation approximative au niveau des courbes DVH
 *                  (fallback, utilisé si grilles incompatibles ou pas
 *                  de RTSTRUCT pour recalcul).
 *
 * Cas clinique type :
 *   Plan 1 : PTV_46 (46 Gy / 23 fx) → RTDOSE_1.dcm
 *   Plan 2 : PTV_boost (14 Gy / 7 fx) → RTDOSE_2.dcm
 *   Somme  : 60 Gy total → validation finale sur DVH sommé
 */

import * as dicomParser from 'dicom-parser';
import type { Structure, DVHPoint } from '@/types/dvh';
import type { DicomRTData, DicomRTDose, DicomRTStructure } from '@/types/dicomRT';

// ────────────────────────────────────────────────────────────────
// Types publics
// ────────────────────────────────────────────────────────────────

export type SummationMethod = 'dose_grid' | 'dvh_direct';

export interface DoseGridGeometry {
  rows: number;
  columns: number;
  frames: number;
  pixelSpacing: [number, number];
  imagePositionPatient: [number, number, number];
  gridFrameOffsetVector: number[];
}

export interface SummedDoseGrid {
  data: Float32Array;
  geometry: DoseGridGeometry;
  doseUnits: string; // 'GY'
}

export interface SummedPlanResult {
  structures: Structure[];
  summationMethod: SummationMethod;
  warnings: string[];
  /** Dimensions/dose summary pour affichage */
  info: {
    planNames: string[];
    matchedStructures: number;
    unmatchedStructures: string[];
    maxDose?: number;
  };
  /** Présent uniquement si méthode dose_grid */
  summedGrid?: SummedDoseGrid;
}

// ────────────────────────────────────────────────────────────────
// Parsing géométrie & grille de dose à partir d'un ArrayBuffer
// ────────────────────────────────────────────────────────────────

interface ParsedDoseFile {
  geometry: DoseGridGeometry;
  doseScaling: number; // multiplier raw → Gy
  rawData: Uint16Array | Uint32Array;
  doseUnits: string;
  bitsAllocated: number;
}

function parseFloatArray(str: string | undefined): number[] {
  if (!str) return [];
  return str.split('\\').map(Number).filter((n) => !isNaN(n));
}

export function parseDoseFile(buffer: ArrayBuffer): ParsedDoseFile {
  const byteArray = new Uint8Array(buffer);
  const ds = dicomParser.parseDicom(byteArray);

  const rows = ds.uint16('x00280010') || 0;
  const columns = ds.uint16('x00280011') || 0;
  const frames = parseInt(ds.string('x00280008') || '1', 10);
  const bitsAllocated = ds.uint16('x00280100') || 16;
  const doseScaling = ds.floatString('x3004000e') || 1.0;
  const doseUnits = (ds.string('x30040002') || 'GY').toUpperCase();

  const pixelSpacingArr = parseFloatArray(ds.string('x00280030'));
  const ipp = parseFloatArray(ds.string('x00200032'));
  const gfov = parseFloatArray(ds.string('x3004000c'));

  const geometry: DoseGridGeometry = {
    rows,
    columns,
    frames,
    pixelSpacing: [pixelSpacingArr[0] || 1, pixelSpacingArr[1] || 1],
    imagePositionPatient: [ipp[0] || 0, ipp[1] || 0, ipp[2] || 0],
    gridFrameOffsetVector: gfov,
  };

  const pixelDataElement = ds.elements['x7fe00010'];
  if (!pixelDataElement) {
    throw new Error('RTDOSE : aucune donnée pixel (PixelData absent)');
  }

  const totalPixels = rows * columns * frames;
  const offset = pixelDataElement.dataOffset;
  let rawData: Uint16Array | Uint32Array;

  if (bitsAllocated === 32) {
    rawData = new Uint32Array(byteArray.buffer, offset, totalPixels);
  } else if (bitsAllocated === 16) {
    rawData = new Uint16Array(byteArray.buffer, offset, totalPixels);
  } else {
    throw new Error(`BitsAllocated ${bitsAllocated} non supporté`);
  }

  return { geometry, doseScaling, rawData, doseUnits, bitsAllocated };
}

// ────────────────────────────────────────────────────────────────
// Validation géométrie
// ────────────────────────────────────────────────────────────────

const EPS = 1e-3;

export function geometriesMatch(g1: DoseGridGeometry, g2: DoseGridGeometry): boolean {
  if (g1.rows !== g2.rows || g1.columns !== g2.columns || g1.frames !== g2.frames) {
    return false;
  }
  if (Math.abs(g1.pixelSpacing[0] - g2.pixelSpacing[0]) > EPS) return false;
  if (Math.abs(g1.pixelSpacing[1] - g2.pixelSpacing[1]) > EPS) return false;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(g1.imagePositionPatient[i] - g2.imagePositionPatient[i]) > EPS) return false;
  }
  return true;
}

export function describeGeometryMismatch(g1: DoseGridGeometry, g2: DoseGridGeometry): string {
  const parts: string[] = [];
  if (g1.rows !== g2.rows || g1.columns !== g2.columns || g1.frames !== g2.frames) {
    parts.push(`dimensions ${g1.columns}×${g1.rows}×${g1.frames} ≠ ${g2.columns}×${g2.rows}×${g2.frames}`);
  }
  if (
    Math.abs(g1.pixelSpacing[0] - g2.pixelSpacing[0]) > EPS ||
    Math.abs(g1.pixelSpacing[1] - g2.pixelSpacing[1]) > EPS
  ) {
    parts.push(`pixel spacing différent`);
  }
  for (let i = 0; i < 3; i++) {
    if (Math.abs(g1.imagePositionPatient[i] - g2.imagePositionPatient[i]) > EPS) {
      parts.push(`origine différente sur axe ${['X', 'Y', 'Z'][i]}`);
      break;
    }
  }
  return parts.join(' | ') || 'incompatibilité non identifiée';
}

// ────────────────────────────────────────────────────────────────
// MÉTHODE 1 : Sommation grille de dose (voxel par voxel)
// ────────────────────────────────────────────────────────────────

export function sumDoseGrids(buffer1: ArrayBuffer, buffer2: ArrayBuffer): SummedDoseGrid {
  const p1 = parseDoseFile(buffer1);
  const p2 = parseDoseFile(buffer2);

  if (!geometriesMatch(p1.geometry, p2.geometry)) {
    throw new Error(
      `Grilles incompatibles : ${describeGeometryMismatch(p1.geometry, p2.geometry)}. ` +
        `Recalculer les plans sur la même grille dans le TPS, ou utiliser la méthode "DVH direct".`,
    );
  }

  // Conversion d'unités vers Gy si nécessaire (cGy → Gy = ×0.01)
  const u1Factor = p1.doseUnits === 'CGY' ? 0.01 : 1;
  const u2Factor = p2.doseUnits === 'CGY' ? 0.01 : 1;

  const len = p1.rawData.length;
  const summed = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    summed[i] = p1.rawData[i] * p1.doseScaling * u1Factor + p2.rawData[i] * p2.doseScaling * u2Factor;
  }

  return {
    data: summed,
    geometry: p1.geometry,
    doseUnits: 'GY',
  };
}

// ────────────────────────────────────────────────────────────────
// Recalcul DVH cumulatif depuis grille sommée + RTSTRUCT
// ────────────────────────────────────────────────────────────────

/**
 * Construit un masque de voxels appartenant à une structure (ROI) en
 * échantillonnant ses contours sur la grille de dose.
 * Approche raycasting 2D slice par slice.
 */
function buildROIMask(
  structure: DicomRTStructure,
  geom: DoseGridGeometry,
): Uint8Array {
  const { rows, columns, frames, pixelSpacing, imagePositionPatient, gridFrameOffsetVector } = geom;
  const mask = new Uint8Array(rows * columns * frames);

  if (!structure.contours || structure.contours.length === 0) return mask;

  // Z absolus de chaque slice
  const sliceZ: number[] = [];
  for (let f = 0; f < frames; f++) {
    sliceZ.push(imagePositionPatient[2] + (gridFrameOffsetVector[f] ?? 0));
  }

  // Grouper les contours par Z
  const contoursByZ = new Map<number, Array<{ x: number; y: number }[]>>();
  for (const c of structure.contours) {
    if (!c.points || c.points.length < 3) continue;
    const z = c.points[0].z;
    const polygon = c.points.map((p) => ({ x: p.x, y: p.y }));
    const arr = contoursByZ.get(z) || [];
    arr.push(polygon);
    contoursByZ.set(z, arr);
  }

  const x0 = imagePositionPatient[0];
  const y0 = imagePositionPatient[1];
  const dx = pixelSpacing[1]; // colonnes
  const dy = pixelSpacing[0]; // lignes

  for (const [z, polygons] of contoursByZ.entries()) {
    // Trouver l'index de slice le plus proche
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let f = 0; f < frames; f++) {
      const d = Math.abs(sliceZ[f] - z);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = f;
      }
    }
    if (bestIdx < 0 || bestDist > Math.max(2, dy)) continue;

    const sliceOffset = bestIdx * rows * columns;

    for (const polygon of polygons) {
      // Bounding box pour limiter les tests
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of polygon) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const cMin = Math.max(0, Math.floor((minX - x0) / dx));
      const cMax = Math.min(columns - 1, Math.ceil((maxX - x0) / dx));
      const rMin = Math.max(0, Math.floor((minY - y0) / dy));
      const rMax = Math.min(rows - 1, Math.ceil((maxY - y0) / dy));

      for (let r = rMin; r <= rMax; r++) {
        const py = y0 + r * dy;
        for (let c = cMin; c <= cMax; c++) {
          const px = x0 + c * dx;
          if (pointInPolygon(px, py, polygon)) {
            // XOR pour gérer les "trous" (multi-contours sur même slice)
            mask[sliceOffset + r * columns + c] ^= 1;
          }
        }
      }
    }
  }

  return mask;
}

function pointInPolygon(px: number, py: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calcule un DVH cumulatif (relatif %) à partir de la dose sommée et
 * du masque d'une structure.
 */
function computeCumulativeDVH(
  doseGrid: Float32Array,
  mask: Uint8Array,
  binWidth = 0.05, // Gy
): { points: DVHPoint[]; totalVolumeVoxels: number; maxDose: number } {
  let maxDose = 0;
  let totalVoxels = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      totalVoxels++;
      const d = doseGrid[i];
      if (d > maxDose) maxDose = d;
    }
  }

  if (totalVoxels === 0) {
    return { points: [], totalVolumeVoxels: 0, maxDose: 0 };
  }

  const nBins = Math.ceil(maxDose / binWidth) + 2;
  const hist = new Uint32Array(nBins);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      const bin = Math.floor(doseGrid[i] / binWidth);
      hist[bin]++;
    }
  }

  // Cumulatif : V(d) = % de voxels recevant ≥ d
  const points: DVHPoint[] = [];
  let cumAbove = totalVoxels;
  for (let b = 0; b < nBins; b++) {
    const dose = b * binWidth;
    const volumePct = (cumAbove / totalVoxels) * 100;
    points.push({ dose, volume: volumePct });
    cumAbove -= hist[b];
    if (cumAbove < 0) cumAbove = 0;
  }

  return { points, totalVolumeVoxels: totalVoxels, maxDose };
}

/**
 * Recalcule les structures DVH depuis une grille sommée et un RTSTRUCT.
 * Le volume absolu est calculé via le voxel size.
 */
export function recomputeStructuresFromGrid(
  summed: SummedDoseGrid,
  rtStructures: DicomRTStructure[],
): Structure[] {
  if (!rtStructures || rtStructures.length === 0) return [];

  const { pixelSpacing, gridFrameOffsetVector } = summed.geometry;
  // Voxel volume en cm³ : (mm × mm × mm) / 1000
  const sliceThickness =
    gridFrameOffsetVector.length >= 2
      ? Math.abs(gridFrameOffsetVector[1] - gridFrameOffsetVector[0])
      : 1;
  const voxelVolumeCc = (pixelSpacing[0] * pixelSpacing[1] * sliceThickness) / 1000;

  const result: Structure[] = [];
  for (const rt of rtStructures) {
    const mask = buildROIMask(rt, summed.geometry);
    const { points, totalVolumeVoxels } = computeCumulativeDVH(summed.data, mask);
    if (totalVolumeVoxels === 0) continue;

    const totalVolumeCc = totalVolumeVoxels * voxelVolumeCc;
    const isPTV = (rt.roiInterpretedType || '').toUpperCase().includes('PTV') ||
      rt.name.toUpperCase().startsWith('PTV');

    result.push({
      name: rt.name,
      type: rt.roiInterpretedType || 'STANDARD',
      category: isPTV ? 'PTV' : 'OAR',
      relativeVolume: points,
      totalVolume: totalVolumeCc,
    });
  }
  return result;
}

// ────────────────────────────────────────────────────────────────
// MÉTHODE 2 : Sommation DVH directe (fallback)
// ────────────────────────────────────────────────────────────────

function fuzzyMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-]/g, '');
  return norm(a) === norm(b);
}

function interpolateVolume(points: DVHPoint[], targetDose: number): number {
  if (points.length === 0) return 0;
  if (targetDose <= points[0].dose) return points[0].volume;
  if (targetDose >= points[points.length - 1].dose) return points[points.length - 1].volume;
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].dose <= targetDose && points[i + 1].dose >= targetDose) {
      const t = (targetDose - points[i].dose) / (points[i + 1].dose - points[i].dose);
      return points[i].volume + t * (points[i + 1].volume - points[i].volume);
    }
  }
  return 0;
}

/**
 * Sommation DVH approximative.
 * V_sum(d) ≈ max( V1(d), V2(d) ) — borne supérieure simple
 * (hypothèse de corrélation totale entre les deux distributions).
 * À documenter dans le rapport comme approximation.
 */
export function sumDVHDirect(
  structures1: Structure[],
  structures2: Structure[],
): { structures: Structure[]; matched: number; unmatched: string[] } {
  const unmatched: string[] = [];
  let matched = 0;

  const result = structures1.map((s1) => {
    const s2 = structures2.find((s) => fuzzyMatch(s.name, s1.name));
    if (!s2) {
      unmatched.push(s1.name);
      return s1;
    }
    matched++;

    const allDoses = Array.from(
      new Set([
        ...s1.relativeVolume.map((p) => p.dose),
        ...s2.relativeVolume.map((p) => p.dose),
      ]),
    ).sort((a, b) => a - b);

    const summedPoints: DVHPoint[] = allDoses.map((dose) => ({
      dose,
      volume: Math.max(
        interpolateVolume(s1.relativeVolume, dose),
        interpolateVolume(s2.relativeVolume, dose),
      ),
    }));

    return {
      ...s1,
      relativeVolume: summedPoints,
    };
  });

  // Structures présentes seulement dans plan 2
  for (const s2 of structures2) {
    if (!structures1.some((s) => fuzzyMatch(s.name, s2.name))) {
      result.push(s2);
      unmatched.push(s2.name);
    }
  }

  return { structures: result, matched, unmatched };
}

// ────────────────────────────────────────────────────────────────
// API haut niveau : orchestrateur
// ────────────────────────────────────────────────────────────────

export interface SummationInput {
  plan1Name: string;
  plan2Name: string;
  rtDose1Buffer?: ArrayBuffer;
  rtDose2Buffer?: ArrayBuffer;
  rtStructures?: DicomRTStructure[]; // requis pour recalcul depuis grille
  /** DVH déjà extraits (méthode dvh_direct) */
  plan1Structures?: Structure[];
  plan2Structures?: Structure[];
  preferredMethod: SummationMethod;
}

export async function summateDicomPlans(input: SummationInput): Promise<SummedPlanResult> {
  const warnings: string[] = [];

  if (input.preferredMethod === 'dose_grid') {
    if (!input.rtDose1Buffer || !input.rtDose2Buffer) {
      throw new Error('Méthode "grille de dose" : les deux fichiers RTDOSE sont requis.');
    }
    if (!input.rtStructures || input.rtStructures.length === 0) {
      warnings.push(
        'Aucun RTSTRUCT fourni : impossible de recalculer les DVH depuis la grille sommée. Bascule en mode DVH direct.',
      );
      return summateDicomPlans({ ...input, preferredMethod: 'dvh_direct' });
    }

    try {
      const summed = sumDoseGrids(input.rtDose1Buffer, input.rtDose2Buffer);
      const structures = recomputeStructuresFromGrid(summed, input.rtStructures);
      let maxDose = 0;
      for (let i = 0; i < summed.data.length; i++) {
        if (summed.data[i] > maxDose) maxDose = summed.data[i];
      }
      return {
        structures,
        summationMethod: 'dose_grid',
        warnings,
        info: {
          plan1Name: input.plan1Name,
          plan2Name: input.plan2Name,
          matchedStructures: structures.length,
          unmatchedStructures: [],
          maxDose,
        },
        summedGrid: summed,
      };
    } catch (err) {
      warnings.push(`Sommation grille échouée : ${(err as Error).message}`);
      warnings.push('Bascule automatique sur la méthode DVH direct (approximative).');
      return summateDicomPlans({ ...input, preferredMethod: 'dvh_direct' });
    }
  }

  // dvh_direct
  if (!input.plan1Structures || !input.plan2Structures) {
    throw new Error(
      'Méthode "DVH direct" : les structures DVH des deux plans sont requises (chargez les RTDOSE associés).',
    );
  }

  const { structures, matched, unmatched } = sumDVHDirect(
    input.plan1Structures,
    input.plan2Structures,
  );
  warnings.push(
    'Sommation par DVH direct : approximation V_sum(d) = max(V1(d), V2(d)). À valider avec une sommation TPS pour usage clinique.',
  );

  let maxDose = 0;
  for (const s of structures) {
    for (const p of s.relativeVolume) {
      if (p.dose > maxDose) maxDose = p.dose;
    }
  }

  return {
    structures,
    summationMethod: 'dvh_direct',
    warnings,
    info: {
      plan1Name: input.plan1Name,
      plan2Name: input.plan2Name,
      matchedStructures: matched,
      unmatchedStructures: unmatched,
      maxDose,
    },
  };
}
