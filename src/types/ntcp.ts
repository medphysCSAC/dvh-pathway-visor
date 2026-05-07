export interface LKBParameters {
  /** Identifier matching protocol structure name (lowercased, normalized) */
  key: string;
  /** Display name */
  organName: string;
  /** TD50 in Gy (uniform whole-organ dose causing 50% complication) */
  TD50: number;
  /** Slope parameter */
  m: number;
  /** Volume effect parameter (0 < n ≤ 1) */
  n: number;
  /** α/β for late effect (Gy) */
  alphaBeta: number;
  /** Endpoint description */
  endpoint: string;
  /** Source citation */
  source: string;
}

export interface TCPParameters {
  key: string;
  organName: string;
  TCD50: number;     // Gy
  gamma50: number;
  alphaBeta: number; // tumor α/β (~10 Gy)
  /** EUD exponent a (negative for tumor, e.g. -10) */
  a: number;
}

export interface NTCPResult {
  structureName: string;          // DICOM matched name
  protocolStructureName: string;  // Protocol expected name
  EUD: number;                    // EQD2-based gEUD (Gy)
  NTCP: number;                   // 0..1
  params: LKBParameters;
}

export interface TCPResult {
  structureName: string;
  protocolStructureName: string;
  EUD: number;
  TCP: number;
  params: TCPParameters;
}
