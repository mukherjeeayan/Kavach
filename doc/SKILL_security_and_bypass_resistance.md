# SKILL: Security & Bypass-Resistance for Kavach Parental Control App

**Applies to:** Any AI model (Claude, GPT-4, Llama, Gemini, Mistral, etc.)
**Purpose:** Ensure every generated feature considers tamper-resistance and security from the start
**How to use:** Apply this skill IN ADDITION to the Android/Backend skill files whenever generating any code that touches enforcement, authentication, or sensitive data

---

## 1. CORE PRINCIPLE

**Server-side authority, always.** The device is never the source of truth for what is blocked/allowed. It enforces what the server says, and reports tampering back to the server. Any generated code that makes the device itself authoritative for security decisions should be flagged as a bypass risk.

---

## 2. THREAT MODEL (What We're Defending Against)

1. **Child uninstalls the app** → Mitigation: Device Owner/Admin mode makes uninstall require admin credentials
2. **Child factory resets device** → Mitigation: Re-enrollment required at setup (Android Zero-Touch/Knox for managed devices), parent notified of factory reset via last-known-state timeout
3. **Child roots/jailbreaks device** → Mitigation: Root detection triggers lockdown + parent alert
4. **Child uses a second, unmonitored device** → Mitigation: Out of scope for on-device controls; addressed via parent education, not code
5. **Child disables internet to avoid sync** → Mitigation: Last-synced ruleset is cached locally and enforced offline; app fails "closed" (blocks stay blocked) not "open"
6. **Child attempts to kill/disable the monitoring service** → Mitigation: `START_STICKY` + `WorkManager` periodic restart + Device Admin restricting force-stop
7. **Child uses Developer Options / Safe Mode** → Mitigation: Detect Safe Mode boot, detect Developer Options enabled, alert parent
8. **Child uses a VPN to bypass web filtering** → Mitigation: VPN Service-based filtering takes priority slot; detect competing VPN apps and alert parent (cannot fully prevent VPN use without MDM-level control)

**IMPORTANT — Be Honest About Limits:** No consumer Android app achieves 100% bypass-proofing without full MDM enrollment (which requires enterprise/education device management, not a normal consumer install). Any generated documentation or marketing copy must not claim "100% unbypassable" — always describe it as "significantly bypass-resistant" and disclose known limitations to parents.

---

## 3. REQUIRED PATTERNS FOR ENFORCEMENT FEATURES

When generating code for App Blocking, Website Filtering, or Scheduled Locks:

1. Always check **both** local cache AND attempt server sync before making an enforcement decision
2. Always default to the **most restrictive** state if local cache is stale/missing (fail closed)
3. Always log enforcement actions (block/unblock events) to local DB for audit, sync to server when online
4. Always re-verify Device Admin / accessibility service status on every enforcement check — if permissions were revoked, alert parent immediately

---

## 4. REQUIRED PATTERNS FOR AUTHENTICATION FEATURES

When generating code for Parental Authentication:

1. PIN must be stored using `EncryptedSharedPreferences`, hashed with a salt — never plaintext, never reversibly encrypted for comparison (compare hashes)
2. Biometric prompt must have a PIN fallback (not the reverse)
3. Lock out after 5 failed PIN attempts for 60 seconds, exponential backoff after repeated failures
4. Any settings screen that changes enforcement rules must re-require authentication if the app has been backgrounded for >5 minutes

---

## 5. REQUIRED PATTERNS FOR TAMPER DETECTION

When generating tamper/root detection code:

1. Combine multiple signals — do not rely on a single check (file existence + `Build.TAGS` + `RootBeer`-style checks)
2. On detection, do three things in order: (a) log locally, (b) attempt immediate server notification, (c) apply local fallback lockdown (most restrictive ruleset) — do this even if step (b) fails due to no connectivity
3. Never expose the specific detection method in user-facing error messages (don't tell the child exactly what tripped the check — this helps them evade it next time)

---

## 6. DATA PROTECTION REQUIREMENTS

1. **Location data, communication logs, mental health data** = highest sensitivity tier
   - Encrypt at rest (AES-256) in both local Room DB and backend Postgres
   - Separate encryption keys per data tier (don't use one key for everything)
   - Auto-purge per configurable retention policy (default: 90 days rolling)
2. **PINs, tokens, biometric data** = never leave the device in raw form; biometric data never leaves the device at all (use Android's `BiometricPrompt`, which never exposes raw biometric data to the app)
3. **Every access to sensitive child data** (by parent, by support staff, by any admin tool) must write an entry to `audit_logs`

---

## 7. WHAT NOT TO DO

- ❌ Do not generate code that claims to guarantee "unbypassable" enforcement
- ❌ Do not generate code that stores the enforcement ruleset ONLY on the device (always sync-capable from server)
- ❌ Do not generate authentication code that falls back to a weaker method without explicit user/parent action
- ❌ Do not log sensitive detection internals in a way visible to the child user (e.g., don't show "Root detected via /system/xbin/su check failed" in any UI string)
- ❌ Do not build features that monitor content in a way that isn't disclosed to the parent in the privacy policy — every monitoring capability must map to a documented, consented data flow

---

## 8. VALIDATION CHECKLIST (Before Accepting Generated Security Code)

- [ ] Server is the source of truth; device enforces cached last-known state when offline
- [ ] Fails closed (restrictive), not open (permissive), when in doubt
- [ ] No plaintext secrets anywhere (code, logs, local storage)
- [ ] Multiple signals combined for tamper detection (not a single check)
- [ ] Sensitive data encrypted at rest with appropriate key separation
- [ ] No marketing/doc claims of "100% bypass-proof"
- [ ] All monitoring capabilities are traceable to a consented data flow in the privacy policy
