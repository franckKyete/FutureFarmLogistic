// =============================================================================
// Auction & Bidding Shared Types
// =============================================================================

export enum AuctionStatus {
  SCHEDULED = 'SCHEDULED',   // Created, start date in the future
  ACTIVE = 'ACTIVE',         // Active and accepting bids
  SOLD = 'SOLD',             // Bid placed and accepted
  EXPIRED = 'EXPIRED',       // End date reached or price hit reserve price without buyer
  CANCELLED = 'CANCELLED',   // Manually cancelled by farmer or admin
}

export enum BidStatus {
  ACCEPTED = 'ACCEPTED',     // Bid won
  CANCELLED = 'CANCELLED',   // Cancelled before close
}

export enum AuctionEvent {
  PRICE_TICK = 'auction:price_tick',
  AUCTION_SOLD = 'auction:sold',
  AUCTION_EXPIRED = 'auction:expired',
  AUCTION_CANCELLED = 'auction:cancelled',
}

export interface CreateAuctionDto {
  harvestId: string;
  startingPrice: number;
  reservePrice: number;
  priceDecrementAmount: number;
  priceDecrementIntervalMinutes: number;
  startAt: string; // ISO string
  endAt: string; // ISO string
  quantityOnOffer: number;
}

export interface UpdateAuctionDto {
  startingPrice?: number;
  reservePrice?: number;
  priceDecrementAmount?: number;
  priceDecrementIntervalMinutes?: number;
  startAt?: string; // ISO string
  endAt?: string; // ISO string
}

export interface PlaceBidDto {
  // Bid takes the whole lot, so no quantity/price fields are passed in the request body
}

export interface AuctionDto {
  id: string;
  harvestId: string;
  farmerProfileId: string;
  status: AuctionStatus;
  startingPrice: number;
  reservePrice: number;
  currentPrice: number;
  priceDecrementAmount: number;
  priceDecrementIntervalMinutes: number;
  nextDecrementAt: string;
  quantityOnOffer: number;
  startAt: string;
  endAt: string;
  soldAt: string | null;
  winnerId: string | null;
  winningBidId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BidDto {
  id: string;
  auctionId: string;
  buyerId: string;
  priceAtBid: number;
  quantityWon: number;
  status: BidStatus;
  createdAt: string;
}
