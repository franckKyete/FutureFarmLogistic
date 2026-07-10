# Plan: Restore Farmer Harvest Analyze Page + Auto-Start Camera

## TL;DR

> **Résumé** : Restaurer la page `/farmer/harvests/analyze` avec un upload de photos fonctionnel et une caméra à démarrage automatique (live preview via `getUserMedia`). Supprimer les images placeholder (Unsplash), fixer la validation HEIC/HEIF iPhone côté serveur, et implémenter un hook `useCamera` réutilisable.
>
> **Livrables** :
> - Mutation `mediaUploadMutation()` existante et vérifiée
> - Page `analyze.tsx` réécrite avec upload réel + live preview caméra
> - Hook personnalisé `useCamera` pour la gestion du flux vidéo
> - Correction validation HEIC/HEIF côté serveur
>
> **Effort** : Moyen — 4 nouvelles tâches (1 correction serveur, 1 hook, 1 page, 1 build)
> **Exécution parallèle** : OUI — 2 vagues
> **Wave 1 (FAIT)** : T1+T2 terminés ✅
> **Wave 2 (FAIT)** : T3 build vérifié ✅
> **Wave 3 (NOUVEAU)** : T4 correction HEIC, T5 hook useCamera, T6 mise à jour page
> **Wave 4** : T7 build final

---

## Contexte

### Problème initial (résolu)
La page `/farmer/harvests/analyze` contenait :
1. `DEFAULT_IMAGES` avec des URLs Unsplash en dur (placeholders)
2. Une modale "Ajouter une image" qui accepte uniquement des URLs
3. Aucun upload de fichier ou prise de photo depuis l'appareil

### Corrections déjà appliquées (Waves 1-2) ✅
- `mediaUploadMutation()` déjà présente et vérifiée (lignes 81-88)
- Page réécrite avec boutons caméra + galerie, upload fonctionnel
- Correction type réponse: `post<{ data: { url: string } }>` → `return data.data`
- Ajout du `express.static('/uploads')` dans `main.ts`
- Ajout du `trust proxy` dans `main.ts`
- Remplacement de l'attribut `hidden` par CSS sur les inputs fichier
- Suppression du `Content-Type: multipart/form-data` explicite
- Build vérifié: API + Web passent avec 0 erreurs

### Nouveaux retours utilisateur
1. **"POST http://localhost:3001/v1/media/upload is failing"** — La requête EST envoyée (bouton caméra fonctionne) mais échoue
2. **"camera is still not working"** — L'upload échoue, donc rien n'apparaît
3. **"When accessing the page, it should automatically start the camera"** — NOUVEAU : caméra doit démarrer automatiquement au chargement

### Résultats d'investigation (Metis)
- **Cause probable de l'échec upload** : Le `FileTypeValidator` côté serveur (`products.controller.ts:77`) accepte uniquement `image/(jpeg|png|webp|gif)` — **les iPhones envoient du HEIC/HEIF** (`image/heic`), ce qui rejette l'upload. Pas un problème d'auth (le token JWT est bien attaché par l'intercepteur axios).
- **L'approche `getUserMedia` + canvas contourne ce problème** : les frames capturées depuis la vidéo sont encodées en JPEG (compatible), donc le validateur accepte.
- **Le proxy Vite est configuré correctement** : port 3001 → redirige vers API port 3000. NE PAS créer `apps/web/.env` (casserait le proxy).
- **Aucun hook caméra existant** dans le codebase — création nécessaire.

