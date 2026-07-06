# Backend — Authentication & Authorization

This document covers the authentication flow, token refresh mechanism, and permission-based Role-Based Access Control (RBAC) guard usage in `apps/api`.

---

## 1. Authentication Flow

Authentication uses JSON Web Tokens (JWT) with separate access and refresh tokens.

### Step 1: User Login
* **Endpoint**: `POST /v1/auth/login`
* **Controller**: `AuthController.login()`
* **Body**: `{ email, password }`
* **Response**: Returns access token (short-lived, 15 minutes) and sets refresh token in a secure, HTTP-only cookie.

### Step 2: Accessing Gated Endpoints
The client includes the access token in the request headers:
```http
Authorization: Bearer <access_token>
```
The request passes through `JwtAuthGuard` to verify validity.

### Step 3: Refreshing Tokens
When the access token expires (HTTP 401), the client requests a new pair:
* **Endpoint**: `POST /v1/auth/refresh`
* **Cookie**: Sends HTTP-only refresh token.
* **Response**: Returns a new access token and updates the refresh token cookie (refresh token rotation to prevent reuse).

### Step 4: Logout
* **Endpoint**: `POST /v1/auth/logout`
* Clears refresh token cookie and invalidates the session in the database.

---

## 2. JWT Payload Structure

The JWT access token decodes to the `AuthUser` / `JwtPayload` interface:
```typescript
export interface JwtPayload {
  sub: string;          // User ID (UUID)
  email: string;        // User email
  permissions: string[]; // List of permissions (flattened from user roles)
}
```

---

## 3. Guiding Gated Controllers

To gate endpoints, NestJS uses decorators on controllers or specific route handlers:

### Authenticated Route
Ensures the request has a valid JWT session.
```typescript
@Get('me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
getProfile(@CurrentUser() user: AuthUser) {
  return this.usersService.getProfile(user.id);
}
```

### RBAC Permission Gated Route
Ensures the request is authenticated AND the user possesses the required permission.
```typescript
@Post('harvests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.HARVEST_CREATE)
@ApiBearerAuth()
createHarvest(@CurrentUser() user: AuthUser, @Body() dto: CreateHarvestDto) {
  return this.productsService.createHarvest(user.id, dto);
}
```

> [!IMPORTANT]
> Always place `@RequirePermissions(...)` alongside `@UseGuards(JwtAuthGuard, PermissionsGuard)`. Without `PermissionsGuard` registered, the permission list will not be evaluated.
