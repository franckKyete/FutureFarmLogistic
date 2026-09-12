import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HarvestUnit, ProductCategory } from '@futurefarm/types';

// Mock apiClient
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock toast store
vi.mock('@/features/shared/store/toast.store', () => ({
  addToast: vi.fn(),
}));

import { apiClient } from '@/lib/api-client';
import { addToast } from '@/features/shared/store/toast.store';
import {
  enqueueHarvestSubmission,
  getAllQueuedHarvests,
  getPendingHarvests,
  getPendingCount,
  updateQueuedHarvest,
  deleteQueuedHarvest,
  clearQueuedHarvests,
  saveTempDraft,
  getTempDraft,
  getAllTempDrafts,
  getPendingAnalysisDrafts,
  getReadyForReviewDrafts,
  updateTempDraft,
  deleteTempDraft,
  clearTempDrafts,
} from './harvest-queue.db';
import {
  offlineSyncStore,
  refreshOfflineQueueState,
  setOnlineStatus,
  setSyncingStatus,
} from './offline-sync.store';
import {
  syncOfflineHarvests,
  processPendingAiDrafts,
  initOfflineSyncListeners,
  dataUrlToFile,
} from './offline-sync.service';

describe('Offline Harvest Queue, Drafts & Rural Sync', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearQueuedHarvests();
    await clearTempDrafts();
    setOnlineStatus(true);
    setSyncingStatus(false);
    await refreshOfflineQueueState();
  });

  afterEach(async () => {
    await clearQueuedHarvests();
    await clearTempDrafts();
  });

  describe('IndexedDB / In-Memory Queue Operations', () => {
    it('enqueues a new harvest submission with pending status', async () => {
      const submission = await enqueueHarvestSubmission({
        harvestPayload: {
          productId: 'prod-123',
          quantityInStock: 500,
          unit: HarvestUnit.KG,
          pricePerUnit: 850,
          harvestDate: '2026-08-30T00:00:00.000Z',
          expirationDate: '2026-09-30T00:00:00.000Z',
          stockMarge: 50,
          farmingMethods: 'Bio',
          photoUrls: ['https://example.com/photo.jpg'],
        },
        metadata: {
          productName: 'Tomates Bio',
          unit: HarvestUnit.KG,
          quantity: 500,
          pricePerUnit: 850,
          category: ProductCategory.VEGETABLES,
        },
      });

      expect(submission.id).toBeDefined();
      expect(submission.status).toBe('PENDING');
      expect(submission.retryCount).toBe(0);
      expect(submission.metadata.productName).toBe('Tomates Bio');

      const count = await getPendingCount();
      expect(count).toBe(1);

      const items = await getPendingHarvests();
      expect(items.length).toBe(1);
      expect(items[0]?.id).toBe(submission.id);
    });

    it('updates and deletes queued harvest submissions', async () => {
      const item = await enqueueHarvestSubmission({
        harvestPayload: {
          productId: 'prod-456',
          quantityInStock: 100,
          unit: HarvestUnit.KG,
          pricePerUnit: 500,
          harvestDate: '2026-08-30T00:00:00.000Z',
          expirationDate: '2026-09-30T00:00:00.000Z',
          stockMarge: 10,
          farmingMethods: '',
          photoUrls: [],
        },
        metadata: {
          productName: 'Manioc',
          unit: HarvestUnit.KG,
          quantity: 100,
          pricePerUnit: 500,
        },
      });

      await updateQueuedHarvest(item.id, {
        status: 'FAILED',
        retryCount: 1,
        lastError: 'Network error',
      });

      const all = await getAllQueuedHarvests();
      expect(all[0]?.status).toBe('FAILED');
      expect(all[0]?.retryCount).toBe(1);
      expect(all[0]?.lastError).toBe('Network error');

      await deleteQueuedHarvest(item.id);
      const afterDelete = await getAllQueuedHarvests();
      expect(afterDelete.length).toBe(0);
    });
  });

  describe('Persistent Temp Draft Storage', () => {
    it('saves and retrieves an in-progress offline harvest draft with photos', async () => {
      const draft = await saveTempDraft({
        id: 'draft_test_1',
        status: 'DRAFT_IN_PROGRESS',
        localPhotos: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
        featuredPhotoIndex: 0,
        additionalNotes: 'Test offline notes',
      });

      expect(draft.id).toBe('draft_test_1');
      expect(draft.status).toBe('DRAFT_IN_PROGRESS');
      expect(draft.localPhotos.length).toBe(1);

      const retrieved = await getTempDraft('draft_test_1');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('draft_test_1');
      expect(retrieved?.localPhotos[0]).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    });

    it('updates status and fetches pending analysis vs ready for review drafts', async () => {
      await saveTempDraft({
        id: 'draft_pending',
        status: 'PENDING_AI_ANALYSIS',
        localPhotos: ['data:image/jpeg;base64,abc123'],
        featuredPhotoIndex: 0,
        manualForm: {
          productName: 'Aubergines',
          quantity: 200,
          unit: HarvestUnit.KG,
          pricePerUnit: 700,
          harvestDate: '2026-08-30T00:00:00.000Z',
          shelfLifeDays: '20',
          stockMarge: 20,
          farmingMethods: 'Bio',
        },
      });

      await saveTempDraft({
        id: 'draft_ready',
        status: 'ANALYZED_READY_FOR_REVIEW',
        localPhotos: ['data:image/jpeg;base64,xyz789'],
        featuredPhotoIndex: 0,
        aiResult: {
          isIdentified: true,
          suggestedName: 'Aubergines',
          category: ProductCategory.VEGETABLES,
          description: 'Aubergines violettes',
          farmingMethods: 'Bio',
          recommendedShelfLifeDays: 20,
          aiQualityScore: 9.2,
          estimatedQuantity: 200,
          suggestedPricePerUnit: 750,
        },
      });

      const pending = await getPendingAnalysisDrafts();
      expect(pending.length).toBe(1);
      expect(pending[0]?.id).toBe('draft_pending');

      const ready = await getReadyForReviewDrafts();
      expect(ready.length).toBe(1);
      expect(ready[0]?.id).toBe('draft_ready');

      await updateTempDraft('draft_pending', { status: 'ANALYZED_READY_FOR_REVIEW' });
      const readyAfterUpdate = await getReadyForReviewDrafts();
      expect(readyAfterUpdate.length).toBe(2);

      await deleteTempDraft('draft_pending');
      const allAfterDelete = await getAllTempDrafts();
      expect(allAfterDelete.length).toBe(1);
    });
  });

  describe('Offline Sync Store', () => {
    it('refreshes counts and state when items and drafts are stored', async () => {
      expect(offlineSyncStore.state.pendingCount).toBe(0);
      expect(offlineSyncStore.state.pendingAnalysisCount).toBe(0);
      expect(offlineSyncStore.state.readyForReviewCount).toBe(0);

      await enqueueHarvestSubmission({
        harvestPayload: {
          productId: 'prod-789',
          quantityInStock: 200,
          unit: HarvestUnit.TON,
          pricePerUnit: 1200,
          harvestDate: '2026-08-30T00:00:00.000Z',
          expirationDate: '2026-09-30T00:00:00.000Z',
          stockMarge: 20,
          farmingMethods: '',
          photoUrls: [],
        },
        metadata: {
          productName: 'Maïs',
          unit: HarvestUnit.TON,
          quantity: 200,
          pricePerUnit: 1200,
        },
      });

      await saveTempDraft({
        id: 'draft_store_test',
        status: 'PENDING_AI_ANALYSIS',
        localPhotos: ['data:image/jpeg;base64,123'],
        featuredPhotoIndex: 0,
      });

      await refreshOfflineQueueState();
      expect(offlineSyncStore.state.pendingCount).toBe(1);
      expect(offlineSyncStore.state.pendingAnalysisCount).toBe(1);
      expect(offlineSyncStore.state.readyForReviewCount).toBe(0);
    });
  });

  describe('Sync Service & AI Background Analysis', () => {
    it('converts dataUrl to browser File object', () => {
      const dataUrl = 'data:image/jpeg;base64,SGVsbG8gV29ybGQ=';
      const file = dataUrlToFile(dataUrl, 'test.jpg');
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('test.jpg');
      expect(file.type).toBe('image/jpeg');
    });

    it('processes pending AI drafts: uploads photos, calls ai-classify, and sets status to review', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const mockQueryClient = {
        invalidateQueries: vi.fn(),
      } as unknown as import('@tanstack/react-query').QueryClient;

      // Mock media upload
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          data: {
            url: '/uploads/media/server_photo_1.jpg',
          },
        },
      } as unknown as import('axios').AxiosResponse);

      // Mock ai-classify
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          data: {
            isIdentified: true,
            suggestedProductId: 'prod-poivron',
            suggestedName: 'Poivrons Verts',
            category: ProductCategory.VEGETABLES,
            description: 'Poivrons frais',
            farmingMethods: 'Sous serre',
            recommendedShelfLifeDays: 14,
            aiQualityScore: 9.5,
            estimatedQuantity: 150,
            suggestedPricePerUnit: 1200,
          },
        },
      } as unknown as import('axios').AxiosResponse);

      await saveTempDraft({
        id: 'draft_ai_test',
        status: 'PENDING_AI_ANALYSIS',
        localPhotos: ['data:image/jpeg;base64,SGVsbG8gV29ybGQ='],
        featuredPhotoIndex: 0,
        manualForm: {
          productName: 'Poivrons Verts',
          quantity: 150,
          unit: HarvestUnit.KG,
          pricePerUnit: 1200,
          harvestDate: '2026-08-30T00:00:00.000Z',
          shelfLifeDays: '14',
          stockMarge: 15,
          farmingMethods: 'Sous serre',
        },
      });

      const count = await processPendingAiDrafts(mockQueryClient);
      expect(count).toBe(1);

      expect(apiClient.post).toHaveBeenNthCalledWith(
        1,
        '/media/upload',
        expect.any(FormData),
      );
      expect(apiClient.post).toHaveBeenNthCalledWith(
        2,
        '/harvests/ai-classify',
        expect.objectContaining({
          photoUrls: ['/uploads/media/server_photo_1.jpg'],
        }),
      );

      const updatedDraft = await getTempDraft('draft_ai_test');
      expect(updatedDraft?.status).toBe('ANALYZED_READY_FOR_REVIEW');
      expect(updatedDraft?.uploadedPhotoUrls).toEqual(['/uploads/media/server_photo_1.jpg']);
      expect(updatedDraft?.aiResult?.suggestedName).toBe('Poivrons Verts');

      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining('L\'analyse IA de votre récolte "Poivrons Verts" est prête'),
        'success',
      );
    });

    it('does not sync when navigator.onLine is false', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      await enqueueHarvestSubmission({
        harvestPayload: {
          productId: 'prod-1',
          quantityInStock: 10,
          unit: HarvestUnit.KG,
          pricePerUnit: 100,
          harvestDate: '2026-08-30T00:00:00.000Z',
          expirationDate: '2026-09-30T00:00:00.000Z',
          stockMarge: 1,
          farmingMethods: '',
          photoUrls: [],
        },
        metadata: {
          productName: 'Haricots',
          unit: HarvestUnit.KG,
          quantity: 10,
          pricePerUnit: 100,
        },
      });

      const result = await syncOfflineHarvests();
      expect(result).toEqual({ successCount: 0, failureCount: 0, analyzedDraftsCount: 0 });
      expect(apiClient.post).not.toHaveBeenCalled();

      // Reset
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('flushes pending queue to API and notifies query client on success', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const mockQueryClient = {
        invalidateQueries: vi.fn(),
      } as unknown as import('@tanstack/react-query').QueryClient;

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          data: {
            id: 'harvest-new-1',
            productId: 'prod-100',
            quantityInStock: 50,
          },
        },
      } as unknown as import('axios').AxiosResponse);

      await enqueueHarvestSubmission({
        harvestPayload: {
          productId: 'prod-100',
          quantityInStock: 50,
          unit: HarvestUnit.KG,
          pricePerUnit: 600,
          harvestDate: '2026-08-30T00:00:00.000Z',
          expirationDate: '2026-09-30T00:00:00.000Z',
          stockMarge: 5,
          farmingMethods: 'Plein champ',
          photoUrls: [],
        },
        metadata: {
          productName: 'Piments',
          unit: HarvestUnit.KG,
          quantity: 50,
          pricePerUnit: 600,
        },
      });

      const result = await syncOfflineHarvests(mockQueryClient);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(apiClient.post).toHaveBeenCalledWith('/harvests', expect.objectContaining({
        productId: 'prod-100',
        quantityInStock: 50,
      }));

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['harvests'] });
      expect(addToast).toHaveBeenCalledWith(expect.stringContaining('Synchronisation réussie'), 'success');

      const remaining = await getPendingCount();
      expect(remaining).toBe(0);
    });

    it('handles custom offline crops by creating product first then harvest', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      // Mock Product creation response
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          data: {
            id: 'generated-product-id-999',
            name: 'Nouvelle Culture Rare',
            category: ProductCategory.FRUITS,
          },
        },
      } as unknown as import('axios').AxiosResponse);

      // Mock Harvest creation response
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          data: {
            id: 'harvest-custom-1',
            productId: 'generated-product-id-999',
          },
        },
      } as unknown as import('axios').AxiosResponse);

      await enqueueHarvestSubmission({
        customProduct: {
          name: 'Nouvelle Culture Rare',
          category: ProductCategory.FRUITS,
          description: 'Culture rare',
        },
        harvestPayload: {
          productId: '',
          quantityInStock: 30,
          unit: HarvestUnit.KG,
          pricePerUnit: 2500,
          harvestDate: '2026-08-30T00:00:00.000Z',
          expirationDate: '2026-09-30T00:00:00.000Z',
          stockMarge: 2,
          farmingMethods: 'Ombragé',
          photoUrls: [],
        },
        metadata: {
          productName: 'Nouvelle Culture Rare',
          unit: HarvestUnit.KG,
          quantity: 30,
          pricePerUnit: 2500,
          category: ProductCategory.FRUITS,
        },
      });

      const result = await syncOfflineHarvests();

      expect(result.successCount).toBe(1);
      expect(apiClient.post).toHaveBeenNthCalledWith(1, '/products', {
        name: 'Nouvelle Culture Rare',
        category: ProductCategory.FRUITS,
        description: 'Culture rare',
      });
      expect(apiClient.post).toHaveBeenNthCalledWith(2, '/harvests', expect.objectContaining({
        productId: 'generated-product-id-999',
        quantityInStock: 30,
      }));
    });

    it('records errors and updates status to FAILED when API fails', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('500 Internal Server Error'));

      await enqueueHarvestSubmission({
        harvestPayload: {
          productId: 'prod-err',
          quantityInStock: 10,
          unit: HarvestUnit.KG,
          pricePerUnit: 100,
          harvestDate: '2026-08-30T00:00:00.000Z',
          expirationDate: '2026-09-30T00:00:00.000Z',
          stockMarge: 1,
          farmingMethods: '',
          photoUrls: [],
        },
        metadata: {
          productName: 'Erreur Test',
          unit: HarvestUnit.KG,
          quantity: 10,
          pricePerUnit: 100,
        },
      });

      const result = await syncOfflineHarvests();

      expect(result.failureCount).toBe(1);
      expect(result.successCount).toBe(0);

      const items = await getAllQueuedHarvests();
      expect(items[0]?.status).toBe('FAILED');
      expect(items[0]?.retryCount).toBe(1);
      expect(items[0]?.lastError).toBe('500 Internal Server Error');

      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining('Échec de la synchronisation'),
        'warning',
      );
    });

    it('syncs direct proxy harvest submissions to /harvests/proxy with farmerUserId', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { data: { id: 'harvest-proxy-1', status: 'PENDING_APPROVAL' } },
      });

      await enqueueHarvestSubmission({
        isProxy: true,
        farmerUserId: 'farmer-user-99',
        harvestPayload: {
          productId: 'prod-p1',
          quantityInStock: 250,
          unit: HarvestUnit.KG,
          pricePerUnit: 1200,
          harvestDate: '2026-08-30T00:00:00.000Z',
          expirationDate: '2026-09-30T00:00:00.000Z',
          stockMarge: 20,
          farmingMethods: 'Traditionnel',
          photoUrls: [],
        },
        metadata: {
          productName: 'Bananes',
          unit: HarvestUnit.KG,
          quantity: 250,
          pricePerUnit: 1200,
        },
      });

      const result = await syncOfflineHarvests();

      expect(result.successCount).toBe(1);
      expect(apiClient.post).toHaveBeenCalledWith('/harvests/proxy', expect.objectContaining({
        farmerUserId: 'farmer-user-99',
        productId: 'prod-p1',
        quantityInStock: 250,
      }));
    });

    it('processes pending inspector proxy AI drafts with farmer name in toast notification', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const fakeDataUrl = 'data:image/jpeg;base64,ZmFrZWltYWdlZGF0YQ==';

      vi.mocked(apiClient.post).mockImplementation(async (url: string) => {
        if (url === '/media/upload') {
          return { data: { data: { url: 'https://cdn.futurefarm.io/proxy-photo-1.jpg' } } };
        }
        if (url === '/harvests/ai-classify') {
          return {
            data: {
              data: {
                suggestedName: 'Manioc Doux',
                category: ProductCategory.VEGETABLES,
                description: 'Tubercules frais',
                aiQualityScore: 9.4,
                estimatedQuantity: 300,
                suggestedPricePerUnit: 700,
                isIdentified: true,
              },
            },
          };
        }
        return { data: {} };
      });

      const proxyDraft = await saveTempDraft({
        id: 'draft-proxy-abc',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'PENDING_AI_ANALYSIS',
        isProxy: true,
        farmerUserId: 'farmer-user-77',
        farmerName: 'Koffi Konan',
        localPhotos: [fakeDataUrl],
        featuredPhotoIndex: 0,
        manualForm: {
          farmerUserId: 'farmer-user-77',
          farmerName: 'Koffi Konan',
          productId: 'prod-manioc',
          productName: 'Manioc',
          quantity: 300,
          unit: HarvestUnit.KG,
          pricePerUnit: 700,
          stockMarge: 10,
          harvestDate: '2026-08-31',
          shelfLifeDays: '14',
          farmingMethods: 'Traditionnel',
        },
        retryCount: 0,
      });

      const analyzedCount = await processPendingAiDrafts();

      expect(analyzedCount).toBe(1);

      const updated = await getTempDraft(proxyDraft.id);
      expect(updated?.status).toBe('ANALYZED_READY_FOR_REVIEW');
      expect(updated?.isProxy).toBe(true);
      expect(updated?.farmerName).toBe('Koffi Konan');
      expect(updated?.uploadedPhotoUrls).toEqual(['https://cdn.futurefarm.io/proxy-photo-1.jpg']);

      expect(addToast).toHaveBeenCalledWith(
        expect.stringContaining('Koffi Konan'),
        'success',
      );
    });
  });

  describe('Online Event Listeners', () => {
    it('attaches listeners and triggers sync when online event is dispatched', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const mockQueryClient = {
        invalidateQueries: vi.fn(),
      } as unknown as import('@tanstack/react-query').QueryClient;

      const cleanup = initOfflineSyncListeners(mockQueryClient);

      window.dispatchEvent(new Event('offline'));
      expect(offlineSyncStore.state.isOnline).toBe(false);

      window.dispatchEvent(new Event('online'));
      expect(offlineSyncStore.state.isOnline).toBe(true);

      cleanup();
    });
  });
});
