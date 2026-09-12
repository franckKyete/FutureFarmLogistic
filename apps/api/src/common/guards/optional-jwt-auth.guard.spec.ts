import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  it('should return user if user is present without error', () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    const result = guard.handleRequest(null, mockUser);
    expect(result).toBe(mockUser);
  });

  it('should return undefined if user is false', () => {
    const result = guard.handleRequest(null, false);
    expect(result).toBeUndefined();
  });

  it('should return undefined if error is provided', () => {
    const result = guard.handleRequest(new Error('Unauthorized'), false);
    expect(result).toBeUndefined();
  });
});
