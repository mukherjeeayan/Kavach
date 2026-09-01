# Deployment Guide

This document describes how to deploy Kavach to a production environment.

## Architecture Overview

```
                    ┌──────────────┐
                    │   CloudFront │  (CDN + WAF + DDoS protection)
                    │   + ACM SSL  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  ALB / Nginx │  (TLS termination, rate limiting)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌────▼────┐ ┌─────▼─────┐
        │  Frontend │ │ Backend │ │  Backend  │  (ECS Fargate / k8s)
        │  (nginx)  │ │  Node   │ │  (replica)│
        └───────────┘ └────┬────┘ └───────────┘
                           │
                ┌──────────┼──────────┐
                │          │          │
          ┌─────▼────┐ ┌───▼────┐ ┌───▼────┐
          │ Postgres │ │ Redis  │ │  S3    │  (backups)
          │   RDS    │ │ElastiC.│ │ bucket │
          └──────────┘ └────────┘ └────────┘
```

## Infrastructure Requirements

### Minimum Production Sizing

| Component | vCPU | RAM | Storage | Notes |
|-----------|------|-----|---------|-------|
| Backend   | 2    | 4GB | 20GB    | Scales horizontally |
| Frontend  | 0.5  | 1GB | 5GB     | Static assets via CDN |
| Postgres  | 2    | 8GB | 100GB   | gp3, 3000 IOPS |
| Redis     | 1    | 2GB | -       | cache.t4g.medium |

### Recommended Sizing (100k children, 50k parents)

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
- [ ] Privacy policy placeholders replaced
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

### Frontend (Build-time)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `https://api.kavach.com/api/v1` |
| `VITE_MAPBOX_TOKEN` | Mapbox access token | `pk.xxx` |

## Deployment Steps

### Option A: Docker Compose (Single Server / Staging)

```bash
# 1. Clone the repository
git clone https://github.com/kavach/kavach.git
cd kavach

# 2. Copy and edit environment file
cp .env.prod.example .env.prod
# Edit .env.prod with real secrets

# 3. Start services
docker compose -f deploy/docker-compose.prod.yml --env-file .env.prod up -d

# 4. Run migrations
docker compose -f deploy/docker-compose.prod.yml exec backend npm run db:migrate

# 5. Verify
curl https://api.kavach.com/health
```

### Option B: AWS ECS Fargate (Production)

```bash
# 1. Build and push images
cd backend
docker build -t $ECR_REGISTRY/kavach-backend:$VERSION .
docker push $ECR_REGISTRY/kavach-backend:$VERSION

cd ../frontend
docker build -t $ECR_REGISTRY/kavach-frontend:$VERSION .
docker push $ECR_REGISTRY/kavach-frontend:$VERSION

# 2. Update ECS service
aws ecs update-service \
  --cluster kavach-prod \
  --service kavach-backend \
  --force-new-deployment

# 3. Run migrations via ECS Run Task
aws ecs run-task \
  --cluster kavach-prod \
  --task-definition kavach-migrate \
  --launch-type FARGATE
```

### Option C: Kubernetes

> **Note:** Kubernetes manifests are not included in the repository.
> Adapt the Docker Compose configuration or ECS task definitions for your
> Kubernetes cluster. The backend Docker image is compatible with any
> container orchestrator.

## Database Migrations

Migrations are tracked in `schema_migrations` table. Run them before deploying new code:

```bash
# Manual
npm run db:migrate

# In Docker
docker compose exec backend npm run db:migrate

# In Kubernetes
kubectl create job --from=cronjob/kavach-migrate kavach-migrate-manual
```

## Backups

### Automated Backups

- **Postgres**: Enable RDS automated backups with 7-day retention (minimum)
- **Manual snapshot**: Daily `pg_dump` to S3 with 30-day retention
- **Cross-region**: Replicate to second region for DR

### Backup Script

Create a backup script (e.g., `backup.sh`):

```bash
#!/bin/bash
# Daily backup script - run via cron
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | \
  gzip | \
  aws s3 cp - s3://$BACKUP_BUCKET/db/kavach_${TIMESTAMP}.sql.gz
```

Set up cron:
```cron
0 2 * * * /opt/kavach/deploy/backup.sh >> /var/log/kavach-backup.log 2>&1
```

### Restore Test

Test restore quarterly:

```bash
# Download latest backup
aws s3 cp s3://$BACKUP_BUCKET/db/kavach_latest.sql.gz /tmp/

# Restore to test database
createdb kavach_restore_test
gunzip -c /tmp/kavach_latest.sql.gz | psql kavach_restore_test

# Verify
psql kavach_restore_test -c "SELECT COUNT(*) FROM parents;"
```

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

### Recommended Tools

- **APM**: Sentry (errors), Datadog/New Relic (performance)
- **Metrics**: Prometheus + Grafana
- **Logs**: CloudWatch / ELK / Loki
- **Uptime**: Pingdom / UptimeRobot / BetterStack
- **DB**: pgwatch2 / pgAdmin

### Health Check Endpoints

- `GET /health` — Basic liveness probe
- `GET /api/v1/health` — Detailed readiness (DB, Redis)

## SSL/TLS

Use Let's Encrypt via certbot (already in deploy/docker-compose) or AWS ACM:

```bash
# Let's Encrypt via certbot
certbot certonly --nginx -d api.kavach.com -d app.kavach.com
# Auto-renewal is enabled via certbot.timer systemd unit
```

Ensure HSTS is enabled (already in Helmet config).

## Scaling

### Horizontal Scaling

Backend is stateless (except for Socket.IO rooms). Scale by:
- Adding more ECS tasks / k8s replicas
- ALB distributes traffic

### Vertical Scaling

Monitor:
- Postgres CPU and memory → upgrade RDS instance
- Backend memory → upgrade task size if >85%

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

Database rollbacks: NEVER roll back migrations. Instead, write a forward fix.

## Post-Deployment Verification

- [ ] All health checks pass
- [ ] Login flow works end-to-end
- [ ] Push notifications arrive on test device
- [ ] Real-time rule sync works (Socket.IO connected)
- [ ] Reports generate without errors
- [ ] Backup ran successfully
- [ ] Monitoring shows all green
- [ ] Smoke test from each region
