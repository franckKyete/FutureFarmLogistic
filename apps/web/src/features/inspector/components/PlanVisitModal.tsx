import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProducers } from '../api/accounts.queries';
import { useCreateVisit } from '../api/visits.queries';
import { addToast } from '@/features/shared/store/toast.store';
import type { VisitReason } from '@futurefarm/types';

interface PlanVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REASON_OPTIONS: { value: VisitReason; label: string }[] = [
  { value: 'ROUTINE' as VisitReason, label: 'Visite de routine' },
  { value: 'URGENT' as VisitReason, label: 'Urgence' },
  { value: 'FIRST_INSPECTION' as VisitReason, label: 'Première inspection' },
];

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function PlanVisitModal({ isOpen, onClose }: PlanVisitModalProps) {
  const queryClient = useQueryClient();
  const createVisit = useCreateVisit();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducerId, setSelectedProducerId] = useState('');
  const [selectedProducerLabel, setSelectedProducerLabel] = useState('');
  const [plannedDate, setPlannedDate] = useState(getTodayString());
  const [plannedTime, setPlannedTime] = useState('09:00');
  const [reason, setReason] = useState<VisitReason>('ROUTINE' as VisitReason);
  const [notes, setNotes] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [errors, setErrors] = useState<{ producer: string | null; date: string | null }>({
    producer: null,
    date: null,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: producers, isLoading: producersLoading } = useProducers({ role: 'farmer', limit: 100 });

  const filteredProducers =
    producers?.filter((p) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = `${p.firstName} ${p.lastName}`.toLowerCase();
      const farm = p.farmName?.toLowerCase() ?? '';
      return name.includes(q) || farm.includes(q);
    }) ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetForm = () => {
    setSearchQuery('');
    setSelectedProducerId('');
    setSelectedProducerLabel('');
    setPlannedDate(getTodayString());
    setPlannedTime('09:00');
    setReason('ROUTINE' as VisitReason);
    setNotes('');
    setErrors({ producer: null, date: null });
    setShowDropdown(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = (): boolean => {
    const newErrors: { producer: string | null; date: string | null } = {
      producer: null,
      date: null,
    };
    if (!selectedProducerId) newErrors.producer = 'Veuillez sélectionner un producteur';
    if (!plannedDate) newErrors.date = 'Veuillez choisir une date';
    setErrors(newErrors);
    return !newErrors.producer && !newErrors.date;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const payload: import('../types').CreateVisitDto = {
        producerId: selectedProducerId,
        plannedDate,
        reason,
      };
      if (plannedTime) payload.plannedTime = plannedTime;
      if (notes) payload.notes = notes;

      await createVisit.mutateAsync(payload);
      addToast('Visite planifiée avec succès', 'success');
      queryClient.invalidateQueries({ queryKey: ['inspector', 'visits'] });
      handleClose();
    } catch {
      addToast('Erreur lors de la planification de la visite', 'error');
    }
  };

  const selectProducer = (id: string, label: string) => {
    setSelectedProducerId(id);
    setSelectedProducerLabel(label);
    setSearchQuery(label);
    setShowDropdown(false);
    setErrors((prev) => ({ ...prev, producer: null }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        <h2 className="text-lg font-bold text-[#1a5c35] mb-6">Planifier une visite</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Producteur <span className="text-red-500">*</span>
            </label>

            {selectedProducerId && !showDropdown ? (
              <div className={`flex items-center justify-between border rounded-xl px-3 py-2.5 bg-white ${
                errors.producer ? 'border-red-400' : 'border-gray-200'
              }`}>
                <span className="text-sm text-gray-900 truncate">{selectedProducerLabel}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProducerId('');
                    setSelectedProducerLabel('');
                    setSearchQuery('');
                    setShowDropdown(true);
                    setTimeout(() => searchInputRef.current?.focus(), 0);
                  }}
                  className="shrink-0 ml-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            ) : (
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Rechercher un producteur..."
                className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1a5c35] focus:ring-2 focus:ring-[#1a5c35]/20 transition-all ${
                  errors.producer ? 'border-red-400' : 'border-gray-200'
                }`}
              />
            )}

            {errors.producer && (
              <p className="text-red-500 text-xs mt-1">{errors.producer}</p>
            )}

            {showDropdown && !selectedProducerId && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {producersLoading ? (
                  <div className="p-3 text-sm text-gray-500 text-center">Chargement...</div>
                ) : filteredProducers.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500 text-center">Aucun producteur trouvé</div>
                ) : (
                  filteredProducers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        selectProducer(p.id, `${p.firstName} ${p.lastName}${p.farmName ? ` — ${p.farmName}` : ''}`)
                      }
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <span className="font-medium text-gray-900">
                        {p.firstName} {p.lastName}
                      </span>
                      {p.farmName && (
                        <span className="text-gray-500 text-xs ml-1">({p.farmName})</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => {
                setPlannedDate(e.target.value);
                setErrors((prev) => ({ ...prev, date: null }));
              }}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1a5c35] focus:ring-2 focus:ring-[#1a5c35]/20 transition-all ${
                errors.date ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Heure</label>
            <input
              type="time"
              value={plannedTime}
              onChange={(e) => setPlannedTime(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1a5c35] focus:ring-2 focus:ring-[#1a5c35]/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Motif</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as VisitReason)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1a5c35] focus:ring-2 focus:ring-[#1a5c35]/20 transition-all bg-white"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes optionnelles..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1a5c35] focus:ring-2 focus:ring-[#1a5c35]/20 transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createVisit.isPending}
              className="flex-1 py-2.5 bg-[#1a5c35] text-white rounded-xl text-sm font-semibold hover:bg-[#004322] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {createVisit.isPending ? 'Planification...' : 'Planifier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
