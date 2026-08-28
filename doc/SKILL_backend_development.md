# SKILL: Backend Development for Kavach Parental Control App

**Applies to:** Any AI model (Claude, GPT-4, Llama, Gemini, Mistral, etc.)
**Purpose:** Guide AI in generating consistent, production-quality backend code
**How to use:** Paste this entire file as context/system prompt before requesting backend code generation

---

## 1. PROJECT CONTEXT

You are helping build the backend for **Kavach**, a parental control app. The backend serves an Android app and a React web dashboard, handling 24 features across 5 development phases.

---

## 2. TECHNICAL STANDARDS (NON-NEGOTIABLE)

- **Runtime:** Node.js 18+ with TypeScript (preferred) OR Python 3.10+ with Django/DRF — pick ONE and stay consistent across the whole project
- **Framework:** Express.js (Node) or Django REST Framework (Python)
- **Database:** PostgreSQL 14+ (primary), Redis (cache/sessions), MongoDB (logs only, optional)
- **API Style:** REST, versioned (`/api/v1/...`)
- **Auth:** JWT (access token 15min expiry) + refresh token (7 day expiry, stored hashed in DB)
- **Validation:** All input validated at the route/controller layer before hitting service layer (use `joi`/`zod` for Node, `serializers` for DRF)

### Project Structure (Node.js/Express example — mirror this for Python)
```
src/
├── config/              -> env config, db config
├── middleware/           -> auth, error handling, rate limiting, logging
├── routes/{feature}/     -> route definitions
├── controllers/{feature}/-> request/response handling only
├── services/{feature}/   -> business logic (no HTTP concerns here)
├── repositories/{feature}/-> DB queries only
├── models/                -> DB models/schemas
├── dto/                   -> request/response type definitions
├── utils/
├── jobs/                  -> background jobs (BullMQ/Celery)
└── app.ts / server.ts
```

### Naming Conventions
- Routes: `{feature}.routes.ts`
- Controllers: `{feature}.controller.ts`
- Services: `{feature}.service.ts`
- Repositories: `{feature}.repository.ts`
- Models: `{Feature}.model.ts`

---

## 3. MANDATORY CODE PATTERNS

### Every Route Must:
1. Have authentication middleware (`authenticateJWT`) unless explicitly public (login/register)
2. Have input validation middleware before the controller
3. Have rate limiting on sensitive endpoints (auth, SOS, password reset)

### Every Controller Must:
1. Only handle HTTP concerns (parse request, call service, format response)
2. Never contain business logic or direct DB queries
3. Use a consistent response wrapper:
```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "ISO8601",
  "request_id": "uuid"
}
```

### Every Service Must:
1. Contain all business logic
2. Be framework-agnostic (no `req`/`res` objects passed in)
3. Throw typed errors (e.g., `NotFoundError`, `ValidationError`) that middleware translates to HTTP codes

### Every Repository Must:
1. Only contain DB queries (no business logic)
2. Use parameterized queries ALWAYS (never string concatenation — prevents SQL injection)
3. Return typed results

### Every Endpoint Must:
1. Have error handling that never leaks stack traces to the client in production
2. Log errors server-side with request context
3. Return appropriate HTTP status codes (200, 201, 400, 401, 403, 404, 409, 422, 500)

---

## 4. SECURITY REQUIREMENTS (APPLY TO ALL GENERATED CODE)

1. **Passwords:** bcrypt with cost factor 12, never store plaintext
2. **PINs:** Encrypted at rest (AES-256), never logged
3. **SQL Injection:** Always use parameterized queries / ORM — never raw string interpolation
4. **Rate Limiting:** Apply to `/auth/*`, `/emergency/*` (stricter limits on auth endpoints — 5 attempts/15min)
5. **CORS:** Whitelist only known frontend domains, never `*` in production
6. **Secrets:** Environment variables only, never committed to git (`.env` in `.gitignore`)
7. **Location Data:** Encrypt at rest, auto-purge after retention period (configurable, default 90 days)
8. **Child Data (DPDP Act):** Explicit parental consent required before any data collection endpoint is used; every write to child data tables must log to `audit_logs`

---

## 5. FEATURE-SPECIFIC GUIDANCE

| Feature | Key Backend Considerations |
|---|---|
| App Blocking | Sync endpoint must be idempotent (device may retry); support bulk block/unblock |
| Screen Time | Batch ingestion endpoint (device uploads in batches, not per-second) to reduce load |
| Location Tracking | Rate-limit ingestion (max 1 update per 5-10 sec per device); use PostGIS extension for geofence queries |
| Cyberbullying Detection | ML inference should be async (queue job), not blocking the request |
| Emergency SOS | Must bypass normal rate limits; must have redundant notification channels (push + SMS) |
| Mental Health Data | Highest sensitivity — separate encryption keys, restricted access, audit every read |
| Multi-device Support | All queries must be scoped by `parent_id` to prevent cross-account data leaks |
| Analytics/Reports | Use read replicas or materialized views for heavy aggregation queries — don't hit primary DB |

---

## 6. WHAT NOT TO DO

- ❌ Do not put business logic in route handlers/controllers
- ❌ Do not use `SELECT *` in production queries — always specify columns
- ❌ Do not return raw DB errors to the client
- ❌ Do not skip pagination on list endpoints (default limit 20, max 100)
- ❌ Do not use synchronous/blocking operations in the request path (e.g., ML inference, email sending — always queue these)
- ❌ Do not trust `child_id`/`device_id` from the request body without verifying it belongs to the authenticated parent

---

## 7. OUTPUT FORMAT EXPECTATIONS

When asked to generate a feature's backend, always output in this order:
1. Database model/schema (SQL or ORM model)
2. DTO/validation schema (request + response types)
3. Repository (DB queries)
4. Service (business logic)
5. Controller (HTTP handling)
6. Routes (with middleware chain)
7. Unit test stubs

Always state which HTTP status codes each endpoint can return and why.

---

## 8. VALIDATION CHECKLIST (Before Accepting Generated Code)

- [ ] All routes have auth middleware (unless intentionally public)
- [ ] All inputs validated before reaching service layer
- [ ] All DB queries parameterized
- [ ] Consistent response format used
- [ ] Errors logged but not leaked to client
- [ ] Sensitive fields (PIN, tokens, location) never appear in logs
- [ ] Pagination included on list endpoints
- [ ] Rate limiting applied where appropriate
