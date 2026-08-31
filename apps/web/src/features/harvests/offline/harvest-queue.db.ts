import type {
  CreateHarvestDto,
  CreateProductDto,
  HarvestUnit,
  ProductCategory,
  AiClassifyHarvestResponseDto,
} from '@futurefarm/types';

export type QueuedSubmissionStatus = 'PENDING' | 'SYNCING' | 'FAILED';

export interface QueuedHarvestSubmission {
  id: string;
  createdAt: string;
  status: QueuedSubmissionStatus;
  retryCount: number;
  lastError?: string | undefined;
  customProduct?: CreateProductDto | undefined;
  harvestPayload: CreateHarvestDto;
  isProxy?: boolean | undefined;
  farmerUserId?: string | undefined;
  metadata: {
    productName: string;
    unit: HarvestUnit;
    quantity: number;
    pricePerUnit: number;
    category?: ProductCategory | undefined;
    photoUrl?: string | undefined;
  };
}

export type OfflineDraftStatus =
  | 'DRAFT_IN_PROGRESS'
  | 'PENDING_AI_ANALYSIS'
  | 'ANALYZING'
  | 'ANALYZED_READY_FOR_REVIEW'
  | 'COMPLETED'
  | 'FAILED';

export interface OfflineHarvestDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: OfflineDraftStatus;
  isProxy?: boolean | undefined;
  farmerUserId?: string | undefined;
  farmerName?: string | undefined;
  localPhotos: string[];
  featuredPhotoIndex: number;
  uploadedPhotoUrls?: string[] | undefined;
  additionalNotes?: string | undefined;
  manualForm?: {
    productId?: string | undefined;
    isCustomCrop?: boolean | undefined;
    customCrop?: {
      name: string;
      category: ProductCategory;
      description?: string | undefined;
    } | undefined;
    productName: string;
    quantity: number;
    unit: HarvestUnit;
    pricePerUnit: number;
    harvestDate: string;
    shelfLifeDays: string;
    stockMarge: number;
    farmingMethods: string;
    farmerUserId?: string | undefined;
    farmerName?: string | undefined;
  } | undefined;
  aiResult?: AiClassifyHarvestResponseDto | undefined;
  lastError?: string | undefined;
  retryCount: number;
}

const DB_NAME = 'futurefarm_offline_db';
const DB_VERSION = 2;
const STORE_NAME = 'harvest_submissions';
const DRAFT_STORE_NAME = 'harvest_draft_storage';

// In-memory fallbacks for environments without IndexedDB
let memoryStore: Map<string, QueuedHarvestSubmission> | null = null;
let memoryDraftStore: Map<string, OfflineHarvestDraft> | null = null;

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function getMemoryStore(): Map<string, QueuedHarvestSubmission> {
  if (!memoryStore) {
    memoryStore = new Map<string, QueuedHarvestSubmission>();
  }
  return memoryStore;
}

function getMemoryDraftStore(): Map<string, OfflineHarvestDraft> {
  if (!memoryDraftStore) {
    memoryDraftStore = new Map<string, OfflineHarvestDraft>();
  }
  return memoryDraftStore;
}

