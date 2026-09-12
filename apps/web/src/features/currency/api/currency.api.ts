import { apiClient } from '@/lib/api-client';
import type {
  CurrencyDto,
  CountryCurrencyConfigDto,
  LiveExchangeRatesDto,
  UpdateCurrencyRateDto,
} from '@futurefarm/types';

export async function fetchActiveCurrencies(): Promise<CurrencyDto[]> {
  const res = await apiClient.get<any>('/currencies');
  return res.data?.data ?? res.data ?? [];
}

export async function fetchCountryConfigs(): Promise<CountryCurrencyConfigDto[]> {
  const res = await apiClient.get<any>('/currencies/countries');
  return res.data?.data ?? res.data ?? [];
}

export async function fetchAdminCurrencies(): Promise<CurrencyDto[]> {
  const res = await apiClient.get<any>('/admin/currencies');
  return res.data?.data ?? res.data ?? [];
}

export async function fetchLiveRates(): Promise<LiveExchangeRatesDto> {
  const res = await apiClient.get<any>('/admin/currencies/live');
  return res.data?.data ?? res.data;
}

export async function updateCurrencyRate(
  code: string,
  dto: UpdateCurrencyRateDto,
): Promise<CurrencyDto> {
  const res = await apiClient.patch<any>(`/admin/currencies/${code}`, dto);
  return res.data?.data ?? res.data;
}

export async function syncLiveRates(): Promise<{ updated: string[]; rates: Record<string, number> }> {
  const res = await apiClient.post<any>('/admin/currencies/sync');
  return res.data?.data ?? res.data;
}

export async function updateUserPreferences(dto: {
  country?: string;
  preferredCurrency?: string;
}): Promise<{ country: string; preferredCurrency: string }> {
  const res = await apiClient.patch<any>('/users/me/preferences', dto);
  return res.data?.data ?? res.data;
}
