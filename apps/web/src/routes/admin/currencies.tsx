import { Icon } from '@/features/shared/components/Icon';
import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/features/auth/utils/auth-guard';
import { Permission, type CurrencyDto, type LiveExchangeRatesDto } from '@futurefarm/types';
import {
  fetchAdminCurrencies,
  fetchLiveRates,
  updateCurrencyRate,
} from '@/features/currency/api/currency.api';
import { initializeCurrencyStore } from '@/features/currency/store/currency.store';
import { addToast } from '@/features/shared/store/toast.store';

export const Route = createFileRoute('/admin/currencies')({
  beforeLoad: () => {
    requireAuth(Permission.DASHBOARD_READ);
  },
  component: CurrenciesAdminPage,
});

function CurrenciesAdminPage() {
  const [currencies, setCurrencies] = useState<CurrencyDto[]>([]);
  const [liveRates, setLiveRates] = useState<LiveExchangeRatesDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editRateValue, setEditRateValue] = useState<string>('');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [currs, live] = await Promise.all([
        fetchAdminCurrencies(),
        fetchLiveRates().catch(() => null),
      ]);
      setCurrencies(Array.isArray(currs) ? currs : []);
      setLiveRates(live);
    } catch (err: any) {
      addToast('Erreur lors du chargement des devises: ' + (err.message || ''), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const startEditing = (curr: CurrencyDto) => {
    setEditingCode(curr.code);
    setEditRateValue(curr.rateAgainstBase.toString());
    setEditIsActive(curr.isActive);
  };

  const cancelEditing = () => {
    setEditingCode(null);
    setEditRateValue('');
  };

  const handleSaveRate = async (code: string) => {
    const rateNum = parseFloat(editRateValue);
    if (isNaN(rateNum) || rateNum <= 0) {
      addToast('Le taux doit être un nombre positif supérieur à 0.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      await updateCurrencyRate(code, {
        rateAgainstBase: rateNum,
        isActive: editIsActive,
      });
      addToast(`Taux pour ${code} mis à jour : 1 USD = ${rateNum} ${code}`, 'success');
      setEditingCode(null);
      await loadData();
      await initializeCurrencyStore();
    } catch (err: any) {
      addToast(err.response?.data?.message || err.message || 'Erreur de mise à jour', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const applyLiveRate = (currCode: string) => {
    if (liveRates?.rates[currCode]) {
      setEditRateValue(liveRates.rates[currCode].toString());
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Icon name="payments" className="text-[28px] text-emerald-600" />
            Gestion des Devises & Taux de Change
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Définissez les devises acceptées et ajustez les taux de conversion par rapport au Dollar américain (USD base).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Icon name="sync" className="text-[18px] ${isLoading ? 'animate-spin' : ''}" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3">
        <Icon name="info" className="text-[20px] text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-900 leading-relaxed">
          <span className="font-semibold">Principe du système multi-devises :</span> La devise de référence du système est le{' '}
          <strong>USD ($1.00)</strong>. Le taux enregistré correspond au nombre d'unités de devise locale pour 1 USD (ex: 1 USD = 2 300 CDF).
          Chaque commande et récolte enregistre un snapshot fixe du taux au moment de la transaction pour garantir l'intégrité comptable.
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center font-bold text-lg">
            $
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Devise Pivot</div>
            <div className="text-xl font-bold text-gray-900">USD (Dollar US)</div>
            <div className="text-xs text-emerald-600 font-medium">Taux fixé à 1.00</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center font-bold text-lg">
            <Icon name="public" className="text-[24px] text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Devises Actives</div>
            <div className="text-xl font-bold text-gray-900">
              {currencies.filter((c) => c.isActive).length} / {currencies.length}
            </div>
            <div className="text-xs text-gray-500">Configurées dans le système</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100/70 text-purple-700 flex items-center justify-center font-bold text-lg">
            <Icon name="trending_up" className="text-[24px] text-purple-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Flux Marché Live</div>
            <div className="text-xl font-bold text-gray-900">
              {liveRates ? 'Connecté' : 'Hors-ligne'}
            </div>
            <div className="text-xs text-gray-500 truncate max-w-[200px]" title={liveRates?.date}>
              {liveRates?.date ? `MàJ : ${new Date(liveRates.date).toLocaleTimeString('fr-FR')}` : 'open.er-api.com'}
            </div>
          </div>
        </div>
      </div>

      {/* Currencies Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Tableau des Devises et Taux de Conversion</h2>
          <span className="text-xs text-gray-400">Taux exprimés pour 1 USD</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="py-3.5 px-6">Devise</th>
                <th className="py-3.5 px-4">Symbole</th>
                <th className="py-3.5 px-4">Taux Système (1 USD =)</th>
                <th className="py-3.5 px-4">Taux Marché Live</th>
                <th className="py-3.5 px-4">Écart Marché</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {currencies.map((curr) => {
                const liveRate = liveRates?.rates[curr.code];
                const isEditing = editingCode === curr.code;

                // Spread calculation
                let spreadPct = 0;
                if (liveRate && curr.rateAgainstBase > 0 && !curr.isBase) {
                  spreadPct = ((curr.rateAgainstBase - liveRate) / liveRate) * 100;
                }

                return (
                  <tr
                    key={curr.code}
                    className={`transition-colors ${
                      isEditing ? 'bg-amber-50/40' : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-700 text-xs">
                          {curr.code}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 flex items-center gap-2">
                            {curr.name}
                            {curr.isBase && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                BASE
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">{curr.code}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-semibold text-gray-800">{curr.symbol}</td>

                    {/* System Rate Column */}
                    <td className="py-4 px-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.000001"
                            value={editRateValue}
                            onChange={(e) => setEditRateValue(e.target.value)}
                            disabled={curr.isBase}
                            className="w-32 px-2.5 py-1 text-sm border border-amber-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono font-medium"
                          />
                          <span className="text-xs text-gray-500 font-mono">{curr.code}</span>
                        </div>
                      ) : (
                        <div className="font-mono font-semibold text-gray-900">
                          {curr.isBase
                            ? '1.000000'
                            : curr.rateAgainstBase.toLocaleString('fr-FR', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 4,
                              })}{' '}
                          <span className="text-xs text-gray-400 font-normal">{curr.code}</span>
                        </div>
                      )}
                    </td>

                    {/* Live Market Rate Column */}
                    <td className="py-4 px-4 font-mono text-gray-600 text-xs">
                      {curr.isBase ? (
                        '1.000000 USD'
                      ) : liveRate ? (
                        <div className="flex items-center gap-2">
                          <span>
                            {liveRate.toLocaleString('fr-FR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}{' '}
                            {curr.code}
                          </span>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => applyLiveRate(curr.code)}
                              title="Copier le taux marché"
                              className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-800 rounded-md hover:bg-emerald-200 transition-colors"
                            >
                              Copier
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* Spread Column */}
                    <td className="py-4 px-4 text-xs">
                      {curr.isBase ? (
                        <span className="text-gray-300">-</span>
                      ) : liveRate ? (
                        <span
                          className={`font-semibold font-mono ${
                            Math.abs(spreadPct) < 0.5
                              ? 'text-gray-500'
                              : spreadPct > 0
                              ? 'text-amber-600'
                              : 'text-blue-600'
                          }`}
                        >
                          {spreadPct > 0 ? `+${spreadPct.toFixed(2)}%` : `${spreadPct.toFixed(2)}%`}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* Active Status */}
                    <td className="py-4 px-4">
                      {isEditing ? (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editIsActive}
                            onChange={(e) => setEditIsActive(e.target.checked)}
                            disabled={curr.isBase}
                            className="w-4 h-4 text-emerald-600 rounded-sm border-gray-300 focus:ring-emerald-500"
                          />
                          <span className="text-xs font-medium text-gray-700">Active</span>
                        </label>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            curr.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {curr.isActive && <Icon name="check_circle" className="text-[14px] text-emerald-600" />}
                          {curr.isActive ? 'Active' : 'Désactivée'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveRate(curr.code)}
                            disabled={isSaving}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1 shadow-xs"
                          >
                            <Icon name="check" className="text-[16px]" />
                            Enregistrer
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                          >
                            <Icon name="close" className="text-[16px]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(curr)}
                          disabled={curr.isBase}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 ml-auto ${
                            curr.isBase
                              ? 'text-gray-300 border-gray-200 cursor-not-allowed'
                              : 'text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <Icon name="edit" className="text-[16px] text-gray-500" />
                          Modifier
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
