import { apiClient } from '@/lib/api-client';
import type {
  PlatformFeeConfigDto,
  CreatePlatformFeeDto,
  UpdatePlatformFeeDto,
} from '@futurefarm/types';

/**
 * Fetch all active platform fees (public for buyer cart and checkout).
 */
export async function fetchActiveFees(): Promise<PlatformFeeConfigDto[]> {
  const res = await apiClient.get<any>('/fees');
  return res.data?.data ?? res.data ?? [];
}

/**
 * Admin: Fetch all platform fees (active and inactive).
 */
export async function fetchAdminFees(): Promise<PlatformFeeConfigDto[]> {
  const res = await apiClient.get<any>('/admin/fees');
  return res.data?.data ?? res.data ?? [];
}

/**
 * Admin: Create a new platform fee configuration.
 */
export async function createPlatformFee(
  dto: CreatePlatformFeeDto,
): Promise<PlatformFeeConfigDto> {
  const res = await apiClient.post<any>('/admin/fees', dto);
  return res.data?.data ?? res.data;
}

/**
 * Admin: Update a platform fee configuration.
 */
export async function updatePlatformFee(
  id: string,
  dto: UpdatePlatformFeeDto,
): Promise<PlatformFeeConfigDto> {
  const res = await apiClient.patch<any>(`/admin/fees/${id}`, dto);
  return res.data?.data ?? res.data;
}

/**
 * Admin: Delete a platform fee configuration.
 */
export async function deletePlatformFee(id: string): Promise<void> {
  await apiClient.delete(`/admin/fees/${id}`);
}
