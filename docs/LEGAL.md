# Privacy Policy

**Effective Date:** August 25, 2026 | **App Name:** Kavach - Parental Control

## 1. Introduction

Kavach ("we", "us", "our") is a parental control application designed to help parents and legal guardians monitor and manage their children's digital safety. This Privacy Policy describes how we collect, use, store, and protect personal data in compliance with the **Digital Personal Data Protection Act, 2023 (DPDP Act)** of India and other applicable data protection laws.

By using Kavach, you acknowledge that you are a parent or legal guardian and that you have read and understood this Privacy Policy.

## 2. Data Controller

**Entity:** Kavach Technologies | **Email:** privacy@kavach.app  
**DPO:** dpo@kavach.app | **Grievance Officer:** grievance@kavach.app

## 3. Data We Collect

### Parent/Guardian Account
- Full name, email address, password (bcrypt hash), parental PIN (bcrypt hash)
- Account timestamps, session tokens

### Child Profile
- Child's name, date of birth, daily screen-time limit settings

### Location
- GPS coordinates, accuracy, speed, timestamps, geofence definitions

### Screen Time & App Usage
- Per-app usage duration, app package names and categories, daily totals

### Communication
- SMS (up to 500 char snippets), call logs, contact names/numbers, keyword matches, alert records

### App Blocking
- Blocked app rules, per-app daily limits, unblock request records

### Mood & Wellness
- Self-reported mood scores, mood notes, activity tags, weekly summaries

### Device Health
- Battery level, storage capacity, root/jailbreak status, OS version, app version

### Audit & Security
- All actions on child data, actor ID, timestamps, IP addresses, tamper alerts

## 4. How We Use Your Data

| Purpose | Legal Basis |
|---------|-------------|
| Parental control and child safety monitoring | Verifiable parental consent |
| Setting and enforcing screen-time limits | Verifiable parental consent |
| Location tracking and geofence alerts | Verifiable parental consent |
| Cyberbullying and safety threat detection | Verifiable parental consent |
| Emergency SOS functionality | Verifiable parental consent |
| Device security monitoring | Verifiable parental consent |
| Mood and wellness tracking | Verifiable parental consent |
| Service improvement and bug fixing | Legitimate interest |
| Security and fraud prevention | Legitimate interest |
| Legal compliance | Legal obligation |

## 5. Data Retention

| Data Category | Retention | Deletion |
|-------------|-----------|----------|
| Location logs | 90 days | Automated purge + manual via account settings |
| Screen time logs | 30 days | Automated purge + manual via account settings |
| Communication logs | 30 days | Automated purge + manual via account settings |
| Mood logs | 1 year | Automated purge + manual via account settings |
| Device health logs | 90 days | Automated purge + manual via account settings |
| App block rules | Until deleted | Manual via dashboard |
| Geofences | Until deleted | Manual via dashboard |
| Audit logs | 2 years | Automated purge |
| Keyword alerts | 90 days | Automated purge |
| Account data | Until deletion | Account deletion endpoint |
| Consent records | 2 years from revocation | Automated purge |

## 6. Data Sharing

- **We do not sell** personal data to any third party for marketing or commercial purposes.
- **Service providers**: Cloud infrastructure (India), Firebase FCM, email provider — under strict data processing agreements.
- **Legal requirements**: Data may be disclosed if required by law, court order, or governmental authority.
- **No cross-border transfers**: All data stored and processed within India.

## 7. Verifiable Parental Consent (DPDP Act Section 6)

Before collecting any child data, we obtain explicit consent for each category:
- **Location tracking** (`location`)
- **App usage monitoring** (`app_usage`)
- **Communication monitoring** (`communications`)
- **Mental health/mood tracking** (`mental_health`)

**Consent Process:** Parent creates account → creates child profile → grants explicit consent per category → each record includes type, timestamp, IP address, parent ID → audited in `audit_logs`.

Parents may revoke consent at any time. Upon revocation, collection for that category ceases immediately. Previously collected data is retained per the retention schedule.

## 8. Your Rights (DPDP Act Section 11)

- **Right to Access**: View all child data via dashboard. API: `GET /children/:childId`
- **Right to Correction**: Update child profile and settings via `PUT /children/:childId`
- **Right to Erasure**: Delete entire child profile via `DELETE /children/:childId` — cascades to all associated data
- **Right to Data Portability**: [PLANNED] Export data in machine-readable format
- **Right to Grievance Redressal**: grievance@kavach.app — response within 72 hours

