# Kavach - Privacy Policy

**Effective Date:** August 25, 2026  
**Last Updated:** August 25, 2026  
**App Name:** Kavach - Parental Control

---

## 1. Introduction

Kavach ("we", "us", "our") is a parental control application designed to help parents and legal guardians monitor and manage their children's digital safety. This Privacy Policy describes how we collect, use, store, and protect personal data in compliance with the **Digital Personal Data Protection Act, 2023 (DPDP Act)** of India and other applicable data protection laws.

By using Kavach, you acknowledge that you are a parent or legal guardian and that you have read and understood this Privacy Policy.

---

## 2. Data Controller

**Entity Name:** Kavach Technologies  
**Registered Address:** [Registered Address, India]  
**Email:** privacy@kavach.app  
**Data Protection Officer:** [Designated DPO Name], dpo@kavach.app  
**Grievance Officer:** [Designated Grievance Officer Name], grievance@kavach.app  
**Phone:** +91-XXXXXXXXXX

---

## 3. Data We Collect

Kavach collects the following categories of personal data, limited to what is strictly necessary for providing parental control and child safety services:

### 3.1 Parent/Guardian Account Data
- Full name
- Email address
- Password (stored as bcrypt hash; never in plaintext)
- Parental PIN (stored as bcrypt hash)
- Account creation and update timestamps
- Session tokens (refresh tokens for session management)

### 3.2 Child Profile Data
- Child's name
- Child's date of birth
- Daily screen-time limit settings

### 3.3 Location Data
- GPS coordinates (latitude, longitude)
- Location accuracy (meters)
- Speed (km/h)
- Timestamp of each location ping
- Geofence definitions (name, coordinates, radius, zone type)

### 3.4 Screen Time & App Usage Data
- Per-app usage duration (seconds)
- App package names and categories
- Daily usage totals
- Date of usage recording

### 3.5 Communication Data
- SMS messages (incoming/outgoing, with content snippets up to 500 characters)
- Call logs (incoming, outgoing, missed; with duration)
- Contact names and phone numbers
- Flagged content indicators and keyword matches
- Keyword alert records

### 3.6 App Blocking & Control Data
- Blocked application rules (package names, app names)
- Per-app daily usage limits
- Unblock request records and approval status

### 3.7 Mood & Wellness Data
- Mood scores (self-reported by child)
- Mood notes (free text)
- Activity tags
- Weekly mood summaries

### 3.8 Device Health Data
- Battery level and charging status
- Storage capacity and free space
- Root/jailbreak detection status
- Developer options and USB debugging status
- Operating system version
- Kavach app version

### 3.9 Audit & Security Data
- All actions performed on child data (create, read, update, delete)
- Actor identification (parent ID)
- Action timestamps
- IP addresses (for consent records)
- Tamper alerts and security events

---

## 4. How We Use Your Data

We use personal data solely for the following purposes:

| Purpose | Data Used | Legal Basis (DPDP Act) |
|---------|-----------|----------------------|
| Parental control and child safety monitoring | Location, screen time, communications, app usage | Verifiable parental consent |
| Setting and enforcing screen-time limits | Screen time logs, app usage | Verifiable parental consent |
| Location tracking and geofence alerts | GPS coordinates, geofence definitions | Verifiable parental consent |
| Cyberbullying and safety threat detection | Communication logs, keyword matching | Verifiable parental consent |
| Emergency SOS functionality | Location data, device status | Verifiable parental consent |
| Device security monitoring (root/tamper detection) | Device health data | Verifiable parental consent |
| Mood and wellness tracking | Mood logs, activity data | Verifiable parental consent |
| Service improvement and bug fixing | Anonymized/aggregated usage data | Legitimate interest |
| Security and fraud prevention | Audit logs, IP addresses | Legitimate interest |
| Legal compliance | All data categories as required | Legal obligation |

---

## 5. Data Retention Periods

We retain personal data only as long as necessary for the purposes described in this policy:

| Data Category | Retention Period | Deletion Method |
|--------------|-----------------|-----------------|
| Location logs | 90 days from recording | Automated purge + manual deletion via account settings |
| Screen time logs | 30 days from recording | Automated purge + manual deletion via account settings |
| Communication logs | 30 days from recording | Automated purge + manual deletion via account settings |
| Mood logs | 1 year from recording | Automated purge + manual deletion via account settings |
| Device health logs | 90 days from recording | Automated purge + manual deletion via account settings |
| App block rules | Until manually deleted by parent | Manual deletion via dashboard |
| Geofences | Until manually deleted by parent | Manual deletion via dashboard |
| Audit logs | 2 years from creation | Automated purge |
| Keyword alerts | 90 days from creation | Automated purge |
| Account data | Until account deletion | Account deletion endpoint |
| Consent records | 2 years from revocation | Automated purge |

---

## 6. Data Sharing & Third Parties

### 6.1 We Do Not Sell Personal Data
Kavach does not sell, rent, or trade personal data to any third party for marketing or commercial purposes.

### 6.2 Service Providers (Data Processors)
We share data with the following categories of service providers who assist in delivering our services, under strict data processing agreements:

- **Cloud Infrastructure Provider:** Hosting and database services (data stored in India)
- **Firebase Cloud Messaging (FCM):** Push notification delivery for alerts and SOS
- **Email Service Provider:** Password reset and account-related communications

### 6.3 Legal Requirements
We may disclose personal data if required by law, court order, or governmental authority under applicable Indian law.

### 6.4 No Cross-Border Transfers
All personal data is stored and processed within India. We do not transfer personal data outside India.

---

## 7. Verifiable Parental Consent

In compliance with Section 6 of the DPDP Act, Kavach implements the following consent mechanisms:

