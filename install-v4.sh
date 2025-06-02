#!/bin/bash

# 🚀 V4 ULTIMATE - Быстрая установка 
# Добавляет только недостающие компоненты в существующую БД

echo "🚀 V4 ULTIMATE - Быстрая установка"
echo "=================================="
echo ""

# Проверка файла
if [ ! -f "backend/init-v4-missing-only.sql" ]; then
    echo "❌ Файл backend/init-v4-missing-only.sql не найден!"
    exit 1
fi

echo "📊 Добавляем недостающие компоненты V4..."

# Попытка через psql
if command -v psql >/dev/null 2>&1; then
    echo "🔧 Выполнение через psql..."
    if psql -h localhost -U "$DB_USER" -d "$DB_NAME" -f backend/init-v4-missing-only.sql; then
        echo "✅ V4 ULTIMATE установлен успешно!"
        echo ""
        echo "🎯 Теперь откройте: Профиль → Статистика → V4 ULTIMATE"
        exit 0
    fi
fi

# Попытка через node
echo "🔧 Выполнение через Node.js..."
if node -e "
const fs = require('fs');
const pool = require('./backend/db');
const sql = fs.readFileSync('backend/init-v4-missing-only.sql', 'utf8');
pool.query(sql).then(() => {
    console.log('✅ V4 ULTIMATE установлен успешно!');
    console.log('');
    console.log('🎯 Теперь откройте: Профиль → Статистика → V4 ULTIMATE');
    process.exit(0);
}).catch(err => {
    console.error('❌ Ошибка установки:', err.message);
    process.exit(1);
});"; then
    exit 0
fi

echo "❌ Не удалось установить V4 ULTIMATE"
echo "💡 Попробуйте выполнить backend/init-v4-missing-only.sql вручную в pgAdmin"
exit 1 