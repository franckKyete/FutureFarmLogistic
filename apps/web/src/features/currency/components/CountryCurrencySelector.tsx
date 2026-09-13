import { Icon } from '@/features/shared/components/Icon';
import { useState, useRef, useEffect } from 'react';
import {
  useCurrencyStore,
  setCountry,
  setCurrency,
} from '../store/currency.store';

export function CountryCurrencySelector() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCountry = useCurrencyStore((s) => s.selectedCountry);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const countries = useCurrencyStore((s) => s.countries);
  const currencies = useCurrencyStore((s) => s.currencies);

  const currentCountryConfig = countries.find(
    (c) => c.countryCode === selectedCountry,
  );
  const currentCurrencyObj = currencies.find((c) => c.code === selectedCurrency);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCountry = async (countryCode: string) => {
    await setCountry(countryCode);
  };

  const handleSelectCurrency = async (currCode: string) => {
    await setCurrency(currCode);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-900 border border-emerald-200/80 hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
        title="Changer de pays / devise"
      >
        <span className="text-sm">{currentCountryConfig?.flagEmoji || '🌍'}</span>
        <span className="font-semibold text-emerald-950">
          {currentCurrencyObj?.symbol || selectedCurrency}
        </span>
        <span className="text-emerald-700 font-mono uppercase text-[11px]">
          ({selectedCurrency})
        </span>
        <Icon name="expand_more" className="text-[16px] text-emerald-700 transition-transform ${isOpen ? 'rotate-180' : ''}" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white shadow-xl border border-gray-100 z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b border-gray-100 mb-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <Icon name="public" className="text-[16px] text-emerald-600" />
              <span>Votre Pays & Devise</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Les prix s'adaptent à votre pays de livraison.
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 py-1 pr-0.5 custom-scrollbar">
            {countries.map((c) => {
              const isSelected = c.countryCode === selectedCountry;
              return (
                <div
                  key={c.countryCode}
                  className={`rounded-xl p-2 transition-colors ${
                    isSelected
                      ? 'bg-emerald-50/70 border border-emerald-200/60'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectCountry(c.countryCode)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{c.flagEmoji}</span>
                      <div>
                        <span className="text-xs font-medium text-gray-900 block">
                          {c.countryName}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          Devise par défaut : {c.defaultCurrency}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Icon name="check" className="text-[18px] text-emerald-600 shrink-0 font-bold" />
                    )}
                  </button>

                  {/* Multi-currency support for this country */}
                  {isSelected && c.supportedCurrencies.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-emerald-100/80 flex items-center gap-1.5 pl-6">
                      <span className="text-[10px] text-emerald-800 font-medium mr-1">
                        Devise :
                      </span>
                      {c.supportedCurrencies.map((curr) => {
                        const isCurrActive = curr === selectedCurrency;
                        return (
                          <button
                            key={curr}
                            type="button"
                            onClick={() => handleSelectCurrency(curr)}
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-all ${
                              isCurrActive
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100/50'
                            }`}
                          >
                            {curr}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
