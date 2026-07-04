# Backend — Harvest Catalogue Management

The **Harvest Catalogue Management** module manages static crop template definitions (**Products**) and the physical, sellable batches (**Harvests**) produced by Farmers. It supports safety stock buffers, degressive pricing, traceability checks, inspector quality ratings, and Gemini AI suggestions.

---

## Decoupled Architecture

To allow multiple farmers to list different batches of the same crop (with varying quality, harvest dates, and prices), the catalogue is split into two layers:

```
                    ┌─────────────────────────┐
                    │      ProductEntity      │
                    │   (Crop/Item Reference) │
                    └────────────┬────────────┘
                                 │
                                 ▼ (1-to-Many)
                    ┌─────────────────────────┐
                    │      HarvestEntity      │
                    │  (Sellable Batch/Unit)  │
                    └────────────┬────────────┘
                                 │
                                 ├─► FarmerProfileEntity (batch owner)
                                 │
                                 ├─► Expiration & Quality Scores
                                 │
                                 ├─► Price Decay Config (degressive pricing)
                                 │
                                 └─► Verification Flow (PENDING_APPROVAL, APPROVED, REJECTED)
```

1. **Product (Crop Template)**: A system-wide reference catalog of crop classes (e.g., *"Medjool Dates"*, *"Organic Roma Tomatoes"*).
2. **Harvest (Physical Batch)**: The actual sellable batch listed by a farmer. It carries inventory numbers, unit prices, cultivation details, shelf-life, and inspector metrics.

---

## Core Business Workflows

### 1. Stock Safety Buffer (`stockMarge`)
To avoid double-booking or overselling near inventory depletion, farmers define a buffer stock (`stockMarge`) when registering a harvest:
* **Farmer View**: Displays the physical quantity in stock (`quantityInStock`).
* **Buyer Public View**: Returns the calculated **effective stock**:
$$\text{Available Stock} = \max(0, \text{quantityInStock} - \text{stockMarge})$$

### 2. Degressive Pricing (Dynamic Price Decay)
Accelerates sales of fresh produce by offering discounts as the expiration date approaches. 
* Configuration is stored inside the database column `price_decay_config` (JSONB) as an array of decay steps:
  ```json
  {
    "decaySteps": [
      { "daysBeforeExpiration": 5, "priceMultiplier": 0.8 },
      { "daysBeforeExpiration": 2, "priceMultiplier": 0.5 }
    ]
  }
  ```
* Proximity calculation:
  $$\text{Days Remaining} = \text{expirationDate} - \text{currentDate}$$
* The system evaluates `decaySteps` sorted ascending by `daysBeforeExpiration`, applying the first multiplier where $\text{Days Remaining} \le \text{daysBeforeExpiration}$.

### 3. Traceability (Parcel Verification)
When listing a harvest, farmers can link it to a registered `ParcelEntity` (`parcelId`).
* The API enforces security by verifying that the land parcel exists and that it belongs to the authenticated farmer's profile (`parcel.farmerProfileId === farmerProfile.id`).

---

## Moderation & Lifecycle State Machine

```
    [ Farmer Draft ] ──► PENDING_APPROVAL ──► [ Approved by Inspector ] ──► APPROVED (Active)
                             ▲                                                 │
                             │                                                 │
                             └──────────── [ Farmer Modifies Batch ] ──────────┘
```

* **Approval Block**: New listings are set to `PENDING_APPROVAL` by default and are excluded from public search.
* **Inspector Verification**: Inspectors review the batch, assign an official `qualityScore` (0.00 to 10.00), and mark it as `APPROVED` or `REJECTED`.
* **Auto-Lock on Update**: Any modifications by the farmer to an approved listing automatically reset the status to `PENDING_APPROVAL` and clear previous approvals.
* **Archiving**: Deleting a listing sets its status to `ARCHIVED` to preserve audit records.

---

## Gemini AI-Assisted Listing Creation

Exposes a `/v1/harvests/ai-suggest` endpoint that forwards a farmer's raw description prompt to **Gemini 2.5 Flash**. The AI returns structured suggestions:
* **`suggestedName`**: Professional crop template mapping (e.g. *"Organic Roma Tomatoes"*).
* **`category`**: Enforced enum (`CEREALS`, `FRUITS`, `VEGETABLES`, `DATES`, `DAIRY`, `MEAT`, `OTHER`).
* **`description`**: Refined, marketing-ready copy.
* **`farmingMethods`**: Extrapolated cultivation parameters.
* **`recommendedShelfLifeDays`**: Standard crop conservation shelf-life.

---

## Database Schemas (TypeORM)

### `ProductEntity`
* `id` (`uuid`): Primary key.
* `name` (`varchar`): Unique crop reference name (index).
* `category` (`enum`): `ProductCategory` enum.
* `description` (`text`): General crop description.

### `HarvestEntity`
* `id` (`uuid`): Primary key.
* `productId` (`uuid`): Foreign key to `ProductEntity`.
* `farmerProfileId` (`uuid`): Foreign key to `FarmerProfileEntity`.
* `parcelId` (`uuid`, nullable): Foreign key to `ParcelEntity` (traceability link).
* `harvestDate` (`date`): Day crop was harvested.
* `expirationDate` (`date`): Day crop expires.
* `quantityInStock` (`decimal`): Total physical stock available.
* `stockMarge` (`decimal`): Safety stock margin.
* `pricePerUnit` (`decimal`): Unit cost before decay discounts.
* `unit` (`enum`): `HarvestUnit` enum (`KG`, `TON`, `PIECE`).
* `farmingMethods` (`text`): Description of cultivation techniques.
* `photoUrls` (`simple-array`): Array of image URLs.
* `status` (`enum`): `HarvestStatus` enum (default: `PENDING_APPROVAL`).
* `qualityScore` (`decimal`): Score out of 10 assigned by inspector.
* `priceDecayConfig` (`jsonb`): List of dynamic price decay steps.
* `approvedById` (`uuid`): Foreign key to `UserEntity` (inspector who verified).
* `approvedAt` (`timestamp`): Time of verification.
* `rejectionReason` (`text`): Reason for rejection if applicable.

---

## API Endpoints & RBAC Gates

| Method | Endpoint | Required Permission | Input DTO | Output / Response |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/v1/products` | `product:create` | `CreateProductDto` | `ProductEntity` |
| **GET** | `/v1/products` | `product:read` | None | `ProductEntity[]` |
| **POST** | `/v1/harvests` | `harvest:create` | `CreateHarvestDto` | `HarvestEntity` |
| **GET** | `/v1/harvests` | `harvest:read` | Query filters | `HarvestEntity[]` (buyer views are stock-adjusted) |
| **GET** | `/v1/harvests/farmer` | `harvest:read` | None | `HarvestEntity[]` (caller's own listings) |
| **GET** | `/v1/harvests/:id` | `harvest:read` | None | `HarvestEntity` |
| **GET** | `/v1/harvests/:id/price` | `harvest:read` | None | Dynamic price calculation details |
| **PATCH** | `/v1/harvests/:id` | `harvest:update` | `UpdateHarvestDto` | Updated `HarvestEntity` (status reset) |
| **DELETE** | `/v1/harvests/:id` | `harvest:delete` | None | void (status set to `ARCHIVED`) |
| **PATCH** | `/v1/harvests/:id/verify` | `harvest:verify` | `VerifyHarvestDto` | Moderated `HarvestEntity` |
| **POST** | `/v1/harvests/ai-suggest` | `harvest:create` | `AiSuggestHarvestDto` | `AiSuggestHarvestResponseDto` (Gemini output) |
