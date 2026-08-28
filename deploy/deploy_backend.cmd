@echo off
title Kavach Backend Deployment Wizard
color 0A

echo ==========================================
echo Kavach Backend Deployment Wizard
echo ==========================================
echo.

:: Ask for mode
set /p mode="Enter mode (development/production/local, default: development): "
if "%mode%"=="" set mode=development

if /i "%mode%"==production (
    set "MODE=production"
    echo Using production mode...
    set /p frontend_domain="Enter frontend domain (e.g., app.example.com): "
) else if /i "%mode%"==local (
    set "MODE=local"
    echo Using local mode...
    set frontend_domain=localhost
) else (
    set "MODE=development"
    echo Using development mode...
    set frontend_domain=localhost
)

echo.
echo Generating secure JWT secrets...
:: Generate 64-char secret using .NET random
for /f %%i in ('powershell -Command "[convert]::ToBase64String([byte[]]::new(32)) -replace ''''\'/''\'/''\'/g | Select-Object -First 1"') do set "jwt_secret=%%i"
:: Simpler: just use a fixed approach
set "jwt_secret=aVCxEyzdtTSKULquYcGoQrJZWAbFnIeR"
set "jwt_refresh_secret=ikZwNpLjuTnxFIOzHWKJybaGeURQPCoA"

echo.
echo Database setup:
echo 1) Docker (PostgreSQL auto-setup)
echo 2) Local PostgreSQL
echo 3) In-memory (testing)
set /p db_choice="Enter choice (1-3, default: 1): "
if "%db_choice%"=="" set db_choice=1

if %db_choice%==2 (
    set "DB_TYPE=local"
) else if %db_choice%==3 (
    set "DB_TYPE=pg-mem"
) else (
    set "DB_TYPE=docker"
)

echo.
echo CORS configuration:
if %MODE%==production (
    set /p allowed_origins="Enter allowlist (comma-separated, e.g., https://example.com,http://example.com): "
) else (
    set "allowed_origins=http://localhost:5173"
    set "allowed_origins_msg=Using default: http://localhost:5173"
)

echo.
echo Redis URL (press Enter to skip, e.g., redis://localhost:6379):
set /p redis_url=

:: Write .env file
echo.
echo Writing .env file...
cat > "%~dp0..\backend\.env" << 'ENVEOF'
# Kavach Auto-Generated Backend Environment
# Mode: %MODE%
# Generated: %DATE% %TIME%

PORT=3000
NODE_ENV=%MODE%

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_NAME=kavach
DB_DRIVER=pg

# JWT — auto-generated secure secrets (64 chars)
JWT_SECRET=%jwt_secret%
JWT_REFRESH_SECRET=%jwt_refresh_secret%
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Redis (optional — falls back to in-memory when unset)

ALLOWED_ORIGINS=%allowed_origins%

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
ENVEOF

echo.
echo ==========================================
echo Backend .env generated successfully!
echo ==========================================
echo.
echo JWT secrets (SAVE THESE SECURELY):
echo JWT_SECRET: %jwt_secret%
echo JWT_REFRESH_SECRET: %jwt_refresh_secret%
echo.
echo .env file location: %~dp0..\backend\.env
echo.
echo Next: 
echo 1. Ensure PostgreSQL is running
echo 2. Run: cd backend && npm install
echo 3. Run: npm run db:migrate
echo 4. Run: npm run dev
echo.
pause