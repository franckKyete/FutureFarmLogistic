# Assisted Farming & Inspection Centers (Module 7)

This module implements capabilities to support offline farmers (without internet access or smartphones) by allowing Quality Inspectors or Admins to act as proxies on their behalf. It also sets up a system to manage physical Inspection Centers from which inspectors are located and dispatched.

---

## 1. Proxy Actor Operations

To allow Admins and Inspectors to interact on behalf of farmers, we use the **Proxy Actor** pattern. This translates incoming REST calls into "on behalf of" actions in the service layers using target user IDs.

### 2. User / Profile Management Endpoints

* **Register Farmer on behalf**: `POST /v1/users/register/farmer/proxy`
  * **Permission**: `farmer:proxy:create`
  * Registers a new farmer user account. Automatically generates a 12-character alphanumeric temporary password. Generates profile entity records and links them. Returns the generated plain-text password so the inspector can hand it off to the farmer.
* **Update Farmer Profile on behalf**: `PUT /v1/users/profile/farmer/:farmerId`
  * **Permission**: `farmer:proxy:update`
  * Allows an inspector to update an offline farmer's profile fields.
* **Create Land Parcel on behalf**: `POST /v1/users/:farmerId/parcels`
  * **Permission**: `farmer:proxy:update`
  * Submits an agricultural parcel for verification on behalf of the farmer.

### 3. Products & Harvests Endpoints

* **Create Harvest proxy**: `POST /v1/harvests/proxy`
  * **Permission**: `farmer:proxy:harvest:manage`
  * Creates a harvest batch listing for a farmer. Takes `farmerUserId` in the request payload.
* **Update Harvest proxy**: `PATCH /v1/harvests/:id/proxy`
  * **Permission**: `farmer:proxy:harvest:manage`
  * Modifies harvest details on behalf of the farmer. Resets status back to `PENDING_APPROVAL`.
* **Delete Harvest proxy**: `DELETE /v1/harvests/:id/proxy`
  * **Permission**: `farmer:proxy:harvest:manage`
  * Archives the harvest batch.

### 4. Auctions Endpoints

* **Create Auction proxy**: `POST /v1/auctions/proxy`
  * **Permission**: `farmer:proxy:auction:manage`
  * Puts an approved harvest batch up for auction.
* **Update Auction proxy**: `PATCH /v1/auctions/:id/proxy`
  * **Permission**: `farmer:proxy:auction:manage`
  * Modifies starting price or dates of a scheduled proxy auction.
* **Cancel Auction proxy**: `POST /v1/auctions/:id/cancel/proxy`
  * **Permission**: `farmer:proxy:auction:manage`
  * Cancels the auction and returns quantity back to the harvest stock.

---

## 5. Inspection Centers Management

Inspection Centers model physical stations or offices where inspectors are dispatched from.

### DB Schema

#### `InspectionCenterEntity`
* `id` (UUID): Primary key.
* `name` (varchar): Display name.
* `code` (varchar): Unique code (e.g. `CTR-ABI-001`).
* `regionName` (varchar): Name of the region.
* `address` (text): Physical location.
* `latitude` / `longitude` (decimal): GPS coordinates.
* `isActive` (boolean): Soft deactivation flag.

#### `InspectorCenterAssignmentEntity`
* `id` (UUID)
* `inspectorProfileId` (UUID): Reference to the inspector.
* `inspectionCenterId` (UUID): Reference to the inspection center.
* `isCurrentAssignment` (boolean): Flag indicating current station.
* `assignedAt` (timestamp)

### API Endpoints

* `POST /v1/inspection-centers`
  * **Permission**: `inspection:center:create`
  * Registers a new center.
* `GET /v1/inspection-centers`
  * **Permission**: `inspection:center:read`
  * Lists centers (optionally filtered by `regionName` or `activeOnly`).
* `GET /v1/inspection-centers/:id`
  * **Permission**: `inspection:center:read`
  * Returns detailed center profile along with assigned inspector list history.
* `PATCH /v1/inspection-centers/:id`
  * **Permission**: `inspection:center:update`
  * Updates center metadata fields.
* `DELETE /v1/inspection-centers/:id`
  * **Permission**: `inspection:center:delete`
  * Soft-deactivates the center.
* `POST /v1/inspection-centers/:id/assign`
  * **Permission**: `inspection:center:assign`
  * Assigns an inspector to a center (marking any previous assignment as inactive).
* `GET /v1/inspection-centers/:id/inspectors`
  * **Permission**: `inspection:center:read`
  * Lists all inspectors currently active at the center.
* `GET /v1/inspection-centers/my-center`
  * **Permission**: `inspection:center:read`
  * Returns current inspector's home base center.
