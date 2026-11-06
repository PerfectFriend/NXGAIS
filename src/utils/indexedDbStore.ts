/**
 * NeXXUs IndexedDB Persistent Chunk Store (WS1 & WS5)
 * Enables true persistent storage of 16 KB binary chunk slices in browser IndexedDB,
 * removing localStorage 5MB quota restrictions and supporting multi-megabyte files.
 */

const DB_NAME = 'nexxus_chunk_db';
const DB_VERSION = 1;
const CHUNK_STORE = 'chunks';
const METADATA_STORE = 'file_metadata';

export interface StoredChunkRecord {
  chunkId: string;
  fileId: string;
  chunkIndex: number;
  hash: string;
  sizeBytes: number;
  data: Uint8Array;
  storedAt: number;
}

let dbInstance: IDBDatabase | null = null;

export async function getChunkDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const store = db.createObjectStore(CHUNK_STORE, { keyPath: 'chunkId' });
        store.createIndex('fileId', 'fileId', { unique: false });
        store.createIndex('chunkIndex', 'chunkIndex', { unique: false });
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error(`Failed to open IndexedDB: ${(event.target as IDBOpenDBRequest).error}`));
    };
  });
}

/**
 * Saves a 16KB binary chunk slice into IndexedDB
 */
export async function saveChunkBinary(
  chunkId: string,
  fileId: string,
  chunkIndex: number,
  hash: string,
  data: Uint8Array
): Promise<void> {
  const db = await getChunkDatabase();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CHUNK_STORE], 'readwrite');
    const store = tx.objectStore(CHUNK_STORE);
    const record: StoredChunkRecord = {
      chunkId,
      fileId,
      chunkIndex,
      hash,
      sizeBytes: data.byteLength,
      data,
      storedAt: Date.now(),
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves a single 16KB binary chunk slice by chunkId
 */
export async function getChunkBinary(chunkId: string): Promise<Uint8Array | null> {
  const db = await getChunkDatabase();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CHUNK_STORE], 'readonly');
    const store = tx.objectStore(CHUNK_STORE);
    const req = store.get(chunkId);
    req.onsuccess = () => {
      if (req.result) {
        resolve(req.result.data);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves and reassembles all chunk binary slices for a file in sequence
 */
export async function getAllChunksForFile(fileId: string): Promise<Uint8Array[]> {
  const db = await getChunkDatabase();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CHUNK_STORE], 'readonly');
    const store = tx.objectStore(CHUNK_STORE);
    const index = store.index('fileId');
    const req = index.getAll(fileId);

    req.onsuccess = () => {
      const records: StoredChunkRecord[] = req.result || [];
      // Sort in order of chunkIndex
      records.sort((a, b) => a.chunkIndex - b.chunkIndex);
      resolve(records.map(r => r.data));
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Calculates current total stored chunks and byte volume in IndexedDB
 */
export async function getChunkStoreStats(): Promise<{ totalChunks: number; totalBytesStored: number }> {
  const db = await getChunkDatabase();
  if (!db) return { totalChunks: 0, totalBytesStored: 0 };
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CHUNK_STORE], 'readonly');
    const store = tx.objectStore(CHUNK_STORE);
    const req = store.getAll();

    req.onsuccess = () => {
      const records: StoredChunkRecord[] = req.result || [];
      const totalBytesStored = records.reduce((sum, r) => sum + r.sizeBytes, 0);
      resolve({
        totalChunks: records.length,
        totalBytesStored,
      });
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes all chunks associated with a fileId
 */
export async function deleteFileChunks(fileId: string): Promise<void> {
  const db = await getChunkDatabase();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CHUNK_STORE], 'readwrite');
    const store = tx.objectStore(CHUNK_STORE);
    const index = store.index('fileId');
    const req = index.getAllKeys(fileId);

    req.onsuccess = () => {
      const keys = req.result;
      for (const key of keys) {
        store.delete(key);
      }
      resolve();
    };

    req.onerror = () => reject(req.error);
  });
}
