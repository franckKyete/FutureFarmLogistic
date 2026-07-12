import type { VisitReason, VisitStatus } from '@futurefarm/types';

export interface DashboardStats {
  pendingAccountsCount: number;
  pendingHarvestsCount: number;
  todayVisitsCount: number;
  monthlyValidationsCount: number;
  priorityAlerts: {
    overdueVisits: number;
    suspiciousHarvests: number;
  };
  todayVisits: VisitDto[];
  weeklyStats?: { day: string; count: number }[];
}

export interface VisitDto {
  id: string;
  inspectorId: string;
  producerId: string;
  plannedDate: string;
  plannedTime?: string | null;
  reason: VisitReason;
  status: VisitStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  producerName?: string;
  producerFarmName?: string;
  producerPhone?: string;
  producerEmail?: string;
}

export interface CreateVisitDto {
  producerId: string;
  plannedDate: string;
  plannedTime?: string;
  reason: VisitReason;
  notes?: string;
}

export interface UpdateVisitDto {
  plannedDate?: string;
  plannedTime?: string;
  notes?: string;
}

export interface VisitFilter {
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: VisitStatus;
  producerId?: string;
}

export interface ProducerDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  phone?: string;
  farmName?: string;
}

export interface ProducerFilter {
  role: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface HarvestDto {
  id: string;
  productName: string;
  producerName: string;
  quantity: number;
  unit: string;
  qualityScore?: number;
  status: string;
  harvestDate: string;
  images?: string[];
}
