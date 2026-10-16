@echo off
cd /d "%~dp0"
if not exist config.local.php copy config.example.php config.local.php >nul
set "SAKTO_PHP=C:\xampp\php\php.exe"
if not exist "%SAKTO_PHP%" set "SAKTO_PHP=php"
"%SAKTO_PHP%" scripts\setup.php --admin
if errorlevel 1 (echo Check that XAMPP MySQL is running and config.local.php matches it. & pause & exit /b 1)
echo Open http://localhost/meal-planner after starting Apache.
echo Administrator credentials, if newly generated: .local\admin-credentials.txt
pause
