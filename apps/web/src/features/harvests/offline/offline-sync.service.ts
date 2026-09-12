import type { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { addToast } from '@/features/shared/store/toast.store';
import type {
  ProductDto,
  HarvestDto,
  AiClassifyHarvestResponseDto,
} from '@futurefarm/types';
import {
  getPendingHarvests,
  updateQueuedHarvest,
  deleteQueuedHarvest,
  getPendingAnalysisDrafts,
  updateTempDraft,
} from './harvest-queue.db';
import {
  offlineSyncStore,
  refreshOfflineQueueState,
  setOnlineStatus,
  setSyncingStatus,
  setLastSyncTime,
} from './offline-sync.store';

export interface SyncResult {
  successCount: number;
  failureCount: number;
  analyzedDraftsCount: number;
}

/**
 * Helper to convert Base64 Data URL to a browser File for multipart upload
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime: string = (mimeMatch && mimeMatch[1]) ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Process all offline drafts awaiting AI photo analysis
 */
export async function processPendingAiDrafts(queryClient?: QueryClient): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 0;
  }

  const pendingDrafts = await getPendingAnalysisDrafts();
  if (pendingDrafts.length === 0) {
    return 0;
  }

  let analyzedCount = 0;

  for (const draft of pendingDrafts) {
    try {
      await updateTempDraft(draft.id, { status: 'ANALYZING' });
      await refreshOfflineQueueState();

      const serverPhotoUrls: string[] = [];

      // 1. Upload local base64 photos to media server
      for (let i = 0; i < draft.localPhotos.length; i++) {
        const photo = draft.localPhotos[i];
        if (!photo) continue;

        if (photo.startsWith('data:')) {
          const file = dataUrlToFile(photo, `offline_photo_${draft.id}_${i}.jpg`);
          const formData = new FormData();
          formData.append('file', file);
          const { data } = await apiClient.post<{ data: { url: string } }>('/media/upload', formData);
          serverPhotoUrls.push(data.data.url);
        } else {
          serverPhotoUrls.push(photo);
        }
      }

      // 2. Call AI classification endpoint with uploaded photo URLs
      const { data: aiRes } = await apiClient.post<{ data: AiClassifyHarvestResponseDto }>(
        '/harvests/ai-classify',
        {
          photoUrls: serverPhotoUrls,
          additionalNotes: draft.additionalNotes,
        },
      );

      // 3. Update draft state with AI analysis results and mark ready for review
      await updateTempDraft(draft.id, {
        status: 'ANALYZED_READY_FOR_REVIEW',
        aiResult: aiRes.data,
        uploadedPhotoUrls: serverPhotoUrls,
      });

      analyzedCount++;

      const cropName = draft.manualForm?.productName || aiRes.data.suggestedName || 'Culture';
      const producerLabel = draft.farmerName || draft.manualForm?.farmerName;
      const qualityScore = aiRes.data.aiQualityScore ? Math.round(aiRes.data.aiQualityScore * 10) : 90;

      // 4. In-App Toast notification
      if (draft.isProxy && producerLabel) {
        addToast(
          `🌾 L'analyse IA du lot "${cropName}" pour ${producerLabel} est prête (Qualité: ${qualityScore}%) ! Cliquez pour réviser et valider.`,
          'success',
        );
      } else {
        addToast(
          `🌾 L'analyse IA de votre récolte "${cropName}" est prête (Qualité: ${qualityScore}%) ! Cliquez pour réviser.`,
          'success',
        );
      }

      // 5. Native Browser Notification (if granted)
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const notifBody = draft.isProxy && producerLabel
            ? `L'IA a terminé l'analyse du lot "${cropName}" pour ${producerLabel}. Ouvrez l'application pour valider par procuration.`
            : `L'IA a terminé l'analyse de votre récolte "${cropName}". Ouvrez l'application pour réviser et confirmer.`;
          new Notification('FutureFarm — Analyse de récolte prête', {
            body: notifBody,
            icon: '/assets/vite.svg',
          });
        } catch {
          // Ignore notification error
        }
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Erreur lors de l'analyse IA de la récolte";
      await updateTempDraft(draft.id, {
        status: 'FAILED',
        retryCount: draft.retryCount + 1,
        lastError: errorMessage,
      });
    }
  }

  await refreshOfflineQueueState();
  if (analyzedCount > 0 && queryClient) {
    void queryClient.invalidateQueries({ queryKey: ['harvests'] });
    void queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  return analyzedCount;
}

