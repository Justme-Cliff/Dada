import { openDB } from 'idb'
import { createInitialModel } from './learningModel'
import type { ModelState } from '../store/brainStore'

const DB_NAME    = 'dada-brain'
const STORE_NAME = 'model-state'
const KEY        = 'current'
// Bump version when ModelState schema changes — triggers migration
const DB_VERSION = 2

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore(STORE_NAME)
      }
      // v2: new fields added (clusterRecency, totalFrames, developmentStage, brainAge)
      // No structural migration needed — loadModel merges defaults for missing fields
    },
  })
}

export async function saveModel(state: ModelState): Promise<void> {
  try {
    const db = await getDB()
    await db.put(STORE_NAME, state, KEY)
  } catch (err) {
    // Non-fatal — app continues without persistence (private browsing, etc.)
    console.warn('[persistence] saveModel failed:', err)
  }
}

export async function loadModel(): Promise<ModelState | null> {
  try {
    const db   = await getDB()
    const raw  = await db.get(STORE_NAME, KEY)
    if (!raw) return null

    // Merge with current defaults so new fields are present even if the
    // saved record predates them (forward-compatible schema migration)
    const defaults = createInitialModel()
    return { ...defaults, ...raw } as ModelState
  } catch (err) {
    console.warn('[persistence] loadModel failed:', err)
    return null
  }
}

export async function clearModel(): Promise<void> {
  try {
    const db = await getDB()
    await db.delete(STORE_NAME, KEY)
  } catch (err) {
    console.warn('[persistence] clearModel failed:', err)
  }
}
