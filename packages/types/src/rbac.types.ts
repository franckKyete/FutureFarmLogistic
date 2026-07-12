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

  // --- Inspector Profile ---
  INSPECTOR_PROFILE_READ = 'inspector:profile:read',
  INSPECTOR_PROFILE_UPDATE = 'inspector:profile:update',

  // --- Auctions ---
  AUCTION_CREATE = 'auction:create',
  AUCTION_UPDATE = 'auction:update',
  AUCTION_MANAGE = 'auction:manage',

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

  // --- Assisted Farmer & Inspection Center Permissions ---
  FARMER_PROXY_CREATE           = 'farmer:proxy:create',
  FARMER_PROXY_UPDATE           = 'farmer:proxy:update',
  FARMER_PROXY_HARVEST_MANAGE   = 'farmer:proxy:harvest:manage',
  FARMER_PROXY_AUCTION_MANAGE   = 'farmer:proxy:auction:manage',
  INSPECTION_CENTER_CREATE      = 'inspection:center:create',
  INSPECTION_CENTER_READ        = 'inspection:center:read',
  INSPECTION_CENTER_UPDATE      = 'inspection:center:update',
  INSPECTION_CENTER_DELETE      = 'inspection:center:delete',
  INSPECTION_CENTER_ASSIGN      = 'inspection:center:assign',

  // --- Visits / Planning ---
  VISIT_CREATE                  = 'visit:create',
  VISIT_READ                    = 'visit:read',
  VISIT_UPDATE                  = 'visit:update',
  VISIT_DELETE                  = 'visit:delete',

  // --- Dashboard ---
  DASHBOARD_READ                = 'dashboard:read',

  // --- Driver Profile ---
  DRIVER_PROFILE_READ           = 'driver:profile:read',
  DRIVER_PROFILE_UPDATE         = 'driver:profile:update',
  DRIVER_PROFILE_DELETE         = 'driver:profile:delete',

  // --- Example Module ---
  EXAMPLE_READ                  = 'example:read',
  EXAMPLE_CREATE                = 'example:create',
  EXAMPLE_UPDATE                = 'example:update',
  EXAMPLE_DELETE                = 'example:delete',

  // --- Disputes ---
  DISPUTE_READ                  = 'dispute:read',
  DISPUTE_CREATE                = 'dispute:create',
  DISPUTE_UPDATE                = 'dispute:update',
  DISPUTE_RESOLVE               = 'dispute:resolve',
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