### Backend upload existant
```typescript
@Post('media/upload')
@UseGuards(JwtAuthGuard) // ← Protégé par JWT
@UseInterceptors(FileInterceptor('file'))
async uploadMedia(@UploadedFile(ParseFilePipe({
  validators: [
    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10 MB
    new FileTypeValidator({ fileType: 'image/(jpeg|png|webp|gif)' }),
  ],
})) file: UploadedFileDto, @Req() req: any) {
  // Sauvegarde dans uploads/media/{timestamp}-{random}{ext}
  // Retourne { url: `${protocol}://${host}/uploads/media/${filename}` }
}
```

---

## Work Objectives

### Core Objective
Restaurer la page d'analyse de récolte avec un flux d'upload fonctionnel ET une caméra à démarrage automatique.

### Concrete Deliverables
1. ✅ `mediaUploadMutation()` dans `harvests.queries.ts` (existant)
2. ✅ `analyze.tsx` réécrite (upload boutons fonctionnels)
3. ⬜ Correction validation HEIC/HEIF côté serveur
4. ⬜ Hook `useCamera` pour la gestion du flux vidéo
5. ⬜ Mise à jour `analyze.tsx` avec live preview + capture auto

### Definition of Done
- [ ] ✅ Plus de DEFAULT_IMAGES (Unsplash)
- [ ] ✅ Upload fichier fonctionnel via boutons caméra/galerie
- [ ] ⬜ Upload accepte les photos iPhone (HEIC/HEIF)
- [ ] ⬜ La caméra démarre automatiquement au chargement de la page
- [ ] ⬜ Live preview vidéo affichée en arrière-plan
- [ ] ⬜ Bouton "capturer" prend un frame de la vidéo et l'uploade
- [ ] ⬜ Fallback vers inputs fichier si `getUserMedia` échoue
- [ ] ⬜ `pnpm run build --filter @futurefarm/web` → exit 0

### Must Have
- ✅ Prise de photo via appareil mobile (`capture="environment"`)
- ✅ Upload depuis la galerie (`accept="image/*" multiple`)
- ✅ Upload via `POST /media/upload`
- ✅ Suppression complète des DEFAULT_IMAGES
- ⬜ Ajout `image/(heic|heif)` au `FileTypeValidator` serveur
- ⬜ Hook `useCamera` avec cycle de vie complet (start/stop/cleanup)
- ⬜ Live preview vidéo avec `<video autoplay playsinline muted>`
- ⬜ Capture frame → canvas → blob → upload via mutation existante
- ⬜ Gestion des erreurs `getUserMedia` (permission, caméra absente)

### Must NOT Have (Guardrails)
- NE PAS toucher aux autres routes farmer existantes
- NE PAS modifier le style visuel global (conserver le thème dark WhatsApp story)
- NE PAS créer de composant réutilisable sauf le hook `useCamera`
- NE PAS ajouter `apps/web/.env` (casserait le proxy Vite)
- NE PAS supprimer les inputs fichier existants (`<input capture>` et `<input multiple>`)
- NE PAS ajouter de contrôle torche/flash/zoom/focus/swap caméra
- NE PAS ajouter d'édition d'image (crop, filtre, rotation)
- NE PAS enregistrer de vidéo — photos uniquement

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (bun test)
- **Automated tests**: NO (agent-executed QA only)
- **Agent-Executed QA**: ALWAYS

### QA Policy
Every task MUST include agent-executed QA scenarios (see TODO template below).

- **API/Backend**: Bash (curl) — Vérifier upload avec/sans auth, types de fichiers acceptés
- **Frontend**: Playwright — Vérifier présence éléments DOM (`<video>`, `<input>`), attributs
- **Build**: `pnpm run build --filter @futurefarm/web` → exit 0
- **LSP**: 0 errors sur fichiers modifiés

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (FAIT ✅ — Parallèle):
├── T1: mediaUploadMutation() — DÉJÀ PRÉSENT
└── T2: analyze.tsx réécrite — FAIT

Wave 2 (FAIT ✅ — Vérification):
└── T3: Build vérifié — FAIT

Wave 3 (NOUVEAU — Parallèle MAX):
├── T4: Correction FileTypeValidator (HEIC/HEIF) [quick]
├── T5: Hook useCamera [unspecified-high]  
└── T6: Mise à jour analyze.tsx avec live preview [visual-engineering]

Wave 4 (NOUVEAU — Build final):
└── T7: Build vérification [quick]

Dépendances:
- T5 → T6 (analyze.tsx importe useCamera)
- T4 peut être fait en parallèle de T5+T6
- T7 dépend de T4+T5+T6
```

### Agent Dispatch Summary

