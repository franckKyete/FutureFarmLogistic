import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createAddressMutation,
  updateAddressMutation,
} from '../api/addresses.queries';
import { addToast } from '@/features/shared/store/toast.store';
import { useCurrencyStore } from '@/features/currency/store/currency.store';
import type { AddressDto, CreateAddressDto } from '@futurefarm/types';

interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  addressToEdit?: AddressDto | null;
  onSuccess?: (newOrUpdatedAddress: AddressDto) => void;
}

export const AddressFormModal: React.FC<AddressFormModalProps> = ({
  isOpen,
  onClose,
  addressToEdit,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const countries = useCurrencyStore((s) => s.countries);
  const selectedCountry = useCurrencyStore((s) => s.selectedCountry);

  const [streetAddress, setStreetAddress] = useState('');
  const [streetAddress2, setStreetAddress2] = useState('');
  const [city, setCity] = useState('');
  const [stateOrProvince, setStateOrProvince] = useState('');
  const [country, setCountry] = useState(selectedCountry || 'COD');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (addressToEdit) {
      setStreetAddress(addressToEdit.streetAddress || '');
      setStreetAddress2(addressToEdit.streetAddress2 || '');
      setCity(addressToEdit.city || '');
      setStateOrProvince(addressToEdit.stateOrProvince || '');
      setCountry(addressToEdit.country || selectedCountry || 'COD');
      setIsDefault(addressToEdit.isDefault || false);
    } else {
      setStreetAddress('');
      setStreetAddress2('');
      setCity('');
      setStateOrProvince('');
      setCountry(selectedCountry || 'COD');
      setIsDefault(false);
    }
  }, [addressToEdit, selectedCountry, isOpen]);

  const createMutation = useMutation({
    ...createAddressMutation(),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['addresses', 'me'] });
      addToast('Adresse enregistrée avec succès', 'success');
      onSuccess?.(saved);
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Erreur lors de l'enregistrement";
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  const updateMutation = useMutation({
    ...(addressToEdit ? updateAddressMutation(addressToEdit.id) : {}),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['addresses', 'me'] });
      addToast('Adresse modifiée avec succès', 'success');
      onSuccess?.(saved);
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Erreur lors de la modification';
      addToast(Array.isArray(msg) ? msg[0] : msg, 'error');
    },
  });

  if (!isOpen) return null;

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!streetAddress.trim() || !city.trim() || !stateOrProvince.trim() || !country.trim()) {
      addToast('Veuillez remplir tous les champs obligatoires (*)', 'error');
      return;
    }

    const payload: CreateAddressDto = {
      streetAddress: streetAddress.trim(),
      city: city.trim(),
      stateOrProvince: stateOrProvince.trim(),
      country: country.trim() || 'COD',
      isDefault,
    };
    if (streetAddress2.trim()) payload.streetAddress2 = streetAddress2.trim();

    if (addressToEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#e6f4ea] text-[#004322] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">location_on</span>
            </div>
            <div>
              <h3 className="font-bold text-[#0b1c30] text-base">
                {addressToEdit ? "Modifier l'adresse" : 'Ajouter une adresse'}
              </h3>
              <p className="text-xs text-[#707970]">Renseignez les informations de localisation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#707970] hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Street Address (Line 1) */}
          <div>
            <label className="text-xs font-bold text-[#0b1c30] block mb-1">
              Adresse (Ligne 1) *
            </label>
            <input
              type="text"
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder="Ex: 12 Boulevard du 30 Juin, N° 45"
              required
              className="w-full h-11 px-3.5 bg-[#f8f9fc] border border-[#e2e8f0] focus:border-[#004322] focus:bg-white rounded-xl text-xs text-[#0b1c30] outline-none transition-colors"
            />
          </div>

          {/* Street Address 2 (Line 2 - Optional) */}
          <div>
            <label className="text-xs font-bold text-[#0b1c30] block mb-1">
              Complément d'adresse / Ligne 2 <span className="text-[#707970] font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={streetAddress2}
              onChange={(e) => setStreetAddress2(e.target.value)}
              placeholder="Ex: Résidence Palmier, Apt 4B, Étage 2"
              className="w-full h-11 px-3.5 bg-[#f8f9fc] border border-[#e2e8f0] focus:border-[#004322] focus:bg-white rounded-xl text-xs text-[#0b1c30] outline-none transition-colors"
            />
          </div>

          {/* City & Province / State */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#0b1c30] block mb-1">
                Ville *
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Kinshasa, Lubumbashi..."
                required
                className="w-full h-11 px-3.5 bg-[#f8f9fc] border border-[#e2e8f0] focus:border-[#004322] focus:bg-white rounded-xl text-xs text-[#0b1c30] outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#0b1c30] block mb-1">
                Province / Région / État *
              </label>
              <input
                type="text"
                value={stateOrProvince}
                onChange={(e) => setStateOrProvince(e.target.value)}
                placeholder="Ex: Kinshasa, Haut-Katanga..."
                required
                className="w-full h-11 px-3.5 bg-[#f8f9fc] border border-[#e2e8f0] focus:border-[#004322] focus:bg-white rounded-xl text-xs text-[#0b1c30] outline-none transition-colors"
              />
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="text-xs font-bold text-[#0b1c30] block mb-1">
              Pays *
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full h-11 px-3 bg-[#f8f9fc] border border-[#e2e8f0] focus:border-[#004322] focus:bg-white rounded-xl text-xs text-[#0b1c30] outline-none transition-colors cursor-pointer"
            >
              {countries && countries.length > 0 ? (
                countries.map((c) => (
                  <option key={c.countryCode} value={c.countryCode}>
                    {c.flagEmoji} {c.countryName} ({c.countryCode})
                  </option>
                ))
              ) : (
                <>
                  <option value="COD">🇨🇩 RD Congo (COD)</option>
                  <option value="SEN">🇸🇳 Sénégal (SEN)</option>
                  <option value="CIV">🇨🇮 Côte d'Ivoire (CIV)</option>
                  <option value="CMR">🇨🇲 Cameroun (CMR)</option>
                  <option value="MAR">🇲🇦 Maroc (MAR)</option>
                  <option value="FRA">🇫🇷 France (FRA)</option>
                </>
              )}
            </select>
          </div>

          {/* Is Default Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded text-[#004322] focus:ring-[#004322] border-[#cbd5e1] cursor-pointer"
              />
              <span className="text-xs font-semibold text-[#0b1c30]">
                Définir comme adresse principale par défaut
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl border border-[#e2e8f0] text-xs font-bold text-[#475569] hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-[#004322] hover:bg-[#1a5c35] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <span>{addressToEdit ? 'Mettre à jour' : 'Enregistrer'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
