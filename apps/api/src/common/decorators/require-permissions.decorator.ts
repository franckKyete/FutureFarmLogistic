import { SetMetadata } from '@nestjs/common';

import type { Permission } from '@futurefarm/types';

export const PERMISSIONS_KEY = 'permissions';
export const REQUIRE_ANY_PERMISSIONS_KEY = 'require_any_permissions';

/**
 * Decorator to declare the permissions required to access a route.
 * User must have ALL specified permissions (AND logic).
 *
 * @example
 * @RequirePermissions(Permission.USER_UPDATE)
 * @Patch(':id')
 * update(...) {}
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to declare alternative permissions to access a route.
 * User must have AT LEAST ONE of the specified permissions (OR logic).
 *
 * @example
 * @RequireAnyPermissions(Permission.HARVEST_CREATE, Permission.FARMER_PROXY_HARVEST_MANAGE)
 * @Post('ai-classify')
 * classify(...) {}
 */
export const RequireAnyPermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSIONS_KEY, permissions);
