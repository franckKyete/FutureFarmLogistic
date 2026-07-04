// =============================================================================
// Quality Inspection Types & DTOs
// =============================================================================

import { ProductCategory } from './product.types';

export enum InspectionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  REJECTED = 'REJECTED',
}

export enum InspectionChecklistItem {
  VISUAL_QUALITY = 'VISUAL_QUALITY',
  MICROBIAL_COUNT = 'MICROBIAL_COUNT',
  WEIGHT_CALIBRATION = 'WEIGHT_CALIBRATION',
  PACKAGING = 'PACKAGING',
  LABELING = 'LABELING',
}

export interface ChecklistDetail {
  passed: boolean;
  notes: string;
}

export type InspectionChecklist = Record<InspectionChecklistItem, ChecklistDetail>;

export interface InspectionPhotoDto {
  id: string;
  url: string;
  size?: number | null;
  takenAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CreateInspectionPhotoDto {
  url: string;
  size?: number | null;
  takenAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface InspectorProfileDto {
  id: string;
  userId: string;
  licenseNumber: string;
  agencyName: string;
  specializations: string[];
  isActiveInspector: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInspectorProfileDto {
  licenseNumber: string;
  agencyName: string;
  specializations: string[];
}

export interface InspectionReportDto {
  id: string;
  harvestId: string;
  inspectorProfileId: string;
  status: InspectionStatus;
  checklist: InspectionChecklist;
  overallNotes: string | null;
  siteVisitDate: string;
  aiPreScreenScore: number | null;
  aiPreScreenNotes: string | null;
  finalQualityScore: number | null;
  photos: InspectionPhotoDto[];
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInspectionReportDto {
  harvestId: string;
  siteVisitDate: string;
  checklist: InspectionChecklist;
}

export interface UpdateInspectionReportDto {
  siteVisitDate?: string;
  checklist?: Partial<InspectionChecklist>;
  overallNotes?: string;
}

export interface SubmitInspectionReportDto {
  finalQualityScore: number;
  overallNotes?: string;
  checklist?: InspectionChecklist;
}

export interface AiClassifyHarvestDto {
  photoUrls: string[];
  additionalNotes?: string;
}

export interface AiClassifyHarvestResponseDto {
  suggestedProductId?: string | null;
  suggestedName: string;
  category: ProductCategory;
  description: string;
  farmingMethods: string;
  recommendedShelfLifeDays: number;
  estimatedQuantity?: number | null;
  suggestedPricePerUnit?: number | null;
  aiQualityScore?: number | null;
}
