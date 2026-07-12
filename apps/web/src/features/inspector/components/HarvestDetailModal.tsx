import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVerifyHarvest } from '../api/harvests.queries';
import { addToast } from '@/features/shared/store/toast.store';
import type { HarvestDto } from '../types';

interface HarvestDetailModalProps {
  harvest: HarvestDto | null;
  isOpen: boolean;
  onClose: () => void;
}

export function HarvestDetailModal({ harvest, isOpen, onClose }: HarvestDetailModalProps) {
  const queryClient = useQueryClient();
  const verifyMutation = useVerifyHarvest();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [manualQualityScore, setManualQualityScore] = useState(5);
  const [notes, setNotes] = useState('');
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  // Reset state when modal opens with new harvest
  useEffect(() => {
    if (harvest) {
      setCurrentImageIndex(0);
      setManualQualityScore(harvest.qualityScore ?? 5);
      setNotes('');
      setShowRejectConfirm(false);
    }
  }, [harvest]);

  const handleClose = useCallback(() => {
    if (!verifyMutation.isPending) {
      onClose();
    }
  }, [onClose, verifyMutation.isPending]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  const handleVerify = useCallback(
    (status: 'APPROVED' | 'REJECTED') => {
      if (!harvest) return;

      const payload: {
        id: string;
        status: string;
        qualityScore?: number;
        rejectionReason?: string;
      } = {
        id: harvest.id,
        status,
      };

      if (status === 'APPROVED') {
        payload.qualityScore = manualQualityScore;
      }

      if (status === 'REJECTED' && notes) {
        payload.rejectionReason = notes;
      }

      verifyMutation.mutate(payload, {
        onSuccess: () => {
          addToast(
            status === 'APPROVED'
              ? 'Récolte approuvée avec succès'
              : 'Récolte rejetée avec succès',
            'success'
          );
          queryClient.invalidateQueries({ queryKey: ['inspector', 'harvests'] });
          onClose();
        },
        onError: (error) => {
          const message =
            error instanceof Error ? error.message : 'Une erreur est survenue';
          addToast(message, 'error');
        },
      });
    },
    [harvest, manualQualityScore, notes, verifyMutation, queryClient, onClose]
  );

  if (!isOpen || !harvest) return null;

  const images = harvest.images ?? [];
  const hasImages = images.length > 0;
  const aiScore = harvest.qualityScore;

  const scoreColor =
    aiScore == null
      ? 'bg-gray-200 text-gray-500'
      : aiScore >= 7
        ? 'bg-green-500 text-white'
        : aiScore >= 4
          ? 'bg-orange-500 text-white'
          : 'bg-red-500 text-white';

  const scoreBarColor =
    aiScore == null
      ? 'bg-gray-200'
      : aiScore >= 7
        ? 'bg-green-500'
        : aiScore >= 4
          ? 'bg-orange-500'
          : 'bg-red-500';

  const formattedDate = new Date(harvest.harvestDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header with close button */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Détail de la récolte</h2>
          <button
            onClick={handleClose}
            disabled={verifyMutation.isPending}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-gray-500">close</span>
          </button>
        </div>

        {/* Image Carousel */}
        <div className="relative bg-gray-100 h-56 flex items-center justify-center">
          {hasImages ? (
            <>
              <img
                src={images[currentImageIndex]}
                alt={`${harvest.productName} - Image ${currentImageIndex + 1}`}
                className="w-full h-full object-cover"
              />

              {images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((prev) =>
                        prev === 0 ? images.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-md transition-colors"
                  >
                    <span className="material-symbols-outlined text-gray-700 text-lg">
                      chevron_left
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((prev) =>
                        prev === images.length - 1 ? 0 : prev + 1
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-md transition-colors"
                  >
                    <span className="material-symbols-outlined text-gray-700 text-lg">
                      chevron_right
                    </span>
                  </button>

                  {/* Dot indicators */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === currentImageIndex
                            ? 'bg-white scale-110 shadow-sm'
                            : 'bg-white/50 hover:bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <span className="material-symbols-outlined text-5xl">image</span>
              <span className="text-sm font-medium">Aucune image</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5">
          {/* Product Info */}
          <div>
            <h3 className="text-xl font-bold text-gray-900">{harvest.productName}</h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span className="font-medium text-gray-700">
                {harvest.quantity} {harvest.unit}
              </span>
              <span className="text-gray-300">•</span>
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Producer Info */}
          <div className="bg-gray-50 rounded-xl p-3.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Producteur
            </p>
            <p className="text-sm font-medium text-gray-900">{harvest.producerName}</p>
          </div>

          {/* AI Analysis Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[#1a5c35] text-lg">
                neurology
              </span>
              <h4 className="text-sm font-bold text-gray-800">Analyse IA</h4>
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                V3
              </span>
            </div>

            {/* Quality Score Gauge */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-gray-500">Score qualité</span>
                <span
                  className={`text-lg font-bold px-2.5 py-0.5 rounded-full ${scoreColor}`}
                >
                  {aiScore ?? '—'}/10
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${scoreBarColor}`}
                  style={{ width: `${aiScore != null ? (aiScore / 10) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Analysis Fields */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-400">Produit suggéré</p>
                <p className="text-sm text-gray-800">{harvest.productName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Description</p>
                <p className="text-sm text-gray-600">
                  {harvest.quantity} {harvest.unit} de {harvest.productName} — récolte
                  contrôlée par inspection
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Méthodes de culture</p>
                <p className="text-sm text-gray-600">Agriculture conventionnelle</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400">Durée de conservation</p>
                <p className="text-sm text-gray-600">7 à 10 jours après récolte</p>
              </div>
            </div>
          </div>

          {/* Manual Validation Section */}
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-bold text-gray-800 mb-3">
              Validation manuelle
            </h4>

            {/* Quality Score Slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="quality-slider"
                  className="text-xs font-medium text-gray-500"
                >
                  Score de qualité
                </label>
                <span className="text-sm font-bold text-[#1a5c35]">
                  {manualQualityScore}/10
                </span>
              </div>
              <input
                id="quality-slider"
                type="range"
                min="0"
                max="10"
                step="1"
                value={manualQualityScore}
                onChange={(e) => setManualQualityScore(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-5
                  [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-[#1a5c35]
                  [&::-webkit-slider-thumb]:shadow-md
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-5
                  [&::-moz-range-thumb]:h-5
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-[#1a5c35]
                  [&::-moz-range-thumb]:border-0
                  [&::-moz-range-thumb]:shadow-md
                  [&::-moz-range-thumb]:cursor-pointer"
              />
            </div>

            {/* Notes Textarea */}
            <div className="mb-4">
              <label
                htmlFor="validation-notes"
                className="text-xs font-medium text-gray-500 block mb-1.5"
              >
                Notes (optionnel)
              </label>
              <textarea
                id="validation-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajouter une note..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#1a5c35]/20 focus:border-[#1a5c35] transition-colors placeholder:text-gray-300"
                disabled={verifyMutation.isPending}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pb-2">
            <button
              onClick={() => setShowRejectConfirm(true)}
              disabled={verifyMutation.isPending}
              className="flex-1 py-3 px-4 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 active:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {verifyMutation.isPending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-lg">close</span>
              )}
              Rejeter
            </button>
            <button
              onClick={() => handleVerify('APPROVED')}
              disabled={verifyMutation.isPending}
              className="flex-1 py-3 px-4 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {verifyMutation.isPending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-lg">check</span>
              )}
              Approuver
            </button>
          </div>
        </div>
      </div>

      {/* Reject Confirmation Dialog */}
      {showRejectConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRejectConfirm(false);
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-red-600 text-xl">
                  warning
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Confirmer le rejet
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Êtes-vous sûr de vouloir rejeter cette récolte ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectConfirm(false)}
                disabled={verifyMutation.isPending}
                className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setShowRejectConfirm(false);
                  handleVerify('REJECTED');
                }}
                disabled={verifyMutation.isPending}
                className="flex-1 py-2.5 px-4 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifyMutation.isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
