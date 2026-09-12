import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '@futurefarm/types';
import {
  PERMISSIONS_KEY,
  REQUIRE_ANY_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  function createMockContext(user?: any): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access if no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user is not attached to request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return [Permission.HARVEST_CREATE];
      return undefined;
    });
    const context = createMockContext(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  describe('RequirePermissions (AND logic)', () => {
    it('should throw ForbiddenException if user lacks any required permission', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === PERMISSIONS_KEY)
          return [Permission.HARVEST_CREATE, Permission.HARVEST_VERIFY];
        return undefined;
      });
      const context = createMockContext({
        permissions: [Permission.HARVEST_CREATE],
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow access if user has all required permissions', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === PERMISSIONS_KEY)
          return [Permission.HARVEST_CREATE, Permission.HARVEST_VERIFY];
        return undefined;
      });
      const context = createMockContext({
        permissions: [Permission.HARVEST_CREATE, Permission.HARVEST_VERIFY],
      });
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('RequireAnyPermissions (OR logic)', () => {
    it('should allow access if user has at least one of the alternative permissions', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === REQUIRE_ANY_PERMISSIONS_KEY)
          return [
            Permission.HARVEST_CREATE,
            Permission.FARMER_PROXY_HARVEST_MANAGE,
          ];
        return undefined;
      });
      const context = createMockContext({
        permissions: [Permission.FARMER_PROXY_HARVEST_MANAGE],
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException if user has none of the alternative permissions', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === REQUIRE_ANY_PERMISSIONS_KEY)
          return [
            Permission.HARVEST_CREATE,
            Permission.FARMER_PROXY_HARVEST_MANAGE,
          ];
        return undefined;
      });
      const context = createMockContext({
        permissions: [Permission.USER_READ],
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
