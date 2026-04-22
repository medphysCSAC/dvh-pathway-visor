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

export interface SummedPlanDetail {
  name: string;
  fractions?: number;
  dosePerFraction?: number;
  dose?: number;       // dose totale (Gy) si dérivable
  label?: string;      // label depuis RTPLAN
}

export interface SummedPlanResult {
  structures: Structure[];
  summationMethod: SummationMethod;
  warnings: string[];
  /** Dimensions/dose summary pour affichage */
  info: {
    planNames: string[];
    planDetails?: SummedPlanDetail[];
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
  return sumDoseGridsN([buffer1, buffer2]);
}

/**
 * Somme N grilles de dose (≥ 2). La 1ʳᵉ grille sert de référence
 * géométrique ; toutes les autres doivent matcher.
 */
export function sumDoseGridsN(buffers: ArrayBuffer[]): SummedDoseGrid {
  if (!buffers || buffers.length < 2) {
    throw new Error('Sommation grille : au moins 2 fichiers RTDOSE requis.');
  }

  const parsed = buffers.map((b) => parseDoseFile(b));
  const ref = parsed[0];

  for (let i = 1; i < parsed.length; i++) {
    if (!geometriesMatch(ref.geometry, parsed[i].geometry)) {
      throw new Error(
        `Plan ${i + 1} incompatible : ${describeGeometryMismatch(ref.geometry, parsed[i].geometry)}. ` +
          `Recalculer les plans sur la même grille dans le TPS, ou utiliser la méthode "DVH direct".`,
      );
    }
  }

  const len = ref.rawData.length;
  const summed = new Float32Array(len);
  for (const p of parsed) {
    const factor = p.doseUnits === 'CGY' ? 0.01 : 1;
    const scale = p.doseScaling * factor;
    for (let i = 0; i < len; i++) {
      summed[i] += p.rawData[i] * scale;
    }
  }

  return {
    data: summed,
    geometry: ref.geometry,
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
 * Sommation DVH approximative (2 plans).
 * V_sum(d) ≈ max( V1(d), V2(d) ) — borne supérieure simple.
 */
export function sumDVHDirect(
  structures1: Structure[],
  structures2: Structure[],
): { structures: Structure[]; matched: number; unmatched: string[] } {
  return sumDVHDirectN([structures1, structures2]);
}

/**
 * Sommation DVH approximative N plans.
 * Pour chaque structure (matchée par nom fuzzy), V_sum(d) = max_i( V_i(d) )
 * sur l'union des doses de tous les plans contenant la structure.
 */
export function sumDVHDirectN(
  structuresList: Structure[][],
): { structures: Structure[]; matched: number; unmatched: string[] } {
  if (!structuresList || structuresList.length < 2) {
    throw new Error('Sommation DVH direct : au moins 2 plans requis.');
  }

  // Index : nom normalisé -> { reference: Structure, sources: Structure[] }
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-]/g, '');
  type Entry = { reference: Structure; sources: Structure[]; presentInAll: boolean; presence: number };
  const map = new Map<string, Entry>();

  structuresList.forEach((plan, planIdx) => {
    plan.forEach((s) => {
      const key = norm(s.name);
      const existing = map.get(key);
      if (existing) {
        existing.sources.push(s);
        existing.presence |= 1 << planIdx;
      } else {
        map.set(key, {
          reference: s,
          sources: [s],
          presentInAll: false,
          presence: 1 << planIdx,
        });
      }
    });
  });

  const fullMask = (1 << structuresList.length) - 1;
  const result: Structure[] = [];
  const unmatched: string[] = [];
  let matched = 0;

  for (const entry of map.values()) {
    if (entry.presence === fullMask) matched++;
    else unmatched.push(entry.reference.name);

    // Union des doses
    const doseSet = new Set<number>();
    for (const s of entry.sources) {
      for (const p of s.relativeVolume) doseSet.add(p.dose);
    }
    const allDoses = Array.from(doseSet).sort((a, b) => a - b);

    const summedPoints: DVHPoint[] = allDoses.map((dose) => ({
      dose,
      volume: Math.max(...entry.sources.map((s) => interpolateVolume(s.relativeVolume, dose))),
    }));

    result.push({
      ...entry.reference,
      relativeVolume: summedPoints,
    });
  }

  return { structures: result, matched, unmatched };
}

// ────────────────────────────────────────────────────────────────
// API haut niveau : orchestrateur (N plans)
// ────────────────────────────────────────────────────────────────

export interface SummationPlanInput {
  name: string;
  rtDoseBuffer?: ArrayBuffer;
  structures?: Structure[];
  rtPlanInfo?: { fractions?: number; dosePerFraction?: number };
}

export interface SummationInput {
  plans: SummationPlanInput[];
  rtStructures?: DicomRTStructure[]; // requis pour recalcul depuis grille
  preferredMethod: SummationMethod;
}

export async function summateDicomPlans(input: SummationInput): Promise<SummedPlanResult> {
  const warnings: string[] = [];
  const planNames = input.plans.map((p) => p.name);
  const planDetails: SummedPlanDetail[] = input.plans.map((p) => {
    const fractions = p.rtPlanInfo?.fractions;
    const dosePerFraction = p.rtPlanInfo?.dosePerFraction;
    const dose =
      fractions !== undefined && dosePerFraction !== undefined
        ? +(fractions * dosePerFraction).toFixed(2)
        : undefined;
    return {
      name: p.name,
      fractions,
      dosePerFraction,
      dose,
      label: p.rtPlanInfo?.planLabel,
    };
  });

  if (!input.plans || input.plans.length < 2) {
    throw new Error('Sommation : au moins 2 plans sont requis.');
  }
  if (input.plans.length > 4) {
    throw new Error('Sommation : maximum 4 plans supportés.');
  }

  if (input.preferredMethod === 'dose_grid') {
    const buffers = input.plans.map((p) => p.rtDoseBuffer).filter((b): b is ArrayBuffer => !!b);
    if (buffers.length !== input.plans.length) {
      throw new Error('Méthode "grille de dose" : un fichier RTDOSE est requis pour chaque plan.');
    }
    if (!input.rtStructures || input.rtStructures.length === 0) {
      warnings.push(
        'Aucun RTSTRUCT fourni : impossible de recalculer les DVH depuis la grille sommée. Bascule en mode DVH direct.',
      );
      return summateDicomPlans({ ...input, preferredMethod: 'dvh_direct' });
    }

    try {
      const summed = sumDoseGridsN(buffers);
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
          planNames,
          planDetails,
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
  const structuresList = input.plans.map((p) => p.structures).filter((s): s is Structure[] => !!s);
  if (structuresList.length !== input.plans.length) {
    throw new Error(
      'Méthode "DVH direct" : les structures DVH de tous les plans sont requises (chargez les RTDOSE associés).',
    );
  }

  const { structures, matched, unmatched } = sumDVHDirectN(structuresList);
  warnings.push(
    `Sommation par DVH direct (${input.plans.length} plans) : approximation V_sum(d) = max_i(V_i(d)). À valider avec une sommation TPS pour usage clinique.`,
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
      planNames,
      planDetails,
      matchedStructures: matched,
      unmatchedStructures: unmatched,
      maxDose,
    },
  };
}
