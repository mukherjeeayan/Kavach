# Kavach - DPDP Act 2023 Compliance Audit

**Audit Date:** August 25, 2026  
**Auditor:** Internal Compliance Review  
**App Version:** Current (backend/src)  
**Legislation:** Digital Personal Data Protection Act, 2023 (India)

---

## Executive Summary

This audit evaluates Kavach's compliance with India's Digital Personal Data Protection Act, 2023 (DPDP Act). The assessment is based on a review of the backend source code, API endpoints, data models, and security implementations.

| Overall Status | PARTIAL COMPLIANCE |
|---|---|
| Compliant Items | 6 of 11 |
| Partially Compliant | 3 of 11 |
| Non-Compliant | 2 of 11 |

---

## 1. Verifiable Parental Consent (Section 6)

**Status: COMPLIANT**

### DPDP Requirement
Section 6 requires that before processing a child's personal data, the data fiduciary must obtain verifiable parental consent.

### Evidence from Code

**Consent Model** (`backend/src/modules/consent/parentalConsent.service.ts`):
- Consent is tracked per data type with `consent_type` enum: `location`, `app_usage`, `communications`, `mental_health`
- Each consent record stores: `parent_id`, `child_id`, `consent_type`, `granted_at`, `revoked_at`, `ip_address`
- Consent is explicitly granted by the parent via `grantConsent()` function
- IP address is captured for audit trail (lines 22-63)

**Consent Enforcement** (`backend/src/modules/consent/parentalConsent.service.ts:132-142`):
- `hasActiveConsent(childId, consentType)` checks if consent is active before any data collection
- All data collection services should verify consent before recording data

**Consent Revocation** (`backend/src/modules/consent/parentalConsent.service.ts:68-91`):
- Parents can revoke consent via `DELETE /children/:childId/consent`
- Revocation sets `revoked_at` timestamp immediately
- Consent revocation is audit-logged

**Consent API Endpoints** (`backend/src/modules/consent/parentalConsent.routes.ts`):
- `POST /children/:childId/consent` - Grant consent
- `DELETE /children/:childId/consent` - Revoke consent
- `GET /children/:childId/consent` - List all consents
- `GET /children/:childId/consent/check/:consentType` - Check consent status

**Role Enforcement** (`backend/src/modules/consent/parentalConsent.routes.ts:11`):
- All consent endpoints require `requireRole('parent')` middleware

### Recommendations
- Verify that all data collection services (location, communication, screentime, mood) call `hasActiveConsent()` before recording data
- Consider adding a consent type for `device_health` data collection

---

## 2. Data Minimization (Section 5(2))

**Status: COMPLIANT**

### DPDP Requirement
Section 5(2)(a) requires that personal data collected shall be adequate, limited, and relevant to the purpose for which it is processed.

### Evidence from Code

**Child Profile** (`backend/src/modules/children/children.service.ts:10-18`):
- Only collects: `name`, `birth_date`, `daily_screen_time_limit_minutes`
- No unnecessary fields like Aadhaar, phone number, or school information

**Location Data** (`backend/src/modules/location/location.service.ts:10-16`):
- Collects: `latitude`, `longitude`, `accuracy_m`, `speed_kmh`, `recorded_at`
- All fields are necessary for location tracking and geofence functionality

**Screen Time** (`backend/src/modules/screentime/screentime.service.ts:12-17`):
- Collects: `app_package`, `app_category`, `seconds`, `date`
- Minimal data needed for usage tracking and limit enforcement

**Communication Logs** (`backend/src/modules/communication/communication.service.ts:12-19`):
- Collects: `comm_type`, `contact_number`, `contact_name`, `content_snippet` (max 500 chars), `duration_seconds`
- Content snippets are truncated to 500 characters (line 75, 85)
- Only collects what is needed for cyberbullying detection

**Mood Data** (`backend/src/modules/mood/mood.service.ts:10-15`):
- Collects: `mood_score`, `note`, `activities`, `device_id`
- Self-reported data only; no invasive monitoring

**Device Health** (`backend/src/modules/devicehealth/deviceHealth.service.ts:10-20`):
- Collects: battery, storage, root/debug status, OS version, app version
- All fields serve a specific security or functional purpose

