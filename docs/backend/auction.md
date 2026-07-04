# Backend — Auction & Bidding System

The **Auction & Bidding** module introduces a real-time Dutch-style auction system over `APPROVED` harvests. It allows farmers to list their crops in a descending-price model, pushes price ticks and bids live over WebSockets, and locks the lot for a single winning buyer.

---

## Architecture Design

### 1. Dutch Auction State Machine

```
   SCHEDULED ────( startAt reached )─────► ACTIVE
      ACTIVE ────( buyer places bid )─────► SOLD (Produces Bid & locks Winner)
      ACTIVE ────( endAt reached )────────► EXPIRED (Refunds stock)
      ACTIVE ────( floor reached )────────► EXPIRED (Refunds stock)
   SCHEDULED │
      ACTIVE ────( farmer/admin cancels )──► CANCELLED (Refunds stock)
```

1. **SCHEDULED**: The auction is created with a future `startAt` timestamp.
2. **ACTIVE**: The auction is open for bidding. Its `currentPrice` drops on a configured timer.
3. **SOLD**: A buyer placed a bid to buy the entire lot at the `currentPrice`. Bidding closes instantly.
4. **EXPIRED**: The deadline `endAt` was reached, or the price dropped to `reservePrice` without any buyer placing a bid.
5. **CANCELLED**: The farmer or an admin cancelled the auction before it could be sold.

### 2. Transaction Lock & Stock Reservation
To prevent overselling and race conditions:
- **Reserves Stock**: Creating a `SCHEDULED` or `ACTIVE` auction immediately deducts `quantityOnOffer` from the harvest's `quantityInStock`. If the auction expires or is cancelled, this quantity is refunded.
- **Pessimistic Locking**: Bidding (`POST /v1/auctions/:id/bids`) is wrapped inside a **`SERIALIZABLE` database transaction** that locks the auction row (`FOR UPDATE`) to ensure only the first buyer's request succeeds. Subsequent bids fail with `409 Conflict`.

### 3. Price Decrement Formula
The current price at time $t$ (where $t \ge \text{startAt}$) is calculated as:
$$\text{currentPrice}(t) = \max(\text{reservePrice}, \text{startingPrice} - (\text{elapsed\_intervals} \times \text{priceDecrementAmount}))$$

---

## Real-Time WebSockets (`AuctionsGateway`)

**Namespace**: `/auctions`  
Clients subscribe to a specific auction room by emitting a `join_auction` event with `{ auctionId }`. 

### Server to Client Events

#### `auction:price_tick`
Emitted every time the cron scheduler drops the price.
```json
{
  "auctionId": "uuid",
  "currentPrice": 85.00,
  "nextDecrementAt": "2026-07-04T18:10:00.000Z"
}
```

#### `auction:sold`
Emitted when a buyer accepts the current price.
```json
{
  "auctionId": "uuid",
  "winnerId": "uuid",
  "priceAtBid": 85.00,
  "soldAt": "2026-07-04T18:05:22.000Z"
}
```

#### `auction:expired`
Emitted when the auction expires without a buyer.
```json
{
  "auctionId": "uuid",
  "reason": "DEADLINE" // or "FLOOR_PRICE"
}
```

#### `auction:cancelled`
Emitted when the farmer or admin cancels.
```json
{
  "auctionId": "uuid"
}
```

---

## Database Schemas (TypeORM)

### `AuctionEntity`
* `id` (`uuid`): Primary key.
* `harvestId` (`uuid`): Foreign key to `HarvestEntity` (`RESTRICT`).
* `farmerProfileId` (`uuid`): Foreign key to `FarmerProfileEntity`.
* `status` (`enum`): `SCHEDULED`, `ACTIVE`, `SOLD`, `EXPIRED`, `CANCELLED`.
* `startingPrice` (`decimal`): Price at auction open.
* `reservePrice` (`decimal`): Floor price where price decrements stop.
* `currentPrice` (`decimal`): Live descending price.
* `priceDecrementAmount` (`decimal`): Price reduction size per interval.
* `priceDecrementIntervalMinutes` (`int`): Reduction interval length.
* `nextDecrementAt` (`timestamp`): Next scheduled price drop.
* `quantityOnOffer` (`decimal`): Lot size on offer.
* `startAt` (`timestamp`): Time bidding opens.
* `endAt` (`timestamp`): Time auction expires.
* `soldAt` (`timestamp`, nullable): Time bid was accepted.
* `winnerId` (`uuid`, nullable): Foreign key to `UserEntity` (buyer).
* `winningBidId` (`uuid`, nullable): Foreign key to `BidEntity`.

### `BidEntity`
* `id` (`uuid`): Primary key.
* `auctionId` (`uuid`): Foreign key to `AuctionEntity` (`RESTRICT`).
* `buyerId` (`uuid`): Foreign key to `UserEntity`.
* `priceAtBid` (`decimal`): Price the buyer accepted.
* `quantityWon` (`decimal`): Lot size matching `quantityOnOffer`.
* `status` (`enum`): `ACCEPTED`, `CANCELLED`.

---

## API Endpoints & RBAC Gates

| Method | Endpoint | Required Permission | Input DTO | Output / Response |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/v1/auctions` | *None (Public)* | Query filters | `PaginatedResult<AuctionEntity>` |
| **GET** | `/v1/auctions/my-bids` | `bid:read` | None | `BidEntity[]` (buyer bids) |
| **GET** | `/v1/auctions/:id` | *None (Public)* | None | `AuctionEntity` |
| **POST** | `/v1/auctions` | `auction:create` | `CreateAuctionDto` | `AuctionEntity` |
| **PATCH** | `/v1/auctions/:id` | `auction:update` | `UpdateAuctionDto` | `AuctionEntity` (SCHEDULED only) |
| **POST** | `/v1/auctions/:id/cancel` | `auction:update` | None | `AuctionEntity` |
| **POST** | `/v1/auctions/:id/bids` | `bid:create` | None | `BidEntity` (buy lot) |
| **GET** | `/v1/auctions/:id/bids` | `bid:read:all` | None | `BidEntity[]` (admin view) |
