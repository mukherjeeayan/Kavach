@echo off
title Kavach Frontend Deployment Configurator
color 0A

echo ==========================================
echo Kavach Frontend Deployment Configurator
echo ==========================================
echo.

:: Ask for mode
set /p mode="Enter mode (development/production/local, default: development): "
if "%mode%"=="" set mode=development

if /i "%mode%"==production (
    set "MODE=production"
    echo Using production mode...
    set /p backend_url="Enter backend API URL (e.g., https://api.example.com): "
    set /p socket_url="Enter Socket.io URL (e.g., https://socket.example.com): "
) else if /i "%mode%"==local (
    set "MODE=local"
    echo Using local mode...
    set "backend_url=http://10.0.2.2:3000"
    set "socket_url=http://10.0.2.2:3000"
) else (
    set "MODE=development"
    echo Using development mode...
    set "backend_url=http://localhost:3000"
    set "socket_url=http://localhost:3000"
)

echo.
echo Mapbox token (optional, press Enter to skip):
set /p mapbox_token=

:: Write .env file
echo.
echo Writing .env file...
cat > "%~dp0..\frontend\.env" << 'ENVEOF'
# Kavach Auto-Generated Frontend Environment Configuration
# Mode: %MODE%
# Generated: %DATE% %TIME%

VITE_API_BASE_URL=%backend_url%
VITE_SOCKET_URL=%socket_url%
VITE_MAPBOX_TOKEN=%mapbox_token%
ENVEOF

echo.
echo ==========================================
echo Frontend .env generated successfully!
echo ==========================================
echo.
echo .env file location: %~dp0..\frontend\.env
echo.
echo Next steps:
echo 1. Review the .env file in the frontend directory
echo 2. Run: cd frontend && npm install
echo 3. Run: npm run dev (development)
echo 4. Run: npm run build (production)
echo 5. Run: npm run preview (preview production)
echo.
pause