export function openHarvestDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_status', 'status', { unique: false });
        store.createIndex('by_createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
        const draftStore = db.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'id' });
        draftStore.createIndex('by_status', 'status', { unique: false });
        draftStore.createIndex('by_updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

// =============================================================================
// Direct Harvest Submissions Queue
// =============================================================================

export async function enqueueHarvestSubmission(
  data: Omit<QueuedHarvestSubmission, 'id' | 'createdAt' | 'status' | 'retryCount'>,
): Promise<QueuedHarvestSubmission> {
  const record: QueuedHarvestSubmission = {
    ...data,
    id: `harvest_offline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: new Date().toISOString(),
    status: 'PENDING',
    retryCount: 0,
  };

  if (!isIndexedDbAvailable()) {
    getMemoryStore().set(record.id, record);
    return record;
  }

  try {
    const db = await openHarvestDb();
    return new Promise<QueuedHarvestSubmission>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(record);

      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error || new Error('Failed to enqueue harvest'));
    });
  } catch {
    getMemoryStore().set(record.id, record);
    return record;
  }
}

export async function getAllQueuedHarvests(): Promise<QueuedHarvestSubmission[]> {
  if (!isIndexedDbAvailable()) {
    return Array.from(getMemoryStore().values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  try {
    const db = await openHarvestDb();
    return new Promise<QueuedHarvestSubmission[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result as QueuedHarvestSubmission[]).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        resolve(results);
      };
      req.onerror = () => reject(req.error || new Error('Failed to fetch queued harvests'));
    });
  } catch {
    return Array.from(getMemoryStore().values());
  }
}

export async function getPendingHarvests(): Promise<QueuedHarvestSubmission[]> {
  const all = await getAllQueuedHarvests();
  return all.filter((item) => item.status === 'PENDING' || item.status === 'FAILED');
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingHarvests();
  return pending.length;
}

export async function updateQueuedHarvest(
  id: string,
  updates: Partial<QueuedHarvestSubmission>,
): Promise<void> {
  if (!isIndexedDbAvailable()) {
    const current = getMemoryStore().get(id);
    if (current) {
      getMemoryStore().set(id, { ...current, ...updates });
    }
    return;
  }

  try {
    const db = await openHarvestDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const current = getReq.result as QueuedHarvestSubmission | undefined;
        if (!current) {
          resolve();
          return;
        }

        const updated: QueuedHarvestSubmission = {
          ...current,
          ...updates,
        };

        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error || new Error('Failed to update queued harvest'));
      };

      getReq.onerror = () => reject(getReq.error || new Error('Failed to read queued harvest for update'));
    });
  } catch {
    const current = getMemoryStore().get(id);
    if (current) {
      getMemoryStore().set(id, { ...current, ...updates });
    }
  }
}

export async function deleteQueuedHarvest(id: string): Promise<void> {
  if (!isIndexedDbAvailable()) {
    getMemoryStore().delete(id);
    return;
  }

  try {
    const db = await openHarvestDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to delete queued harvest'));
    });
  } catch {
    getMemoryStore().delete(id);
  }
}

export async function clearQueuedHarvests(): Promise<void> {
  if (!isIndexedDbAvailable()) {
    getMemoryStore().clear();
    return;
  }

  try {
    const db = await openHarvestDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to clear queued harvests'));
    });
  } catch {
    getMemoryStore().clear();
  }
}

// =============================================================================
// Persistent Temp Storage for Drafts & Background AI Processing
// =============================================================================

export async function saveTempDraft(
  draft: Omit<OfflineHarvestDraft, 'createdAt' | 'updatedAt' | 'retryCount'> & {
    createdAt?: string;
    updatedAt?: string;
    retryCount?: number;
  },
): Promise<OfflineHarvestDraft> {
  const now = new Date().toISOString();
  const record: OfflineHarvestDraft = {
    ...draft,
    createdAt: draft.createdAt || now,
    updatedAt: now,
    retryCount: draft.retryCount || 0,
  };

  if (!isIndexedDbAvailable()) {
    getMemoryDraftStore().set(record.id, record);
    return record;
  }

  try {
    const db = await openHarvestDb();
    return new Promise<OfflineHarvestDraft>((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DRAFT_STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error || new Error('Failed to save temp draft'));
    });
  } catch {
    getMemoryDraftStore().set(record.id, record);
    return record;
  }
}

export async function getTempDraft(id: string): Promise<OfflineHarvestDraft | null> {
  if (!isIndexedDbAvailable()) {
    return getMemoryDraftStore().get(id) || null;
  }

  try {
    const db = await openHarvestDb();
    return new Promise<OfflineHarvestDraft | null>((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
      const store = tx.objectStore(DRAFT_STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve((req.result as OfflineHarvestDraft) || null);
      req.onerror = () => reject(req.error || new Error('Failed to get temp draft'));
    });
  } catch {
    return getMemoryDraftStore().get(id) || null;
  }
}

export async function getAllTempDrafts(): Promise<OfflineHarvestDraft[]> {
  if (!isIndexedDbAvailable()) {
    return Array.from(getMemoryDraftStore().values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  try {
    const db = await openHarvestDb();
    return new Promise<OfflineHarvestDraft[]>((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
      const store = tx.objectStore(DRAFT_STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = (req.result as OfflineHarvestDraft[]).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        resolve(results);
      };
      req.onerror = () => reject(req.error || new Error('Failed to fetch all temp drafts'));
    });
  } catch {
    return Array.from(getMemoryDraftStore().values());
  }
}

export async function getPendingAnalysisDrafts(): Promise<OfflineHarvestDraft[]> {
  const all = await getAllTempDrafts();
  return all.filter((d) => d.status === 'PENDING_AI_ANALYSIS' || d.status === 'FAILED');
}

export async function getReadyForReviewDrafts(): Promise<OfflineHarvestDraft[]> {
  const all = await getAllTempDrafts();
  return all.filter((d) => d.status === 'ANALYZED_READY_FOR_REVIEW');
}

export async function updateTempDraft(
  id: string,
  updates: Partial<OfflineHarvestDraft>,
): Promise<void> {
  if (!isIndexedDbAvailable()) {
    const current = getMemoryDraftStore().get(id);
    if (current) {
      getMemoryDraftStore().set(id, {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }

  try {
    const db = await openHarvestDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DRAFT_STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const current = getReq.result as OfflineHarvestDraft | undefined;
        if (!current) {
          resolve();
          return;
        }

        const updated: OfflineHarvestDraft = {
          ...current,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error || new Error('Failed to update temp draft'));
      };

      getReq.onerror = () => reject(getReq.error || new Error('Failed to read temp draft for update'));
    });
  } catch {
    const current = getMemoryDraftStore().get(id);
    if (current) {
      getMemoryDraftStore().set(id, {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function deleteTempDraft(id: string): Promise<void> {
  if (!isIndexedDbAvailable()) {
    getMemoryDraftStore().delete(id);
    return;
  }

  try {
    const db = await openHarvestDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DRAFT_STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to delete temp draft'));
    });
  } catch {
    getMemoryDraftStore().delete(id);
  }
}

export async function clearTempDrafts(): Promise<void> {
  if (!isIndexedDbAvailable()) {
    getMemoryDraftStore().clear();
    return;
  }

  try {
    const db = await openHarvestDb();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(DRAFT_STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to clear temp drafts'));
    });
  } catch {
    getMemoryDraftStore().clear();
  }
}
