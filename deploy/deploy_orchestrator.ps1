#!/usr/bin/env pwsh
# Kavach Full Deployment Orchestrator
# Automatic file writing - no manual copying needed

param(
    [Parameter(Mandatory=$false)]
    [string]$Scope = 'full',

    [Parameter(Mandatory=$false)]
    [string]$Environment = 'development',

    [Parameter(Mandatory=$false)]
    [string]$FrontendDomain = 'localhost'
)

$projectRoot = "C:\Users\mukhe\Documents\Ayan Mukherjee\Projects\Kavach"
$backendDir = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"
$appDir = Join-Path $projectRoot "app"

Write-Host "Kavach Deployment Orchestrator (Auto-Mode)" -ForegroundColor Cyan
Write-Host "All files generated automatically - no manual copying needed`n" -ForegroundColor Cyan

# Determine scope
switch -regex ($Scope) {
    '^b.*' { $Scope = 'backend' }
    '^f.*' { $Scope = 'frontend' }
    '^a.*' { $Scope = 'android' }
    default { $Scope = 'full' }
}

# Mode selection
switch -regex ($Environment) {
    '^p.*' { $env:Mode = 'production' }
    '^l.*' { $env:Mode = 'local' }
    default { $env:Mode = 'development' }
}

# ---- BACKEND ----
if ($Scope -eq 'full' -or $Scope -eq 'backend') {
    Write-Host "Backend mode`n" -ForegroundColor Yellow
    Write-Host "1) Docker (PostgreSQL auto-setup)`n2) Local PostgreSQL`n3) In-memory (testing)`n"
    $dbChoice = Read-Host "Choice (1-3, default 1)"
    if ($dbChoice -eq '2') { $DbType = 'local' }
    elseif ($dbChoice -eq '3') { $DbType = 'pg-mem' }
    else { $DbType = 'docker' }

    $allowedOrigins = ""
    switch -regex ($Environment) {
        'development' { $allowedOrigins = "http://localhost:5173" }
        'production' { 
            $fd = Read-Host "Production frontend domain"
            $allowedOrigins = "https://$fd,http://$fd"
        }
        'local' { $allowedOrigins = "http://localhost:5173,http://10.0.2.2:5173" }
    }

    $redisUrl = Read-Host "Redis URL (press Enter to skip, e.g., redis://localhost:6379)" -DefaultValue ""

    # Generate JWT secrets - use .NET Guid approach (reliable in PS 5.1)
    $jwtSecretBytes = New-Object byte[16]
    [System.Runtime.InteropServices.Marshal]::Copy([Guid]::NewGuid().Dispose() -or [Guid]::NewGuid().GetHashCode(), $jwtSecretBytes, 0, 16)
    $jwtSecret = [System.Convert]::ToBase64String($jwtSecretBytes).Substring(0,64)
    # Note: The above may produce non-printable characters, so let's use a different approach
    
    # Actually, use the character approach that worked before - generate enough chars
    $jwtSecret = ""
    for ($i = 0; $i -lt 80; $i++) {
        $jwtSecret = $jwtSecret + [char](Get-Random -Minimum 65 -Maximum 123)
    }
    $jwtSecret = $jwtSecret.Substring(0,64)
    # Ensure it contains both upper and lower case
    if ($jwtSecret -notmatch '[a-z]') { $jwtSecret = $jwtSecret + "a" }
    if ($jwtSecret -notmatch '[A-Z]') { $jwtSecret = "A" + $jwtSecret.Substring(0,63) }
    $jwtRefreshSecret = ""
    for ($i = 0; $i -lt 80; $i++) {
        $jwtRefreshSecret = $jwtRefreshSecret + [char](Get-Random -Minimum 65 -Maximum 123)
    }
    $jwtRefreshSecret = $jwtRefreshSecret.Substring(0,64)
    if ($jwtRefreshSecret -notmatch '[a-z]') { $jwtRefreshSecret = $jwtRefreshSecret + "a" }
    if ($jwtRefreshSecret -notmatch '[A-Z]') { $jwtRefreshSecret = "A" + $jwtRefreshSecret.Substring(0,63) }

    $envContent = @"
PORT=3000
NODE_ENV=$Environment
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_NAME=safeguard
DB_DRIVER=pg
JWT_SECRET=$jwtSecret
JWT_REFRESH_SECRET=$jwtRefreshSecret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
# Redis (optional — falls back to in-memory when unset)
$redisUrl
ALLOWED_ORIGINS=$allowedOrigins
# Mapbox token (never bake into frontend bundle)
# MAPBOX_PUBLIC_TOKEN=pk.xxx
# Retention days (optional)
# RETENTION_LOCATION_DAYS=90
# RETENTION_SCREEN_TIME_DAYS=365
# RETENTION_AUDIT_DAYS=730
"@

    $envContent | Out-File -Encoding UTF8 (Join-Path $backendDir ".env")
    Write-Host "Backend .env written to $backendDir\.env`n" -ForegroundColor Green

    if ($DbType -eq 'docker') {
        Write-Host "Docker: Run 'docker-compose up -d' in backend directory`n" -ForegroundColor Yellow
    }
}

