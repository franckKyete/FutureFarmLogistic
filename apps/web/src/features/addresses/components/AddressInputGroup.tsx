import React from 'react';
import { useCurrencyStore } from '@/features/currency/store/currency.store';

export interface AddressValue {
  streetAddress: string;
  streetAddress2?: string;
  city: string;
  stateOrProvince?: string;
  country?: string;
}

interface AddressInputGroupProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  title?: string;
  subtitle?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const AddressInputGroup: React.FC<AddressInputGroupProps> = ({
  value,
  onChange,
  title,
  subtitle,
  required = true,
  disabled = false,
  className = '',
}) => {
  const countries = useCurrencyStore((s) => s.countries);

  const updateField = (field: keyof AddressValue, val: string) => {
    onChange({
      ...value,
      [field]: val,
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {title && (
        <div className="mb-2">
          <label className="text-xs font-bold text-[#0b1c30] block">
            {title} {required && <span className="text-rose-500">*</span>}
          </label>
          {subtitle && <p className="text-[11px] text-[#707970] mt-0.5">{subtitle}</p>}
        </div>
      )}

      {/* Ligne 1 : Rue, Avenue, N° */}
      <div>
        <label className="text-[11px] font-semibold text-gray-700 block mb-1">
          Adresse (Ligne 1) {required && <span className="text-rose-500">*</span>}
        </label>
        <input
          type="text"
          value={value.streetAddress || ''}
          onChange={(e) => updateField('streetAddress', e.target.value)}
          placeholder="Ex: 12 Boulevard du 30 Juin, N° 45"
          required={required}
          disabled={disabled}
          className="w-full bg-[#f8f9fc] border border-[#e2e8f0] focus:border-[#004322] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#0b1c30] outline-none transition-colors disabled:opacity-50"
        />
      </div>

      {/* Ligne 2 : Complément d'adresse (Optionnel) */}
      <div>
        <label className="text-[11px] font-semibold text-gray-700 block mb-1">
          Complément d'adresse / Ligne 2 <span className="text-[#707970] font-normal">(optionnel)</span>
        </label>
        <input
          type="text"
          value={value.streetAddress2 || ''}
          onChange={(e) => updateField('streetAddress2', e.target.value)}
          placeholder="Ex: Appartement 4B, Résidence Palmier, Étage 2"
          disabled={disabled}
          className="w-full bg-[#f8f9fc] border border-[#e2e8f0] focus:border-[#004322] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#0b1c30] outline-none transition-colors disabled:opacity-50"
        />
      </div>

      {/* Ville & Province / Région */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-gray-700 block mb-1">
            Ville {required && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="text"
            value={value.city || ''}
            onChange={(e) => updateField('city', e.target.value)}
            placeholder="Ex: Kinshasa, Dakar, Abidjan..."
            required={required}
            disabled={disabled}
            className="w-full bg-[#f8f9fc] border border-[#e2e8f0] focus:border-[#004322] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#0b1c30] outline-none transition-colors disabled:opacity-50"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-700 block mb-1">
            Province / Région {required && <span className="text-rose-500">*</span>}
          </label>
          <input
            type="text"
            value={value.stateOrProvince || ''}
            onChange={(e) => updateField('stateOrProvince', e.target.value)}
            placeholder="Ex: Kinshasa, Thiès, Lagunes..."
            required={required}
            disabled={disabled}
            className="w-full bg-[#f8f9fc] border border-[#e2e8f0] focus:border-[#004322] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#0b1c30] outline-none transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      {/* Pays */}
      <div>
        <label className="text-[11px] font-semibold text-gray-700 block mb-1">
          Pays {required && <span className="text-rose-500">*</span>}
        </label>
        <select
          value={value.country || 'COD'}
          onChange={(e) => updateField('country', e.target.value)}
          disabled={disabled}
          className="w-full bg-[#f8f9fc] border border-[#e2e8f0] focus:border-[#004322] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs text-[#0b1c30] outline-none transition-colors cursor-pointer disabled:opacity-50"
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
    </div>
  );
};
