# Feature Branch: `feature/custom-model-integration`

## 1. Overview & Objectives

This document summarizes the changes implemented on branch `feature/custom-model-integration` for FutureFarm Logistic. The main objective was to replace Google Gemini Vision with custom local Keras deep learning models for product classification and harvest quality evaluation, enforce a 10-photo minimum rule across the application, and migrate the authentication password hashing library to `bcryptjs`.

---

## 2. Models & Architecture

Two Keras `.keras` models are located at the project root:

### A. Product Classification Model (`product_model_mvp_final.keras`)
- **Input Dimension**: `160x160` RGB image.
- **Ordered Target Classes**:
  1. `tomato` (Tomates)
  2. `potato` (Pommes de terre)
  3. `bellpepper` (Poivrons)
  4. `cucumber` (Concombres)
- **Inference Strategy**: Images are fed sequentially one by one into the model. Prediction vectors are aggregated/averaged across all photos to determine the top predicted class and confidence.

### B. Quality Classification Model (`quality_model.keras`)
- **Input Dimension**: `254x254` RGB image.
- **Classification Type**: Binary classification (`GOOD` vs `BAD`).
- **Inference Strategy**: Images are fed sequentially one by one into the model.
- **Quality Scoring Formula**:
  $$\text{Score (out of 10)} = \left( \frac{\text{GOOD Photo Count}}{\text{Total Photo Count}} \right) \times 10$$
  *(rounded to 1 decimal place)*

---

## 3. Python Environment & Persistent In-Memory Worker

To achieve fast inference without re-importing TensorFlow/Keras or reloading model weights on every request, the backend uses a persistent background daemon architecture.

### Persistent Inference Worker (`apps/api/scripts/vision_worker.py`)
- **Lifecycle**:
  - `KerasVisionProvider` implements NestJS `OnModuleInit` and `OnModuleDestroy`.
  - On startup (`onModuleInit`), it spawns a persistent Python worker (`apps/api/scripts/vision_worker.py`).
  - The worker loads both `product_model_mvp_final.keras` and `quality_model.keras` into RAM **once** at startup and signals `READY`.
  - It listens on `stdin` for JSON-line inference jobs and returns single-line JSON responses on `stdout`.
  - Automatically cleans up or restarts if the process terminates.

### Real-Time Image-by-Image Processing Logs
- As each photo is processed sequentially, the Python worker emits live formatted logs directly to `stderr`:
  - `[Req:...] [Image 1/10] [PRODUCT 160x160] -> Output: 'tomato' (98.4%) [tomato=98.4%, potato=1.2%, bellpepper=0.3%, cucumber=0.1%]`
  - `[Req:...] [Image 1/10] [QUALITY 254x254] -> Output: GOOD (good_prob: 96.7%)`
  - `[Req:...] [SUMMARY] Product Classification: 'tomato' (Overall Confidence: 98.4%)`
  - `[Req:...] [SUMMARY] Quality Evaluation: 9/10 GOOD (Score: 9.0/10)`
- `KerasVisionProvider` streams worker `stderr` directly into NestJS `this.logger.log(...)` in real-time, making all image feeding steps and outputs instantly visible in the application console.

### Interpreter Resolution
[`KerasVisionProvider`](apps/api/src/modules/inspections/providers/keras-vision.provider.ts) looks for the Python interpreter in the following order:
1. `process.env.PYTHON_PATH`
2. `.venv/bin/python`
3. `venv/bin/python`
4. Global `python3`

### Required Python Packages
```bash
tensorflow
keras
pillow
numpy
```
> **Note**: TensorFlow wheels are best supported on Python 3.10 or 3.11.

### Stream & Error Handling
- Handled `pyProcess.stdin.on('error', ...)` to prevent unhandled `EPIPE` stream crashes if the Python process terminates early.
- Built-in heuristic/deterministic fallback if Python/TensorFlow is not initialized in the local development environment.

---

## 4. 10-Photo Requirement

Farmers and inspectors are required to provide at least 10 photos for harvest creation and AI pre-screening / quality analysis.

### A. Backend Enforcement
- **DTO Validation**: [`apps/api/src/modules/inspections/dto/ai-classify-harvest.dto.ts`](apps/api/src/modules/inspections/dto/ai-classify-harvest.dto.ts) decorated with `@ArrayMinSize(10, { message: 'Au moins 10 photos sont nécessaires pour la classification IA.' })`.
- **Service Validation**: [`apps/api/src/modules/inspections/inspections.service.ts`](apps/api/src/modules/inspections/inspections.service.ts) verifies `photoUrls.length >= 10` in `classifyHarvest()` and `runAiPreScreen()`.

### B. Frontend UI & Guidance
- **Interactive Capture Guidance**: [`apps/web/src/features/harvests/components/PhotoGuidanceBanner.tsx`](apps/web/src/features/harvests/components/PhotoGuidanceBanner.tsx) displays 10 recommended capture angles with progress tracking and tips:
  1. Vue d'ensemble du lot
  2. Gros plan sur un échantillon
  3. Face supérieure
  4. Face inférieure / base
  5. Calibre et taille
  6. Éclairage naturel
  7. Détail de la couleur
  8. Détection des imperfections
  9. Texture / fermeté
  10. Vue d'ensemble du contenant / caisse