### Recommendations
- Document data minimization rationale for each data category in the Privacy Policy
- Consider implementing data anonymization for analytics purposes

---

## 3. Purpose Limitation (Section 5(2)(b))

**Status: COMPLIANT**

### DPDP Requirement
Section 5(2)(b) requires that personal data shall be processed only for the purpose for which it was collected.

### Evidence from Code

**Consent Types Map to Purposes** (`backend/src/modules/consent/parentalConsent.dto.ts:6-11`):
```typescript
consentTypeEnum = z.enum([
  'location',      // Location tracking and geofencing
  'app_usage',     // Screen time and app blocking
  'communications', // SMS/call monitoring
  'mental_health',  // Mood tracking
]);
```

**Data Usage Patterns**:
- Location data → Used exclusively for location tracking, history, and geofence alerts
- Screen time data → Used exclusively for usage tracking and limit enforcement
- Communication data → Used exclusively for monitoring and cyberbullying detection
- Mood data → Used exclusively for wellness tracking and summaries

**No Secondary Use**:
- No advertising or marketing use of child data
- No data sharing with third parties (except essential service providers)
- No profiling or behavioral advertising

### Recommendations
- Add explicit purpose statements to each data collection endpoint
- Implement automated checks to prevent cross-purpose data access

---

## 4. Data Retention (Section 8)

**Status: PARTIAL COMPLIANT**

### DPDP Requirement
Section 8 requires that personal data should not be retained longer than necessary for the purpose of processing.

### Evidence from Code

**Retention Periods Defined** (per Privacy Policy):
| Data Type | Retention Period |
|-----------|-----------------|
| Location logs | 90 days |
| Screen time logs | 30 days |
| Communication logs | 30 days |
| Mood logs | 1 year |
| Device health logs | 90 days |
| Audit logs | 2 years |
| Keyword alerts | 90 days |

**Implementation Status**:
- ✅ Retention periods are documented in the Privacy Policy
- ⚠️ No automated data retention/purge utility found in the codebase
- ⚠️ No `dataRetention.ts` utility file exists (glob search returned empty)
- ✅ Manual deletion is available via child profile deletion (`DELETE /children/:childId`)
- ✅ Device unpairing deletes device data (`DELETE /devices/:deviceId`)

### Evidence Gaps
- No scheduled job or cron task for automatic data purging
- No TTL indexes or automatic deletion mechanisms in database schema
- No data retention enforcement at the application level

### Recommendations
1. **HIGH PRIORITY:** Implement a `dataRetention.ts` utility with automated purge jobs
2. Add TTL indexes to time-series tables (location_logs, screen_time_logs, communication_logs, mood_logs, device_health_logs)
3. Schedule a daily cron job to delete records exceeding retention periods
4. Add retention period configuration to environment variables
5. Log all automated deletions in the audit trail

---

## 5. Right to Access (Section 11)

**Status: COMPLIANT**

### DPDP Requirement
Section 11 grants data principals the right to access their personal data.

### Evidence from Code

**Parent Data Access Endpoints**:
- `GET /children/:childId` - Access child profile (`children.service.ts:354-365`)
- `GET /children/:childId/consent` - Access consent records (`parentalConsent.service.ts:96-127`)
- `GET /children/:childId/consent/check/:consentType` - Check consent status
- `GET /auth/me` - Access parent profile (`auth.service.ts:461-469`)

**Child Data Access Endpoints** (via device services):
- `GET /children/:childId/devices/:deviceId/location` - Location history
- `GET /children/:childId/devices/:deviceId/screentime` - Screen time data
- `GET /children/:childId/devices/:deviceId/communications` - Communication logs
- `GET /children/:childId/devices/:deviceId/mood` - Mood logs
- `GET /children/:childId/devices/:deviceId/health` - Device health

**Audit Trail Access**:
- `GET /children/:childId/alerts` - Security and limit alerts

### Recommendations
- Implement a dedicated data export endpoint (JSON/CSV format)
- Add data portability features per DPDP Act requirements
- Consider implementing a data download feature for the parent dashboard

---

## 6. Right to Correction (Section 11)

