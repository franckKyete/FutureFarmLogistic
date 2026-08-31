import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import {
  getAllQueuedHarvests,
  getAllTempDrafts,
  type QueuedHarvestSubmission,
  type OfflineHarvestDraft,
} from './harvest-queue.db';

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  queuedHarvests: QueuedHarvestSubmission[];
  pendingAnalysisCount: number;
  readyForReviewCount: number;
  tempDrafts: OfflineHarvestDraft[];
  lastSyncAt: string | null;
}

export const offlineSyncStore = new Store<OfflineSyncState>({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  isSyncing: false,
  queuedHarvests: [],
  pendingAnalysisCount: 0,
  readyForReviewCount: 0,
  tempDrafts: [],
  lastSyncAt: null,
});

/**
 * Refresh store state from IndexedDB (both queued direct submissions & drafts)
 */
export async function refreshOfflineQueueState(): Promise<void> {
  try {
    const [allSubmissions, allDrafts] = await Promise.all([
      getAllQueuedHarvests(),
      getAllTempDrafts(),
    ]);

    const pendingSubs = allSubmissions.filter(
      (item) => item.status === 'PENDING' || item.status === 'FAILED',
    );
    const pendingAnalysis = allDrafts.filter(
      (d) => d.status === 'PENDING_AI_ANALYSIS' || d.status === 'FAILED',
    );
    const readyForReview = allDrafts.filter(
      (d) => d.status === 'ANALYZED_READY_FOR_REVIEW',
    );

    offlineSyncStore.setState((prev) => ({
      ...prev,
      pendingCount: pendingSubs.length,
      queuedHarvests: allSubmissions,
      pendingAnalysisCount: pendingAnalysis.length,
      readyForReviewCount: readyForReview.length,
      tempDrafts: allDrafts,
    }));
  } catch {
    // Keep current state on read error
  }
}

export function setOnlineStatus(isOnline: boolean): void {
  offlineSyncStore.setState((prev) => ({
    ...prev,
    isOnline,
  }));
}

export function setSyncingStatus(isSyncing: boolean): void {
  offlineSyncStore.setState((prev) => ({
    ...prev,
    isSyncing,
  }));
}

export function setLastSyncTime(timestamp: string): void {
  offlineSyncStore.setState((prev) => ({
    ...prev,
    lastSyncAt: timestamp,
  }));
}

/**
 * Hook to consume offline sync state in React components
 */
export function useOfflineSyncState(): OfflineSyncState {
  return useStore(offlineSyncStore);
}
