# Oracle Cloud Always-Free Deployment Guide

## Prerequisites

1. Oracle Cloud account (always-free tier)
2. OCI CLI installed locally
3. SSH key pair for instance access

## Deployment Steps

### 1. Create Always-Free ARM Instance

```bash
# Using OCI CLI to create an Ampere A1 instance
oci compute instance launch \
  --availability-domain "YOUR_AD" \
  --compartment-id "YOUR_COMPARTMENT_ID" \
  --display-name "kavach-server" \
  --image-id "ocid1.image.oc1..YOUR_IMAGE_OCID" \
  --shape "VM.Standard.A1.Flex" \
  --shape-config '{"Ocpus": 4, "MemoryInGBs": 24}' \
  --subnet-id "YOUR_SUBNET_ID" \
  --ssh-authorized-keys-file ~/.ssh/id_rsa.pub
```

### 2. Connect to Instance

```bash
ssh -i ~/.ssh/id_rsa ubuntu@YOUR_INSTANCE_IP
```

### 3. Install Docker & Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Log out and back in for group changes
exit
```

### 4. Deploy Kavach

```bash
# Clone repository
git clone https://github.com/your-org/kavach.git
cd kavach

# Create production environment file
cp .env.example .env
# Edit .env with your configuration

# Deploy with Docker Compose
cd deploy
docker compose -f docker-compose.prod.yml up -d
```

### 5. Configure Firewall

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

### 6. Setup SSL Certificates

```bash
# Certbot is included in docker-compose.prod.yml
# After deployment, run:
docker compose -f docker-compose.prod.yml exec certbot certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  -d your-domain.com
```

## Resource Allocation

| Service | CPU | Memory | Storage |
|---------|-----|--------|---------|
| PostgreSQL + PostGIS | 1 core | 4 GB | 50 GB |
| Redis | 0.5 core | 1 GB | 5 GB |
| Backend API | 1 core | 4 GB | 10 GB |
| Frontend | 0.5 core | 1 GB | 5 GB |
| Grafana | 0.5 core | 1 GB | 5 GB |
| Prometheus | 0.5 core | 2 GB | 20 GB |
| Uptime Kuma | 0.25 core | 0.5 GB | 2 GB |
| Nginx | 0.25 core | 0.5 GB | 1 GB |
| **Total** | **4 cores** | **14 GB** | **98 GB** |

## Monitoring

- **Grafana**: http://YOUR_IP:3001 (admin/kavach_grafana)
- **Prometheus**: http://YOUR_IP:9090
- **Uptime Kuma**: http://YOUR_IP:3002

## Backup Strategy

```bash
# Automated daily backups
crontab -e

# Add backup job
0 2 * * * /home/ubuntu/kavach/deploy/oracle-cloud/backup.sh
```

## Cost

**$0.00/month** - Always-Free tier includes:
- 4 OCPUs ARM Ampere A1
- 24 GB RAM
- 200 GB block storage
- 10 GB object storage
- 10 TB/month outbound data transfer
