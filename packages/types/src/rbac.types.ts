// =============================================================================
// RBAC — Permissions & Roles
// =============================================================================

/**
 * All system permissions.
 * Format: RESOURCE_ACTION
 *
 * This enum is the single source of truth for what actions are gate-kept.
 * Roles are simply named collections of these permissions.
 * Add new permissions here as new business modules are introduced.
 */
export enum Permission {
  // --- User management ---
  USER_READ = 'user:read',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // --- Role management ---
  ROLE_READ = 'role:read',
  ROLE_CREATE = 'role:create',
  ROLE_UPDATE = 'role:update',
  ROLE_DELETE = 'role:delete',
  ROLE_ASSIGN = 'role:assign',

  // --- Example resource (remove when adding real business modules) ---
  EXAMPLE_READ = 'example:read',
  EXAMPLE_CREATE = 'example:create',
  EXAMPLE_UPDATE = 'example:update',
  EXAMPLE_DELETE = 'example:delete',

  // --- Notifications ---
  NOTIFICATION_READ = 'notification:read',
  NOTIFICATION_SEND = 'notification:send',
  NOTIFICATION_BROADCAST = 'notification:broadcast',
  NOTIFICATION_DELETE_OWN = 'notification:delete:own',
  NOTIFICATION_ADMIN = 'notification:admin',

  // --- User / Profile / Parcel Management ---
  USER_VALIDATE = 'user:validate',
  PARCEL_CREATE = 'parcel:create',
  PARCEL_VERIFY = 'parcel:verify',
  PROFILE_UPDATE = 'profile:update',
  SESSION_MANAGE = 'session:manage',

  // --- Product Crop Templates ---
  PRODUCT_CREATE = 'product:create',
  PRODUCT_READ = 'product:read',
  PRODUCT_UPDATE = 'product:update',
  PRODUCT_DELETE = 'product:delete',
  PRODUCT_VERIFY = 'product:verify',

  // --- Physical Harvest Batches ---
  HARVEST_CREATE = 'harvest:create',
  HARVEST_READ = 'harvest:read',
  HARVEST_READ_ALL = 'harvest:read:all',
  HARVEST_UPDATE = 'harvest:update',
  HARVEST_DELETE = 'harvest:delete',
  HARVEST_VERIFY = 'harvest:verify',

  // --- Quality Inspection ---
  INSPECTION_CREATE = 'inspection:create',
  INSPECTION_READ = 'inspection:read',
  INSPECTION_READ_ALL = 'inspection:read:all',
  INSPECTION_UPDATE = 'inspection:update',
  INSPECTION_DELETE = 'inspection:delete',

  // --- Inspector Profile ---
  INSPECTOR_PROFILE_READ = 'inspector:profile:read',
  INSPECTOR_PROFILE_UPDATE = 'inspector:profile:update',

  // --- Auctions ---
  AUCTION_CREATE = 'auction:create',
  AUCTION_UPDATE = 'auction:update',
  AUCTION_MANAGE = 'auction:manage',
  AUCTION_READ = 'auction:read',

  // --- Bids ---
  BID_CREATE = 'bid:create',
  BID_READ = 'bid:read',
  BID_READ_ALL = 'bid:read:all',
  BID_CANCEL = 'bid:cancel',

  // --- Basket ---
  BASKET_MANAGE = 'basket:manage',

  // --- Orders ---
  ORDER_CREATE = 'order:create',
  ORDER_READ = 'order:read',
  ORDER_READ_ALL = 'order:read:all',
  ORDER_READ_SELLER = 'order:read:seller',
  ORDER_CONFIRM = 'order:confirm',
  ORDER_REJECT = 'order:reject',
  ORDER_SHIP = 'order:ship',
  ORDER_DELIVER = 'order:deliver',
  ORDER_CANCEL = 'order:cancel',
  ORDER_CANCEL_FORCE = 'order:cancel:force',
  ORDER_REFUND = 'order:refund',
  ORDER_FEE_OVERRIDE = 'order:fee:override',

  // --- Logistics ---
  DELIVERY_RUN_CREATE   = 'delivery:run:create',
  DELIVERY_RUN_READ     = 'delivery:run:read',
  DELIVERY_RUN_READ_ALL = 'delivery:run:read:all',
  DELIVERY_RUN_UPDATE   = 'delivery:run:update',
  DELIVERY_RUN_CANCEL   = 'delivery:run:cancel',
  DELIVERY_STOP_UPDATE  = 'delivery:stop:update',
  VEHICLE_CREATE        = 'vehicle:create',
  VEHICLE_READ          = 'vehicle:read',
  VEHICLE_UPDATE        = 'vehicle:update',
  VEHICLE_DELETE        = 'vehicle:delete',
  DRIVER_LOCATION_PUSH  = 'driver:location:push',
  DRIVER_LOCATION_READ  = 'driver:location:read',
}

/** A role is a named bundle of permissions */
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

/** Lightweight user representation (embedded in JWT payload and API responses) */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: Permission[];
  roles: string[];
}

/** JWT token payload */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  permissions: Permission[];
  iat?: number;
  exp?: number;
}

/** Auth token pair returned on login / refresh */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
