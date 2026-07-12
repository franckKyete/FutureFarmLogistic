// =============================================================================
// Dispute Shared Types & DTOs
// =============================================================================

export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export enum DisputeSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface Dispute {
  id: string;
  title: string;
  description: string;
  status: DisputeStatus;
  severity: DisputeSeverity;
  relatedType: 'order' | 'inspection' | 'delivery';
  relatedId: string;
  createdById: string;
  assignedToId: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDisputeDto {
  title: string;
  description: string;
  severity: DisputeSeverity;
  relatedType: 'order' | 'inspection' | 'delivery';
  relatedId: string;
}

export interface UpdateDisputeDto {
  title?: string;
  description?: string;
  severity?: DisputeSeverity;
  assignedToId?: string;
}

export interface ResolveDisputeDto {
  resolutionNotes: string;
  status: DisputeStatus.RESOLVED | DisputeStatus.DISMISSED;
}