/**
 * Flush all pending offline harvest submissions and process AI drafts
 */
export async function syncOfflineHarvests(queryClient?: QueryClient): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { successCount: 0, failureCount: 0, analyzedDraftsCount: 0 };
  }

  if (offlineSyncStore.state.isSyncing) {
    return { successCount: 0, failureCount: 0, analyzedDraftsCount: 0 };
  }

  setSyncingStatus(true);

  // 1. Process AI Drafts that were captured offline
  const analyzedDraftsCount = await processPendingAiDrafts(queryClient);

  // 2. Process Direct Harvest Submissions
  const pendingItems = await getPendingHarvests();
  let successCount = 0;
  let failureCount = 0;

  for (const item of pendingItems) {
    try {
      await updateQueuedHarvest(item.id, { status: 'SYNCING' });
      await refreshOfflineQueueState();

      let targetProductId = item.harvestPayload.productId;

      // If this was a custom crop created offline, create product first
      if (item.customProduct && (!targetProductId || targetProductId === '')) {
        const { data: productRes } = await apiClient.post<{ data: ProductDto }>(
          '/products',
          item.customProduct,
        );
        targetProductId = productRes.data.id;
        item.harvestPayload.productId = targetProductId;
      }

      // Submit harvest creation to backend API (proxy or self)
      if (item.isProxy && item.farmerUserId) {
        await apiClient.post<{ data: HarvestDto }>('/harvests/proxy', {
          ...item.harvestPayload,
          productId: targetProductId,
          farmerUserId: item.farmerUserId,
        });
      } else {
        await apiClient.post<{ data: HarvestDto }>('/harvests', {
          ...item.harvestPayload,
          productId: targetProductId,
        });
      }

      // Remove from offline queue upon success
      await deleteQueuedHarvest(item.id);
      successCount++;
    } catch (err: unknown) {
      failureCount++;
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Erreur réseau lors de la synchronisation';

      await updateQueuedHarvest(item.id, {
        status: 'FAILED',
        retryCount: item.retryCount + 1,
        lastError: errorMessage,
      });
    }
  }

  setSyncingStatus(false);
  setLastSyncTime(new Date().toISOString());
  await refreshOfflineQueueState();

  if (successCount > 0) {
    if (queryClient) {
      void queryClient.invalidateQueries({ queryKey: ['harvests'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    }
    addToast(
      `Synchronisation réussie : ${successCount} récolte${successCount > 1 ? 's' : ''} synchronisée${successCount > 1 ? 's' : ''} !`,
      'success',
    );
  }

  if (failureCount > 0 && successCount === 0) {
    addToast(
      'Échec de la synchronisation de certaines récoltes. Nouvelle tentative automatique dès reconnexion.',
      'warning',
    );
  }

  return { successCount, failureCount, analyzedDraftsCount };
}

/**
 * Initialize listeners for online / offline events and trigger automatic sync
 */
export function initOfflineSyncListeners(queryClient: QueryClient): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Initial store load
  void refreshOfflineQueueState();

  // If already online at startup, attempt initial sync
  if (navigator.onLine) {
    setOnlineStatus(true);
    void syncOfflineHarvests(queryClient);
  } else {
    setOnlineStatus(false);
  }

  const handleOnline = () => {
    setOnlineStatus(true);
    addToast('Connexion Internet rétablie. Synchronisation des récoltes en cours...', 'info');
    void syncOfflineHarvests(queryClient);
  };

  const handleOffline = () => {
    setOnlineStatus(false);
    addToast('Mode hors-ligne activé. Vos photos et récoltes sont stockées localement.', 'warning');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
