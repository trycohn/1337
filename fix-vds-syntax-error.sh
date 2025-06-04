#!/bin/bash

# 🔧 СКРИПТ ИСПРАВЛЕНИЯ: Синтаксическая ошибка TournamentDetails.js на VDS
# Исправляет лишнюю закрывающую скобку на строке 3969

echo "🔧 ИСПРАВЛЕНИЕ СИНТАКСИЧЕСКОЙ ОШИБКИ TournamentDetails.js"
echo "======================================================="

# Проверяем, что мы в правильной директории
if [ ! -f "frontend/src/components/TournamentDetails.js" ]; then
    echo "❌ ОШИБКА: Файл TournamentDetails.js не найден!"
    echo "Убедитесь, что вы в директории /var/www/1337community.com/"
    exit 1
fi

echo "📁 Создаем резервную копию..."
cp frontend/src/components/TournamentDetails.js frontend/src/components/TournamentDetails.js.backup.$(date +%Y%m%d_%H%M%S)

echo "🔍 Анализируем проблемную область..."
echo "Последние 15 строк файла:"
tail -15 frontend/src/components/TournamentDetails.js

echo ""
echo "🔧 Исправляем лишнюю закрывающую скобку..."

# Создаем временный файл без лишней скобки
head -n 3968 frontend/src/components/TournamentDetails.js > temp_tournament.js

# Добавляем корректное окончание
cat >> temp_tournament.js << 'EOF'

export default TournamentDetails;
EOF

# Заменяем оригинальный файл
mv temp_tournament.js frontend/src/components/TournamentDetails.js

echo "✅ Лишняя скобка удалена"

echo ""
echo "🔍 Проверяем результат..."
echo "Последние 10 строк исправленного файла:"
tail -10 frontend/src/components/TournamentDetails.js

echo ""
echo "📊 Подсчет скобок в файле:"
OPEN_BRACES=$(grep -o '{' frontend/src/components/TournamentDetails.js | wc -l)
CLOSE_BRACES=$(grep -o '}' frontend/src/components/TournamentDetails.js | wc -l)

echo "Открывающие скобки: $OPEN_BRACES"
echo "Закрывающие скобки: $CLOSE_BRACES"

if [ $OPEN_BRACES -eq $CLOSE_BRACES ]; then
    echo "✅ Баланс скобок восстановлен!"
else
    echo "⚠️ Дисбаланс скобок: $((CLOSE_BRACES - OPEN_BRACES))"
fi

echo ""
echo "🏗️ Тестируем компиляцию..."
cd frontend

# Проверяем синтаксис
echo "Проверяем синтаксис файла..."
node -c src/components/TournamentDetails.js

if [ $? -eq 0 ]; then
    echo "✅ Синтаксис корректен!"
    
    echo ""
    echo "🚀 Запускаем build..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 BUILD УСПЕШЕН! Ошибка исправлена!"
        echo "======================================="
        echo ""
        echo "📋 Что было исправлено:"
        echo "- Удалена лишняя закрывающая скобка на строке 3969"
        echo "- Восстановлен баланс скобок"
        echo "- Build проходит без ошибок"
        echo ""
        echo "🔄 Перезапустите backend сервис:"
        echo "sudo systemctl restart 1337-backend"
    else
        echo "❌ Build все еще падает. Проверьте другие ошибки."
    fi
else
    echo "❌ Синтаксические ошибки остались. Требуется дополнительная диагностика."
fi

cd ..

echo ""
echo "🔧 Скрипт исправления завершен!" 