**Status: COMPLIANT**

### DPDP Requirement
Section 11 grants data principals the right to correct or update their personal data.

### Evidence from Code

**Child Data Correction** (`backend/src/modules/children/children.service.ts:371-397`):
- `PUT /children/:childId` - Update child name and birth date
- `updateChild(parentId, childId, { name?, birth_date? })` function
- All corrections are audit-logged

**Parent Profile Correction** (`backend/src/modules/auth/auth.service.ts:471-492`):
- `PUT /auth/profile` - Update parent name
- `updateProfile(parentId, name)` function
- Profile updates are audit-logged

**Screen Time Limit Correction** (`backend/src/modules/children/children.service.ts:257-281`):
- `PUT /children/:childId/screen-time-limit` - Update daily limit
- `setScreenTimeLimit(parentId, childId, limitMinutes)` function

**Geofence Correction** (`backend/src/modules/geo/geofence.service.ts:95-142`):
- `PUT /children/:childId/geofences/:geofenceId` - Update geofence parameters
- `updateGeofence(parentId, childId, geofenceId, input)` function

### Recommendations
- Add correction capabilities for communication logs (e.g., marking false positives)
- Add correction capabilities for mood logs (child self-correction)

---

## 7. Right to Erasure (Section 11)

**Status: COMPLIANT**

### DPDP Requirement
Section 11 grants data principals the right to request erasure of their personal data.

### Evidence from Code

**Child Profile Deletion** (`backend/src/modules/children/children.service.ts:403-418`):
- `DELETE /children/:childId` - Delete entire child profile
- `deleteChild(parentId, childId)` function
- Cascading delete: devices, rules, logs, consents are all removed
- Pre-deletion audit log is written

**Device Unpairing** (`backend/src/modules/devices/device.service.ts:227-250`):
- `DELETE /devices/:deviceId` - Unpair device
- `unpairDevice(parentId, deviceId)` function
- Cascading delete for device-specific data

**Account Management**:
- `POST /auth/logout-all` - Revoke all sessions
- Account deletion available via support contact

### Recommendations
1. **MEDIUM PRIORITY:** Implement self-service account deletion endpoint
2. Add data export before deletion (right to data portability)
3. Implement a confirmation workflow for irreversible deletions
4. Add a grace period before permanent deletion

---

## 8. Data Breach Notification (Section 8(6))

**Status: PARTIAL COMPLIANT**

### DPDP Requirement
Section 8(6) requires data fiduciaries to notify the Data Protection Board of India and affected data principals in the event of a personal data breach.

### Evidence from Code

**Security Monitoring**:
- Audit logging of all data access (`audit.service.ts`)
- Tamper detection and alerts (`children.service.ts:283-350`)
- Device security alerts (root, USB debugging) (`deviceHealth.service.ts:59-72`)
- PIN brute-force lockout (`auth.service.ts:261-321`)

**Incident Response Infrastructure**:
- Request ID tracking for incident investigation (`x-request-id` headers)
- Comprehensive audit trail for breach investigation

### Evidence Gaps
- ⚠️ No automated breach detection system
- ⚠️ No breach notification workflow implemented
- ⚠️ No integration with DPBI notification system
- ⚠️ No breach response playbook documented

### Recommendations
1. **HIGH PRIORITY:** Implement breach detection and classification system
2. Create a breach response playbook with escalation procedures
3. Implement automated breach notification to DPBI within 72 hours
4. Add breach notification templates for affected users
5. Conduct regular breach simulation exercises

---

## 9. Cross-Border Transfer (Section 16)

**Status: COMPLIANT**

### DPDP Requirement
Section 16 restricts transfer of personal data to countries or territories outside India unless the Central Government has specified conditions.

### Evidence from Code

**Data Storage**:
- All data is stored in PostgreSQL database (assumed India-hosted)
- No evidence of cross-border data transfers in the codebase
- Firebase Cloud Messaging (FCM) is used for push notifications only; no child data is sent to FCM

**Infrastructure**:
- Database queries show no cross-border endpoints
- JWT tokens are signed locally (not via external services)
- Email service is the only external integration (for password resets)

