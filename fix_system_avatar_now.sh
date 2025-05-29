#!/bin/bash

# Быстрый скрипт для немедленного исправления аватара системного пользователя 1337community
# Использовать когда аватар не обновился в существующем чате

echo "🚨 ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ АВАТАРА СИСТЕМНОГО ПОЛЬЗОВАТЕЛЯ"
echo "========================================================="

# Переходим в директорию проекта
cd /var/www/1337community || {
    echo "❌ Ошибка: Не удалось перейти в директорию проекта /var/www/1337community"
    exit 1
}

echo "📁 Текущая директория: $(pwd)"

# Переходим в директорию backend
cd backend || {
    echo "❌ Ошибка: Не удалось перейти в директорию backend"
    exit 1
}

# Сначала запускаем диагностику
echo "🔍 Запуск диагностики аватара системного пользователя..."
NODE_ENV=production node debug_system_avatar.js
if [ $? -ne 0 ]; then
    echo "⚠️ Диагностика завершилась с ошибками, но продолжаем исправление..."
fi

echo ""
echo "🔄 Запуск принудительного исправления аватара..."

# Запускаем принудительное обновление аватара
NODE_ENV=production node force_update_system_avatar.js
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при принудительном обновлении аватара"
    exit 1
fi

# Возвращаемся в корневую директорию проекта
cd ..

# Перезапускаем сервис приложения
echo "🔄 Перезапуск сервиса приложения..."
sudo systemctl restart 1337-backend
if [ $? -eq 0 ]; then
    echo "✅ Сервис 1337-backend перезапущен успешно"
else
    echo "⚠️ Не удалось перезапустить сервис 1337-backend, попробуйте вручную"
fi

# Проверяем статус сервиса
echo "📋 Проверка статуса сервиса..."
sudo systemctl status 1337-backend --no-pager -l

# Проверяем доступность файла аватара
echo ""
echo "🔍 Проверка доступности файла аватара..."
if [ -f "backend/uploads/avatars/1337-logo-chat.png" ]; then
    echo "✅ Файл аватара найден: backend/uploads/avatars/1337-logo-chat.png"
    ls -la backend/uploads/avatars/1337-logo-chat.png
else
    echo "❌ Файл аватара НЕ НАЙДЕН: backend/uploads/avatars/1337-logo-chat.png"
    echo "📋 Содержимое директории backend/uploads/avatars/:"
    ls -la backend/uploads/avatars/ 2>/dev/null || echo "Директория не существует"
fi

# Проверяем доступность через HTTP
echo ""
echo "🌐 Проверка доступности аватара через HTTP..."
if command -v curl >/dev/null 2>&1; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/uploads/avatars/1337-logo-chat.png)
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "✅ Аватар доступен через HTTP (статус: $HTTP_STATUS)"
    else
        echo "❌ Аватар недоступен через HTTP (статус: $HTTP_STATUS)"
    fi
else
    echo "⚠️ curl не установлен, пропускаем HTTP проверку"
fi

echo ""
echo "🎉 ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!"
echo "=================================="
echo ""
echo "📝 Следующие шаги:"
echo "1. ✅ Очистите кэш браузера (Ctrl+F5)"
echo "2. ✅ Откройте сайт в режиме инкогнито"
echo "3. ✅ Проверьте чат - аватар должен отображаться как логотип 1337"
echo ""
echo "🔍 Если проблема не решена:"
echo "1. Проверьте логи сервера: sudo journalctl -u 1337-backend -f"
echo "2. Запустите диагностику еще раз: cd backend && NODE_ENV=production node debug_system_avatar.js"
echo "3. Обратитесь к разработчику с результатами диагностики"
echo ""
echo "🏁 Скрипт завершен: $(date)" 