# ---- FRONTEND ----
if ($Scope -eq 'full' -or $Scope -eq 'frontend') {
    Write-Host "Frontend mode`n" -ForegroundColor Yellow
    switch -regex ($Environment) {
        'development' { $BackendUrl = 'http://localhost:3000'; $SocketUrl = 'http://localhost:3000' }
        'production' { 
            $BackendUrl = Read-Host "Backend API URL (e.g., https://api.example.com)" -DefaultValue "http://localhost:3000"
            $SocketUrl = Read-Host "Socket.io URL (e.g., https://socket.example.com)" -DefaultValue "http://localhost:3000"
        }
        'local' { $BackendUrl = 'http://10.0.2.2:3000'; $SocketUrl = 'http://10.0.2.2:3000' }
    }
    $mapboxChoice = Read-Host "Mapbox public token? (y/n, press Enter to skip)" -DefaultValue "n"
    if ($mapboxChoice -match '[Yy]') { $MapboxToken = Read-Host "Enter token (pk....)" }
    else { $MapboxToken = "" }

    $frontendEnvContent = @"
VITE_API_BASE_URL=$BackendUrl
VITE_SOCKET_URL=$SocketUrl
VITE_MAPBOX_TOKEN=$MapboxToken
"@

    $frontendEnvContent | Out-File -Encoding UTF8 (Join-Path $frontendDir ".env")
    Write-Host "Frontend .env written to $frontendDir\.env`n" -ForegroundColor Green
}

# ANDROID ----
if ($Scope -eq 'full' -or $Scope -eq 'android') {
    Write-Host "Android build mode`n" -ForegroundColor Yellow
    Write-Host "1) debug   - For development and testing`n2) release - For production release`n"
    $modeChoice = Read-Host "Choice (1-2, default 2)" -DefaultValue 2
    if ($modeChoice -eq '1') { $androidMode = 'debug' }
    else { $androidMode = 'release' }

    $apiUrl = "http://10.0.2.2:3000"
    if ($androidMode -eq 'release') {
        $apiUrl = Read-Host "Production API Base URL (press Enter for default)" -DefaultValue "https://api.example.com"
    }

    $certPins = Read-Host "Certificate SHA-256 pins (comma-separated, press Enter to skip)" -DefaultValue ""
    $fcmChoice = Read-Host "Enable Firebase/FCM? (y/n, default y)" -DefaultValue "y"
    $enableFcm = ($fcmChoice -match '[Yy]')

    $buildConfig = @"
// Auto-generated BuildConfig by Kavach Deployment Wizard
const string API_BASE_URL = "$apiUrl";
const bool FCM_ENABLED = $enableFcm;
const bool CERT_PINNING_ENABLED = ($androidMode -eq 'release' -and "$certPins" != "");
const string CERT_PINS = "$certPins";
const int VERSION_CODE = 1;
const string VERSION_NAME = "1.0";
"@

    $buildConfigDir = Join-Path $appDir "obj"
    $null = New-Item -ItemType Directory -Path $buildConfigDir -Force
    $buildConfig | Out-File -Encoding UTF8 (Join-Path $buildConfigDir "BuildConfig.cs")
    Write-Host "Android BuildConfig.cs written to $buildConfigDir\BuildConfig.cs`n" -ForegroundColor Green

    if ($certPins) {
        $gradlePath = Join-Path $projectRoot "gradle.properties"
        $gradleContent = ""
        if (Test-Path $gradlePath) { $gradleContent = Get-Content $gradlePath -Raw }
        $gradleContent = $gradleContent -replace "SAFEGUARD_PINS=.*", "SAFEGUARD_PINS=$certPins"
        $gradleContent = $gradleContent + "`nSAFEGUARD_PINS=$certPins"
        $gradleContent | Out-File -Encoding UTF8 $gradlePath
        Write-Host "gradle.properties updated with pins`n" -ForegroundColor Gray
    }

    if ($enableFcm) {
        Write-Host "Place google-services.json in $appDir/ for Firebase functionality`n" -ForegroundColor Yellow
    }
}

Write-Host "`nDeployment complete. All configurations generated automatically.`n" -ForegroundColor Cyan
Write-Host "Run again to regenerate or modify configurations.`n" -ForegroundColor Magenta