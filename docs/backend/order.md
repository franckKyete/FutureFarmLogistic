# Purchase & Order (Achat et Commande)

The Purchase & Order module manages the transactional checkout flow for agricultural harvests, including a transient buyer shopping cart (basket), order state transitions, multi-farmer line confirmation lifecycles, cancellation fees, and won auction lots.

## Features

- **Active Basket**: Buyers can curate crop quantities across multiple farmer harvests.
- **Stock Guardrail**: Basket quantity updates check against `quantityInStock - stockMarge` (effective stock) to prevent over-purchasing.
- **Dynamic Decay Checkout**: Basket checkout locks relevant harvest rows in a `SERIALIZABLE` transaction, deducts stock, resolves the time-decayed price dynamically, and starts a payment session.
- **Granular Farmer Review**: Farmers confirm or reject their specific order items (`OrderLine`). If rejected, individual item amounts are refunded, and stock is replenished.
- **Order State Machine**:
  - `PENDING_PAYMENT` ──(paid)──► `AWAITING_CONFIRMATION`
  - `AWAITING_CONFIRMATION` ──(farmer review)──► `CONFIRMED` / `CANCELLED` (if all lines rejected)
  - `CONFIRMED` ──(shipped)──► `SHIPPED`
  - `SHIPPED` ──(delivered)──► `DELIVERED`
  - Any of the first three states ──(buyer cancel)──► `CANCELLED`
- **Cancellation Fee**: Gated by a 10% fee if the buyer cancels an already `CONFIRMED` order. Fees can be manually adjusted/waived by administrators.
- **Auction Won Integration**: Dutch auctions create pre-confirmed orders and payment records atomically upon winning bids.
- **Pluggable Payments**: Decoupled using a `PaymentGatewayPort` interface, allowing hot-swappable external payment gateways (e.g. Stripe, CinetPay).

---

## DB Entity Schema

### `baskets`
- `id` (uuid, PK)
- `buyer_id` (uuid, FK → `users`) - Unique active basket constraint.
- `status` (varchar) - `ACTIVE` or `ABANDONED`.

### `basket_lines`
- `id` (uuid, PK)
- `basket_id` (uuid, FK → `baskets`)
- `harvest_id` (uuid, FK → `harvests`)
- `quantity` (decimal)

### `orders`
- `id` (uuid, PK)
- `buyer_id` (uuid, FK → `users`)
- `status` (enum) - `OrderStatus`
- `payment_status` (enum) - `PaymentStatus`
- `total_amount` (decimal)
- `cancellation_fee` (decimal)
- `delivery_address` (jsonb)
- `notes` (text)
- `cancelled_reason` (text)
- `auction_bid_id` (uuid, FK → `bids`, nullable)

### `order_lines`
- `id` (uuid, PK)
- `order_id` (uuid, FK → `orders`)
- `harvest_id` (uuid, FK → `harvests`)
- `farmer_profile_id` (uuid, FK → `farmer_profiles`)
- `quantity` (decimal)
- `unit_price` (decimal)
- `total_price` (decimal)
- `status` (enum) - `OrderLineStatus`
- `rejection_reason` (text, nullable)

### `payment_records`
- `id` (uuid, PK)
- `order_id` (uuid, FK → `orders`)
- `gateway_ref` (varchar)
- `amount` (decimal)
- `status` (enum) - `PaymentStatus`
- `metadata` (jsonb)

---

## Permissions & RBAC

### Basket permissions
- `basket:manage` (buyer)

### Order permissions
- `order:create` (buyer)
- `order:read` (buyer/seller/admin)
- `order:read:seller` (farmer)
- `order:read:all` (admin)
- `order:confirm` (farmer)
- `order:reject` (farmer)
- `order:ship` (farmer)
- `order:deliver` (farmer)
- `order:cancel` (buyer)
- `order:cancel:force` (admin)
- `order:refund` (admin)
- `order:fee:override` (admin)

---

## REST API Endpoints

### Basket Operations
- `GET /v1/basket` - Retrieve/create current active basket.
- `POST /v1/basket/lines` - Add line to basket.
- `PATCH /v1/basket/lines/:lineId` - Update quantity.
- `DELETE /v1/basket/lines/:lineId` - Remove line.
- `POST /v1/basket/checkout` - Convert active basket to order.

### Order Operations
- `GET /v1/orders` - Buyer lists their placed orders.
- `GET /v1/orders/seller` - Farmer lists order lines matching their harvest profiles.
- `GET /v1/orders/all` - Admin lists all orders (paginated).
- `GET /v1/orders/:id` - Fetch secure order details.
- `POST /v1/orders/payments/confirm?paymentRef=REF` - Confirm payment trigger (simulates gateway callback).
- `POST /v1/orders/:id/confirm-line/:lineId` - Farmer confirms item.
- `POST /v1/orders/:id/reject-line/:lineId` - Farmer rejects item (with reason).
- `POST /v1/orders/:id/ship` - Farmer marks confirmed lines as shipped.
- `POST /v1/orders/:id/deliver` - Farmer marks shipped lines as delivered.
- `POST /v1/orders/:id/cancel` - Buyer cancels order (applies 10% fee if status is `CONFIRMED`).
- `POST /v1/orders/:id/cancel-force` - Admin forces cancellation (full refund).
- `POST /v1/orders/:id/refund` - Admin manual refund trigger.
- `POST /v1/orders/:id/override-fee` - Admin waives/updates fee.
