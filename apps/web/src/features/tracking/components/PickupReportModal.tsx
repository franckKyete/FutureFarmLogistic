import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Icon } from '@/features/shared/components/Icon';
import { addToast } from '@/features/shared/store/toast.store';
import { submitPickupReportMutation } from '@/features/tracking/api/tracking.queries';

interface PickupReportModalProps {
  runId: string;
  stopId: string;
  initialWeight?: number | undefined;
  productName?: string | undefined;
  farmerName?: string | undefined;
  destinationCity?: string | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

export function PickupReportModal({
  runId,
  stopId,
  initialWeight = 0,
  productName,
  farmerName,
  destinationCity,
  onClose,
  onSuccess,
}: PickupReportModalProps) {
  const [conditionOk, setConditionOk] = useState<'GOOD' | 'BAD'>('GOOD');
  const [quantityVerified, setQuantityVerified] = useState<boolean>(true);
  const [packagingIntact, setPackagingIntact] = useState<boolean>(true);
  const [weightActualKg, setWeightActualKg] = useState<number>(initialWeight > 0 ? initialWeight : 0);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (initialWeight > 0 && (!weightActualKg || weightActualKg === 0)) {
      setWeightActualKg(initialWeight);
    }
  }, [initialWeight]);

  const submitMutation = useMutation({
    ...submitPickupReportMutation(),
    onSuccess: () => {
      addToast('Rapport de contrôle qualité validé avec succès !', 'success');
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erreur lors de la validation du rapport';
      addToast(Array.isArray(msg) ? msg.join(', ') : msg, 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (weightActualKg <= 0) {
      addToast('Veuillez renseigner un poids valide (> 0 kg)', 'error');
      return;
    }
    submitMutation.mutate({
      runId,
      stopId,
      dto: {
        quantityVerified,
        conditionOk,
        packagingIntact,
        weightActualKg,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5 border border-gray-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#004322] flex items-center justify-center font-bold">
              <Icon name="assignment" className="text-xl" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#004322] tracking-tight">
                Rapport de contrôle qualité
              </h2>
              <p className="text-[11px] font-semibold text-gray-500">
                Inspection de l'article chez le producteur
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Item context banner */}
        {(productName || farmerName || destinationCity) && (
          <div className="bg-emerald-50/60 rounded-2xl p-3.5 border border-emerald-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Article à collecter
              </span>
              {destinationCity && (
                <span className="text-[10px] font-bold text-gray-500">
                  Destination : <span className="text-gray-800">{destinationCity}</span>
                </span>
              )}
            </div>
            {productName && (
              <p className="font-extrabold text-sm text-[#0b1c30]">{productName}</p>
            )}
            {farmerName && (
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <Icon name="store" className="text-sm text-emerald-700" />
                <span>Producteur : {farmerName}</span>
              </p>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          {/* Quality Condition Radio */}
          <div className="space-y-1.5">
            <label className="block font-bold text-gray-700">
              Qualité des produits récoltés
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConditionOk('GOOD')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
                  conditionOk === 'GOOD'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/20'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>✅</span>
                <span>Bon état</span>
              </button>
              <button
                type="button"
                onClick={() => setConditionOk('BAD')}
                className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all cursor-pointer ${
                  conditionOk === 'BAD'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 ring-2 ring-rose-600/20'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>❌</span>
                <span>Mauvais état</span>
              </button>
            </div>
          </div>

          {/* Quantity verification toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <p className="font-bold text-gray-800">Quantité conforme</p>
              <p className="text-[10px] text-gray-500">
                La quantité correspond bien au bon de collecte
              </p>
            </div>
            <input
              type="checkbox"
              checked={quantityVerified}
              onChange={(e) => setQuantityVerified(e.target.checked)}
              className="w-4 h-4 accent-[#004322] rounded cursor-pointer"
            />
          </div>

          {/* Packaging intact toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <p className="font-bold text-gray-800">Emballage intact</p>
              <p className="text-[10px] text-gray-500">
                Conditionnement propre, étiqueté et prêt au transport
              </p>
            </div>
            <input
              type="checkbox"
              checked={packagingIntact}
              onChange={(e) => setPackagingIntact(e.target.checked)}
              className="w-4 h-4 accent-[#004322] rounded cursor-pointer"
            />
          </div>

          {/* Weight actual kg */}
          <div className="space-y-1">
            <label className="block font-bold text-gray-700">
              Poids réel pesé (kg) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={weightActualKg || ''}
              onChange={(e) => setWeightActualKg(parseFloat(e.target.value) || 0)}
              placeholder="Ex: 45.5"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-[#004322] focus:ring-2 focus:ring-[#004322]/15 outline-hidden text-sm font-semibold"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="block font-bold text-gray-700">
              Remarques / Observations
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Précisions éventuelles sur l'état ou le lot..."
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 focus:border-[#004322] focus:ring-2 focus:ring-[#004322]/15 outline-hidden text-xs"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-[#004322] hover:bg-[#1a5c35] text-white font-bold flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Icon name="check" className="text-base" />
                  <span>Confirmer la conformité</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
