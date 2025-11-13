import { TreatmentProtocol } from '@/types/protocol';

// Import default protocol JSON files
import breastGHBoost from './defaultProtocols/breast-GH-boost-45-50-66.json';
import breastRightBoost from './defaultProtocols/breast-right-boost-45-50-66.json';
import cavumSIB from './defaultProtocols/cavum-SIB-54-59.4-70_33fx.json';
import glioblastome from './defaultProtocols/glioblastome-60Gy-30fx.json';
import prostateClassic from './defaultProtocols/prostate-54-59.4-76Gy_38fx.json';
import prostateCHHiP1 from './defaultProtocols/prostate-chhip-44-60-20fx.json';
import prostateCHHiP2 from './defaultProtocols/prostate-chhip-48-57.6-60-20fx.json';

/**
 * Protocoles de radiothérapie prédéfinis (installés par défaut avec l'application)
 * Ces protocoles sont chargés depuis les fichiers JSON dans defaultProtocols/
 */
export const predefinedProtocols: TreatmentProtocol[] = [
  breastGHBoost,
  breastRightBoost,
  cavumSIB,
  glioblastome,
  prostateClassic,
  prostateCHHiP1,
  prostateCHHiP2,
].map((protocol: any) => ({
  ...protocol,
  isCustom: false,
  createdAt: protocol.createdAt ? new Date(protocol.createdAt) : new Date(),
  modifiedAt: protocol.modifiedAt ? new Date(protocol.modifiedAt) : new Date(),
}));

/**
 * Récupère un protocole prédéfini par son ID
 */
export function getProtocolById(id: string): TreatmentProtocol | undefined {
  return predefinedProtocols.find(p => p.id === id);
}

// ============= IndexedDB Integration =============
// These functions now use IndexedDB instead of localStorage

import {
  getAllDefaultProtocols,
  saveDefaultProtocol,
  deleteDefaultProtocol,
  getAllCustomProtocols,
  saveCustomProtocol as saveCustomProtocolDB,
  deleteCustomProtocol as deleteCustomProtocolDB,
  getAllArchivedProtocols,
  archiveProtocol as archiveProtocolDB,
  unarchiveProtocol as unarchiveProtocolDB,
  deleteArchivedProtocol as deleteArchivedProtocolDB,
  migrateLocalStorageToIndexedDB,
} from '@/utils/indexedDBService';

// Initialize migration on module load
migrateLocalStorageToIndexedDB().catch(console.error);

/**
 * Charge les protocoles par défaut ajoutés par l'utilisateur (stockés dans IndexedDB)
 */
export async function loadAddedPredefinedProtocols(): Promise<TreatmentProtocol[]> {
  const userDefaults = await getAllDefaultProtocols();
  return userDefaults.map(p => ({ ...p, isCustom: false }));
}

/**
 * Retourne tous les protocoles disponibles (prédéfinis + ajoutés + personnalisés)
 */
export async function getAllProtocols(): Promise<TreatmentProtocol[]> {
  const addedPredefined = await loadAddedPredefinedProtocols();
  const custom = await loadCustomProtocols();
  
  return [...predefinedProtocols, ...addedPredefined, ...custom];
}

/**
 * Charge les protocoles personnalisés (depuis IndexedDB)
 */
export async function loadCustomProtocols(): Promise<TreatmentProtocol[]> {
  return getAllCustomProtocols();
}

/**
 * Sauvegarde un protocole personnalisé (dans IndexedDB)
 */
export async function saveCustomProtocol(protocol: TreatmentProtocol): Promise<void> {
  await saveCustomProtocolDB(protocol);
}

/**
 * Supprime un protocole personnalisé (de IndexedDB)
 */
export async function deleteCustomProtocol(id: string): Promise<void> {
  await deleteCustomProtocolDB(id);
}

/**
 * Convertit un protocole personnalisé en protocole par défaut
 */
export async function convertCustomToPredefined(customProtocol: TreatmentProtocol): Promise<void> {
  const protocolToAdd = {
    ...customProtocol,
    isCustom: false,
    modifiedAt: new Date(),
  };
  
  // Add to default protocols (user-added)
  await saveDefaultProtocol(protocolToAdd, true);
  
  // Remove from custom protocols
  await deleteCustomProtocolDB(customProtocol.id);
}

/**
 * Archive un protocole
 */
export async function archiveProtocol(protocol: TreatmentProtocol): Promise<void> {
  await archiveProtocolDB(protocol);
}

/**
 * Désarchive un protocole
 */
export async function unarchiveProtocol(protocol: TreatmentProtocol): Promise<void> {
  await unarchiveProtocolDB(protocol);
}

/**
 * Charge les protocoles archivés
 */
export async function loadArchivedProtocols(): Promise<TreatmentProtocol[]> {
  return getAllArchivedProtocols();
}

/**
 * Supprime définitivement un protocole archivé
 */
export async function deleteArchivedProtocol(id: string): Promise<void> {
  await deleteArchivedProtocolDB(id);
}

