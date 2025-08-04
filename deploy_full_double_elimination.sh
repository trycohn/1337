#!/bin/bash

# ========================================
# РАЗВЕРТЫВАНИЕ ОПЦИИ FULL DOUBLE ELIMINATION
# ========================================

set -e  # Остановка при ошибке

echo "🚀 Начинаем развертывание опции Full Double Elimination..."

# Проверяем что мы находимся в правильной директории
if [ ! -f "backend/server.js" ]; then
    echo "❌ Ошибка: Выполните скрипт из корня проекта 1337/"
    exit 1
fi

echo "📍 Текущая директория: $(pwd)"

# ШАГ 1: МИГРАЦИЯ БАЗЫ ДАННЫХ
# ========================================
echo ""
echo "🗄️ ШАГ 1: Применение миграции базы данных..."

sudo -u postgres psql -d tournament_db -f add_full_double_elimination_option.sql

if [ $? -eq 0 ]; then
    echo "✅ Миграция базы данных выполнена успешно"
else
    echo "❌ Ошибка при выполнении миграции"
    exit 1
fi

# ШАГ 2: ПРОВЕРКА ИЗМЕНЕНИЙ В GIT
# ========================================
echo ""
echo "📦 ШАГ 2: Обновление кода с Git..."

git pull origin main

echo "📋 Последние коммиты:"
git log --oneline -5

# ШАГ 3: ПЕРЕЗАПУСК BACKEND
# ========================================
echo ""
echo "🔧 ШАГ 3: Перезапуск backend сервиса..."

sudo systemctl restart 1337-backend

# Ждем немного чтобы сервис запустился
sleep 3

sudo systemctl status 1337-backend --no-pager -l

if [ $? -eq 0 ]; then
    echo "✅ Backend сервис перезапущен успешно"
else
    echo "❌ Ошибка при перезапуске backend сервиса"
    exit 1
fi

# ШАГ 4: СБОРКА И РАЗВЕРТЫВАНИЕ FRONTEND
# ========================================
echo ""
echo "🎨 ШАГ 4: Сборка и развертывание frontend..."

cd frontend

# Проверяем наличие package.json
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: package.json не найден в директории frontend"
    exit 1
fi

# Устанавливаем зависимости если нужно
npm install

# Собираем проект
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Frontend собран успешно"
else
    echo "❌ Ошибка при сборке frontend"
    exit 1
fi

# Обновляем статические файлы
sudo cp -r build/* /var/www/html/1337community/

echo "✅ Frontend развернут успешно"

cd ..

# ШАГ 5: ПЕРЕЗАПУСК NGINX
# ========================================
echo ""
echo "🌐 ШАГ 5: Перезапуск Nginx..."

sudo systemctl restart nginx

if [ $? -eq 0 ]; then
    echo "✅ Nginx перезапущен успешно"
else
    echo "❌ Ошибка при перезапуске Nginx"
    exit 1
fi

# ШАГ 6: ПРОВЕРКА СТАТУСА СЕРВИСОВ
# ========================================
echo ""
echo "🔍 ШАГ 6: Проверка статуса сервисов..."

echo "Backend статус:"
sudo systemctl is-active 1337-backend

echo "Nginx статус:"
sudo systemctl is-active nginx

# ШАГ 7: ТЕСТИРОВАНИЕ
# ========================================
echo ""
echo "🧪 ШАГ 7: Базовое тестирование..."

# Проверяем что сайт отвечает
if curl -s -o /dev/null -w "%{http_code}" http://localhost/ | grep -q "200"; then
    echo "✅ Сайт доступен (HTTP 200)"
else
    echo "⚠️ Предупреждение: Сайт может быть недоступен"
fi

# Проверяем API
if curl -s -o /dev/null -w "%{http_code}" http://localhost/api/tournaments | grep -q "200"; then
    echo "✅ API турниров доступен"
else
    echo "⚠️ Предупреждение: API может быть недоступен"
fi

# ЗАВЕРШЕНИЕ
# ========================================
echo ""
echo "🎉 РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО!"
echo ""
echo "📋 Что было сделано:"
echo "  ✅ Добавлено поле full_double_elimination в таблицу tournaments"
echo "  ✅ Обновлен код backend с поддержкой новой опции"
echo "  ✅ Обновлен frontend с чекбоксами для опции"
echo "  ✅ Перезапущены все сервисы"
echo ""
echo "🎯 Что можно тестировать:"
echo "  • Создание турнира с опцией Full Double Elimination"
echo "  • Генерация сетки с включенной/отключенной опцией"
echo "  • Регенерация сетки с изменением опции"
echo ""
echo "🌐 Откройте: http://1337community.com/create-tournament"
echo "📝 Выберите Double Elimination и найдите чекбокс '🏆 Включить Full Double Elimination?'"

echo ""
echo "✨ Готово! Grand Final Triumph теперь опциональный! ✨"