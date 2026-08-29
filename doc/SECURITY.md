# Security Policy

## Supported Versions

| Version | Supported          | Notes |
|---------|--------------------|-------|
| 1.x.x   | :white_check_mark: | Current stable release |
| 0.9.x   | :white_check_mark: | Security fixes only until 2026-12-31 |
| < 0.9   | :x:                | End of life |

## Reporting a Vulnerability

**Please do not file a public GitHub issue for security vulnerabilities.**

We take all security reports seriously. To report a vulnerability:

1. **Email**: security@kavach.com
2. **PGP Key**: Available at https://kavach.com/.well-known/pgp-key.txt
3. **Response time**: We acknowledge within 24 hours

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your name/handle for credit (optional)

## Our Commitments

When you report a vulnerability, we will:

- Acknowledge receipt within **24 hours**
- Provide an initial assessment within **72 hours**
- Keep you informed of progress at least every 7 days
- Credit you in our security acknowledgments (if desired)
- Not take legal action against good-faith research

## Severity Classification

We use CVSS v3.1 to classify vulnerabilities:

| Severity | CVSS Score | Response Time | Fix Target |
|----------|-----------|---------------|------------|
| Critical | 9.0-10.0  | 24 hours      | 7 days     |
| High     | 7.0-8.9   | 48 hours      | 30 days    |
| Medium   | 4.0-6.9   | 1 week        | 60 days    |
| Low      | 0.1-3.9   | 2 weeks       | 90 days    |

## Scope

### In Scope

- Backend API (Kavach REST endpoints)
- Web frontend (parent dashboard)
- Android child app
- Authentication and session management
- Data storage and transmission
- Third-party integrations

### Out of Scope

- Denial of service attacks
- Social engineering
- Physical attacks
- Self-XSS / requiring user interaction
- Reports from automated scanners without PoC
- Issues in third-party services we integrate with

## Security Architecture

### Authentication

- JWT access tokens (15-minute expiry)
- Refresh tokens (7-day expiry, server-side revocation)
- HttpOnly cookies for session management
- bcrypt password hashing (cost factor 12)
- Account lockout after 10 failed attempts (15 min)
- Optional 2FA via TOTP (planned)

### Transport Security

- TLS 1.2+ required for all connections
- HSTS with 1-year max-age
- Certificate pinning in Android app
- Encrypted WebSocket (WSS) for real-time updates

### Data Protection

- PostgreSQL SSL/TLS for connections
- At-rest encryption via cloud provider
- EncryptedSharedPreferences on Android
- SQLCipher for local database on Android
- Field-level encryption for sensitive PII (planned)
- PII minimization (collect only what's needed)
- Configurable data retention (30 days default)

### Authorization

- Role-based access control (parent, child, admin)
- Per-child consent tracking
- Resource-level authorization on all endpoints
- JWT scope validation

### Network Security

- Helmet.js for HTTP security headers
- CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- CORS with explicit origin whitelist
- Rate limiting (5 auth attempts / 15 min, 100 API calls / 15 min)
- SQL injection prevention via parameterized queries

## Compliance

- **DPDP Act 2023** (India) — Data Protection and Privacy
- **GDPR** (EU) — General Data Protection Regulation (where applicable)
- **COPPA** (US) — Children's Online Privacy Protection Act

For compliance questions: privacy@kavach.com

## Security Acknowledgments

We thank the following researchers for responsible disclosure:

*(This list will be updated as reports are received and resolved.)*

## Security Best Practices for Operators

1. **Rotate secrets quarterly** — JWT_SECRET, JWT_REFRESH_SECRET, DB_PASSWORD
2. **Enable MFA** on all admin accounts
3. **Review audit logs** weekly for suspicious activity
4. **Keep dependencies updated** — run `npm audit` weekly
5. **Penetration test annually** by an independent firm
6. **Backup test quarterly** — verify restore works
7. **Incident response drill** annually
8. **Privacy policy review** annually with legal team

## Incident Response

In case of a security incident:

1. **Contain**: Rotate secrets, disable affected accounts
2. **Investigate**: Review audit logs, identify scope
3. **Notify**: Inform affected users within 72 hours (DPDP requirement)
4. **Remediate**: Deploy fix, verify
5. **Post-mortem**: Document, share lessons learned

Contact: security-incident@kavach.com (24/7 monitored)

## Bug Bounty

We do not currently operate a paid bug bounty program, but we acknowledge all reports and credit researchers publicly (with permission).
