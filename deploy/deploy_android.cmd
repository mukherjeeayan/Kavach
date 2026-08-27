@echo off
title Kavach Android Build Configuration
color 0A

echo ==========================================
echo Kavach Android Build Configuration
echo ==========================================
echo.

:: Ask for build mode
set /p mode="Enter build mode (debug/release, default: release): "
if "%mode%"=="" set mode=release

if /i "%mode%"==debug (
    set "BUILD_MODE=debug"
    set "api_base_url=http://10.0.2.2:3000"
    set "enable_firebase=true"
    echo Using debug mode with 10.0.2.2 localhost...
) else (
    set "BUILD_MODE=release"
    echo Using release mode...
    set /p api_base_url="Enter production API Base URL (e.g., https://api.example.com): "
    if "%api_base_url%"=="" (
        echo ERROR: API Base URL is required for release builds
        pause
        exit /b 1
    )
    set /p cert_pins="Enter SHA-256 certificate pins (comma-separated, or press Enter if unsure): "
    set /p enable_firebase="Enable Firebase/FCM? (y/n, default y): "
    if "%enable_firebase%"=="" set "enable_firebase=y"
    if /i "%enable_firebase%"==n set "enable_firebase=false"
)

echo.
echo Building Android BuildConfig...

:: Create BuildConfig text file
echo.
echo API_BASE_URL: %api_base_url%
echo FCM_ENABLED: %enable_firebase%
echo CERT_PINNING_ENABLED: %cert_pins%

:: Write BuildConfig info
echo.
set "build_config=// Auto-generated BuildConfig by Kavach Deployment Wizard
// Do not edit manually — rebuild using deployment script

// API Base URL for the application
const string API_BASE_URL = "%api_base_url%";

// Feature flags
const bool FCM_ENABLED = %enable_firebase%;

// Certificate pinning status
const bool CERT_PINNING_ENABLED = (%mode%==release && not "%cert_pins%"=="");

// Production certificate pins
const string CERT_PINS = "%cert_pins%"

// Build version info
const int VERSION_CODE = 1;
const string VERSION_NAME = "1.0";
"

echo "%build_config%" > "%~dp0..\app\obj\BuildConfig.cs"
echo.
echo BuildConfig written to app/obj/BuildConfig.cs

:: Provide guidance
echo.
echo ==========================================
echo Android Build Configuration Complete
echo ==========================================
echo.
echo Release build command examples:
if %mode%==release (
    if "%cert_pins%"=="" (
        echo To build release: ./gradlew assembleRelease
        echo WARNING: Certificate pinning will fail without pins
    ) else (
        echo To build release: ./gradlew assembleRelease -PSAFEGUARD_PINS="%cert_pins%"
    )
)
echo.
echo Debug build command: ./gradlew assembleDebug
echo.
echo Install debug: ./gradlew installDebug
echo.
echo Firebase: Place google-services.json in app/ directory
echo if %enable_firebase%==true
echo.
echo SDK must be configured (local.properties sdk.dir)
echo.
pause