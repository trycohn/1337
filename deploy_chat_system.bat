@echo off
setlocal enabledelayedexpansion

REM Скрипт развертывания новой системы чатов для Windows
REM Автор: AI Assistant

echo ==================================================
echo   Развертывание новой системы чатов
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

if exist "frontend\src\components" (
    xcopy "frontend\src\components" "%BACKUP_DIR%\components\" /E /I /Q >nul
    echo [SUCCESS] Компоненты скопированы в резервную копию
)

if exist "frontend\src\App.js" (
    copy "frontend\src\App.js" "%BACKUP_DIR%\" >nul
    echo [SUCCESS] App.js скопирован в резервную копию
)

echo [SUCCESS] Резервная копия создана в %BACKUP_DIR%

REM Обновление из Git (если доступно)
echo [INFO] Проверка Git репозитория...
if exist ".git" (
    echo [INFO] Обновление кода из Git...
    git stash push -m "Auto-stash before deployment %date% %time%"
    git fetch origin
    git pull origin main
    echo [SUCCESS] Код обновлен из Git
) else (
    echo [WARNING] Git репозиторий не найден. Пропускаем обновление из Git.
)

REM Установка зависимостей
echo [INFO] Установка зависимостей...
cd frontend

REM Очистка кэша npm
npm cache clean --force >nul 2>&1

REM Установка зависимостей
npm install
if errorlevel 1 (
    echo [ERROR] Ошибка при установке зависимостей
    cd ..
    pause
    exit /b 1
)

echo [SUCCESS] Зависимости установлены

REM Сборка проекта
echo [INFO] Сборка проекта...
npm run build
if errorlevel 1 (
    echo [ERROR] Ошибка при сборке проекта
    cd ..
    pause
    exit /b 1
)

echo [SUCCESS] Проект успешно собран
cd ..

REM Развертывание на сервере (для локального тестирования)
echo [INFO] Подготовка к развертыванию...

REM Проверка размера собранного проекта
if exist "frontend\build" (
    echo [INFO] Сборка завершена. Файлы готовы к развертыванию.
    dir "frontend\build" /s /-c | find "файлов"
    echo [SUCCESS] Файлы фронтенда готовы
) else (
    echo [ERROR] Папка build не найдена
    pause
    exit /b 1
)

REM Очистка временных файлов
echo [INFO] Очистка временных файлов...
cd frontend
npm cache clean --force >nul 2>&1
cd ..

REM Удаление старых логов (если есть)
forfiles /p . /m *.log /d -7 /c "cmd /c del @path" 2>nul

echo [SUCCESS] Временные файлы очищены

echo.
echo ==================================================
echo [SUCCESS] Развертывание завершено успешно!
echo ==================================================
echo.
echo Изменения:
echo ✅ Удалена система уведомлений
echo ✅ Удален значок уведомлений из навигации  
echo ✅ Обновлен дизайн чата в черно-белом стиле
echo ✅ Создано руководство по дизайн-системе
echo.
echo Все уведомления теперь приходят в чат от пользователя '1337community'
echo.
echo Для развертывания на сервере:
echo 1. Скопируйте содержимое папки frontend\build на сервер
echo 2. Перезапустите веб-сервер (nginx/apache)
echo 3. Проверьте работоспособность сайта
echo.

pause 