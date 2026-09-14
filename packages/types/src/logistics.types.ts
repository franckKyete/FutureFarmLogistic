// =============================================================================
// Logistics & Transport — Shared Types
// =============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Current lifecycle status of a delivery run */
export enum DeliveryRunStatus {
  PLANNED     = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED   = 'COMPLETED',
  CANCELLED   = 'CANCELLED',
}

/** Whether a stop is a collection from a farmer or a delivery to a buyer */
export enum DeliveryStopType {
  COLLECTION = 'COLLECTION',
  DELIVERY   = 'DELIVERY',
}

/** Current lifecycle status of a delivery stop */
export enum DeliveryStopStatus {
  PENDING   = 'PENDING',
  ARRIVED   = 'ARRIVED',
  COMPLETED = 'COMPLETED',
  SKIPPED   = 'SKIPPED',
}

/** Vehicle categories */
export enum VehicleType {
  TRUCK      = 'TRUCK',
  VAN        = 'VAN',
  MOTORCYCLE = 'MOTORCYCLE',
  UTILITY    = 'UTILITY',
}

// ---------------------------------------------------------------------------
// Embedded value objects
// ---------------------------------------------------------------------------

/** Compact address + geo-coordinates stored on each stop */
export interface StopAddress {
  street: string;
  city:   string;
  lat:    number;
  lon:    number;
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export class CreateVehicleDto {
  brand?:            string;
  registrationPlate!: string;
  type!:             VehicleType;
  capacityKg!:       number;
  capacityM3!:       number;
}

export class UpdateVehicleDto {
  brand?:             string;
  registrationPlate?: string;
  type?:              VehicleType;
  capacityKg?:        number;
  capacityM3?:        number;
  isActive?:          boolean;
}

export class AssignDriverDto {
  /** ID of the user to assign as current driver (null to unassign) */
  driverId!: string | null;
}

export class CreateDeliveryStopDto {
  orderLineId!: string;
  type!:        DeliveryStopType;
  address!:     StopAddress;
  notes?:      string;
}

export class CreateDeliveryRunDto {
  driverId?:    string;
  vehicleId?:   string;
  scheduledAt!:  string; // ISO-8601
  notes?:       string;
  stops!:        CreateDeliveryStopDto[];
}

export class UpdateDeliveryRunDto {
  scheduledAt?: string;
  notes?:       string;
}

export class SkipStopDto {
  reason!: string;
}

export class PushLocationDto {
  runId?:     string;
  lat!:       number;
  lon!:       number;
  heading?:  number;
  speedKmh?: number;
}

export class AssignVehicleDto {
  vehicleId!: string;
}

/** Quality condition of goods inspected at pickup */
export enum PickupCondition {
  GOOD = 'GOOD',
  BAD  = 'BAD',
}

/** Status of driver pickup inspection report */
export enum PickupReportStatus {
  PENDING   = 'PENDING',
  SUBMITTED = 'SUBMITTED',
}

/** DTO for driver submitting pickup report */
export class SubmitPickupReportDto {
  quantityVerified!: boolean;
  conditionOk!:      PickupCondition;
  packagingIntact!:  boolean;
  weightActualKg!:   number;
  notes?:            string | undefined;
}

/** WebSocket payload sent when run is assigned to driver */
export interface RunAssignedPayload {
  runId:             string;
  scheduledAt:       string; // ISO-8601
  originCity:        string;
  destinationCity:   string;
  stopsCount:        number;
  totalDistanceKm?:  number | undefined;
  estimatedCargoKg?: number | undefined;
}
