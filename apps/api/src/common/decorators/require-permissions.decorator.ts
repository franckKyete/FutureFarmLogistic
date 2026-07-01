import { SetMetadata } from '@nestjs/common';

import type { Permission } from '@futurefarm/types';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to declare the permissions required to access a route.
 *
 * @example
 * @RequirePermissions(Permission.USER_UPDATE)
 * @Patch(':id')
 * update(...) {}
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
