// =============================================================================
// @futurefarm/types — Currency & Exchange Rate Types
// =============================================================================

export interface CurrencyDto {
  code: string; // e.g. 'USD', 'CDF', 'XOF'
  name: string; // e.g. 'Dollar américain', 'Franc congolais'
  symbol: string; // e.g. '$', 'FC', 'FCFA'
  rateAgainstBase: number; // e.g. 2300 for CDF (relative to 1 USD)
  isActive: boolean;
  isBase: boolean;
  updatedAt: string;
}

export interface CountryCurrencyConfigDto {
  countryCode: string; // ISO-3, e.g. 'COD', 'SEN', 'CIV'
  countryName: string;
  defaultCurrency: string; // e.g. 'CDF' for COD, 'XOF' for SEN
  supportedCurrencies: string[]; // e.g. ['CDF', 'USD'] for COD
  flagEmoji: string;
}

export interface LiveExchangeRatesDto {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface UpdateCurrencyRateDto {
  rateAgainstBase: number;
  isActive?: boolean;
}

export interface UserCurrencyPreferencesDto {
  country: string;
  preferredCurrency: string;
}
