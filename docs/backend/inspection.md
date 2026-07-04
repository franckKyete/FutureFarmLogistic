# Backend — Quality Inspection & AI Classification

The **Quality Inspection & AI Classification** module formalizes the harvest listing quality control process. It introduces inspector profile management, structured site-visit inspection reports, photo metadata tracking (including GPS coordinates for traceability), Gemini-powered pre-screening, and photo-based AI crop classification to pre-fill harvest creation fields.

---

## Architecture Design

### 1. Photo Traceability Metadata (`InspectionPhotoEntity`)
To verify crop provenance and prevent listing fraud, each inspection photo is stored as a database record inside the `inspection_photos` table, recording:
* **File size** (bytes).
* **Capture timestamp** (`takenAt`).
* **GPS coordinates** (`latitude` and `longitude` decimal values).

### 2. Swapable Vision Provider (`QualityVisionProvider`)
We define a generic interface for vision capabilities so that the underlying model can be easily swapped for an in-house model in the future:
```typescript
export interface QualityVisionProvider {
  analyzeHarvestPhotos(photoUrls: string[]): Promise<VisionAnalysisResult>;
  classifyHarvestPhotos(photoUrls: string[], additionalNotes?: string): Promise<ClassificationResult>;
}
```
* **Gemini Implementation**: Configured via `GeminiVisionProvider` using Gemini 2.5 Flash's multimodal capabilities, converting image assets to base64 inline buffers.
* **Dependency Injection**: Registered under the NestJS provider token `QUALITY_VISION_PROVIDER`.

### 3. AI Pre-Fill & Classification Flow
To streamline harvest listings, a farmer or inspector can upload photos first before filling out the form:
1. Photos are sent to `POST /v1/harvests/ai-classify`.
2. Gemini analyzes the images to infer the crop variety, ProductCategory, description, farming methods, shelf life, estimated quantity, and suggested price.
3. The backend queries `ProductEntity` templates for a case-insensitive name match. If found, it attaches the `suggestedProductId`.
4. The client receives these pre-fill values, allowing the user to review and override them on the form.

---

## Database Schemas (TypeORM)

### `InspectorProfileEntity`
* `id` (`uuid`): Primary key.
* `userId` (`uuid`): One-to-one link to `UserEntity`.
* `licenseNumber` (`varchar`, unique): Official inspector registration number.
* `agencyName` (`varchar`): Employer or inspecting body name.
* `specializations` (`simple-array`): Product categories this inspector covers.
* `isActiveInspector` (`boolean`): Toggle for active status.

### `InspectionReportEntity`
* `id` (`uuid`): Primary key.
* `harvestId` (`uuid`): Linked `HarvestEntity` under review.
* `inspectorProfileId` (`uuid`): Inspector writing the report.
* `status` (`enum`): `IN_PROGRESS`, `SUBMITTED`, or `REJECTED`.
* `checklist` (`jsonb`): Form checklist tracking `passed` (boolean) and `notes` (string) for `VISUAL_QUALITY`, `MICROBIAL_COUNT`, `WEIGHT_CALIBRATION`, `PACKAGING`, and `LABELING`.
* `overallNotes` (`text`, nullable): Concluding inspection remarks.
* `siteVisitDate` (`date`): Date of inspection.
* `aiPreScreenScore` (`decimal`): Estimated quality score computed by Gemini.
* `aiPreScreenNotes` (`text`): Defect details identified by Gemini.
* `finalQualityScore` (`decimal`): Final official score out of 10.00 assigned by the human inspector (overrides AI suggestions).
* `submittedAt` (`timestamp`, nullable): Completion timestamp.

### `InspectionPhotoEntity`
* `id` (`uuid`): Primary key.
* `inspectionReportId` (`uuid`): Parent report link.
* `url` (`varchar`): File storage location.
* `size` (`int`, nullable): Photo size in bytes.
* `takenAt` (`timestamp`, nullable): Photo capture time.
* `latitude` (`decimal`): Coordinate latitude.
* `longitude` (`decimal`): Coordinate longitude.

---

## API Endpoints & RBAC Gates

| Method | Endpoint | Required Permission | Input DTO | Output / Response |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/v1/inspections/profile` | `inspector:profile:update` | `CreateInspectorProfileDto` | `InspectorProfileEntity` |
| **GET** | `/v1/inspections/profile/me` | `inspector:profile:read` | None | `InspectorProfileEntity` |
| **POST** | `/v1/harvests/ai-classify` | `harvest:create` | `AiClassifyHarvestDto` | `AiClassifyHarvestResponseDto` (Pre-fill details) |
| **POST** | `/v1/inspections/reports` | `inspection:create` | `CreateInspectionReportDto` | `InspectionReportEntity` |
| **GET** | `/v1/inspections/reports` | `inspection:read:all` | None | `InspectionReportEntity[]` (Admin view) |
| **GET** | `/v1/inspections/reports/me` | `inspection:read` | None | `InspectionReportEntity[]` (Inspector reports list) |
| **GET** | `/v1/inspections/reports/:id` | `inspection:read` | None | `InspectionReportEntity` |
| **PATCH** | `/v1/inspections/reports/:id` | `inspection:update` | `UpdateInspectionReportDto` | Updated `InspectionReportEntity` |
| **POST** | `/v1/inspections/reports/:id/photos` | `inspection:update` | `CreateInspectionPhotoDto` | `InspectionPhotoEntity` |
| **DELETE** | `/v1/inspections/reports/:id/photos/:photoId` | `inspection:update` | None | void |
| **POST** | `/v1/inspections/reports/:id/ai-screen` | `inspection:update` | None | Report with `aiPreScreenScore` |
| **POST** | `/v1/inspections/reports/:id/submit` | `inspection:create` | `SubmitInspectionReportDto` | Finalized report (triggers harvest status update) |
