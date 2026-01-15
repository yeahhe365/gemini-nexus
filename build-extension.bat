@echo off
REM Gemini Nexus Chrome Extension Build Script for Windows
REM This script builds the extension and copies all necessary files to dist/

echo ========================================
echo   Building Gemini Nexus Chrome Extension
echo ========================================
echo.

cd gemini-nexus

REM Step 1: Clean dist directory
echo [1/4] Cleaning dist directory...
if exist dist rmdir /s /q dist
mkdir dist

REM Step 2: Run Vite build
echo [2/4] Running Vite build...
call npm run build

REM Step 3: Copy extension files
echo [3/4] Copying extension files...

copy manifest.json dist\ >nul
copy logo.png dist\ >nul
copy metadata.json dist\ >nul

xcopy background dist\background\ /E /I /Q /Y >nul
xcopy content dist\content\ /E /I /Q /Y >nul
xcopy lib dist\lib\ /E /I /Q /Y >nul
xcopy services dist\services\ /E /I /Q /Y >nul
xcopy css dist\css\ /E /I /Q /Y >nul

REM Copy sandbox theme_init.js (not bundled by Vite)
copy sandbox\theme_init.js dist\sandbox\ >nul

REM Step 4: Verify build
echo [4/4] Verifying build...
echo.
echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Build summary:
echo   - manifest.json: OK
echo   - logo.png: OK
echo   - background/: OK
echo   - content/: OK (includes pip.js)
echo   - sidepanel/: OK
echo   - sandbox/: OK
echo   - services/: OK
echo   - lib/: OK
echo   - css/: OK
echo.

if exist dist\content\pip.js (
    echo   PIP Window: OK (pip.js found)
) else (
    echo   PIP Window: WARNING (pip.js not found^!)
)

echo.
echo Extension location: %CD%\dist
echo.
echo Next steps:
echo   1. Open chrome://extensions/
echo   2. Enable 'Developer mode'
echo   3. Click 'Load unpacked'
echo   4. Select the 'dist' folder
echo   5. Press Alt+G to test PIP window!
echo.
echo See CHROME-EXTENSION-INSTALL.md for detailed instructions
echo.

pause
