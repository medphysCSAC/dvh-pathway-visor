import { LKBParameters, TCPParameters } from '@/types/ntcp';

/**
 * Default LKB parameters compiled from QUANTEC (Marks et al. 2010),
 * Burman 1991, Emami 1991. These are starting points — clinicians
 * should adjust per institution / endpoint.
 */
export const DEFAULT_LKB_PARAMETERS: LKBParameters[] = [
  { key: 'lung',         organName: 'Poumon',           TD50: 24.5, m: 0.37, n: 1.0,  alphaBeta: 3,  endpoint: 'Pneumonite radique sympt. ≥ G2', source: 'QUANTEC 2010' },
  { key: 'heart',        organName: 'Cœur',             TD50: 48,   m: 0.10, n: 0.35, alphaBeta: 3,  endpoint: 'Péricardite',                     source: 'Burman 1991' },
  { key: 'parotid',      organName: 'Parotide',         TD50: 39,   m: 0.40, n: 1.0,  alphaBeta: 3,  endpoint: 'Xérostomie longue durée',         source: 'QUANTEC 2010' },
  { key: 'spinalcord',   organName: 'Moelle épinière',  TD50: 66.5, m: 0.18, n: 0.05, alphaBeta: 2,  endpoint: 'Myélopathie',                     source: 'Schultheiss 2008' },
  { key: 'rectum',       organName: 'Rectum',           TD50: 76.9, m: 0.13, n: 0.09, alphaBeta: 3,  endpoint: 'Toxicité rectale ≥ G2',           source: 'QUANTEC 2010' },
  { key: 'bladder',      organName: 'Vessie',           TD50: 80,   m: 0.11, n: 0.50, alphaBeta: 5,  endpoint: 'Toxicité GU tardive ≥ G3',        source: 'Emami 1991' },
  { key: 'esophagus',    organName: 'Œsophage',         TD50: 51,   m: 0.32, n: 0.69, alphaBeta: 3,  endpoint: 'Œsophagite aiguë ≥ G2',           source: 'QUANTEC 2010' },
  { key: 'liver',        organName: 'Foie',             TD50: 40,   m: 0.12, n: 0.97, alphaBeta: 2.5,endpoint: 'RILD',                            source: 'QUANTEC 2010' },
  { key: 'kidney',       organName: 'Rein',             TD50: 28,   m: 0.10, n: 0.70, alphaBeta: 2.5,endpoint: 'Néphrite',                        source: 'Burman 1991' },
  { key: 'brainstem',    organName: 'Tronc cérébral',   TD50: 65,   m: 0.14, n: 0.16, alphaBeta: 2,  endpoint: 'Nécrose',                         source: 'QUANTEC 2010' },
  { key: 'cochlea',      organName: 'Cochlée',          TD50: 47,   m: 0.39, n: 1.0,  alphaBeta: 3,  endpoint: 'Hypoacousie',                     source: 'Bhandare 2010' },
  { key: 'larynx',       organName: 'Larynx',           TD50: 70,   m: 0.17, n: 0.45, alphaBeta: 3,  endpoint: 'Œdème ≥ G2',                      source: 'Rancati 2010' },
  { key: 'smallbowel',   organName: 'Intestin grêle',   TD50: 55,   m: 0.16, n: 0.15, alphaBeta: 4,  endpoint: 'Toxicité aiguë ≥ G3',             source: 'QUANTEC 2010' },
  { key: 'femoralhead',  organName: 'Tête fémorale',    TD50: 65,   m: 0.12, n: 0.25, alphaBeta: 3,  endpoint: 'Nécrose',                         source: 'Emami 1991' },
  { key: 'lens',         organName: 'Cristallin',       TD50: 18,   m: 0.27, n: 0.30, alphaBeta: 1,  endpoint: 'Cataracte',                       source: 'Emami 1991' },
  { key: 'opticnerve',   organName: 'Nerf optique',     TD50: 72,   m: 0.14, n: 0.25, alphaBeta: 2,  endpoint: 'Neuropathie',                     source: 'QUANTEC 2010' },
  { key: 'opticchiasm',  organName: 'Chiasma optique',  TD50: 72,   m: 0.14, n: 0.25, alphaBeta: 2,  endpoint: 'Neuropathie',                     source: 'QUANTEC 2010' },
];

export const DEFAULT_TCP_PARAMETERS: TCPParameters = {
  key: 'ptv',
  organName: 'PTV',
  TCD50: 60,
  gamma50: 1.5,
  alphaBeta: 10,
  a: -10,
};

/**
 * Match a structure / protocol name to a default LKB entry.
 * Returns null if no match.
 */
export function findDefaultLKB(name: string): LKBParameters | null {
  const n = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  const aliases: Record<string, string> = {
    poumon: 'lung', lung: 'lung', lungs: 'lung',
    coeur: 'heart', heart: 'heart',
    parotide: 'parotid', parotid: 'parotid',
    moelle: 'spinalcord', spinalcord: 'spinalcord', spinal: 'spinalcord', cord: 'spinalcord',
    rectum: 'rectum',
    vessie: 'bladder', bladder: 'bladder',
    oesophage: 'esophagus', esophagus: 'esophagus',
    foie: 'liver', liver: 'liver',
    rein: 'kidney', kidney: 'kidney', kidneys: 'kidney',
    tronc: 'brainstem', brainstem: 'brainstem', brainste: 'brainstem',
    cochlee: 'cochlea', cochlea: 'cochlea',
    larynx: 'larynx',
    grele: 'smallbowel', smallbowel: 'smallbowel', bowel: 'smallbowel', intestingrele: 'smallbowel',
    femorale: 'femoralhead', femoral: 'femoralhead', femoralhead: 'femoralhead', tetefemorale: 'femoralhead',
    cristallin: 'lens', lens: 'lens',
    nerfoptique: 'opticnerve', opticnerve: 'opticnerve',
    chiasma: 'opticchiasm', opticchiasm: 'opticchiasm', chiasm: 'opticchiasm',
  };
  for (const [alias, key] of Object.entries(aliases)) {
    if (n.includes(alias)) {
      return DEFAULT_LKB_PARAMETERS.find(p => p.key === key) ?? null;
    }
  }
  return null;
}
