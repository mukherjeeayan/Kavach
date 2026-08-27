#!/usr/bin/env pwsh
# Kavach Frontend Deployment Configuration
# Generates .env file and configures for the backend endpoint

param(
    [Parameter(Mandatory=$false)]
    [string]$Mode = 'development',

    [Parameter(Mandatory=$false)]
    [string]$BackendUrl = 'http://localhost:3000',

    [Parameter(Mandatory=$false)]
    [string]$SocketUrl,

    [Parameter(Mandatory=$false)]
    [string]$MapboxToken
)

$projectRoot = "C:\Users\mukhe\Documents\Ayan Mukherjee\Projects\Kavach"
$frontendDir = Join-Path $projectRoot "frontend"
$envPath = Join-Path $frontendDir ".env"

Write-Host "Kavach Frontend Deployment Configurator" -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Yellow
Write-Host ""

# Detect mode
if (-not $PSBoundParameters.ContainsKey('Mode')) {
    Write-Host "Select deployment mode:" -ForegroundColor Yellow
    Write-Host "  1) development   - Uses Vite proxy to localhost:3000"
    Write-Host "  2) production    - Uses direct backend URL"
    Write-Host "  3) local         - Local development"
    $choice = Read-Host "Enter choice (1-3, default 1)"
    
    switch ($choice) {
        '2' { $Mode = 'production' }
        '3' { $Mode = 'local' }
        default { $Mode = 'development' }
    }
}

# Set backend URL based on mode
switch ($Mode) {
    'development' {
        $BackendUrl = 'http://localhost:3000'
        $SocketUrl = 'http://localhost:3000'
        Write-Host "  Development mode: Using Vite proxy" -ForegroundColor Green
    }
    'production' {
        $BackendUrl = Read-Host "Enter backend API URL (e.g., https://api.yourcompany.com)" -DefaultValue "http://localhost:3000"
        $SocketUrl = Read-Host "Enter Socket.io URL (e.g., https://socket.yourcompany.com)" -DefaultValue "http://localhost:3000"
    }
    'local' {
        $BackendUrl = 'http://10.0.2.2:3000'
        $SocketUrl = 'http://10.0.2.2:3000'
        Write-Host "  Local mode: Using 10.0.2.2 for Android emulator" -ForegroundColor Green
    }
}

# Mapbox token
$mapboxChoice = Read-Host "Do you have a Mapbox public token? (y/n, press Enter to skip)" -DefaultValue "n"
if ($mapboxChoice -match '[Yy]') {
    $MapboxToken = Read-Host "Enter Mapbox public token (pk....)"
}

# Build the .env content - use simple string concatenation
$envLines = @()
$envLines += "# Kavach Auto-Generated Frontend Environment Configuration"
$envLines += "# Mode: $Mode"
$envLines += "# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$envLines += ""
$envLines += "# Backend API base URL"
$envLines += "# Omit to use the Vite dev proxy /api/v1 (development mode)"
$envLines += "VITE_API_BASE_URL=$BackendUrl"
$envLines += ""
$envLines += "# Backend socket.io URL for realtime rule:changed pushes"
$envLines += "# (e.g. http://localhost:3000 in dev)"
$envLines += "VITE_SOCKET_URL=$SocketUrl"
$envLines += ""
$envLines += "# Mapbox public token (pk.…) — enables the embedded location map"
$envLines += "VITE_MAPBOX_TOKEN=$MapboxToken"

# Write .env file using join
$envContent = $envLines -join "`n"
Write-Host "Writing .env file to $envPath" -ForegroundColor Green
$envContent | Out-File -Encoding UTF8 $envPath

Write-Host "" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review the .env file in the frontend directory"
Write-Host "  2. Run: cd frontend && npm install"
Write-Host "  3. For development: npm run dev"
Write-Host "  4. For production build: npm run build"
Write-Host "  5. Preview production build: npm run preview"
Write-Host ""
Write-Host "Notes:" -ForegroundColor Gray
Write-Host "  - VITE_API_BASE_URL: The base URL of your backend API"
Write-Host "  - VITE_SOCKET_URL: The URL for Socket.io realtime connections"
Write-Host "  - VITE_MAPBOX_TOKEN: Optional — Mapbox public token for maps"
Write-Host "    If omitted, map functionality will not work"
Write-Host "  - In development, Vite proxy handles /api and /socket.io routing"