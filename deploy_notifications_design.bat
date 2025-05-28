@echo off
setlocal enabledelayedexpansion

REM Скрипт развертывания нового дизайна уведомлений для Windows
REM Автор: AI Assistant

echo ==================================================
echo   Развертывание нового дизайна уведомлений
echo ==================================================
echo.

REM Проверка Node.js
echo [INFO] Проверка зависимостей...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js не установлен
    pause
    exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm не установлен
    pause
    exit /b 1
)

echo [SUCCESS] Зависимости проверены

REM Создание резервной копии
echo [INFO] Создание резервной копии...
set BACKUP_DIR=backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%
mkdir "%BACKUP_DIR%" 2>nul

if exist "frontend\src\components\Notifications.css" (
    copy "frontend\src\components\Notifications.css" "%BACKUP_DIR%\" >nul
)

if exist "frontend\src\components\Notifications.js" (
    copy "frontend\src\components\Notifications.js" "%BACKUP_DIR%\" >nul
)

if exist "frontend\src\components\Notifications\Toast.css" (
    copy "frontend\src\components\Notifications\Toast.css" "%BACKUP_DIR%\" >nul
)

if exist "frontend\src\components\Home.css" (
    copy "frontend\src\components\Home.css" "%BACKUP_DIR%\" >nul
)

echo [SUCCESS] Резервная копия создана в %BACKUP_DIR%

REM Сборка frontend
echo [INFO] Сборка frontend...
cd frontend

echo [INFO] Установка зависимостей...
call npm install
if errorlevel 1 (
    echo [ERROR] Ошибка при установке зависимостей
    cd ..
    pause
    exit /b 1
)

echo [INFO] Сборка проекта...
call npm run build
if errorlevel 1 (
    echo [ERROR] Ошибка при сборке frontend
    cd ..
    pause
    exit /b 1
)

echo [SUCCESS] Frontend собран успешно
cd ..

REM Проверка результата
if not exist "frontend\build" (
    echo [ERROR] Директория build не найдена
    pause
    exit /b 1
)

echo [SUCCESS] Сборка завершена успешно

REM Очистка
echo [INFO] Очистка временных файлов...
if exist "frontend\node_modules\.cache" (
    rmdir /s /q "frontend\node_modules\.cache" 2>nul
)

echo [SUCCESS] Очистка завершена

echo.
echo ==================================================
echo [SUCCESS] Развертывание завершено успешно!
echo ==================================================
echo.
echo Следующие шаги:
echo 1. Скопируйте содержимое frontend\build на ваш сервер
echo 2. Откройте https://yourdomain.com/notifications
echo 3. Проверьте всплывающие уведомления
echo 4. Протестируйте на мобильных устройствах
echo 5. Соберите обратную связь от пользователей
echo.

pause 