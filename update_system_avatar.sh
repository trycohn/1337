#!/bin/bash

# Скрипт для обновления аватара системного пользователя 1337community на VDS сервере
# Автор: 1337 Community Team
# Дата: $(date +%Y-%m-%d)

echo "🚀 Начинаем обновление аватара системного пользователя 1337community..."
echo "=================================================="

# Переходим в директорию проекта
cd /var/www/1337community || {
    echo "❌ Ошибка: Не удалось перейти в директорию проекта /var/www/1337community"
    exit 1
}

echo "📁 Текущая директория: $(pwd)"

# Проверяем наличие файла аватара
if [ ! -f "backend/uploads/avatars/1337-logo-chat.png" ]; then
    echo "❌ Ошибка: Файл аватара backend/uploads/avatars/1337-logo-chat.png не найден"
    echo "📋 Содержимое директории backend/uploads/avatars/:"
    ls -la backend/uploads/avatars/ 2>/dev/null || echo "Директория не существует"
    exit 1
fi

echo "✅ Файл аватара найден: backend/uploads/avatars/1337-logo-chat.png"

# Получаем последние изменения из GitHub
echo "🔄 Получаем последние изменения из GitHub..."
git fetch origin main
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при получении изменений из GitHub"
    exit 1
fi

# Проверяем, есть ли новые изменения
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ Локальная версия актуальна"
else
    echo "🔄 Обнаружены новые изменения, обновляем..."
    git pull origin main
    if [ $? -ne 0 ]; then
        echo "❌ Ошибка при обновлении кода"
        exit 1
    fi
    echo "✅ Код успешно обновлен"
fi

# Переходим в директорию backend
cd backend || {
    echo "❌ Ошибка: Не удалось перейти в директорию backend"
    exit 1
}

# Устанавливаем зависимости (если нужно)
echo "📦 Проверяем зависимости..."
npm install --production
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при установке зависимостей"
    exit 1
fi

# Запускаем скрипт обновления аватара
echo "🔄 Запускаем обновление аватара системного пользователя..."
NODE_ENV=production node update_system_user_avatar.js
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при обновлении аватара"
    exit 1
fi

# Перезапускаем сервис приложения
echo "🔄 Перезапускаем сервис приложения..."
sudo systemctl restart 1337-backend
if [ $? -ne 0 ]; then
    echo "⚠️ Предупреждение: Не удалось перезапустить сервис через systemctl"
    echo "🔄 Пытаемся перезапустить через PM2..."
    pm2 restart 1337-backend 2>/dev/null || {
        echo "⚠️ Предупреждение: Не удалось перезапустить через PM2"
        echo "📋 Проверьте статус сервиса вручную"
    }
else
    echo "✅ Сервис успешно перезапущен"
fi

# Проверяем статус сервиса
echo "🔍 Проверяем статус сервиса..."
sleep 3
if systemctl is-active --quiet 1337-backend; then
    echo "✅ Сервис работает корректно"
elif pm2 list | grep -q "1337-backend.*online"; then
    echo "✅ Сервис работает через PM2"
else
    echo "⚠️ Предупреждение: Статус сервиса неопределен, проверьте вручную"
fi

# Проверяем доступность файла аватара через веб-сервер
echo "🌐 Проверяем доступность аватара через веб-сервер..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/uploads/avatars/1337-logo-chat.png)
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Аватар доступен по адресу: https://1337community.com/uploads/avatars/1337-logo-chat.png"
else
    echo "⚠️ Предупреждение: Аватар недоступен (HTTP $HTTP_STATUS)"
    echo "🔍 Проверьте настройки Nginx и права доступа к файлам"
fi

echo "=================================================="
echo "🎉 Обновление аватара системного пользователя завершено!"
echo ""
echo "📋 Что было сделано:"
echo "   ✅ Обновлен код из GitHub"
echo "   ✅ Установлены зависимости"
echo "   ✅ Обновлен аватар пользователя 1337community в базе данных"
echo "   ✅ Перезапущен сервис приложения"
echo ""
echo "🔗 Аватар доступен по адресу:"
echo "   https://1337community.com/uploads/avatars/1337-logo-chat.png"
echo ""
echo "📝 Для проверки работы чата:"
echo "   1. Откройте сайт https://1337community.com"
echo "   2. Перейдите в раздел 'Чат'"
echo "   3. Найдите чат с пользователем '1337community'"
echo "   4. Убедитесь, что отображается логотип 1337"
echo ""
echo "🏁 Развертывание завершено успешно!" 