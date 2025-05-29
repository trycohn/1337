@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: Скрипт развертывания обновленного дизайна турниров для Windows
:: Автор: AI Assistant

echo.
echo ========================================
echo   Развертывание дизайна турниров 1337
echo ========================================
echo.

:: Проверка наличия SSH клиента
where ssh >nul 2>&1
if %errorlevel% neq 0 (
    echo [ОШИБКА] SSH клиент не найден. Установите OpenSSH или используйте PuTTY.
    pause
    exit /b 1
)

:: Запрос данных для подключения
set /p SERVER_IP="Введите IP адрес сервера: "
set /p USERNAME="Введите имя пользователя (по умолчанию root): "
if "%USERNAME%"=="" set USERNAME=root

echo.
echo [ИНФО] Подключение к серверу %SERVER_IP% под пользователем %USERNAME%...
echo.

:: Создание временного скрипта для выполнения на сервере
echo #!/bin/bash > temp_deploy.sh
echo set -e >> temp_deploy.sh
echo. >> temp_deploy.sh
echo # Цвета для вывода >> temp_deploy.sh
echo RED='\033[0;31m' >> temp_deploy.sh
echo GREEN='\033[0;32m' >> temp_deploy.sh
echo YELLOW='\033[1;33m' >> temp_deploy.sh
echo BLUE='\033[0;34m' >> temp_deploy.sh
echo NC='\033[0m' >> temp_deploy.sh
echo. >> temp_deploy.sh
echo log^(^) { >> temp_deploy.sh
echo     echo -e "${BLUE}[$(date +'%%Y-%%m-%%d %%H:%%M:%%S')]${NC} $1" >> temp_deploy.sh
echo } >> temp_deploy.sh
echo. >> temp_deploy.sh
echo success^(^) { >> temp_deploy.sh
echo     echo -e "${GREEN}[SUCCESS]${NC} $1" >> temp_deploy.sh
echo } >> temp_deploy.sh
echo. >> temp_deploy.sh
echo error^(^) { >> temp_deploy.sh
echo     echo -e "${RED}[ERROR]${NC} $1" >> temp_deploy.sh
echo } >> temp_deploy.sh
echo. >> temp_deploy.sh
echo log "Начинаем развертывание обновленного дизайна турниров..." >> temp_deploy.sh
echo. >> temp_deploy.sh
echo # Переход в директорию проекта >> temp_deploy.sh
echo cd /var/www/1337community.com ^|^| { error "Директория проекта не найдена"; exit 1; } >> temp_deploy.sh
echo. >> temp_deploy.sh
echo # Создание резервной копии >> temp_deploy.sh
echo BACKUP_DIR="/backup/1337community-design-$(date +%%Y%%m%%d_%%H%%M%%S)" >> temp_deploy.sh
echo log "Создаем резервную копию..." >> temp_deploy.sh
echo mkdir -p "$BACKUP_DIR" >> temp_deploy.sh
echo cp -r frontend/src/components/TournamentDetails.css "$BACKUP_DIR/" 2^>/dev/null ^|^| true >> temp_deploy.sh
echo cp -r frontend/src/components/Home.css "$BACKUP_DIR/" 2^>/dev/null ^|^| true >> temp_deploy.sh
echo success "Резервная копия создана в $BACKUP_DIR" >> temp_deploy.sh
echo. >> temp_deploy.sh
echo # Остановка сервиса >> temp_deploy.sh
echo log "Останавливаем сервис 1337-backend..." >> temp_deploy.sh
echo systemctl stop 1337-backend ^|^| true >> temp_deploy.sh
echo. >> temp_deploy.sh
echo # Обновление кода >> temp_deploy.sh
echo log "Обновляем код из Git..." >> temp_deploy.sh
echo git fetch origin >> temp_deploy.sh
echo git pull origin main >> temp_deploy.sh
echo success "Код обновлен" >> temp_deploy.sh
echo. >> temp_deploy.sh
echo # Сборка frontend >> temp_deploy.sh
echo log "Собираем frontend..." >> temp_deploy.sh
echo cd frontend >> temp_deploy.sh
echo npm install >> temp_deploy.sh
echo npm run build >> temp_deploy.sh
echo cd .. >> temp_deploy.sh
echo success "Frontend собран" >> temp_deploy.sh
echo. >> temp_deploy.sh
echo # Копирование файлов >> temp_deploy.sh
echo log "Копируем файлы..." >> temp_deploy.sh
echo rm -rf /var/www/1337community.com/frontend/build.old 2^>/dev/null ^|^| true >> temp_deploy.sh
echo mv /var/www/1337community.com/frontend/build /var/www/1337community.com/frontend/build.old 2^>/dev/null ^|^| true >> temp_deploy.sh
echo cp -r frontend/build /var/www/1337community.com/frontend/ >> temp_deploy.sh
echo success "Файлы скопированы" >> temp_deploy.sh
echo. >> temp_deploy.sh
echo # Установка прав >> temp_deploy.sh
echo log "Устанавливаем права доступа..." >> temp_deploy.sh
echo chown -R www-data:www-data /var/www/1337community.com >> temp_deploy.sh
echo chmod -R 755 /var/www/1337community.com >> temp_deploy.sh
echo success "Права установлены" >> temp_deploy.sh
echo. >> temp_deploy.sh
echo # Запуск сервиса >> temp_deploy.sh
echo log "Запускаем сервис 1337-backend..." >> temp_deploy.sh
echo systemctl start 1337-backend >> temp_deploy.sh
echo sleep 3 >> temp_deploy.sh
echo systemctl reload nginx >> temp_deploy.sh
echo success "Сервисы запущены" >> temp_deploy.sh
echo. >> temp_deploy.sh
echo # Проверка >> temp_deploy.sh
echo log "Проверяем работоспособность..." >> temp_deploy.sh
echo systemctl status 1337-backend --no-pager -l ^| head -5 >> temp_deploy.sh
echo. >> temp_deploy.sh
echo success "Развертывание завершено!" >> temp_deploy.sh
echo echo "🎨 Обновления дизайна:" >> temp_deploy.sh
echo echo "  ✅ Минималистичный черно-белый стиль" >> temp_deploy.sh
echo echo "  ✅ Обновленные страницы турниров" >> temp_deploy.sh
echo echo "  ✅ Единая цветовая схема" >> temp_deploy.sh
echo echo "🌐 Проверьте: https://1337community.com" >> temp_deploy.sh

