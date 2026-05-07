import { Structure, DVHPoint } from '@/types/dvh';
import { LKBParameters, TCPParameters, NTCPResult, TCPResult } from '@/types/ntcp';

/** Abramowitz & Stegun erf approximation (≈ 1.5e-7 precision) */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

/** Convert a physical dose D delivered in nFractions to EQD2 */
export function toEQD2(D: number, nFx: number, alphaBeta: number): number {
  if (D <= 0 || nFx <= 0) return 0;
  const d = D / nFx;
  return D * (d + alphaBeta) / (2 + alphaBeta);
}

/**
 * Build a normalized differential DVH (volume fractions summing to 1) from
 * either differentialAbsoluteVolume, or by numerical derivation of the
 * cumulative absolute / relative DVH.
 */
function getDifferentialBins(structure: Structure): { dose: number; fraction: number }[] {
  // Prefer absolute differential
  const diff = structure.differentialAbsoluteVolume?.length
    ? structure.differentialAbsoluteVolume
    : structure.differentialRelativeVolume;

  if (diff && diff.length > 0) {
    const total = diff.reduce((s, p) => s + p.volume, 0);
    if (total > 0) {
      return diff.map(p => ({ dose: p.dose, fraction: p.volume / total }));
    }
  }

  // Fallback: derive from cumulative absolute or relative
  const cum: DVHPoint[] = (structure.absoluteVolume?.length
    ? structure.absoluteVolume
    : structure.relativeVolume) ?? [];
  if (cum.length < 2) return [];

  const bins: { dose: number; fraction: number }[] = [];
  let totalDelta = 0;
  for (let i = 0; i < cum.length - 1; i++) {
    const d = (cum[i].dose + cum[i + 1].dose) / 2;
    const dv = Math.max(0, cum[i].volume - cum[i + 1].volume);
    bins.push({ dose: d, fraction: dv });
    totalDelta += dv;
  }
  if (totalDelta <= 0) return [];
  return bins.map(b => ({ dose: b.dose, fraction: b.fraction / totalDelta }));
}

/**
 * Generalized EUD with optional EQD2 conversion per bin.
 * gEUD = (Σ vᵢ · Dᵢ^(1/n))^n  where Σvᵢ = 1.
 */
export function computeEUD(
  structure: Structure,
  n: number,
  opts: { nFx?: number; alphaBeta?: number; doseScale?: number } = {}
): number {
  const bins = getDifferentialBins(structure);
  if (bins.length === 0) return 0;
  const { nFx, alphaBeta, doseScale = 1 } = opts;

  const a = 1 / n; // exponent
  let sum = 0;
  for (const b of bins) {
    let D = b.dose * doseScale;
    if (nFx && alphaBeta) D = toEQD2(D, nFx, alphaBeta);
    if (D <= 0) continue;
    sum += b.fraction * Math.pow(D, a);
  }
  if (sum <= 0) return 0;
  return Math.pow(sum, n);
}

/** Lyman-Kutcher-Burman NTCP from EUD */
export function computeNTCP_LKB(EUD: number, p: LKBParameters): number {
  if (EUD <= 0 || p.TD50 <= 0 || p.m <= 0) return 0;
  const t = (EUD - p.TD50) / (p.m * p.TD50);
  return 0.5 * (1 + erf(t / Math.SQRT2));
}

/** Niemierko logistic TCP */
export function computeTCP_Logistic(EUD: number, p: TCPParameters): number {
  if (EUD <= 0) return 0;
  return 1 / (1 + Math.pow(p.TCD50 / EUD, 4 * p.gamma50));
}

export function evaluateNTCP(
  structure: Structure,
  protocolStructureName: string,
  params: LKBParameters,
  nFx: number,
  doseScale = 1
): NTCPResult {
  const EUD = computeEUD(structure, params.n, { nFx, alphaBeta: params.alphaBeta, doseScale });
  return {
    structureName: structure.name,
    protocolStructureName,
    EUD,
    NTCP: computeNTCP_LKB(EUD, params),
    params,
  };
}

export function evaluateTCP(
  structure: Structure,
  protocolStructureName: string,
  params: TCPParameters,
  nFx: number,
  doseScale = 1
): TCPResult {
  // For TCP, n in EUD formula corresponds to a = 1/n; we have a directly.
  // Build EUD using exponent a = params.a (negative).
  const bins = getDifferentialBins(structure);
  let sum = 0;
  for (const b of bins) {
    let D = b.dose * doseScale;
    if (nFx && params.alphaBeta) D = toEQD2(D, nFx, params.alphaBeta);
    if (D <= 0) continue;
    sum += b.fraction * Math.pow(D, params.a);
  }
  const EUD = sum > 0 ? Math.pow(sum, 1 / params.a) : 0;
  return {
    structureName: structure.name,
    protocolStructureName,
    EUD,
    TCP: computeTCP_Logistic(EUD, params),
    params,
  };
}
