import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before all imports
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts) => {
    throw opts;
  }),
}));

vi.mock('../store/auth.store', () => ({
  authStore: {
    state: {
      isAuthenticated: false,
      user: null,
    },
  },
}));

vi.mock('@/features/shared/store/toast.store', () => ({
  addToast: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (get mocked versions)
// ---------------------------------------------------------------------------

import { redirect } from '@tanstack/react-router';
import { authStore } from '../store/auth.store';
import { findRoleHomepage, requireRole } from './role-guard';

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// findRoleHomepage
// ===========================================================================

describe('findRoleHomepage', () => {
  it('returns /admin/dashboard for Admin+Farmer (Admin priority)', () => {
    expect(findRoleHomepage(['Admin', 'Farmer'])).toBe('/admin/dashboard');
  });

  it('returns /farmer/dashboard for Farmer+Buyer (Farmer priority)', () => {
    expect(findRoleHomepage(['Farmer', 'Buyer'])).toBe('/farmer/dashboard');
  });

  it('returns /marketplace for Buyer only', () => {
    expect(findRoleHomepage(['Buyer'])).toBe('/marketplace');
  });

  it('returns /marketplace for unrecognized role (User)', () => {
    expect(findRoleHomepage(['User'])).toBe('/marketplace');
  });

  it('returns /marketplace for empty roles array', () => {
    expect(findRoleHomepage([])).toBe('/marketplace');
  });

  it('returns /marketplace for non-existent role', () => {
    expect(findRoleHomepage(['NonExistentRole'])).toBe('/marketplace');
  });
});

// ===========================================================================
// requireRole
// ===========================================================================

describe('requireRole', () => {
  it('allows access when user has matching role', () => {
    (authStore as any).state = {
      isAuthenticated: true,
      user: { roles: ['Farmer'] },
    };

    expect(() => requireRole(['Farmer'])).not.toThrow();
  });

  it('redirects when user lacks matching role', () => {
    (authStore as any).state = {
      isAuthenticated: true,
      user: { roles: ['Admin'] },
    };

    expect(() => requireRole(['Farmer'])).toThrow();
    expect(redirect).toHaveBeenCalledWith({ to: '/admin/dashboard' });
  });

  it('allows access when user has any matching role (multi-role)', () => {
    (authStore as any).state = {
      isAuthenticated: true,
      user: { roles: ['Farmer'] },
    };

    expect(() => requireRole(['Farmer', 'Admin'])).not.toThrow();
  });

  it('redirects to login when user is null', () => {
    (authStore as any).state = {
      isAuthenticated: true,
      user: null,
    };

    expect(() => requireRole(['Farmer'])).toThrow();
    expect(redirect).toHaveBeenCalledWith({ to: '/auth/login' });
  });

  it('redirects to login when not authenticated', () => {
    (authStore as any).state = {
      isAuthenticated: false,
      user: null,
    };

    expect(() => requireRole(['Farmer'])).toThrow();
    expect(redirect).toHaveBeenCalledWith({ to: '/auth/login' });
  });
});
