import { Store } from '@tanstack/store';
import { useStore } from '@tanstack/react-store';
import type { CurrencyDto, CountryCurrencyConfigDto } from '@futurefarm/types';
import {
  fetchActiveCurrencies,
  fetchCountryConfigs,
  updateUserPreferences,
} from '../api/currency.api';
import { authStore, updateAuthUser } from '@/features/auth/store/auth.store';

export interface CurrencyState {
  selectedCountry: string;
  selectedCurrency: string;
  currencies: CurrencyDto[];
  countries: CountryCurrencyConfigDto[];
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_CURRENCIES: CurrencyDto[] = [
  { code: 'USD', name: 'Dollar américain', symbol: '$', rateAgainstBase: 1.0, isBase: true, isActive: true, updatedAt: '' },
  { code: 'CDF', name: 'Franc congolais', symbol: 'FC', rateAgainstBase: 2300.0, isBase: false, isActive: true, updatedAt: '' },
  { code: 'XOF', name: 'Franc CFA (UEMOA)', symbol: 'FCFA', rateAgainstBase: 565.0, isBase: false, isActive: true, updatedAt: '' },
  { code: 'EUR', name: 'Euro', symbol: '€', rateAgainstBase: 0.86, isBase: false, isActive: true, updatedAt: '' },
];

const DEFAULT_COUNTRIES: CountryCurrencyConfigDto[] = [
  { countryCode: 'COD', countryName: 'RDC (Congo-Kinshasa)', defaultCurrency: 'CDF', supportedCurrencies: ['CDF', 'USD'], flagEmoji: '🇨🇩' },
  { countryCode: 'SEN', countryName: 'Sénégal', defaultCurrency: 'XOF', supportedCurrencies: ['XOF'], flagEmoji: '🇸🇳' },
  { countryCode: 'CIV', countryName: "Côte d'Ivoire", defaultCurrency: 'XOF', supportedCurrencies: ['XOF'], flagEmoji: '🇨🇮' },
  { countryCode: 'USA', countryName: 'États-Unis', defaultCurrency: 'USD', supportedCurrencies: ['USD'], flagEmoji: '🇺🇸' },
  { countryCode: 'FRA', countryName: 'France', defaultCurrency: 'EUR', supportedCurrencies: ['EUR'], flagEmoji: '🇫🇷' },
];

function loadPersistedPreferences(): { selectedCountry: string; selectedCurrency: string } {
  try {
    const authUser = authStore.state.user;
    if (authUser?.country && authUser?.preferredCurrency) {
      return {
        selectedCountry: authUser.country,
        selectedCurrency: authUser.preferredCurrency,
      };
    }
    const raw = localStorage.getItem('futurefarm:currency');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore error
  }
  return { selectedCountry: 'COD', selectedCurrency: 'CDF' };
}

const initialPreferences = loadPersistedPreferences();

const initialState: CurrencyState = {
  selectedCountry: initialPreferences.selectedCountry,
  selectedCurrency: initialPreferences.selectedCurrency,
  currencies: DEFAULT_CURRENCIES,
  countries: DEFAULT_COUNTRIES,
  isLoading: false,
  error: null,
};

export const currencyStore = new Store<CurrencyState>(initialState);

export function useCurrencyStore<T>(selector: (state: CurrencyState) => T) {
  return useStore(currencyStore, selector);
}

export async function initializeCurrencyStore() {
  currencyStore.setState((prev) => ({ ...prev, isLoading: true, error: null }));
  try {
    const [currencies, countries] = await Promise.all([
      fetchActiveCurrencies().catch(() => DEFAULT_CURRENCIES),
      fetchCountryConfigs().catch(() => DEFAULT_COUNTRIES),
    ]);

    const authUser = authStore.state.user;
    let selectedCountry = currencyStore.state.selectedCountry;
    let selectedCurrency = currencyStore.state.selectedCurrency;

    if (authUser?.country) {
      selectedCountry = authUser.country;
      selectedCurrency = authUser.preferredCurrency || selectedCurrency;
    }

    // Verify consistency
    const countryConfig = countries.find((c) => c.countryCode === selectedCountry);
    if (countryConfig && !countryConfig.supportedCurrencies.includes(selectedCurrency)) {
      selectedCurrency = countryConfig.defaultCurrency;
    }

    currencyStore.setState((prev) => ({
      ...prev,
      currencies,
      countries,
      selectedCountry,
      selectedCurrency,
      isLoading: false,
    }));

    localStorage.setItem(
      'futurefarm:currency',
      JSON.stringify({ selectedCountry, selectedCurrency }),
    );
  } catch (err: any) {
    currencyStore.setState((prev) => ({
      ...prev,
      isLoading: false,
      error: err.message || 'Failed to load currencies',
    }));
  }
}

export async function setCountry(countryCode: string) {
  const normCountry = countryCode.toUpperCase();
  const state = currencyStore.state;
  const countryConfig = state.countries.find((c) => c.countryCode === normCountry);
  const newCurrency = countryConfig ? countryConfig.defaultCurrency : 'USD';

  currencyStore.setState((prev) => ({
    ...prev,
    selectedCountry: normCountry,
    selectedCurrency: newCurrency,
  }));

  localStorage.setItem(
    'futurefarm:currency',
    JSON.stringify({ selectedCountry: normCountry, selectedCurrency: newCurrency }),
  );

  if (authStore.state.isAuthenticated) {
    try {
      await updateUserPreferences({
        country: normCountry,
        preferredCurrency: newCurrency,
      });
      updateAuthUser({
        country: normCountry,
        preferredCurrency: newCurrency,
      });
    } catch (e) {
      console.warn('Could not sync country preference with server', e);
    }
  }
}

export async function setCurrency(currencyCode: string) {
  const normCurrency = currencyCode.toUpperCase();
  currencyStore.setState((prev) => ({
    ...prev,
    selectedCurrency: normCurrency,
  }));

  localStorage.setItem(
    'futurefarm:currency',
    JSON.stringify({
      selectedCountry: currencyStore.state.selectedCountry,
      selectedCurrency: normCurrency,
    }),
  );

  if (authStore.state.isAuthenticated) {
    try {
      await updateUserPreferences({
        preferredCurrency: normCurrency,
      });
      updateAuthUser({
        preferredCurrency: normCurrency,
      });
    } catch (e) {
      console.warn('Could not sync currency preference with server', e);
    }
  }
}

export function convertFromUSD(amountUSD: number, targetCurrencyCode?: string): number {
  const state = currencyStore.state;
  const code = targetCurrencyCode || state.selectedCurrency;
  const curr = state.currencies.find((c) => c.code === code);
  const rate = curr ? curr.rateAgainstBase : 1.0;
  return amountUSD * rate;
}

export function convertToUSD(amountInCurrency: number, sourceCurrencyCode?: string): number {
  const state = currencyStore.state;
  const code = sourceCurrencyCode || state.selectedCurrency;
  const curr = state.currencies.find((c) => c.code === code);
  const rate = curr && curr.rateAgainstBase > 0 ? curr.rateAgainstBase : 1.0;
  return amountInCurrency / rate;
}

export function formatPrice(
  amountUSD: number,
  targetCurrencyCode?: string,
  options?: { showSymbol?: boolean; showCode?: boolean },
): string {
  const state = currencyStore.state;
  const code = targetCurrencyCode || state.selectedCurrency;
  const curr = state.currencies.find((c) => c.code === code);
  const rate = curr ? curr.rateAgainstBase : 1.0;
  const symbol = curr ? curr.symbol : '$';
  const converted = amountUSD * rate;

  const showSymbol = options?.showSymbol ?? true;
  const showCode = options?.showCode ?? false;

  // Zero-decimal currencies or large denomination currencies (CDF, XOF, XAF, RWF, UGX)
  const isZeroDecimal = ['CDF', 'XOF', 'XAF', 'RWF', 'UGX', 'BIF', 'GNF', 'JPY'].includes(code);
  const fractionDigits = isZeroDecimal ? 0 : 2;

  const formattedNumber = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(converted);

  if (showCode) {
    return `${formattedNumber} ${code}`;
  }

  if (code === 'USD') {
    return `$${formattedNumber}`;
  }

  if (showSymbol) {
    return `${formattedNumber} ${symbol}`;
  }

  return formattedNumber;
}

export function formatPriceDirect(
  amount: number,
  currencyCode?: string,
): string {
  const code = currencyCode || 'USD';
  const state = currencyStore.state;
  const curr = state.currencies.find((c) => c.code === code);
  const symbol = curr ? curr.symbol : code;

  const isZeroDecimal = ['CDF', 'XOF', 'XAF', 'RWF', 'UGX', 'BIF', 'GNF', 'JPY'].includes(code);
  const fractionDigits = isZeroDecimal ? 0 : 2;

  const formattedNumber = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);

  if (code === 'USD') {
    return `$${formattedNumber}`;
  }

  return `${formattedNumber} ${symbol}`;
}

export function formatCurrencyPrice(
  amount: number,
  sourceCurrencyCode?: string,
  targetCurrencyCode?: string,
): string {
  const state = currencyStore.state;
  const targetCode = targetCurrencyCode || state.selectedCurrency;
  const sourceCode = sourceCurrencyCode || 'CDF';

  if (sourceCode === targetCode) {
    return formatPriceDirect(amount, targetCode);
  }

  const sourceCurr = state.currencies.find((c) => c.code === sourceCode);
  const targetCurr = state.currencies.find((c) => c.code === targetCode);

  const sourceRate = sourceCurr?.rateAgainstBase ?? 1.0;
  const targetRate = targetCurr?.rateAgainstBase ?? 1.0;

  const amountUSD = sourceRate > 0 ? amount / sourceRate : amount;
  const convertedAmount = amountUSD * targetRate;

  return formatPriceDirect(convertedAmount, targetCode);
}

