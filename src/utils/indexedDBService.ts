import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { TreatmentProtocol } from '@/types/protocol';

// Define database schema
interface DVHAnalyzerDB extends DBSchema {
  defaultProtocols: {
    key: string;
    value: TreatmentProtocol & { isUserDefault?: boolean };
  };
  customProtocols: {
    key: string;
    value: TreatmentProtocol;
  };
  archivedProtocols: {
    key: string;
    value: TreatmentProtocol;
  };
}

const DB_NAME = 'dvh-analyzer-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<DVHAnalyzerDB> | null = null;

// Initialize database
export async function initDB(): Promise<IDBPDatabase<DVHAnalyzerDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<DVHAnalyzerDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('defaultProtocols')) {
        db.createObjectStore('defaultProtocols', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('customProtocols')) {
        db.createObjectStore('customProtocols', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('archivedProtocols')) {
        db.createObjectStore('archivedProtocols', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

// Migrate localStorage data to IndexedDB (run once)
export async function migrateLocalStorageToIndexedDB() {
  const db = await initDB();

  // Check if migration already done
  const migrationFlag = localStorage.getItem('indexeddb_migration_done');
  if (migrationFlag === 'true') return;

  try {
    // Migrate custom protocols
    const customProtocolsStr = localStorage.getItem('customProtocols');
    if (customProtocolsStr) {
      const customProtocols: TreatmentProtocol[] = JSON.parse(customProtocolsStr);
      const tx = db.transaction('customProtocols', 'readwrite');
      for (const protocol of customProtocols) {
        await tx.store.put(protocol);
      }
      await tx.done;
    }

    // Migrate added predefined protocols
    const addedPredefinedStr = localStorage.getItem('addedPredefinedProtocols');
    if (addedPredefinedStr) {
      const addedPredefined: TreatmentProtocol[] = JSON.parse(addedPredefinedStr);
      const tx = db.transaction('defaultProtocols', 'readwrite');
      for (const protocol of addedPredefined) {
        await tx.store.put({ ...protocol, isUserDefault: true });
      }
      await tx.done;
    }

    // Mark migration as complete
    localStorage.setItem('indexeddb_migration_done', 'true');
    console.log('✅ Migration from localStorage to IndexedDB completed');
  } catch (error) {
    console.error('Migration error:', error);
  }
}

// ============= Default Protocols =============

export async function getAllDefaultProtocols(): Promise<TreatmentProtocol[]> {
  const db = await initDB();
  return db.getAll('defaultProtocols');
}

export async function saveDefaultProtocol(protocol: TreatmentProtocol, isUserDefault = true) {
  const db = await initDB();
  await db.put('defaultProtocols', { ...protocol, isUserDefault });
}

export async function deleteDefaultProtocol(id: string) {
  const db = await initDB();
  await db.delete('defaultProtocols', id);
}

// ============= Custom Protocols =============

export async function getAllCustomProtocols(): Promise<TreatmentProtocol[]> {
  const db = await initDB();
  return db.getAll('customProtocols');
}

export async function saveCustomProtocol(protocol: TreatmentProtocol) {
  const db = await initDB();
  await db.put('customProtocols', protocol);
}

export async function deleteCustomProtocol(id: string) {
  const db = await initDB();
  await db.delete('customProtocols', id);
}

export async function getCustomProtocol(id: string): Promise<TreatmentProtocol | undefined> {
  const db = await initDB();
  return db.get('customProtocols', id);
}

// ============= Archived Protocols =============

export async function getAllArchivedProtocols(): Promise<TreatmentProtocol[]> {
  const db = await initDB();
  return db.getAll('archivedProtocols');
}

export async function archiveProtocol(protocol: TreatmentProtocol) {
  const db = await initDB();
  
  // Add to archived
  await db.put('archivedProtocols', protocol);
  
  // Remove from custom or default
  if (protocol.isCustom) {
    await deleteCustomProtocol(protocol.id);
  } else {
    await deleteDefaultProtocol(protocol.id);
  }
}

export async function unarchiveProtocol(protocol: TreatmentProtocol) {
  const db = await initDB();
  
  // Remove from archived
  await db.delete('archivedProtocols', protocol.id);
  
  // Add back to appropriate store
  if (protocol.isCustom) {
    await saveCustomProtocol(protocol);
  } else {
    await saveDefaultProtocol(protocol, true);
  }
}

export async function deleteArchivedProtocol(id: string) {
  const db = await initDB();
  await db.delete('archivedProtocols', id);
}

// ============= Utility Functions =============

export async function clearAllData() {
  const db = await initDB();
  await db.clear('defaultProtocols');
  await db.clear('customProtocols');
  await db.clear('archivedProtocols');
}

export async function exportAllData() {
  const db = await initDB();
  return {
    defaultProtocols: await db.getAll('defaultProtocols'),
    customProtocols: await db.getAll('customProtocols'),
    archivedProtocols: await db.getAll('archivedProtocols'),
  };
}
