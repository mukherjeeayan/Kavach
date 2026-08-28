#!/usr/bin/env pwsh
# Kavach Android Deployment & Build Configuration
# Handles BuildConfig generation, certificate pinning, and release setup

param(
    [Parameter(Mandatory=$false)]
    [string]$Mode = 'release',  # debug | release
    
    [Parameter(Mandatory=$false)]
    [string]$ApiBaseUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$CertPins,
    
    [Parameter(Mandatory=$false)]
    [bool]$EnableFirebase = $true
)

$projectRoot = "C:\Users\mukhe\Documents\Ayan Mukherjee\Projects\Kavach"
$appDir = Join-Path $projectRoot "app"
$buildGradlePath = Join-Path $appDir "build.gradle.kts"
$gradlePropsPath = Join-Path $projectRoot "gradle.properties"
$localPropsPath = Join-Path $projectRoot "local.properties"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Kavach Android Build Configuration" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Detect mode
if (-not $PSBoundParameters.ContainsKey('Mode')) {
    Write-Host "Select build mode:" -ForegroundColor Yellow
    Write-Host "  1) debug   - For development and testing"
    Write-Host "  2) release - For production release (requires additional config)"
    $choice = Read-Host "Enter choice (1-2, default 2)" -DefaultValue 2
    
    if ($choice -eq '1') {
        $Mode = 'debug'
    }
}

# API Base URL
if ($Mode -eq 'release' -and -not $PSBoundParameters.ContainsKey('ApiBaseUrl')) {
    $ApiBaseUrl = Read-Host "Enter production API Base URL (e.g., https://api.yourcompany.com)" -DefaultValue ""
}

if ($Mode -eq 'debug') {
    # Debug uses 10.0.2.2 for localhost from emulator
    $ApiBaseUrl = "http://10.0.2.2:3000"
    Write-Host "  Debug mode: Using 10.0.2.2 (localhost from emulator)" -ForegroundColor Green
} elseif (-not $ApiBaseUrl) {
    Write-Error "API Base URL is required for release builds"
    return
}

# Certificate pinning
Write-Host "Certificate Pinning Configuration" -ForegroundColor Yellow
Write-Host "  Release builds require certificate pinning for security"
$pinChoice = Read-Host "Do you have production certificate pins? (y/n, press Enter if unsure)" -DefaultValue "n"

if ($pinChoice -match '[Yy]') {
    $CertPins = Read-Host "Enter comma-separated SHA-256 pins (e.g., sha256/abc123,sha256/def456)"
} else {
    $CertPins = ""
    Write-Host "  Note: Without pins, release build will fail (fail-closed security)" -ForegroundColor Yellow
}

# Firebase
$firebaseChoice = Read-Host "Enable Firebase/FCM? (y/n, default y)" -DefaultValue "y"
if ($firebaseChoice -match '[Nn]') {
    $EnableFirebase = $false
}

# Generate BuildConfig configuration
Write-Host ""
Write-Host "Generating BuildConfig configuration..." -ForegroundColor Green

# Create a temporary BuildConfig file that will be embedded
$buildConfigContent = @"
// Auto-generated BuildConfig by Kavach Deployment Wizard
// Do not edit manually — rebuild using deployment script

// These values are generated at build time via Gradle properties
// They override the defaults in build.gradle.kts

// API Base URL for the application
const string API_BASE_URL = "$ApiBaseUrl";

// Feature flags
const bool FCM_ENABLED = $EnableFirebase;

// Certificate pinning status
// In release mode, these pins must match the production API server certificate
// Set via gradle property: -PKAVACH_PINS="sha256/...,sha256/..."
const bool CERT_PINNING_ENABLED = ($Mode -eq 'release' -and "$CertPins" != "")

// Production certificate pins (set via gradle property)
// Format: "-PKAVACH_PINS=""sha256/...,sha256/..."""
const string CERT_PINS = "$CertPins"

// Build version info
const int VERSION_CODE = 1;
const string VERSION_NAME = "1.0";
"@

# Write BuildConfig.cs or embed in properties
$buildConfigPath = Join-Path $appDir "obj" "BuildConfig.cs"
$null = New-Item -ItemType Directory -Path (Split-Path $buildConfigPath) -Force
$buildConfigContent | Out-File -Encoding UTF8 $buildConfigPath

# Update gradle.properties if providing pins
if ($CertPins) {
    $gradlePropsContent = ""
    if (Test-Path $gradlePropsPath) {
        $gradlePropsContent = Get-Content $gradlePropsPath -Raw
    }
    
    # Add or update KAVACH_PINS
    if ($gradlePropsContent -match "KAVACH_PINS") {
        $gradlePropsContent = $gradlePropsContent -replace "KAVACH_PINS=.*", "KAVACH_PINS=$CertPins"
    } else {
        $gradlePropsContent = "$gradlePropsContent`nKAVACH_PINS=$CertPins"
    }
    
    $gradlePropsContent | Out-File -Encoding UTF8 $gradlePropsPath
    Write-Host "  Updated gradle.properties with certificate pins" -ForegroundColor Green
}

# Update local.properties if needed
if (-not (Test-Path $localPropsPath) -or ($localPropsPath | Get-Content | Select-String -pattern "sdk.dir" -notmatch "sdk.dir")) {
    $localProps = @"
sdk.dir=$env:LOCALAPPDATA\Android\Sdk
"@
    $localProps | Out-File -Encoding UTF8 $localPropsPath
    Write-Host "  Ensured local.properties has SDK path" -ForegroundColor Green
}

# Firebase google-services.json guidance
if ($EnableFirebase) {
    $gsPath = Join-Path $appDir "google-services.json"
    if (Test-Path $gsPath) {
        Write-Host "  Found existing google-services.json" -ForegroundColor Green
    } else {
        Write-Host "  Place google-services.json in: $appDir/" -ForegroundColor Yellow
        Write-Host "   (Required for Firebase/FCM functionality)" -ForegroundColor Gray
    }
}

# Summary and next steps
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Android Build Configuration Complete" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Generated BuildConfig values:" -ForegroundColor Cyan
Write-Host "  API_BASE_URL: $ApiBaseUrl" -ForegroundColor Cyan
Write-Host "  FCM_ENABLED: $EnableFirebase" -ForegroundColor Cyan
Write-Host "  CERT_PINNING_ENABLED: $(if ($Mode -eq 'release' -and "$CertPins" -ne '') { Write-Host "true (pins provided)" } else { Write-Host "false or debug mode" })" -ForegroundColor Cyan
Write-Host "  CERT_PINS: $CertPins" -ForegroundColor Cyan
Write-Host ""
Write-Host "Release build command examples:" -ForegroundColor Yellow
Write-Host "  # With certificate pins"
Write-Host "  ./gradlew assembleRelease -PKAVACH_PINS=\"$CertPins\""
Write-Host ""
Write-Host "  # Without pins (will fail in release mode)"
Write-Host "  ./gradlew assembleRelease"
Write-Host ""
Write-Host "Debug build command:" -ForegroundColor Yellow
Write-Host "  ./gradlew assembleDebug"
Write-Host ""
Write-Host "Install on device/emulator:" -ForegroundColor Cyan
Write-Host "  ./gradlew installDebug    # for debug"
Write-Host "  ./gradlew installRelease  # for release (with pins)"
Write-Host ""
Write-Host "Firebase requirement:" -ForegroundColor Yellow
Write-Host "  For push notifications, place google-services.json in $appDir/"
Write-Host "  Ensure FIREBASE_SERVICE_ACCOUNT_JSON is set in backend .env"