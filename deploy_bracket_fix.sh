#!/bin/bash

# 🔧 КРИТИЧЕСКОЕ РАЗВЕРТЫВАНИЕ: Исправления генератора турнирной сетки
# Дата: $(date)
# Автор: QA Engineer

echo "🚀 РАЗВЕРТЫВАНИЕ ИСПРАВЛЕНИЙ ГЕНЕРАТОРА ТУРНИРНОЙ СЕТКИ"
echo "======================================================"

# Переходим в директорию проекта
cd /var/www/1337community.com

echo "📁 Текущая директория: $(pwd)"

# Обновляем код с GitHub
echo "⬇️ Обновляем код с GitHub..."
git pull origin main

if [ $? -eq 0 ]; then
    echo "✅ Код успешно обновлен"
else
    echo "❌ Ошибка обновления кода"
    exit 1
fi

# Проверяем наличие исправленного файла
if [ -f "backend/bracketGenerators/singleEliminationV2.js" ]; then
    echo "✅ Исправленный генератор найден"
    
    # Показываем первые строки файла для подтверждения версии
    echo "🔍 Версия генератора:"
    head -5 backend/bracketGenerators/singleEliminationV2.js | grep -E "(Версия|Version)"
else
    echo "❌ Файл генератора не найден!"
    exit 1
fi

# Перезапускаем backend сервис
echo "🔄 Перезапускаем backend сервис..."
pm2 restart 1337-backend

if [ $? -eq 0 ]; then
    echo "✅ Backend успешно перезапущен"
else
    echo "❌ Ошибка перезапуска backend"
    exit 1
fi

# Проверяем статус сервиса
echo "📊 Статус сервисов:"
pm2 status

echo ""
echo "✅ РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО!"
echo "🔧 Исправления генератора турнирной сетки применены"
echo "📍 Версия: Single Elimination V3.0 с исправленной математикой"
echo "" 