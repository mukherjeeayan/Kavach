# Deployment Guide

## Quick Start (3 Steps)

1. **Run the Wizard** — Open `deploy/index.html` in your browser. Follow the 6-step wizard.
2. **Download & Run the Script** — Wizard auto-generates `deploy.sh` / `deploy.cmd`. The script handles everything: deps, DB, migrations, builds, verification.
3. **Build Android** — `cd android && ./gradlew assembleDebug` (or open in Android Studio)

## The Deployment Wizard

Open `deploy/index.html` in any browser (Chrome, Firefox, Edge, Safari).

### Wizard Steps

| Step | What it generates |
|------|-------------------|
| 1. Environment & Mode | Dev/Prod/Local mode selection |
| 2. Backend Configuration | JWT secrets (64-char), DB config, rate limiting, CORS |
| 3. Frontend Configuration | API URL, Socket.io URL, VAPID public key |
| 4. Android Configuration | API base URL, certificate pinning, Firebase |
| 5. Admin Panel Configuration | Admin access key, panel URL |
| 6. Summary & Deploy | Generated .env files, BuildConfig, deploy script |

**Download the script** and run it — no manual steps required.

### Security Reminders

- ✅ DO save JWT secrets (64-char strings) in a password manager
- ✅ DO restrict ALLOWED_ORIGINS to your actual domain(s)
- ✅ DO use strong DATA_ENCRYPTION_KEY for AI API key encryption
- ❌ DON'T commit .env files to version control
- ❌ DON'T share JWT secrets
- ❌ DON'T expose Redis or database ports to the internet

### Common Issues

| Problem | Quick Fix |
|---------|-----------|
| "PostgreSQL connection failed" | Ensure Docker is running. Default: user=postgres, password=password, db=kavach |
| "Module not found" errors | Run `npm install` in respective directory |
| "Android build fails" | Open Android Studio, ensure `google-services.json` is in `android/app/` |
| "Socket.io not connecting" | Ensure both backend and frontend are running |
| "Redis connection failed" | Ensure Redis is running. Default: port 6379 |

## Production Architecture

```
┌─────────────────────────────────────────┐
│  CDN (CloudFront / Cloudflare)          │  (CDN + WAF + DDoS protection)
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  ALB / Nginx                            │  (TLS termination, rate limiting)
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┼───────────────────────┐
│                 │                       │
┌─────────────▼──┐  ┌──────────────▼──┐  ┌──────────────▼──┐
│ Frontend       │  │ Backend        │  │ Admin Panel     │
│ (React/Vite)   │  │ (Node.js/TS)   │  │ (React)         │
└────────────────┘  └───────┬────────┘  └─────────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
     ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
     │ PostgreSQL │  │ Redis      │  │ S3/MinIO   │  (backups)
     │ + PostGIS  │  │ (Pub/Sub)  │  │ bucket     │
     └────────────┘  └────────────┘  └────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
     ┌─────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
     │ Prometheus │  │ Grafana    │  │ Uptime Kuma│  (monitoring)
     │ (metrics)  │  │ (dashboards│  │ (uptime)   │
     └────────────┘  └────────────┘  └────────────┘
```

### Sizing

**Minimum Production Sizing:**

| Component | vCPU | RAM | Storage | Notes |
|-----------|------|-----|---------|-------|
| Backend   | 2    | 4GB | 20GB    | Scales horizontally |
| Frontend  | 0.5  | 1GB | 5GB     | Static assets via CDN |
| Postgres  | 2    | 8GB | 100GB   | gp3, 3000 IOPS |
| Redis     | 1    | 2GB | -       | cache.t4g.medium |

**Recommended (100k children, 50k parents):**

| Component | vCPU | RAM | Storage | Notes |
|-----------|------|-----|---------|-------|
| Backend   | 8    | 16GB| 20GB    | 3+ replicas, ALB |
| Postgres  | 8    | 32GB| 500GB   | Multi-AZ, read replica |
| Redis     | 2    | 8GB | -       | cluster mode |

## Pre-Deployment Checklist

- [ ] All environment variables set in secrets manager (AWS SSM, Vault, etc.)
- [ ] Database backups configured and tested
- [ ] SSL certificates obtained and auto-renewal verified
- [ ] DNS records configured
- [ ] Monitoring/alerting set up (Sentry, CloudWatch, Datadog)
- [ ] Load testing completed
- [ ] Penetration test completed
- [ ] Privacy policy published with real company details
- [ ] Terms of service published
- [ ] Razorpay payment integration configured and tested
- [ ] Legal review of DPDP/GDPR compliance

## Environment Variables

