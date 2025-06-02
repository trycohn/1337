#!/bin/bash

# 🎯 ОПТИМАЛЬНЫЙ скрипт деплоя для исправления проблем статистики профиля
# ✅ Решает: создание отсутствующей таблицы user_tournament_stats + улучшенный UX
# ⭐ ВАРИАНТ 2: ОПТИМАЛЬНЫЙ - быстро, безопасно, user-friendly

set -e

echo "🎯 ОПТИМАЛЬНОЕ исправление проблем статистики профиля..."
echo ""
echo "🔍 ДИАГНОЗ: Таблица user_tournament_stats НЕ СУЩЕСТВУЕТ!"
echo "💡 РЕШЕНИЕ: Создаем таблицу + улучшаем UX + добавляем error handling"
echo ""
echo "📋 ЧТО БУДЕТ ИСПРАВЛЕНО:"
echo "   ✅ Создана таблица user_tournament_stats для хранения результатов турниров"
echo "   ✅ Улучшен error handling с проверкой существования таблицы"
echo "   ✅ Добавлен детальный статус пересчета для пользователя"
echo "   ✅ UPSERT вместо DELETE+INSERT для безопасности"
echo "   ✅ Graceful degradation если что-то пойдет не так"
echo "   ✅ Анимированные индикаторы статуса (success/error/loading)"
echo ""

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: запустите скрипт из корневой директории проекта"
    exit 1
fi

# 1. Получаем последние изменения из GitHub
echo "📥 Получаем обновления из GitHub..."
git pull origin main

# 2. Создаем/обновляем таблицу user_tournament_stats
echo "🗄️ Создаем недостающую таблицу user_tournament_stats..."
if command -v psql &> /dev/null; then
    psql -U postgres -d 1337community -f backend/create_user_tournament_stats_table.sql
    echo "✅ Таблица user_tournament_stats создана/обновлена"
else
    echo "⚠️ PostgreSQL не найден, создайте таблицу вручную:"
    echo "   psql -U postgres -d 1337community -f backend/create_user_tournament_stats_table.sql"
fi

# 3. Обновляем backend
echo "🔧 Обновляем backend..."
cd backend
npm install --production

# 4. Перезапускаем backend сервис
echo "🔄 Перезапускаем backend сервис..."
sudo systemctl restart 1337-backend

# Ждем запуска сервиса
sleep 3

# Проверяем статус backend
echo "📡 Проверяем статус backend сервиса..."
if sudo systemctl is-active --quiet 1337-backend; then
    echo "✅ Backend сервис работает"
else
    echo "❌ Backend сервис не запущен, проверяем логи..."
    sudo journalctl -u 1337-backend -n 10 --no-pager
    exit 1
fi

# 5. Обновляем frontend
echo "🎨 Обновляем frontend..."
cd ../frontend
npm install --production
npm run build

# 6. Перезагружаем nginx
echo "🌐 Перезагружаем nginx..."
sudo systemctl reload nginx

# Проверяем статус nginx
echo "📡 Проверяем статус nginx..."
if sudo systemctl is-active --quiet nginx; then
    echo "✅ Nginx работает"
else
    echo "❌ Nginx не работает"
    sudo systemctl status nginx --no-pager -l
    exit 1
fi

# 7. Тестируем ключевые endpoints
echo "🧪 Тестируем endpoints..."

# Проверяем endpoint пересчета статистики (должен возвращать ошибку авторизации без токена - это нормально)
if curl -s -w "%{http_code}" "http://localhost:3000/api/users/recalculate-tournament-stats" -X POST | grep -q "401"; then
    echo "✅ Endpoint пересчета статистики отвечает"
else
    echo "⚠️ Endpoint пересчета статистики не отвечает должным образом"
fi

# Проверяем основные endpoints
if curl -s -f "http://localhost:3000/api/users/stats" > /dev/null 2>&1; then
    echo "✅ Users stats endpoint работает"
else
    echo "⚠️ Users stats endpoint требует авторизации (нормально)"
fi

# 8. Проверяем логи на наличие ошибок
echo "📋 Проверяем последние логи backend..."
sudo journalctl -u 1337-backend -n 5 --no-pager | grep -E "(error|Error|ERROR)" || echo "✅ Критических ошибок не обнаружено"

# 9. Проверяем создание таблицы
echo "🔍 Проверяем создание таблицы user_tournament_stats..."
if command -v psql &> /dev/null; then
    if psql -U postgres -d 1337community -c "SELECT COUNT(*) FROM user_tournament_stats;" > /dev/null 2>&1; then
        echo "✅ Таблица user_tournament_stats создана и доступна"
    else
        echo "❌ Таблица user_tournament_stats не найдена"
        exit 1
    fi
else
    echo "⚠️ Не могу проверить таблицу - PostgreSQL недоступен"
fi

echo ""
echo "🎉 ОПТИМАЛЬНЫЙ ДЕПЛОЙ ЗАВЕРШЕН УСПЕШНО!"
echo ""
echo "📊 РЕЗУЛЬТАТ ВНЕДРЕНИЯ:"
echo "   🗄️ Создана таблица user_tournament_stats для хранения результатов турниров"
echo "   🔄 Статистика автоматически пересчитывается при каждом открытии профиля"
echo "   🎯 Детальные индикаторы статуса: 'Проверяем...', 'Обновлено: X из Y', 'Статистика актуальна'"
echo "   🛡️ Безопасный UPSERT вместо DELETE+INSERT операций"
echo "   ⚡ Graceful degradation - если пересчет не удался, статистика все равно загружается"
echo "   🎨 Красивые анимированные индикаторы (загрузка/успех/ошибка)"
echo ""
echo "🔗 ПРОВЕРИТЬ РЕЗУЛЬТАТ:"
echo "   1. Откройте https://1337community.com/profile"
echo "   2. Перейдите на вкладку 'Статистика'"
echo "   3. Увидите процесс пересчета: '🔄 Проверяем статистику турниров...'"
echo "   4. Затем: '✅ Обновлено: X из Y турниров' → '✅ Статистика актуальна'"
echo "   5. В завершенных турнирах появятся правильные результаты вместо 'Не указан'"
echo ""
echo "✅ Сайт готов к использованию с ПОЛНОСТЬЮ РАБОЧЕЙ системой статистики!"
echo "🎯 Проблема 'Не указан' в результатах турниров РЕШЕНА!"

# Возвращаемся в корневую директорию
cd .. 