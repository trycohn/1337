#!/bin/bash

# Полный скрипт исправления аватара системного пользователя 1337community
# Исправляет все возможные проблемы

echo "🔧 ПОЛНОЕ ИСПРАВЛЕНИЕ АВАТАРА СИСТЕМНОГО ПОЛЬЗОВАТЕЛЯ 1337community"
echo "=================================================================="

# Переходим в директорию проекта
cd /var/www/1337community || {
    echo "❌ Ошибка: Не удалось перейти в директорию проекта /var/www/1337community"
    exit 1
}

echo "📁 Текущая директория: $(pwd)"

# Обновляем код из GitHub
echo "📥 Обновление кода из GitHub..."
git pull origin main
if [ $? -ne 0 ]; then
    echo "⚠️ Предупреждение: Не удалось обновить код из GitHub"
fi

# Переходим в директорию backend
cd backend || {
    echo "❌ Ошибка: Не удалось перейти в директорию backend"
    exit 1
}

# Запускаем диагностику
echo ""
echo "🔍 ЭТАП 1: Диагностика текущего состояния"
echo "=========================================="
NODE_ENV=production node debug_system_avatar.js
if [ $? -ne 0 ]; then
    echo "⚠️ Диагностика завершилась с ошибками, но продолжаем исправление..."
fi

# Принудительное обновление аватара
echo ""
echo "🔄 ЭТАП 2: Принудительное обновление аватара"
echo "============================================"
NODE_ENV=production node force_update_system_avatar.js
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при принудительном обновлении аватара"
    exit 1
fi

# Возвращаемся в корневую директорию
cd ..

# Перезапускаем сервис
echo ""
echo "🔄 ЭТАП 3: Перезапуск сервиса"
echo "============================"
sudo systemctl restart 1337-backend
if [ $? -eq 0 ]; then
    echo "✅ Сервис 1337-backend перезапущен успешно"
else
    echo "⚠️ Не удалось перезапустить сервис 1337-backend через systemctl"
    echo "🔄 Пытаемся через PM2..."
    pm2 restart 1337-backend 2>/dev/null || {
        echo "⚠️ Не удалось перезапустить через PM2"
        echo "📋 Перезапустите сервис вручную"
    }
fi

# Ждем запуска сервиса
echo "⏳ Ожидание запуска сервиса..."
sleep 10

# Проверяем статус сервиса
echo ""
echo "📋 ЭТАП 4: Проверка статуса сервиса"
echo "==================================="
if systemctl is-active --quiet 1337-backend; then
    echo "✅ Сервис работает через systemctl"
    sudo systemctl status 1337-backend --no-pager -l | head -20
elif pm2 list | grep -q "1337-backend.*online"; then
    echo "✅ Сервис работает через PM2"
    pm2 list | grep 1337-backend
else
    echo "⚠️ Предупреждение: Статус сервиса неопределен"
fi

# Проверяем файл аватара
echo ""
echo "📁 ЭТАП 5: Проверка файла аватара"
echo "================================="
if [ -f "backend/uploads/avatars/1337-logo-chat.png" ]; then
    echo "✅ Файл аватара найден: backend/uploads/avatars/1337-logo-chat.png"
    ls -la backend/uploads/avatars/1337-logo-chat.png
    
    # Проверяем размер файла
    FILE_SIZE=$(stat -c%s "backend/uploads/avatars/1337-logo-chat.png" 2>/dev/null || echo "0")
    if [ "$FILE_SIZE" -gt 1000 ]; then
        echo "✅ Размер файла корректный: $FILE_SIZE байт"
    else
        echo "⚠️ Предупреждение: Файл слишком маленький: $FILE_SIZE байт"
    fi
else
    echo "❌ Файл аватара НЕ НАЙДЕН: backend/uploads/avatars/1337-logo-chat.png"
    echo "📋 Содержимое директории backend/uploads/avatars/:"
    ls -la backend/uploads/avatars/ 2>/dev/null || echo "Директория не существует"
fi

# Проверяем доступность через HTTP
echo ""
echo "🌐 ЭТАП 6: Проверка HTTP доступности"
echo "===================================="
if command -v curl >/dev/null 2>&1; then
    # Проверяем локально
    LOCAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/uploads/avatars/1337-logo-chat.png)
    if [ "$LOCAL_STATUS" = "200" ]; then
        echo "✅ Аватар доступен локально (статус: $LOCAL_STATUS)"
    else
        echo "❌ Аватар недоступен локально (статус: $LOCAL_STATUS)"
    fi
    
    # Проверяем через домен (если production)
    if [ "$NODE_ENV" = "production" ]; then
        PROD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/uploads/avatars/1337-logo-chat.png)
        if [ "$PROD_STATUS" = "200" ]; then
            echo "✅ Аватар доступен через домен (статус: $PROD_STATUS)"
        else
            echo "❌ Аватар недоступен через домен (статус: $PROD_STATUS)"
        fi
    fi
else
    echo "⚠️ curl не установлен, пропускаем HTTP проверку"
fi

# Финальная диагностика
echo ""
echo "🔍 ЭТАП 7: Финальная диагностика"
echo "================================"
cd backend
NODE_ENV=production node debug_system_avatar.js
FINAL_RESULT=$?
cd ..

echo ""
echo "🎉 ПОЛНОЕ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!"
echo "==============================="
echo ""
echo "📊 Результаты:"
if [ $FINAL_RESULT -eq 0 ]; then
    echo "✅ Все проверки пройдены успешно"
    echo "✅ Аватар системного пользователя должен отображаться корректно"
else
    echo "⚠️ Обнаружены проблемы в финальной диагностике"
fi

echo ""
echo "📝 Следующие шаги:"
echo "1. ✅ Очистите кэш браузера (Ctrl+F5)"
echo "2. ✅ Откройте сайт в режиме инкогнито"
echo "3. ✅ Проверьте чат с системным пользователем '1337community'"
echo "4. ✅ Убедитесь, что аватар отображается как логотип 1337"

echo ""
echo "🔍 Если проблема не решена:"
echo "1. Проверьте логи сервера: sudo journalctl -u 1337-backend -f"
echo "2. Проверьте логи PM2: pm2 logs 1337-backend"
echo "3. Обратитесь к разработчику с результатами диагностики"

echo ""
echo "🏁 Скрипт завершен: $(date)"
echo "Статус: $([ $FINAL_RESULT -eq 0 ] && echo "✅ УСПЕШНО" || echo "⚠️ С ПРЕДУПРЕЖДЕНИЯМИ")" 