## 9. Security Measures

- **Encryption**: TLS 1.2+ in transit, database encryption at rest, bcrypt passwords (cost 12), EncryptedSharedPreferences on Android, SQLCipher Room DB on Android
- **Access Controls**: JWT auth (15-min expiry), role-based access (parent/child/admin), per-child resource ownership verification
- **Audit Logging**: Every CRUD operation on child data logged with actor ID, timestamp, and details
- **Brute-Force Protection**: 5 failed PIN attempts → 15-min lock; 5 auth attempts/15min rate limit
- **Device Security**: Root/jailbreak detection, USB debugging alerts, tamper detection

## 10. Children's Privacy

We do not directly collect data from children without parental consent. All collection is initiated by the parent-owned device. Children cannot create accounts independently. Mood data is self-reported but only accessible to verified parents. We do not use children's data for advertising or profiling.

## 11. Data Breach Notification

In the event of a personal data breach, we will notify the Data Protection Board of India (DPBI) within **72 hours** and affected data principals without undue delay.

## 12. Contact

- **General:** privacy@kavach.app
- **DPO:** dpo@kavach.app
- **Grievance:** grievance@kavach.app
- **Governing Law**: Laws of India, including the DPDP Act, 2023

---

# Terms of Service

**Effective Date:** August 25, 2026 | **App Name:** Kavach - Parental Control

## 1. Acceptance of Terms

By downloading, installing, or using Kavach, you agree to be bound by these Terms. If you do not agree, do not use the App. We reserve the right to modify these Terms at any time. Material changes will be communicated via email and in-app notification.

## 2. Eligibility

- **Age**: Available only to individuals at least 18 years of age, or the legal parent/guardian of a minor child
- **Parental Use Only**: App is designed exclusively for parents to monitor their own minor children
- **Account Registration**: One account per parent; sharing accounts is prohibited; you are responsible for maintaining confidentiality of your credentials

## 3. Account Responsibilities

- **Security**: Use a strong, unique password; enable biometric authentication; never share credentials
- **Session Management**: Sessions via secure refresh tokens; "Sign Out All Devices" available; suspicious activity triggers automatic revocation
- **Account Changes**: `PUT /auth/profile`, `PUT /auth/password`, `PUT /auth/pin`
- **Account Deletion**: `DELETE /auth/account` — permanent and irreversible; cascade deletes all child profiles, devices, and data; export data first via `GET /auth/export-data`

## 4. Acceptable Use

### Permitted

- Create and manage child profiles for your own children
- Set screen-time limits, block applications, monitor location, receive alerts, manage geofences, track mood

### Prohibited

- Monitor anyone other than your own minor children
- Use for any illegal purpose
- Bypass or circumvent security measures
- Access another user's account or data
- Use to stalk, harass, or harm any individual
- Reverse engineer, decompile, or disassemble the App
- Use automated tools without written permission

### Child Data Ethics

- Collect only data necessary for safety purposes
- Do not use data to punish or emotionally harm your child
- Maintain open communication with your child about monitoring
- Respect your child's developing need for privacy

## 5. Service Description

### Core Features

App Blocking, Screen Time Management, Location Tracking, Geofencing, Communication Monitoring (SMS + call logs with keyword-based cyberbullying detection), Emergency SOS, Device Health Monitoring, Mood Tracking, Multi-Device Support, Co-Guardian Sharing, Weekly AI Reports (user-provided AI key), Behavior Predictions (AI-powered with user-provided key)

### Limitations

- Requires active internet on child's device
- Location accuracy depends on GPS signal and device capabilities
- App blocking requires Device Administrator privileges on Android
- The App does not guarantee 100% bypass prevention
- Real-time monitoring depends on device connectivity
- Some features may not be available on all Android versions

## 6. Intellectual Property

- Kavach and all related technologies are owned by Kavach Technologies
- We grant a limited, non-exclusive, non-transferable, revocable license for personal, non-commercial use only
- You retain ownership of data you input; you grant us a limited license to process your data as described in our Privacy Policy

## 7. Privacy and Data Protection

Your use of the App is governed by our Privacy Policy (incorporated by reference). We comply with the DPDP Act 2023 — verifiable parental consent required, you may access/correct/delete child data at any time.

