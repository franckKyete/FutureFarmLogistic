# Branch Summary — Dutch Auctions & Tooling Updates

This document outlines the architectural changes, UI redesigns, dependency migrations, and documentation updates implemented in this branch for subsequent agents and developers.

---

## 1. Farmer Dutch Auction Creation Page Redesign

### Objective
Modernize the farmer-facing auction creation interface (`/farmer/auctions/new`) to match the mobile-first Dutch Auction design, ensuring 100% dynamic data integration with the backend and utilizing the platform's multi-currency system.

### Key Architectural & Implementation Details
- **Harvest-First Creation Model**:
  - Auctions are created directly from approved batches (`HarvestEntity`, `status === 'APPROVED'`), never from abstract product templates.
  - Fetches approved farmer harvests via `GET /v1/harvests/farmer`.
  - Supports `harvestId` query search param for pre-selection when navigating from stock/dashboard.
- **Section 1: PRODUIT (Harvest Selection & Metadata)**:
  - Displays authenticated signed photo URL (`harvest.photoUrls[0]`), crop name, batch ID, and effective stock (`quantityInStock - stockMarge`).
  - Displays the AI/Inspector quality badge (`Qualité IA : X%`) derived from `harvest.qualityScore` (0.00 – 10.00).
  - Includes a **Modifier** trigger opening a slide-over modal to switch between approved harvest batches.
- **Section 2: LOT DE VENTE (Lot Sizing & Stock Guard)**:
  - Input with unit suffix (`kg`, `ton`, `piece`).
  - Dynamic stock safety warning banner calculating remaining stock in real time:
    $$\text{Remaining Stock} = \text{Effective Stock} - \text{Quantity On Offer}$$
- **Section 3: TARIFICATION (Pricing & Reserve Price)**:
  - Prominent starting price input styled with primary branding.
  - Reserve price (minimum floor) input with backend-consistent validation ($\text{startingPrice} > \text{reservePrice}$).
- **Section 4: PARAMÈTRES DE BAISSE (Interval & Step Amounts)**:
  - Decrement amount with currency symbol suffix.
  - Frequency dropdown (1 min, 2 min, 3 min, 5 min, 10 min, 15 min, 30 min, 1 h).
- **Section 5: PLANIFICATION (Scheduling & Datetime)**:
  - French-friendly dynamic date labels (`Aujourd'hui à HH:mm`, `Demain à HH:mm`, `DD/MM/YYYY à HH:mm`).
  - Start and end datetime-local inputs.
- **Section 6: Aperçu de votre enchère (Live Dutch Auction Simulation)**:
  - **Dynamic Step-Down Chart**: Responsive SVG rendering discrete Dutch auction staircase price drop steps over time down to the reserve price horizontal indicator line.
  - **30-Minute Price Projection**: Computes live price drop at $t + 30\text{ min}$:
    $$\text{Projected Price} = \max\left(\text{reservePrice}, \text{startingPrice} - \left\lfloor \frac{30}{\text{frequencyMinutes}} \right\rfloor \times \text{decrementAmount}\right)$$
- **Sticky Actions**:
  - **Brouillon**: Saves auction parameters to `localStorage` (`futurefarm:auction_draft`).
  - **Lancer l'enchère**: Dispatches `POST /v1/auctions` (`CreateAuctionDto`) with atomic stock locking.

### Modified Files:
- [`apps/web/src/routes/farmer/auctions/new.tsx`](file:///home/kyete/kitchen/FutureFarmLogistic/apps/web/src/routes/farmer/auctions/new.tsx) (Removed AI suggested price line, keeping clean starting and reserve price inputs)
- [`apps/web/src/routes/farmer/auctions/$id.bidders.tsx`](file:///home/kyete/kitchen/FutureFarmLogistic/apps/web/src/routes/farmer/auctions/$id.bidders.tsx) (Replaced mock data with real backend data, live WebSockets, staircase Dutch price decay curve with actual bids plotted on the plateaus without label collision, real buyer outcome cards, real event timeline, farmer cancellation modal, and elevated bottom action buttons above `FarmerBottomNav`)
- [`apps/web/src/routes/farmer/stock.tsx`](file:///home/kyete/kitchen/FutureFarmLogistic/apps/web/src/routes/farmer/stock.tsx) (Removed low-stock alert banner and stats cards grid)
- [`apps/web/src/features/farmer/components/FarmerHeader.tsx`](file:///home/kyete/kitchen/FutureFarmLogistic/apps/web/src/features/farmer/components/FarmerHeader.tsx) (Set title to *"Créer une enchère"*, back button, profile avatar)
- [`apps/web/src/features/farmer/components/FarmerBottomNav.tsx`](file:///home/kyete/kitchen/FutureFarmLogistic/apps/web/src/features/farmer/components/FarmerBottomNav.tsx) (Added *Profil* tab, active rounded pill styling matching design)

---

## 2. Currency Management Integration

- Replaced hardcoded currency labels with [`currencyStore`](file:///home/kyete/kitchen/FutureFarmLogistic/apps/web/src/features/currency/store/currency.store.ts) symbol resolution.
- Dynamic fallback hierarchy: `harvest.currency` $\rightarrow$ `selectedCurrency` $\rightarrow$ `'CDF'`.
- Supports proper localized symbols (`FCFA` for XOF, `FC` for CDF, `$` for USD, `€` for EUR).

---

## 3. Native Dependency Fix (`bcrypt` $\rightarrow$ `bcryptjs`)

### Problem
Runtime failure under Bun due to missing native C++ binary bindings:
```
Error: Cannot find module '.../bcrypt/lib/binding/napi-v3/bcrypt_lib.node'
```

### Solution
- Migrated from `bcrypt` to pure JavaScript `bcryptjs` and `@types/bcryptjs`.
- Updated entity import in [`apps/api/src/modules/users/entities/user.entity.ts`](file:///home/kyete/kitchen/FutureFarmLogistic/apps/api/src/modules/users/entities/user.entity.ts).
- Updated [`apps/api/package.json`](file:///home/kyete/kitchen/FutureFarmLogistic/apps/api/package.json) dependencies.

---

## 4. Documentation Standardization for Bun

Updated all references to package managers in the documentation to reflect **Bun**:

- [`docs/frontend/getting-started.md`](file:///home/kyete/kitchen/FutureFarmLogistic/docs/frontend/getting-started.md)
- [`docs/backend/getting-started.md`](file:///home/kyete/kitchen/FutureFarmLogistic/docs/backend/getting-started.md)
- [`docs/packages/types.md`](file:///home/kyete/kitchen/FutureFarmLogistic/docs/packages/types.md)
- [`docs/architecture/overview.md`](file:///home/kyete/kitchen/FutureFarmLogistic/docs/architecture/overview.md)
- [`docs/architecture/monorepo.md`](file:///home/kyete/kitchen/FutureFarmLogistic/docs/architecture/monorepo.md)
- [`docs/contributing/git-workflow.md`](file:///home/kyete/kitchen/FutureFarmLogistic/docs/contributing/git-workflow.md)
