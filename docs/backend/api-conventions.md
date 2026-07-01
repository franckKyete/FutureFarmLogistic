# API Conventions

## URL Structure

```
https://api.futurefarm.io/v1/{resource}
https://api.futurefarm.io/v1/{resource}/{id}
https://api.futurefarm.io/v1/{resource}/{id}/{sub-resource}
```

- **Versioning**: URI prefix `/v1/` — explicit and simple
- **Resources**: plural nouns (`/users`, `/roles`, not `/user`, `/getUsers`)
- **IDs**: UUID (path param)
- **Pagination**: query params `?page=1&limit=20`
- **Filtering**: query params `?isActive=true`
- **Sorting**: query params `?sortBy=createdAt&order=DESC`

## Standard Response Shapes

### Success

```json
{
  "data": { ... }
}
```

### Paginated Success

```json
{
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Error

```json
{
  "statusCode": 422,
  "message": ["email must be an email"],
  "error": "Unprocessable Entity",
  "timestamp": "2026-06-20T10:00:00.000Z",
  "path": "/v1/auth/login"
}
```

## HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | OK (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request (validation) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (missing permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 500 | Internal Server Error |