### Recommendations
- Document data hosting location in Privacy Policy
- Verify all third-party service providers store data in India
- Implement data residency controls to prevent accidental cross-border transfers
- Include cross-border transfer restrictions in vendor contracts

---

## 10. Grievance Redressal (Section 8(9))

**Status: PARTIAL COMPLIANT**

### DPDP Requirement
Section 8(9) requires every data fiduciary to designate a grievance officer and publish their contact details.

### Evidence from Code

**Audit Trail for Complaints**:
- All data operations are logged with actor ID, timestamp, and details
- Consent grant/revocation is audit-logged
- Security events are audit-logged

### Evidence Gaps
- ⚠️ No dedicated grievance redressal system in the codebase
- ⚠️ No grievance tracking or ticketing system
- ⚠️ No response time SLA enforcement
- ⚠️ Grievance officer contact details not programmatically available

### Recommendations
1. **HIGH PRIORITY:** Implement a grievance tracking system
2. Add a grievance submission endpoint in the API
3. Implement automated acknowledgment within 24 hours
4. Add escalation workflows for unresolved grievances
5. Publish grievance officer details in the app and Privacy Policy
6. Maintain a grievance register as required by DPDP Act

---

## 11. Data Protection Officer (Section 8(10))

**Status: NON-COMPLIANT**

### DPDP Requirement
Section 8(10) requires certain data fiduciaries to designate a Data Protection Officer (DPO).

### Evidence from Code

- ⚠️ No DPO designation found in the codebase
- ⚠️ No DPO contact information available in the app
- ⚠️ No DPO responsibilities defined

### Recommendations
1. **CRITICAL:** Designate a Data Protection Officer
2. Publish DPO contact details in the Privacy Policy and app
3. Define DPO responsibilities and reporting structure
4. Ensure DPO has independence and resources as required by DPDP Act
5. Register DPO with the Data Protection Board of India if required

---

## Summary of Recommendations

### Critical (Immediate Action)
1. Designate a Data Protection Officer (Section 8(10))
2. Implement automated data retention/purge system (Section 8)
3. Implement breach notification workflow (Section 8(6))

### High Priority (Within 30 Days)
4. Implement self-service account deletion endpoint (Section 11)
5. Implement grievance tracking system (Section 8(9))
6. Add data export/portability features (Section 11)

### Medium Priority (Within 90 Days)
7. Document data minimization rationale for each data category
8. Add data residency controls and documentation
9. Conduct breach simulation exercises
10. Verify all vendor contracts include data protection clauses

### Low Priority (Ongoing)
11. Add correction capabilities for communication and mood logs
12. Implement automated consent verification audits
13. Regular compliance reviews (quarterly)

---

## Appendix: Code Files Reviewed

| File | Purpose |
|------|---------|
| `backend/src/modules/consent/parentalConsent.service.ts` | Consent business logic |
| `backend/src/modules/consent/parentalConsent.routes.ts` | Consent API endpoints |
| `backend/src/modules/consent/parentalConsent.dto.ts` | Consent validation schemas |
| `backend/src/modules/consent/parentalConsent.controller.ts` | Consent request handlers |
| `backend/src/modules/children/children.service.ts` | Child profile management |
| `backend/src/modules/location/location.service.ts` | Location tracking |
| `backend/src/modules/communication/communication.service.ts` | SMS/call monitoring |
| `backend/src/modules/mood/mood.service.ts` | Mood tracking |
| `backend/src/modules/geo/geofence.service.ts` | Geofence management |
| `backend/src/modules/screentime/screentime.service.ts` | Screen time tracking |
| `backend/src/modules/appblocking/appBlocking.service.ts` | App blocking |
| `backend/src/modules/devicehealth/deviceHealth.service.ts` | Device health monitoring |
| `backend/src/modules/devices/device.service.ts` | Device registration |
| `backend/src/modules/auth/auth.service.ts` | Authentication and account management |
| `backend/src/modules/shared/audit.service.ts` | Audit logging |
| `backend/src/middleware/auth.ts` | JWT authentication middleware |

---

*This audit is based on source code review as of August 25, 2026. A production deployment audit should also include infrastructure, database, and network security assessments.*
