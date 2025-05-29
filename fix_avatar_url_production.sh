#!/bin/bash

# Скрипт для исправления URL аватара системного пользователя в production
# Исправляет localhost URL на правильный домен

echo "🔧 ИСПРАВЛЕНИЕ URL АВАТАРА СИСТЕМНОГО ПОЛЬЗОВАТЕЛЯ В PRODUCTION"
echo "=============================================================="

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

# Создаем временный скрипт для исправления URL
cat > fix_avatar_url.js << 'EOF'
const pool = require('./db');

async function fixAvatarUrl() {
    try {
        console.log('🔄 Исправление URL аватара системного пользователя...');
        
        // Правильный URL для production
        const correctAvatarUrl = 'https://1337community.com/uploads/avatars/1337-logo-chat.png';
        
        // Находим системного пользователя
        const userCheck = await pool.query('SELECT id, username, avatar_url FROM users WHERE username = $1', ['1337community']);
        
        if (userCheck.rows.length === 0) {
            console.log('❌ Системный пользователь 1337community не найден');
            return;
        }
        
        const user = userCheck.rows[0];
        console.log(`📋 Найден пользователь: ${user.username}`);
        console.log(`📋 Текущий URL: ${user.avatar_url || 'не установлен'}`);
        console.log(`📋 Правильный URL: ${correctAvatarUrl}`);
        
        // Проверяем, нужно ли обновление
        if (user.avatar_url === correctAvatarUrl) {
            console.log('✅ URL аватара уже корректный');
            return;
        }
        
        // Обновляем URL аватара
        await pool.query(
            'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE username = $2',
            [correctAvatarUrl, '1337community']
        );
        
        console.log('✅ URL аватара успешно обновлен');
        
        // Проверяем результат
        const updatedUser = await pool.query('SELECT avatar_url, updated_at FROM users WHERE username = $1', ['1337community']);
        const updated = updatedUser.rows[0];
        
        console.log(`✅ Новый URL: ${updated.avatar_url}`);
        console.log(`✅ Обновлено: ${updated.updated_at}`);
        
    } catch (error) {
        console.error('❌ Ошибка при исправлении URL аватара:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

fixAvatarUrl()
    .then(() => {
        console.log('🎉 Исправление URL завершено успешно');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Ошибка:', error);
        process.exit(1);
    });
EOF

# Запускаем скрипт исправления
echo "🔄 Запуск исправления URL аватара..."
NODE_ENV=production node fix_avatar_url.js
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при исправлении URL аватара"
    exit 1
fi

# Удаляем временный скрипт
rm -f fix_avatar_url.js

# Возвращаемся в корневую директорию
cd ..

# Перезапускаем сервис
echo ""
echo "🔄 Перезапуск сервиса для применения изменений..."
sudo systemctl restart 1337-backend
if [ $? -eq 0 ]; then
    echo "✅ Сервис перезапущен успешно"
else
    echo "⚠️ Не удалось перезапустить сервис через systemctl"
    echo "🔄 Пытаемся через PM2..."
    pm2 restart 1337-backend 2>/dev/null || {
        echo "⚠️ Не удалось перезапустить через PM2"
        echo "📋 Перезапустите сервис вручную"
    }
fi

# Ждем запуска сервиса
echo "⏳ Ожидание запуска сервиса..."
sleep 5

# Проверяем доступность аватара
echo ""
echo "🌐 Проверка доступности аватара..."
if command -v curl >/dev/null 2>&1; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/uploads/avatars/1337-logo-chat.png)
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "✅ Аватар доступен через HTTPS (статус: $HTTP_STATUS)"
    else
        echo "❌ Аватар недоступен через HTTPS (статус: $HTTP_STATUS)"
    fi
else
    echo "⚠️ curl не установлен, пропускаем HTTP проверку"
fi

echo ""
echo "🎉 ИСПРАВЛЕНИЕ URL АВАТАРА ЗАВЕРШЕНО!"
echo "===================================="
echo ""
echo "📝 Что было сделано:"
echo "1. ✅ Исправлен URL аватара в базе данных"
echo "2. ✅ Обновлено поле updated_at для сброса кэша"
echo "3. ✅ Перезапущен сервис приложения"
echo "4. ✅ Проверена доступность аватара"
echo ""
echo "📝 Следующие шаги:"
echo "1. ✅ Очистите кэш браузера (Ctrl+F5)"
echo "2. ✅ Откройте сайт в режиме инкогнито"
echo "3. ✅ Проверьте чат - аватар должен загружаться с правильного URL"
echo ""
echo "🏁 Скрипт завершен: $(date)" 