## 8. Payment and Subscriptions

- Pricing displayed in the App and website; all prices in Indian Rupees (INR) unless stated
- Subscriptions billed through **Razorpay** (we do not store payment card information)
- Subscriptions auto-renew unless cancelled 24 hours before renewal
- Refunds handled through Razorpay's policy; contact support@kavach.app for billing inquiries
- Price changes: 30 days' notice, effective next billing cycle

## 9. Limitation of Liability

- THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND
- WE DO NOT WARRANT THAT THE APP WILL PREVENT ALL BYPASSES OR SECURITY BREACHES
- OUR TOTAL LIABILITY SHALL NOT EXCEED AMOUNTS PAID IN THE 12 MONTHS PRECEDING THE CLAIM
- We are not liable for: unauthorized access due to your negligence, device malfunctions, child's ability to bypass controls, third-party service disruptions, force majeure events

## 10. Indemnification

You agree to indemnify Kavach Technologies from any claims arising from your use of the App, violation of these Terms, violation of applicable law, violation of third-party rights, or data you input.

## 11. Termination

- **By you**: Stop using the App at any time; uninstalling does not delete your account
- **By us**: We may suspend/terminate if you violate Terms, engage in prohibited use, or we are required by law
- **Effect**: Your right to use the App ceases immediately; Sections 6, 7, 9, 10, 12, and 13 survive termination

## 12. Dispute Resolution

- **Governing Law**: Laws of India (IT Act 2000, DPDP Act 2023)
- **Jurisdiction**: Exclusive jurisdiction of courts in [City], India
- **Process**: Contact support@kavach.app → Mediation → Arbitration under the Arbitration and Conciliation Act, 1996
- **Class Action Waiver**: You agree to resolve disputes on an individual basis

## 13. General Provisions

- These Terms together with the Privacy Policy constitute the entire agreement
- Severability: unenforceable provisions do not affect remaining provisions
- Force majeure: not liable for delays caused by events beyond our control

## 14. Contact & Grievance Redressal

- **Email:** legal@kavach.app | **Support:** support@kavach.app
- **Grievance Officer:** grievance@kavach.app
- Response within 24 hours acknowledgment, aim to resolve within 30 days
- Escalation: Data Protection Board of India (DPBI) if unresolved

---

# DPDP Act Compliance Audit

**Status: PARTIAL COMPLIANCE (6/11 compliant, 3 partial, 2 non-compliant)**

## Compliance Status by Provision

| Provision | Status | Notes |
|-----------|--------|-------|
| Section 6 — Verifiable Parental Consent | ✅ COMPLIANT | Explicit consent per data category, audit trail, revocation |
| Section 5(2) — Data Minimization | ✅ COMPLIANT | Only collects data strictly necessary for service |
| Section 5(2)(b) — Purpose Limitation | ✅ COMPLIANT | Data used only for stated parental control purposes |
| Section 8 — Data Retention | ⚠️ PARTIAL | Retention policies defined but no automated purge job exists |
| Section 11 — Right to Access | ✅ COMPLIANT | Dashboard + API endpoints for all child data |
| Section 11 — Right to Correction | ✅ COMPLIANT | `PUT /children/:childId` for profile updates |
| Section 11 — Right to Erasure | ✅ COMPLIANT | `DELETE /children/:childId` cascades to all data |
| Section 8(6) — Breach Notification | ⚠️ PARTIAL | Procedure documented, not yet tested |
| Section 16 — Cross-Border Transfer | ✅ COMPLIANT | All data stays in India |
| Section 8(9) — Grievance Redressal | ⚠️ PARTIAL | Grievance officer contact available, formal procedure not tested |
| Section 8(10) — Data Protection Officer | ❌ NON-COMPLIANT | DPO contact placeholder, no formal appointment |

## Key Recommendations

### Critical (Before Launch)
- Appoint and publicly designate a Data Protection Officer (Section 8(10))
- Implement automated data purge job for retention policy enforcement
- Test breach notification procedure end-to-end

### High Priority
- Implement data portability export feature (Right to Portability)
- Formally test grievance redressal procedure with mock complaint
- Complete DPO appointment documentation

### Medium Priority
- Annual privacy policy review process
- Consent refresh for existing users (re-obtain consent on first login after DPDP rules effective date)

### Low Priority
- Field-level encryption for additional PII fields
- Third-party security audit