### 7.1 Consent Types
Before collecting any child data, we obtain explicit consent for each data category:
- **Location tracking** (`location`)
- **App usage monitoring** (`app_usage`)
- **Communication monitoring** (`communications`)
- **Mental health/mood tracking** (`mental_health`)

### 7.2 Consent Process
1. The parent creates an account and verifies their identity via email
2. The parent creates a child profile
3. The parent explicitly grants consent for each data category via the consent management interface
4. Each consent record includes: consent type, timestamp, IP address, and parent ID
5. Consent is audited and logged in the `audit_logs` table

### 7.3 Consent Revocation
- Parents may revoke consent for any data category at any time
- Upon revocation, data collection for that category ceases immediately
- Previously collected data is retained per the retention schedule but is no longer actively processed
- Consent revocation is logged in the audit trail

### 7.4 Consent Verification
- The `hasActiveConsent` function verifies consent before any data collection
- All data collection endpoints check for active consent before recording data
- Consent status can be queried via `GET /children/:childId/consent/check/:consentType`

---

## 8. Your Rights (DPDP Act Section 11)

As a parent/guardian, you have the following rights regarding your child's personal data:

### 8.1 Right to Access
- View all data collected about your child via the parent dashboard
- Access child profile, location history, screen time, communications, mood logs, and device health
- API endpoints: `GET /children/:childId`, `GET /children/:childId/consent`

### 8.2 Right to Correction
- Update your child's name and date of birth via `PUT /children/:childId`
- Update your own profile information via `PUT /auth/profile`
- Modify screen-time limits and app blocking rules

### 8.3 Right to Erasure
- Delete your child's entire profile and all associated data via `DELETE /children/:childId`
- This cascades to delete: devices, app block rules, location logs, communication logs, screen time logs, mood logs, device health logs, geofences, and consent records
- Unpair individual devices via `DELETE /devices/:deviceId`

### 8.4 Right to Data Portability
- [PLANNED] Export your child's data in a machine-readable format (JSON/CSV)

### 8.5 Right to Grievance Redressal
- Contact our Grievance Officer at grievance@kavach.app
- Response within 72 hours for data-related complaints
- Escalation process available if unresolved within 30 days

---

## 9. Security Measures

Kavach implements comprehensive technical and organizational security measures:

### 9.1 Encryption
- **Data in Transit:** All API communication is encrypted via TLS 1.2+
- **Data at Rest:** Database encryption at the infrastructure level
- **Passwords:** Bcrypt hashing with configurable salt rounds (default: 12)
- **PINs:** Bcrypt hashing; never stored in plaintext
- **Refresh Tokens:** SHA-256 hashed before storage

### 9.2 Access Controls
- **Authentication:** JWT-based authentication with short-lived access tokens
- **Authorization:** Role-based access control (parent role required for all child-data operations)
- **Ownership Verification:** Every child-data operation verifies `child.parent_id` matches the authenticated user
- **Scoped Tokens:** PIN and biometric tokens are scoped and time-limited (15 minutes)
- **Session Management:** Token family rotation; reuse detection revokes entire session families

### 9.3 Audit Logging
- Every create, read, update, and delete operation on child data is logged in the `audit_logs` table
- Audit entries include: actor ID, target child ID, action type, resource type, timestamp, and details
- Tamper alerts and security events are permanently logged

### 9.4 Brute-Force Protection
- PIN verification: 5 failed attempts → 15-minute account lock
- Authentication endpoints: Rate-limited (5 attempts per 15 minutes)
- Password reset: One-time use tokens with 1-hour expiry

### 9.5 Device Security
- Root/jailbreak detection with parent alerts
- USB debugging detection with parent alerts
- Device admin status monitoring
- Tamper detection and alerting

### 9.6 Infrastructure Security
- Database parameterized queries (SQL injection prevention)
- Input validation via Zod schemas on all endpoints
- Request ID tracking for incident investigation
- Secure cookie handling (httpOnly, secure flags)

---

## 10. Children's Privacy

Kavach is designed for parents to monitor their children's digital safety. We are committed to protecting children's privacy:

- We do not directly collect data from children without parental consent
- All data collection is initiated by the parent-owned device
- Children cannot create accounts or consent to data collection independently
- Mood data is self-reported by children but only accessible to verified parents
- We do not use children's data for advertising or profiling

---

## 11. Data Breach Notification

In compliance with Section 8(6) of the DPDP Act:

- We maintain incident response procedures for data breaches
- In the event of a personal data breach, we will notify:
  - The Data Protection Board of India (DPBI) within 72 hours
  - Affected data principals (parents) without undue delay
- Notification will include: nature of breach, data affected, remedial measures taken
- Our incident response team can be contacted at security@kavach.app

---

## 12. Changes to This Privacy Policy

- We may update this Privacy Policy from time to time
- Material changes will be communicated via email and in-app notification
- The "Last Updated" date at the top indicates the most recent revision
- Continued use after changes constitutes acceptance of the updated policy

---

## 13. Contact Us

For any questions, concerns, or requests regarding this Privacy Policy or your personal data:

**General Inquiries:**  
Email: privacy@kavach.app

**Data Protection Officer:**  
Email: dpo@kavach.app

**Grievance Officer:**  
Name: [Designated Grievance Officer Name]  
Email: grievance@kavach.app  
Phone: +91-XXXXXXXXXX  
Address: [Office Address, India]

**Response Time:** We aim to respond to all data protection inquiries within 72 hours.

---

## 14. Governing Law

This Privacy Policy is governed by and construed in accordance with the laws of India, including the Digital Personal Data Protection Act, 2023. Any disputes arising from this policy shall be subject to the exclusive jurisdiction of the courts in [City], India.