- **Wave 3**: 3 tâches parallélisables (T4 seul, T5+T6 séquentiel)
  - T4 → `quick` (correction regex une ligne)
  - T5 → `unspecified-high` (hook custom avec logique getUserMedia)
  - T6 → `visual-engineering` (UI vidéo + interactions)
- **Wave 4**: 1 tâche
  
**Critical Path**: T5 → T6 → T7

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + QA Scenarios.

### Wave 1 (FAIT ✅)

- [x] 1. Ajouter `mediaUploadMutation()` à `harvests.queries.ts` — **DÉJÀ PRÉSENT** (lignes 81-90)

- [x] 2. Réécrire `analyze.tsx` avec camera + upload + suppression placeholders — **FAIT** ✅

### Wave 2 (FAIT ✅)

- [x] 3. Vérifier le build — **FAIT** ✅

---

### Wave 3 (NOUVEAU)

- [x] 4. Correction validation HEIC/HEIF côté serveur

  **What to do**:
  - Modifier `apps/api/src/modules/products/products.controller.ts` ligne 77
  - Changer `fileType: 'image/(jpeg|png|webp|gif)'` → `fileType: 'image/(jpeg|png|webp|gif|heic|heif)'`
  - Ce correctif permet aux photos iPhone (format HEIC/HEIF par défaut) d'être acceptées par le `FileTypeValidator`

  **Must NOT do**:
  - Ne pas modifier d'autre partie du contrôleur
  - Ne pas changer la logique de sauvegarde
  - Ne pas modifier d'autres fichiers

  **Recommended Agent Profile**:
  - **Category**: `quick` — une ligne à modifier, changement trivial
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3, avec T5 et T6)
  - **Blocks**: T7
  - **Blocked By**: None

  **References**:
  - `apps/api/src/modules/products/products.controller.ts:77` — Le `FileTypeValidator` avec le pattern regex à étendre

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Upload JPEG (existing format — should still work)
    Tool: Bash (curl)
    Preconditions: Create a test JPEG file (1x1 pixel)
    Steps:
      1. `convert -size 1x1 xc:white test.jpg` (or create minimal JPEG via python)
      2. `curl -s -X POST http://localhost:3000/v1/media/upload -H "Authorization: Bearer $TOKEN" -F "file=@test.jpg" -w "\nHTTP_CODE: %{http_code}"`
    Expected Result: HTTP 200 with JSON containing "url"
    Evidence: .sisyphus/evidence/task-4-jpeg-upload.txt

  Scenario: Upload HEIC (new format — should now work)
    Tool: Bash (curl)
    Preconditions: Create or use a minimal HEIC test file
    Steps:
      1. `curl -s -X POST http://localhost:3000/v1/media/upload -H "Authorization: Bearer $TOKEN" -F "file=@test.heic" -w "\nHTTP_CODE: %{http_code}"`
    Expected Result: HTTP 200 with JSON containing "url" (not 400)
    Evidence: .sisyphus/evidence/task-4-heic-upload.txt
  ```

  **Evidence to Capture**:
  - [ ] task-4-jpeg-upload.txt (confirms backward compat)
  - [ ] task-4-heic-upload.txt (confirms HEIC fix)
  - [ ] task-4-diff.txt (git diff showing the one-line change)

  **Commit**: YES
  - Message: `fix(api): add HEIC/HEIF support to media upload FileTypeValidator`
  - Files: `apps/api/src/modules/products/products.controller.ts`
  - Pre-commit: `pnpm run build --filter @futurefarm/api`

---

- [x] 5. Créer le hook `useCamera` pour la gestion du flux vidéo

  **What to do**:
  Créer `apps/web/src/hooks/useCamera.ts` avec un hook React personnalisé qui encapsule :
  
  1. **Cycle de vie `getUserMedia`** :
     - `start()` : appelle `navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { min: 640 }, height: { min: 480 } } })`
     - `stop()` : arrête tous les tracks du stream
     - Nettoyage automatique dans le `useEffect` cleanup

  2. **État exposé** :
     - `stream: MediaStream | null` — le flux vidéo actif
     - `isActive: boolean` — si la caméra est active
     - `error: string | null` — message d'erreur (permission refusée, caméra absente, etc.)
     - `videoRef: RefObject<HTMLVideoElement>` — à attacher à l'élément `<video>`

  3. **Capture d'image** :
     - `capture(): Promise<File | null>` — capture un frame depuis le flux vidéo :
       1. Crée un canvas aux dimensions de la vidéo
       2. `ctx.drawImage(video, 0, 0)`
       3. `canvas.toBlob('image/jpeg', 0.8)` (JPEG compressé ~500KB)
       4. Crée un `File` à partir du blob avec nom `capture-{timestamp}.jpg`
       5. Retourne le File (prêt à être passé à `uploadFile.mutate(file)`)

  4. **Fallback automatique** :
     - Si `getUserMedia` échoue (`NotAllowedError`, `NotFoundError`, `NotReadableError`), `error` est mis à jour avec un message explicite
     - Le composant parent utilise `error` pour décider d'afficher les inputs fichier de secours

  5. **Gestion des erreurs spécifiques** :
     - `NotAllowedError` → "Accès à la caméra refusé. Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur."
     - `NotFoundError` → "Aucune caméra trouvée sur cet appareil."
     - `NotReadableError` → "La caméra est utilisée par une autre application. Fermez-la et réessayez."
     - `OverconstrainedError` → "Caméra arrière non disponible, utilisation de la caméra par défaut." (non-bloquant)

  6. **Cycle de vie propre** :
     - `useEffect` cleanup : `return () => { stream.getTracks().forEach(t => t.stop()); }`
     - Variable `cancelled` pour éviter les course conditions (unmount pendant `getUserMedia` en attente)
     - Optionnel : `document.visibilitychange` listener pour pause/resume

  Suivre le pattern de `apps/web/src/hooks/usePermissions.ts` pour la structure du hook.

  **Structure du hook** :
  ```typescript
  import { useState, useRef, useEffect, useCallback } from 'react';

  interface UseCameraReturn {
    videoRef: React.RefObject<HTMLVideoElement>;
    isActive: boolean;
    error: string | null;
    capture: () => Promise<File | null>;
    stop: () => void;
  }

  export function useCamera(): UseCameraReturn {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Démarrer la caméra au montage
    useEffect(() => {
      let cancelled = false;
      async function start() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { min: 640, ideal: 1280 },
              height: { min: 480, ideal: 720 },
            },
          });
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
          setIsActive(true);
        } catch (err: any) {
          if (cancelled) return;
          if (err.name === 'NotAllowedError')
            setError('Accès à la caméra refusé. Autorisez l\'accès dans les paramètres.');
          else if (err.name === 'NotFoundError')
            setError('Aucune caméra trouvée.');
          else if (err.name === 'NotReadableError')
            setError('Caméra utilisée par une autre application.');
          else
            setError('Erreur lors de l\'accès à la caméra.');
        }
      }
      start();
      return () => {
        cancelled = true;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      };
    }, []);

    const capture = useCallback(async (): Promise<File | null> => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return null;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0);
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) resolve(null);
          else resolve(new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.8);
      });
    }, []);

    const stop = useCallback(() => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setIsActive(false);
    }, []);

    return { videoRef, isActive, error, capture, stop };
  }
  ```

  **Must NOT do**:
  - Ne PAS ajouter de contrôles torche/flash/zoom/swap
  - Ne PAS éditer les images capturées
  - NE PAS utiliser `facingMode: 'environment'` strict (toujours `ideal`)
  - NE PAS enregistrer de vidéo

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — hook custom avec gestion d'état complexe et lifecycle
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3, avec T4 et parallèle à T6 si on écrit le hook d'abord)
  - **Blocks**: T6
  - **Blocked By**: None

  **References**:
  - `apps/web/src/hooks/usePermissions.ts` — Pattern de hook custom à suivre
  - `apps/web/src/routes/harvests/$id.tsx:48-63` — Pattern de cleanup useEffect
  - `MDN: MediaDevices.getUserMedia()` — API officielle
  - `apps/web/src/features/harvests/api/harvests.queries.ts:81-88` — `mediaUploadMutation()` que le composant utilisera avec le fichier capturé

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Hook exports correct interface
    Tool: Bash (tsc type check)
    Preconditions: File created at apps/web/src/hooks/useCamera.ts
    Steps:
      1. `npx tsc --noEmit apps/web/src/hooks/useCamera.ts 2>&1 | head -20`
    Expected Result: No TypeScript errors
    Evidence: .sisyphus/evidence/task-5-tsc-types.txt

  Scenario: Video element attributes verified
    Tool: Playwright
    Preconditions: Page with useCamera renders a <video> element
    Steps:
      1. Check that generated HTML contains <video autoplay playsinline muted> element
    Expected Result: Video element exists with correct attributes
    Evidence: .sisyphus/evidence/task-5-video-attrs.txt
  ```

  **Evidence to Capture**:
  - [ ] task-5-hook-exists.txt (file exists check)
  - [ ] task-5-tsc-types.txt (TypeScript compilation)
  - [ ] task-5-video-attrs.txt (DOM attributes verified)

  **Commit**: YES (groups with T6)
  - Message: `feat(web): add useCamera hook for live camera preview and capture`
  - Files: `apps/web/src/hooks/useCamera.ts`

