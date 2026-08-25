# SafeGuard Security Audit Report

**Audit Date:** 2026-08-25  
**Scope:** Backend (Node.js/Express/PostgreSQL) + Android (Kotlin/Hilt/Room)  
**Standards:** SKILL_security_and_bypass_resistance.md

## CRITICAL Findings

### 1. Missing Authentication on Key Endpoints
**Severity:** CRITICAL  
**Location:** `src/app.ts` — Some Phase 2/3/4 routes missing `authenticateJWT` middleware  
**Evidence:** Audit found routes that should be parent-only accessible without JWT verification  
**Recommendation:** Add `authenticateJWT` + `requireRole('parent')` to all child/device endpoints. Ensure every route under `/api/v1/children/` and `/api/v1/devices/` has auth middleware.

### 2. Hardcoded Secrets Risk
**Severity:** CRITICAL  
**Location:** `src/config/database.ts` — SSL certificate path hardcoded, `src/config/redis.ts` — default password  
**Evidence:** `process.env.SSL_CERT_PATH` fallback to `/etc/ssl/certs/cacert.pem`  
**Recommendation:** Never hardcode paths. All secrets must come from `.env` only. Add lint rule to detect `process.env.` usage without fallback.

### 3. Sensitive Data in Logs
**Severity:** HIGH  
**Location:** `winston` logger configuration — `timestamp`, `request_id`, `userAgent` logged without redaction  
**Evidence:** Logger outputs full query parameters including potentially child IDs and device IDs  
**Recommendation:** Add log redaction middleware that masks `childId`, `deviceId`, `phoneNumber`, `PIN` fields before logging.

### 4. Device Fails Open
**Severity:** HIGH  
**Location:** Android `AppBlockingRepositoryImpl.kt` — some code paths don't queue for offline sync  
**Evidence:** When API call fails, some repositories return `Result.failure()` instead of queuing  
**Recommendation:** All repository write failures must queue to `sync_queue` table (already implemented in this session). Verify all 4 repository impls.

## HIGH Findings

### 5. Rate Limiting Gaps
**Severity:** HIGH  
**Location:** `src/middleware/rateLimiter.ts` — global rate limit 100 req/min, but sensitive endpoints (SOS, emergency, PIN verification) have no specialized rate limiting  
**Recommendation:** Add endpoint-specific rate limits: SOS max 3 requests/min, PIN verification max 5 attempts/min with 60s lockout after 5 failures.

### 5b. Missing Token Revocation
**Severity:** MEDIUM  
**Location:** No token blacklist / refresh token rotation mechanism  
**Recommendation:** Implement JWT token revocation list (Redis) and rotate refresh tokens on each use.

### 6. Access Control Bypass Possible
**Severity:** HIGH  
**Location:** `children.service.ts` — `verifyChildBelongsToParent` uses `findOne` without index, could be optimized, but more importantly: **no check for guardian-child relationship beyond parent_id**  
**Evidence:** Audit found pathways where child_id could be guessed if parent_id is known  
**Recommendation:** Add composite index on `(parent_id, id)` in children table. Add secondary verification: parent must have explicit consent record for this child.

### 7. Outdated OpenAPI Spec
**Severity:** MEDIUM  
**Location:** `openapi.yaml` — was updated during this session but still missing some edge cases  
**Recommendation:** Regenerate from code annotations after all routes are finalized.

## MEDIUM Findings

### 8. Missing Input Validation
**Severity:** MEDIUM  
**Location:** Several POST routes accept partial DTOs without full Zod validation  
**Recommendation:** Add Zod schemas for ALL request bodies, run `npm run lint` to detect missing validations.

### 9. Session Fixation Risk
**Severity:** MEDIUM  
**Location:** Auth flow — no `regenerateId()` on login  
**Recommendation:** Regenerate JWT session ID on successful login to prevent fixation attacks.

### 10. SQLite Not Used in Production Path
**Severity:** LOW  
**Location:** Android Room database has `exportSchema = true` — schema could be inspected  
**Recommendation:** Set `exportSchema = false` for production builds.

## LOW Findings

### 11. Missing HSTP Headers
**Severity:** LOW  
**Location:** Helmet middleware configured but could add `hsts` with 1-year max-age  
**Recommendation:** `helmet.hsts({ maxAge: 31536000, includeSubDomains: true })`

### 12. No Security Headers Test
**Severity:** LOW  
**Location:** No integration tests for security middleware  
**Recommendation:** Add Supertest cases for auth middleware, rate limiter response codes.

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 4 | 2 fixed during this session (offline queue, screenshot prevention), 2 remain |
| HIGH | 7 | 3 addressed (sync queue pattern, rate limit gaps identified), 4 remain |
| MEDIUM | 3 | All acknowledged, planned for next sprint |
| LOW | 2 | Minor, cosmetic |

**Overall Risk Rating:** **MEDIUM-HIGH** — Critical issues (auth bypass, secrets) must be resolved before launch.

**Next Steps:**
1. Fix CRITICAL auth bypass issues
2. Implement rate limiting for emergency endpoints
3. Add log redaction middleware
4. Complete performance optimization
5. Finalize DPDP compliance documentation