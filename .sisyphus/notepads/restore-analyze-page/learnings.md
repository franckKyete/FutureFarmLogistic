
## 2026-07-10 — Created `useCamera` hook

- Created `apps/web/src/hooks/useCamera.ts` — encapsulates `getUserMedia` lifecycle for live camera preview and frame capture.
- Follows the same convention as `usePermissions.ts` (named export, no default export, functional component hook).
- Uses `facingMode: { ideal: 'environment' }` (not strict) to avoid `OverconstrainedError`.
- Handles race condition with `cancelled` flag for unmount while `getUserMedia` pending.
- Cleanup stops all stream tracks on unmount via `useEffect` return.
- `capture()` uses `canvas.toBlob('image/jpeg', 0.8)` producing a `File` suitable for `mediaUploadMutation`.
- French error messages for camera errors (matching project locale).
- TypeScript check passes — 0 errors on `useCamera.ts`.

## 2026-07-10 — Added HEIC/HEIF support to FileTypeValidator

- Modified `apps/api/src/modules/products/products.controller.ts` line 77.
- Updated regex: `image/(jpeg|png|webp|gif)` → `image/(jpeg|png|webp|gif|heic|heif)`.
- Build passes (`pnpm run build --filter @futurefarm/api`).
- This allows iPhone users to upload HEIC/HEIF photos via the file-input fallback (`<input capture="environment">`).
- The `getUserMedia` + canvas path already works (captures as JPEG), so no changes needed there.

## 2026-07-10 — Integrated `useCamera` into harvest analyze page

- Modified `apps/web/src/routes/farmer/harvests/analyze.tsx` to integrate `useCamera`:
  - Added `useCamera` import and hook call with `error` aliased to `cameraError` to avoid shadowing.
  - Added `handleCameraClick` — captures frame from live video when `isActive`, falls back to `<input capture="environment">` click otherwise.
  - Added live `<video>` preview in the background when no images are uploaded (`images.length === 0 && isActive`), matching the existing backdrop overlay pattern (`bg-black/40`).
  - Updated both camera buttons (existing-images and empty-state) to call `handleCameraClick` with `disabled={uploadFile.isPending}`.
  - Added camera error message (`cameraError &&`) in empty state as amber warning text.
  - Zero CSS class changes to existing elements — only new elements added.
- Fixed `useCamera` interface: `RefObject<HTMLVideoElement>` → `RefObject<HTMLVideoElement | null>` to match React 19 types (strict ref handling).
- TypeScript compiles with 0 errors (`npx tsc -b`).