---

- [x] 6. Mettre à jour `analyze.tsx` avec live preview caméra et capture

  **What to do**:
  Modifier `apps/web/src/routes/farmer/harvests/analyze.tsx` pour intégrer le hook `useCamera` :

  1. **Importer le hook** : `import { useCamera } from '@/hooks/useCamera';`

  2. **Utiliser le hook** dans le composant :
     ```typescript
     const { videoRef, isActive, error: cameraError, capture, stop: stopCamera } = useCamera();
     ```

  3. **Ajouter l'élément `<video>`** pour le live preview (arrière-plan quand aucune image) :
     ```tsx
     {/* Live camera preview */}
     {images.length === 0 && isActive && (
       <video
         ref={videoRef}
         autoPlay
         playsInline
         muted
         className="absolute inset-0 z-0 w-full h-full object-cover"
       />
     )}
     ```
     - Placer AVANT le bloc d'image de fond existant (qui s'affiche quand `images.length > 0`)
     - Ajouter le même overlay `bg-black/40` pour lisibilité

  4. **Ajouter le bouton "Capture"** (prendre une photo depuis le flux) :
     ```tsx
     <button
       onClick={async () => {
         const file = await capture();
         if (file) uploadFile.mutate(file);
       }}
       disabled={uploadFile.isPending || !isActive}
       // ... style similaire aux autres boutons
     >
       <span className="material-symbols-outlined">camera</span>
     </button>
     ```
     - Placer ce bouton dans la barre d'actions en bas, à côté du bouton galerie
     - Quand `isActive` est vrai, ce bouton remplace/est prioritaire sur le bouton fichier caméra
     - Quand `cameraError` est vrai ou `isActive` faux, garder les boutons fichier existants comme fallback

  5. **Message d'erreur** quand la caméra n'est pas disponible :
     - Si `cameraError`, afficher un message comme "Caméra non disponible. Utilisez la galerie."
     - Les inputs fichier existants (`<input capture="environment">`) restent comme fallback

  6. **Nettoyage** : Le hook `useCamera` gère déjà le cleanup via son `useEffect`. Ajouter éventuellement `stopCamera()` dans un `useEffect` de démontage si besoin de logique supplémentaire.

  **Ne PAS modifier** :
  - Le style visuel global (dark WhatsApp story)
  - Les boutons galerie existants
  - L'input notes
  - L'overlay résultat
  - La navigation vers `/farmer/harvests/new`

  **Must NOT do**:
  - NE PAS supprimer les `<input type="file">` existants — ils sont le fallback
  - NE PAS ajouter de logique d'édition d'image
  - NE PAS modifier le comportement d'analyse (classify, navigation)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — UI avec intégration vidéo + interactions utilisateur
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (dépend de T5)
  - **Blocks**: T7
  - **Blocked By**: T5

  **References**:
  - `apps/web/src/hooks/useCamera.ts` (T5) — Le hook à importer et utiliser
  - `apps/web/src/routes/farmer/harvests/analyze.tsx` — Le fichier à modifier (état actuel)
  - `apps/web/src/features/harvests/api/harvests.queries.ts:81-88` — `mediaUploadMutation` pour uploader les fichiers capturés

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Video element renders when camera active
    Tool: Playwright
    Preconditions: Page loads with camera permission granted
    Steps:
      1. Navigate to /farmer/harvests/analyze
      2. Wait for page to render
      3. Check for <video> element with autoplay attribute
    Expected Result: <video autoplay playsinline muted> element exists in DOM
    Evidence: .sisyphus/evidence/task-6-video-renders.txt

  Scenario: Fallback file inputs still present
    Tool: Playwright
    Preconditions: Page loaded
    Steps:
      1. Navigate to /farmer/harvests/analyze
      2. Check for <input type="file" capture="environment"> and <input type="file" multiple>
    Expected Result: Both file input elements exist in DOM
    Evidence: .sisyphus/evidence/task-6-file-inputs.txt

  Scenario: Camera error shows fallback message
    Tool: Playwright (with camera permission blocked)
    Preconditions: Page loads with camera permission denied
    Steps:
      1. Block camera permission in browser context
      2. Navigate to /farmer/harvests/analyze
      3. Check for error message about camera unavailability
    Expected Result: Error message displayed, file input buttons still functional
    Evidence: .sisyphus/evidence/task-6-camera-error.txt
  ```

  **Evidence to Capture**:
  - [ ] task-6-build-pre.txt (`tsc -b` avant modifications)
  - [ ] task-6-video-renders.txt
  - [ ] task-6-file-inputs.txt
  - [ ] task-6-camera-error.txt

  **Commit**: YES (groups with T5)
  - Message: `feat(web): integrate useCamera hook with auto-start live preview on analyze page`
  - Files: `apps/web/src/routes/farmer/harvests/analyze.tsx`

---

### Wave 4

- [x] 7. Vérifier le build final

  **What to do**:
  - Lancer `pnpm run build --filter @futurefarm/web` (inclut `tsc -b` + `vite build`)
  - Vérifier exit code 0
  - Lancer `pnpm run build --filter @futurefarm/api` (`nest build`)
  - Vérifier LSP diagnostics sur tous les fichiers modifiés

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (dernière étape)
  - **Blocks**: Nothing (wave finale)
  - **Blocked By**: T4, T6

  **Acceptance Criteria**:
  - [ ] `pnpm run build --filter @futurefarm/web` → exit 0
  - [ ] `pnpm run build --filter @futurefarm/api` → exit 0
  - [ ] LSP diagnostics: 0 errors sur tous les fichiers modifiés

  **Evidence to Capture**:
  - [ ] task-7-build-web.txt
  - [ ] task-7-build-api.txt

  **Commit**: YES (groups with T4+T5+T6)
  - Message: `feat(web): complete auto-start camera + HEIC upload support`

---

## Success Criteria

### Verification Commands
```bash
# Build verification
pnpm run build --filter @futurefarm/web
# Expected: exit 0

pnpm run build --filter @futurefarm/api
# Expected: exit 0

# Upload verification (with valid JWT token)
curl -X POST http://localhost:3000/v1/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.jpg"
# Expected: 200 OK, {"url":"..."}

# HEIC upload verification
curl -X POST http://localhost:3000/v1/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.heic"
# Expected: 200 OK (not 400)

# LSP check
lsp_diagnostics("apps/web/src/routes/farmer/harvests/analyze.tsx")
# Expected: 0 errors

lsp_diagnostics("apps/web/src/hooks/useCamera.ts")
# Expected: 0 errors
```

### Final Checklist
- [x] `mediaUploadMutation()` présente et exportée
- [x] Aucune DEFAULT_IMAGES restante
- [x] Upload fonctionnel via boutons caméra/galerie
- [x] ✅ Correction HEIC/HEIF côté serveur
- [x] Hook `useCamera` créé et fonctionnel
- [x] Live preview vidéo affichée au chargement
- [x] Capture d'image depuis la vidéo → upload
- [x] Fallback inputs fichier toujours présents
- [x] Build exit 0 (Web + API)