:: Копирование и выполнение скрипта на сервере
echo [ИНФО] Копируем скрипт на сервер...
scp temp_deploy.sh %USERNAME%@%SERVER_IP%:/tmp/deploy_design.sh
if %errorlevel% neq 0 (
    echo [ОШИБКА] Не удалось скопировать скрипт на сервер
    del temp_deploy.sh
    pause
    exit /b 1
)

echo [ИНФО] Выполняем развертывание на сервере...
ssh %USERNAME%@%SERVER_IP% "chmod +x /tmp/deploy_design.sh && sudo /tmp/deploy_design.sh && rm /tmp/deploy_design.sh"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО УСПЕШНО!
    echo ========================================
    echo.
    echo 🎨 Обновления дизайна:
    echo   ✅ Минималистичный черно-белый стиль
    echo   ✅ Обновленные страницы турниров  
    echo   ✅ Единая цветовая схема
    echo   ✅ Улучшенная типографика
    echo.
    echo 🌐 Проверьте работу сайта: https://1337community.com
    echo.
) else (
    echo.
    echo ========================================
    echo   ОШИБКА ПРИ РАЗВЕРТЫВАНИИ!
    echo ========================================
    echo.
    echo Проверьте логи на сервере:
    echo   ssh %USERNAME%@%SERVER_IP% "sudo journalctl -u 1337-backend -n 20"
    echo.
)

:: Очистка временных файлов
del temp_deploy.sh

echo Нажмите любую клавишу для выхода...
pause >nul 