- **Integration Points**:
  - [`apps/web/src/features/harvests/components/HarvestAnalyzeView.tsx`](apps/web/src/features/harvests/components/HarvestAnalyzeView.tsx): Banner integrated; analyze buttons disabled until $\ge 10$ photos exist.
  - [`apps/web/src/features/harvests/components/HarvestFormView.tsx`](apps/web/src/features/harvests/components/HarvestFormView.tsx): Harvest creation form requires at least 1 photo to submit (allowing farmers to remove unwanted photos after AI analysis).
  - [`apps/web/src/routes/inspector/reports/$id.tsx`](apps/web/src/routes/inspector/reports/$id.tsx): Banner and 10-photo constraint in inspector report creation and pre-screening modal.

---

## 5. Stock Margin & Quality Score Approval Rules

### A. Automatic 10% Stock Safety Margin
- The manual `stockMarge` input field has been removed from [`HarvestFormView.tsx`](apps/web/src/features/harvests/components/HarvestFormView.tsx).
- Both frontend and backend automatically compute and assign a 10% stock safety margin on all created harvests:
  $$\text{stockMarge} = \text{quantityInStock} \times 0.10$$

### B. AI Quality Score Persistence & Inspector Report Pre-Fill
- When a farmer analyses photos on [`HarvestAnalyzeView.tsx`](apps/web/src/features/harvests/components/HarvestAnalyzeView.tsx), the AI score is forwarded to [`HarvestFormView.tsx`](apps/web/src/features/harvests/components/HarvestFormView.tsx) and saved to `HarvestEntity.qualityScore`.
- When an inspector opens the inspection report for that harvest, the score automatically populates `InspectionReportEntity.aiPreScreenScore` and `finalQualityScore`.

### C. Minimum Quality Score $\ge 5.0$ for Approval
- Inspectors cannot approve any harvest with a quality score $< 5.0/10$:
  - Backend validation in `verifyHarvest()` and `submitReport()` throws a `BadRequestException` if approval is attempted on a harvest with a score below 5.0.
  - Frontend in [`inspector/reports/$id.tsx`](apps/web/src/routes/inspector/reports/$id.tsx) disables the certification button with clear warnings if score $< 5.0$.

---

## 5. Bcrypt to `bcryptjs` Migration

### Reason for Migration
Native `bcrypt` node-gyp bindings failed to find precompiled binaries on Node.js v26 (Node ABI `node-v147`) resulting in runtime missing module errors (`bcrypt_lib.node`).

### Changes
- Uninstalled native `bcrypt` and `@types/bcrypt`.
- Installed pure JavaScript `bcryptjs` and `@types/bcryptjs`.
- Updated password hashing and comparison in [`apps/api/src/modules/users/entities/user.entity.ts`](apps/api/src/modules/users/entities/user.entity.ts).
- Converted AWS S3 client imports in [`apps/api/src/modules/storage/storage.service.ts`](apps/api/src/modules/storage/storage.service.ts) to dynamic lazy imports to avoid module loader conflicts in test runners.

---

## 6. Testing & Verification

All test suites and TypeScript checks pass:
1. **Types Package**:
   ```bash
   cd packages/types && bun run build
   ```
2. **Frontend (`apps/web`)**:
   ```bash
   cd apps/web
   bun run type-check   # tsc --noEmit (Passes)
   bun run test         # vitest (14/14 test files passed, 83/83 tests passed)
   ```
3. **Backend (`apps/api`)**:
   ```bash
   cd apps/api
   bun run type-check   # tsc --noEmit (Passes)
   bun run test src/modules/users src/modules/inspections  # (67/67 tests passed)
   ```

---

## 7. Key Files Changed / Added

| File | Type | Description |
|---|---|---|
| `product_model_mvp_final.keras` | Asset | Custom Keras product classifier (root) |
| `quality_model.keras` | Asset | Custom Keras quality classifier (root) |
| `apps/api/src/modules/inspections/providers/keras-vision.provider.ts` | Added | Custom Keras Vision provider implementing `QualityVisionProvider` |
| `apps/web/src/features/harvests/components/PhotoGuidanceBanner.tsx` | Added | 10-angle interactive guidance component |
| `apps/api/src/modules/inspections/dto/ai-classify-harvest.dto.ts` | Modified | `@ArrayMinSize(10)` validator added |
| `apps/api/src/modules/inspections/inspections.service.ts` | Modified | 10-photo validation in classification and pre-screen |
| `apps/api/src/modules/inspections/inspections.module.ts` | Modified | `KerasVisionProvider` registered |
| `apps/api/src/modules/users/entities/user.entity.ts` | Modified | Switched from `bcrypt` to `bcryptjs` |
| `apps/api/src/modules/storage/storage.service.ts` | Modified | Dynamic import of AWS S3 client |
| `apps/web/src/features/harvests/components/HarvestAnalyzeView.tsx` | Modified | Photo guidance & 10-photo validation |
| `apps/web/src/features/harvests/components/HarvestFormView.tsx` | Modified | Photo guidance & 10-photo validation |
| `apps/web/src/features/harvests/components/HarvestPhotoPicker.tsx` | Modified | 10-photo counter feedback |
| `apps/web/src/routes/inspector/reports/$id.tsx` | Modified | Photo guidance in inspection center |
| `.gitignore` | Modified | Added `.venv/`, `venv/`, `*.pyc` |

---

## 8. Important Rules for Future Agents
- **Git Staging & Commits**: Staging must **always** be done manually by the user. Never run `git add` or auto-stage files. Only commit when explicitly instructed by the user, and commit only what is staged.
