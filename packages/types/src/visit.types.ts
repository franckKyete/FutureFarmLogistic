// =============================================================================
// Visit / Planning Types & DTOs
// =============================================================================

export enum VisitReason {
  ROUTINE = 'ROUTINE',
  URGENT = 'URGENT',
  FIRST_INSPECTION = 'FIRST_INSPECTION',
}

export enum VisitStatus {
  PLANNED = 'PLANNED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  MISSED = 'MISSED',
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

export interface VisitDto {
  id: string;
  inspectorId: string;
  producerId: string;
  plannedDate: string;
  plannedTime?: string;
  reason: VisitReason;
  status: VisitStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  producerName?: string;
  producerFarmName?: string;
  producerPhone?: string;
  producerEmail?: string;
}

export interface DashboardStatsDto {
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

export interface VisitFilterDto {
  date?: string;
  status?: VisitStatus;
  producerId?: string;
  startDate?: string;
  endDate?: string;
}
