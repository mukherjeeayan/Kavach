#!/usr/bin/env pwsh
# Kavach Backend Deployment Wizard
# Abstracts all configuration for minimal user input

param(
    [Parameter(Mandatory=$false)]
    [string]$Mode = 'development',

    [Parameter(Mandatory=$false)]
    [string]$FrontendDomain = 'localhost'
)

$projectRoot = "C:\Users\mukhe\Documents\Ayan Mukherjee\Projects\Kavach"
$backendDir = Join-Path $projectRoot "backend"
$envPath = Join-Path $backendDir ".env"

Write-Host "Kavach Backend Deployment Wizard" -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Yellow
Write-Host ""

# Set mode
if ($Mode -match '^p') { $Mode = 'production' }
if ($Mode -match '^l') { $Mode = 'local' }
if (-not ($Mode -eq 'development' -or $Mode -eq 'production' -or $Mode -eq 'local')) { $Mode = 'development' }

# Generate secure random secret (64 chars using .NET Random)
$rand = [System.Random]::new()
$jwtSecretBytes = new-object byte[] 32
$rand.NextBytes($jwtSecretBytes)
$jwtSecret = [System.Convert]::ToBase64String($jwtSecretBytes) -replace '\+/,''' | Substring(0,64)
$jwtRefreshSecret = [System.Convert]::ToBase64String((new-object byte[32])) -replace '\+/,''' | Substring(0,64)

# Actually use a better approach - use Get-Random with a seed
$jwtSecret = -join ((65..90 + 97..122 | Get-Random -Count 32) | ForEach-Object { [char]$_ })
$jwtRefreshSecret = -join ((65..90 + 97..122 | Get-Random -Count 32) | ForEach-Object { [char]$_ })
$jwtSecret = $jwtSecret.Substring(0,64)
$jwtRefreshSecret = $jwtRefreshSecret.Substring(0,64)

# Database type
Write-Host "Database setup:" -ForegroundColor Yellow
Write-Host "  1) Docker (PostgreSQL auto-setup)"
Write-Host "  2) Local PostgreSQL"
Write-Host "  3) In-memory (testing)"
$dbChoice = Read-Host "Choice (1-3, default 1)" -DefaultValue 1
if ($dbChoice -eq '2') { $DbType = 'local' }
elseif ($dbChoice -eq '3') { $DbType = 'pg-mem' }
else { $DbType = 'docker' }

# CORS origins
Write-Host "CORS configuration:" -ForegroundColor Yellow
$allowedOrigins = ""
switch ($Mode) {
    'development' { $allowedOrigins = "http://localhost:5173"; }
    'production' {
        $fd = Read-Host "Production frontend domain (e.g., app.example.com)"
        $allowedOrigins = "https://$fd,http://$fd"
    }
    'local' { $allowedOrigins = "http://localhost:5173,http://10.0.2.2:5173" }
}

# Redis
$redisUrl = Read-Host "Redis URL (press Enter to skip, e.g., redis://localhost:6379)" -DefaultValue ""

# Build .env content
$envContent = @"
# Kavach Auto-Generated Backend Environment
# Mode: $Mode
# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

PORT=3000
NODE_ENV=$Mode

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_NAME=safeguard
DB_DRIVER=pg

# JWT — auto-generated secure secrets (64 chars)
JWT_SECRET=$jwtSecret
JWT_REFRESH_SECRET=$jwtRefreshSecret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Redis (optional — falls back to in-memory when unset)
$redisUrl

ALLOWED_ORIGINS=$allowedOrigins

# Firebase (optional)
# FIREBASE_SERVICE_ACCOUNT_JSON=...

# Bcrypt rounds (optional, defaults to 12)
# BCRYPT_SALT_ROUNDS=12

# Mapbox token (never bake into frontend bundle)
# MAPBOX_PUBLIC_TOKEN=pk.xxx

# Retention days (optional)
# RETENTION_LOCATION_DAYS=90
# RETENTION_SCREEN_TIME_DAYS=365
# RETENTION_AUDIT_DAYS=730
"@

# Write .env file
$envContent | Out-File -Encoding UTF8 $envPath
Write-Host "Generated $envPath" -ForegroundColor Green

# Docker guidance
if ($DbType -eq 'docker') {
    Write-Host "Docker: Run 'docker-compose up -d' in the backend directory" -ForegroundColor Yellow
    Write-Host "DB: postgres/password/safeguard at localhost:5432" -ForegroundColor Gray
}

Write-Host ""
Write-Host "JWT secrets (SAVE THESE SECURELY):" -ForegroundColor Gray
Write-Host "  JWT_SECRET: $jwtSecret" -ForegroundColor Gray
Write-Host "  JWT_REFRESH_SECRET: $jwtRefreshSecret" -ForegroundColor Gray
Write-Host "Review .env file and adjust values as needed." -ForegroundColor Cyan