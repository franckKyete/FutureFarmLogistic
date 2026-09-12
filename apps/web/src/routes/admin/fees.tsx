import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import {
  Permission,
  FeeCalculationType,
  type PlatformFeeConfigDto,
  type CreatePlatformFeeDto,
  type UpdatePlatformFeeDto,
} from '@futurefarm/types';
import {
  fetchAdminFees,
  createPlatformFee,
  updatePlatformFee,
  deletePlatformFee,
} from '@/features/fees/api/fees.api';
import { addToast } from '@/features/shared/store/toast.store';
import { useCurrencyStore, formatPriceDirect } from '@/features/currency/store/currency.store';

export const Route = createFileRoute('/admin/fees')({
  beforeLoad: () => {
    requireAuth(Permission.DASHBOARD_READ);
  },
  component: PlatformFeesAdminPage,
});

function PlatformFeesAdminPage() {
  const [fees, setFees] = useState<PlatformFeeConfigDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<PlatformFeeConfigDto | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formType, setFormType] = useState<FeeCalculationType>(FeeCalculationType.FIXED);
  const [formValue, setFormValue] = useState<string>('0.00');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Currency Store for simulation
  const currencies = useCurrencyStore((s) => s.currencies);
  const cdfRate = currencies.find((c) => c.code === 'CDF')?.rateAgainstBase ?? 2300.0;
  const xofRate = currencies.find((c) => c.code === 'XOF')?.rateAgainstBase ?? 565.0;

  const loadFees = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminFees();
      setFees(Array.isArray(data) ? data : []);
    } catch (err: any) {
      addToast('Erreur lors du chargement des frais: ' + (err.message || ''), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFees();
  }, []);

  const openCreateModal = () => {
    setEditingFee(null);
    setFormName('');
    setFormCode('');
    setFormType(FeeCalculationType.FIXED);
    setFormValue('2.50');
    setFormDescription('');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (fee: PlatformFeeConfigDto) => {
    setEditingFee(fee);
    setFormName(fee.name);
    setFormCode(fee.code);
    setFormType(fee.calculationType);
    setFormValue(fee.value.toString());
    setFormDescription(fee.description || '');
    setFormIsActive(fee.isActive);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (fee: PlatformFeeConfigDto) => {
    try {
      const updated = await updatePlatformFee(fee.id, { isActive: !fee.isActive });
      setFees((prev) => prev.map((f) => (f.id === fee.id ? updated : f)));
      addToast(`Frais "${fee.name}" ${!fee.isActive ? 'activé' : 'désactivé'}.`, 'success');
    } catch (err: any) {
      addToast(err.response?.data?.message || err.message || 'Erreur de modification', 'error');
    }
  };

  const handleDelete = async (fee: PlatformFeeConfigDto) => {
    if (!window.confirm(`Confirmer la suppression du frais "${fee.name}" (${fee.code}) ?`)) {
      return;
    }
    try {
      await deletePlatformFee(fee.id);
      setFees((prev) => prev.filter((f) => f.id !== fee.id));
      addToast(`Frais "${fee.name}" supprimé.`, 'info');
    } catch (err: any) {
      addToast(err.response?.data?.message || err.message || 'Erreur de suppression', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valNum = parseFloat(formValue);
    if (isNaN(valNum) || valNum < 0) {
      addToast('Veuillez entrer une valeur valide supérieure ou égale à 0.', 'error');
      return;
    }
    if (!formName.trim() || !formCode.trim()) {
      addToast('Le nom et le code du frais sont obligatoires.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (editingFee) {
        const payload: UpdatePlatformFeeDto = {
          name: formName.trim(),
          code: formCode.toUpperCase().trim(),
          calculationType: formType,
          value: valNum,
          description: formDescription.trim() || undefined,
          isActive: formIsActive,
        };
        const updated = await updatePlatformFee(editingFee.id, payload);
        setFees((prev) => prev.map((f) => (f.id === editingFee.id ? updated : f)));
        addToast(`Frais "${updated.name}" mis à jour.`, 'success');
      } else {
        const payload: CreatePlatformFeeDto = {
          name: formName.trim(),
          code: formCode.toUpperCase().trim(),
          calculationType: formType,
          value: valNum,
          currency: 'USD',
          description: formDescription.trim() || undefined,
          isActive: formIsActive,
          displayOrder: fees.length + 1,
        };
        const created = await createPlatformFee(payload);
        setFees((prev) => [...prev, created]);
        addToast(`Nouveau frais "${created.name}" créé avec succès.`, 'success');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      addToast(err.response?.data?.message || err.message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const activeCount = fees.filter((f) => f.isActive).length;
  const fixedCount = fees.filter((f) => f.calculationType === FeeCalculationType.FIXED && f.isActive).length;
  const percentageCount = fees.filter((f) => f.calculationType === FeeCalculationType.PERCENTAGE && f.isActive).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--admin-outline-variant)]/40 pb-5">
        <div>
          <h1 className="text-2xl font-black text-[var(--admin-on-surface)] tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[28px] text-[var(--admin-primary)]">
              payments
            </span>
            <span>Frais de plateforme & additionnels</span>
          </h1>
          <p className="text-xs text-[var(--admin-on-surface-variant)] mt-1">
            Configurez les frais de livraison, service, taxes et suppléments appliqués dynamiquement au panier des acheteurs.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--admin-primary)] hover:bg-[var(--admin-primary)]/90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Ajouter un frais</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--admin-surface-container-low)] border border-[var(--admin-outline-variant)]/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
              Total Frais
            </span>
            <span className="material-symbols-outlined text-[20px] text-[var(--admin-primary)]">
              tune
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--admin-on-surface)]">{fees.length}</span>
            <span className="text-xs text-[var(--admin-on-surface-variant)] font-medium">configurés</span>
          </div>
        </div>

        <div className="bg-[var(--admin-surface-container-low)] border border-[var(--admin-outline-variant)]/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
              Frais Actifs
            </span>
            <span className="material-symbols-outlined text-[20px] text-emerald-600">
              check_circle
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{activeCount}</span>
            <span className="text-xs text-[var(--admin-on-surface-variant)] font-medium">
              appliqués au panier
            </span>
          </div>
        </div>

        <div className="bg-[var(--admin-surface-container-low)] border border-[var(--admin-outline-variant)]/60 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
              Structure active
            </span>
            <span className="material-symbols-outlined text-[20px] text-blue-600">
              analytics
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-bold text-[var(--admin-on-surface)]">
              {fixedCount} Fixe(s) • {percentageCount} Pourcentage(s)
            </span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[var(--admin-surface-container-lowest)] border border-[var(--admin-outline-variant)]/60 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[var(--admin-outline-variant)]/40 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--admin-on-surface)] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--admin-primary)]">
              list_alt
            </span>
            <span>Liste des frais configurés</span>
          </h2>
          <span className="text-xs text-[var(--admin-on-surface-variant)] font-medium">
            Taux de change appliqués : 1 USD = {cdfRate.toLocaleString('fr-FR')} CDF | {xofRate.toLocaleString('fr-FR')} XOF
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-[var(--admin-on-surface-variant)] flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-[var(--admin-primary)] border-t-transparent rounded-full animate-spin" />
            <span>Chargement des frais...</span>
          </div>
        ) : fees.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="material-symbols-outlined text-[40px] text-[var(--admin-on-surface-variant)]/50">
              receipt_long
            </span>
            <p className="text-sm font-bold text-[var(--admin-on-surface)]">Aucun frais configuré</p>
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              Cliquez sur "Ajouter un frais" pour créer le premier frais de la plateforme.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--admin-outline-variant)]/40 bg-[var(--admin-surface-container-low)] text-[11px] font-bold text-[var(--admin-on-surface-variant)] uppercase tracking-wider">
                  <th className="py-3.5 px-6">Nom & Code</th>
                  <th className="py-3.5 px-4">Type de calcul</th>
                  <th className="py-3.5 px-4">Valeur de base</th>
                  <th className="py-3.5 px-4">Aperçu multi-devises</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-outline-variant)]/30 text-xs text-[var(--admin-on-surface)]">
                {fees.map((fee) => {
                  const isFixed = fee.calculationType === FeeCalculationType.FIXED;
                  const cdfVal = isFixed ? fee.value * cdfRate : null;
                  const xofVal = isFixed ? fee.value * xofRate : null;

                  return (
                    <tr
                      key={fee.id}
                      className={`hover:bg-[var(--admin-surface-container-low)]/50 transition-colors ${
                        !fee.isActive ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-[var(--admin-on-surface)] text-sm">{fee.name}</div>
                        <div className="text-[10px] font-mono font-bold text-[var(--admin-primary)]">
                          {fee.code}
                        </div>
                        {fee.description && (
                          <div className="text-[11px] text-[var(--admin-on-surface-variant)]/80 mt-0.5 line-clamp-1">
                            {fee.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {isFixed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <span className="material-symbols-outlined text-[12px]">attach_money</span>
                            <span>Montant Fixe</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            <span className="material-symbols-outlined text-[12px]">percent</span>
                            <span>Pourcentage</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-sm">
                        {isFixed ? `$${fee.value.toFixed(2)} USD` : `${fee.value}%`}
                      </td>
                      <td className="py-3.5 px-4">
                        {isFixed && cdfVal !== null && xofVal !== null ? (
                          <div className="space-y-0.5 text-[11px] font-medium text-[var(--admin-on-surface-variant)]">
                            <div>🇨🇩 {formatPriceDirect(cdfVal, 'CDF')}</div>
                            <div>🇸🇳 {formatPriceDirect(xofVal, 'XOF')}</div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[var(--admin-on-surface-variant)] italic">
                            {fee.value}% sur le total récoltes
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(fee)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            fee.isActive ? 'bg-emerald-600' : 'bg-gray-300'
                          }`}
                          title={fee.isActive ? 'Désactiver le frais' : 'Activer le frais'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              fee.isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(fee)}
                            className="p-1.5 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] hover:bg-[var(--admin-surface-container-high)] rounded-lg transition-colors cursor-pointer"
                            title="Modifier"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(fee)}
                            className="p-1.5 text-[var(--admin-on-surface-variant)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Supprimer"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[var(--admin-outline-variant)] space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-[#0b1c30] flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-[var(--admin-primary)]">
                  {editingFee ? 'edit_note' : 'add_circle'}
                </span>
                <span>{editingFee ? 'Modifier le frais' : 'Nouveau frais de plateforme'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-[#004322] mb-1">
                  Nom du frais *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Frais de livraison, Taxe environnementale"
                  className="w-full h-10 px-3 border border-[#c0c9be] rounded-xl text-xs font-medium text-[#0b1c30] focus:outline-none focus:border-[#004322] focus:ring-1 focus:ring-[#004322]"
                />
              </div>

              {/* Code */}
              <div>
                <label className="block text-xs font-bold text-[#004322] mb-1">
                  Code technique unique *
                </label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                  placeholder="Ex: DELIVERY, SERVICE_FEE, ECO_TAX"
                  className="w-full h-10 px-3 border border-[#c0c9be] rounded-xl text-xs font-mono font-bold text-[#0b1c30] uppercase focus:outline-none focus:border-[#004322] focus:ring-1 focus:ring-[#004322]"
                />
              </div>

              {/* Calculation Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-[#004322] mb-1.5">
                  Type de calcul *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType(FeeCalculationType.FIXED)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      formType === FeeCalculationType.FIXED
                        ? 'border-[#004322] bg-[#e6f4ea] text-[#004322] ring-1 ring-[#004322]'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">attach_money</span>
                    <span>Montant Fixe ($ USD)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType(FeeCalculationType.PERCENTAGE)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      formType === FeeCalculationType.PERCENTAGE
                        ? 'border-[#004322] bg-[#e6f4ea] text-[#004322] ring-1 ring-[#004322]'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">percent</span>
                    <span>Pourcentage (%)</span>
                  </button>
                </div>
              </div>

              {/* Value Input with Live Preview */}
              <div>
                <label className="block text-xs font-bold text-[#004322] mb-1">
                  {formType === FeeCalculationType.FIXED ? 'Montant en USD ($) *' : 'Pourcentage du sous-total (%) *'}
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-gray-500">
                    {formType === FeeCalculationType.FIXED ? '$' : '%'}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="w-full h-10 pl-8 pr-3 border border-[#c0c9be] rounded-xl text-xs font-bold text-[#0b1c30] focus:outline-none focus:border-[#004322] focus:ring-1 focus:ring-[#004322]"
                  />
                </div>
                {formType === FeeCalculationType.FIXED && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    Équivaut à env. {formatPriceDirect(parseFloat(formValue || '0') * cdfRate, 'CDF')} / {formatPriceDirect(parseFloat(formValue || '0') * xofRate, 'XOF')}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#004322] mb-1">
                  Description / Explication
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Informations visibles dans le récapitulatif du panier..."
                  className="w-full p-2.5 border border-[#c0c9be] rounded-xl text-xs text-[#0b1c30] focus:outline-none focus:border-[#004322] resize-none"
                />
              </div>

              {/* Active switch */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#0b1c30]">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded text-[#004322] focus:ring-[#004322] w-4 h-4 cursor-pointer"
                  />
                  <span>Activer immédiatement ce frais</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#004322] hover:bg-[#1a5c35] text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{editingFee ? 'Enregistrer les modifications' : 'Créer le frais'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
