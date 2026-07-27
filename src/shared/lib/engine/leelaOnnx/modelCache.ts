import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'leela-onnx-model-cache'
const STORE_NAME = 'models'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

export async function getCachedModel(
  key: string
): Promise<ArrayBuffer | null> {
  try {
    const db = await getDB()
    const result = await db.get(STORE_NAME, key)
    return result ?? null
  } catch {
    return null
  }
}

export async function cacheModel(
  key: string,
  data: ArrayBuffer
): Promise<void> {
  try {
    const db = await getDB()
    await db.put(STORE_NAME, data, key)
  } catch (e) {
    console.warn('Failed to cache model:', e)
  }
}

export async function deleteCachedModel(key: string): Promise<void> {
  try {
    const db = await getDB()
    await db.delete(STORE_NAME, key)
  } catch (e) {
    console.warn('Failed to delete cached model:', e)
  }
}

export async function decompressGzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream('gzip')
  const decompressed = new Blob([data]).stream().pipeThrough(ds)
  return new Response(decompressed).arrayBuffer()
}

export async function hasModelCached(key: string): Promise<boolean> {
  try {
    const db = await getDB()
    const result = await db.get(STORE_NAME, key)
    return result !== undefined
  } catch {
    return false
  }
}