### Backend (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Set to `production` | `production` |
| `PORT` | HTTP port | `3000` |
| `DB_HOST` | Postgres host | `kavach-prod.xxxx.rds.amazonaws.com` |
| `DB_PORT` | Postgres port | `5432` |
| `DB_USER` | DB username | `kavach_app` |
| `DB_PASSWORD` | DB password | (use secrets manager) |
| `DB_NAME` | Database name | `kavach` |
| `REDIS_URL` | Redis connection URL | `redis://...` |
| `JWT_SECRET` | JWT signing secret (>= 32 chars) | (generate with `openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | Refresh token secret | (generate separately) |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-sep) | `https://app.kavach.com` |
| `SMTP_HOST` | SMTP server | `smtp.sendgrid.net` |
| `SMTP_USER` | SMTP username | `apikey` |
| `SMTP_PASSWORD` | SMTP password | (use secrets manager) |
| `FIREBASE_PROJECT_ID` | Firebase project | `kavach-prod` |
| `FIREBASE_PRIVATE_KEY` | Firebase service account key | (use secrets manager) |
| `RAZORPAY_KEY_ID` | Razorpay key | `rzp_live_xxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | (use secrets manager) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook | (use secrets manager) |
| `ADMIN_ACCESS_KEY` | Admin panel access key | (generated by wizard) |
| `DATA_ENCRYPTION_KEY` | Symmetric key for AI API keys (>= 32 chars) | (generate with `openssl rand -hex 32`) |

### Frontend (Build-time)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `https://api.kavach.com/api/v1` |
| `VITE_SOCKET_URL` | Socket.IO URL (defaults to API URL) | `wss://api.kavach.com` |
| `VITE_VAPID_PUBLIC_KEY` | Web Push VAPID public key | `BN...` |

### Admin Panel (Build-time)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `https://api.kavach.com/api/v1` |
| `VITE_ADMIN_ACCESS_KEY` | Admin panel access key | (must match backend `ADMIN_ACCESS_KEY`) |

## Deployment Options

### Option A: Docker Compose (Single Server / Staging)

```bash
git clone https://github.com/kavach/kavach.git
cd kavach
cp .env.prod.example .env.prod
# Edit .env.prod with real secrets
docker compose -f deploy/docker-compose.prod.yml --env-file .env.prod up -d
docker compose -f deploy/docker-compose.prod.yml exec backend npm run db:migrate
curl https://api.kavach.com/health
```

### Option B: Oracle Cloud Always-Free (Zero Cost)

Deploy on Oracle Cloud's Always Free tier — **$0.00/month** for 4 OCPUs, 24 GB RAM.

```bash
# On Oracle Cloud ARM instance (Ubuntu 22.04)
git clone https://github.com/kavach/kavach.git
cd kavach/deploy/oracle-cloud
chmod +x setup.sh
./setup.sh

# Edit .env with real secrets
nano ../.env.prod

# Start services
docker compose -f ../docker-compose.prod.yml --env-file ../.env.prod up -d
```

See `deploy/oracle-cloud/README.md` for full resource allocation and monitoring setup.

### Option C: AWS ECS Fargate (Production)

```bash
# Deploy via CloudFormation
aws cloudformation deploy \
  --template-file deploy/ecs/cloudformation.yml \
  --stack-name kavach-production \
  --parameter-overrides Environment=production \
  --capabilities CAPABILITY_IAM

# Or via CLI
cd backend
docker build -t $ECR_REGISTRY/kavach-backend:$VERSION .
docker push $ECR_REGISTRY/kavach-backend:$VERSION

aws ecs update-service \
  --cluster kavach-prod \
  --service kavach-backend \
  --force-new-deployment

# Run migrations via ECS Run Task
aws ecs run-task \
  --cluster kavach-prod \
  --task-definition kavach-migrate \
  --launch-type FARGATE
```

See `deploy/ecs/` for CloudFormation template, task definition, and service definition.

### Option D: Kubernetes

Complete Kubernetes manifests are provided in `deploy/kubernetes/`:

```bash
# Create namespace and secrets
kubectl apply -f deploy/kubernetes/namespace.yml
kubectl apply -f deploy/kubernetes/secrets.yml

# Deploy infrastructure
kubectl apply -f deploy/kubernetes/postgres.yml
kubectl apply -f deploy/kubernetes/redis.yml

# Deploy application
kubectl apply -f deploy/kubernetes/backend.yml
kubectl apply -f deploy/kubernetes/frontend.yml

# Configure ingress (requires cert-manager and nginx-ingress)
kubectl apply -f deploy/kubernetes/ingress.yml
```

See `deploy/kubernetes/` for all manifests (namespace, secrets, postgres, redis, backend, frontend, ingress).

## Database

### Migrations

Migrations are tracked in `schema_migrations` table:

```bash
npm run db:migrate                                    # Manual
docker compose exec backend npm run db:migrate        # In Docker
kubectl create job --from=cronjob/kavach-migrate kavach-migrate-manual  # In k8s
```

### Backups

- **Postgres**: Enable RDS automated backups with 7-day retention (minimum)
- **Manual snapshot**: Daily `pg_dump` to S3 with 30-day retention
- **Cross-region**: Replicate to second region for DR

```bash
#!/bin/bash
# Daily backup script
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | \
  gzip | \
  aws s3 cp - s3://$BACKUP_BUCKET/db/kavach_${TIMESTAMP}.sql.gz
```

```cron
0 2 * * * /opt/kavach/deploy/backup.sh >> /var/log/kavach-backup.log 2>&1
```

### Restore Test (Quarterly)

```bash
aws s3 cp s3://$BACKUP_BUCKET/db/kavach_latest.sql.gz /tmp/
createdb kavach_restore_test
gunzip -c /tmp/kavach_latest.sql.gz | psql kavach_restore_test
psql kavach_restore_test -c "SELECT COUNT(*) FROM parents;"
```

## Security Essentials

### JWT Secrets (Critical)

Two 64-character secrets:
- `JWT_SECRET` — Protects access tokens
- `JWT_REFRESH_SECRET` — Protects refresh tokens

Save in a password manager. Never share. Never commit to version control.

### CORS Origins

`ALLOWED_ORIGINS` — comma-separated list of allowed origins.

- **Development**: `http://localhost:5173`
- **Production**: `https://app.yourcompany.com`
- **Local with Android emulator**: `http://localhost:5173,http://10.0.2.2:5173`

### Certificate Pinning (Android Release Only)

Set SHA-256 certificate pins in `android/local.properties`. Get pins from your production server's certificate.

### Firebase/FCM (Optional)

1. Create project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add Android app
3. Download `google-services.json` and place in `android/app/`

## Monitoring

### Required Alerts

- [ ] Backend `/health` returns 5xx for >1 minute
- [ ] Database connection failures
- [ ] Disk usage >80%
- [ ] Memory usage >85%
- [ ] Error rate >1% of requests
- [ ] Response time p95 >500ms
- [ ] Failed login attempts >100/min
- [ ] Unhandled exceptions in Sentry
- [ ] Audit chain verification failures
- [ ] SMS fallback failures (SOS critical)

### Recommended Tools

- **APM**: Sentry (errors), Datadog/New Relic (performance)
- **Metrics**: Prometheus + Grafana (included in `docker-compose.prod.yml`)
- **Logs**: CloudWatch / ELK / Loki
- **Uptime**: Uptime Kuma (self-hosted, included in `docker-compose.prod.yml`)
- **DB**: pgwatch2 / pgAdmin
- **Load Testing**: k6 scripts in `loadtest/`

### Health Check Endpoints

- `GET /health` — Basic liveness probe
- `GET /api/v1/health` — Detailed readiness (DB, Redis)

## SSL/TLS

Use Let's Encrypt via certbot (already in `deploy/docker-compose`) or AWS ACM:

```bash
certbot certonly --nginx -d api.kavach.com -d app.kavach.com
```

Auto-renewal enabled via certbot.timer systemd unit. HSTS is enabled in Helmet config.

## Scaling

### Horizontal Scaling

Backend is stateless (except for Socket.IO rooms). Scale by adding more ECS tasks / k8s replicas behind an ALB.

### Vertical Scaling

Monitor Postgres CPU/memory and backend memory. Upgrade RDS instance or task size when >85% utilization.

### Database Scaling

- **Read replicas**: Add for read-heavy endpoints (reports, analytics)
- **Partitioning**: Partition `location_history`, `communication_logs` by month when >100M rows
- **Archiving**: Move data >90 days old to cold storage (S3 + Athena)

## Rollback Procedure

```bash
# 1. Identify last good version
git log --oneline -10

# 2. Tag current as bad
git tag bad-$(date +%Y%m%d-%H%M%S)

# 3. Revert to last good
git checkout <good-commit>
docker build -t kavach-backend:$GOOD_VERSION .
docker push $ECR_REGISTRY/kavach-backend:$GOOD_VERSION

# 4. Deploy
aws ecs update-service --force-new-deployment
```

**Database rollbacks**: NEVER roll back migrations. Instead, write a forward fix.

## Post-Deployment Verification

- [ ] All health checks pass
- [ ] Login flow works end-to-end
- [ ] Push notifications arrive on test device
- [ ] Real-time rule sync works (Socket.IO connected)
- [ ] Reports generate without errors
- [ ] Backup ran successfully
- [ ] Monitoring shows all green
- [ ] Smoke test from each region