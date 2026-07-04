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
