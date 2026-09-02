#!/bin/bash
# setup.sh - Initial setup script for Kavach on Oracle Cloud Always-Free
# Run this on a fresh Ubuntu 22.04 ARM instance

set -euo pipefail

echo "=== Kavach Oracle Cloud Always-Free Setup ==="
echo ""

# Update system
echo "[1/8] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo "[2/8] Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose plugin
echo "[3/8] Installing Docker Compose plugin..."
sudo apt install docker-compose-plugin -y

# Install useful tools
echo "[4/8] Installing utility packages..."
sudo apt install -y git curl wget htop iotop

# Create swap file (helps with memory pressure)
echo "[5/8] Creating swap file..."
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Clone Kavach repository
echo "[6/8] Cloning Kavach repository..."
cd /home/ubuntu
git clone https://github.com/your-org/kavach.git
cd kavach

# Create production environment
echo "[7/8] Setting up environment..."
cp .env.example .env
echo ""
echo "Please edit /home/ubuntu/kavach/.env with your configuration:"
echo "  - JWT_SECRET"
echo "  - JWT_REFRESH_SECRET"
echo "  - DB_PASSWORD"
echo "  - REDIS_PASSWORD"
echo "  - ALLOWED_ORIGINS"
echo "  - FIREBASE_PROJECT_ID (for push notifications)"
echo "  - FIREBASE_CLIENT_EMAIL"
echo "  - FIREBASE_PRIVATE_KEY"
echo ""

# Configure firewall
echo "[8/8] Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Create backup cron job
echo "Setting up automated backups..."
chmod +x /home/ubuntu/kavach/deploy/oracle-cloud/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/kavach/deploy/oracle-cloud/backup.sh >> /home/ubuntu/backups/backup.log 2>&1") | crontab -

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit /home/ubuntu/kavach/.env with your configuration"
echo "2. Deploy with: cd /home/ubuntu/kavach/deploy && docker compose -f docker-compose.prod.yml up -d"
echo "3. Access Grafana at http://YOUR_IP:3001"
echo "4. Access Uptime Kuma at http://YOUR_IP:3002"
echo ""
echo "For SSL certificates, run:"
echo "  docker compose -f docker-compose.prod.yml exec certbot certbot certonly \\"
echo "    --webroot --webroot-path=/var/www/certbot -d your-domain.com"
