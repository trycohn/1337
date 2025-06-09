#!/bin/bash

# 🔍 БЫСТРАЯ ДИАГНОСТИКА 403 FORBIDDEN
# Автоматическое выявление причин недоступности сайта
# Использовать: ./diagnose_403_quick.sh

set -e

echo "🔍 === БЫСТРАЯ ДИАГНОСТИКА 403 FORBIDDEN ==="
echo "📅 Дата: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Проверяем что мы на правильном сервере
if [[ ! -d "/var/www/1337community.com" ]]; then
    echo "❌ Ошибка: Скрипт должен выполняться на VDS сервере 1337community.com"
    exit 1
fi

echo "🔧 1. ДИАГНОСТИКА NGINX"
echo "─────────────────────"

echo "📊 Статус Nginx:"
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx активен"
else
    echo "❌ Nginx НЕ РАБОТАЕТ!"
    echo "🔧 Запустите: systemctl start nginx"
fi

echo ""
echo "📋 Порты Nginx:"
NGINX_PORTS=$(ss -tlnp | grep nginx || echo "")
if [[ -n "$NGINX_PORTS" ]]; then
    echo "$NGINX_PORTS"
else
    echo "❌ Nginx не слушает порты!"
fi

echo ""
echo "🔧 2. ДИАГНОСТИКА КОНФИГУРАЦИИ"
echo "─────────────────────────────"

echo "📄 Конфигурация сайта:"
if [[ -f "/etc/nginx/sites-available/1337community.com" ]]; then
    echo "✅ Файл конфигурации существует"
    
    # Проверяем root директорию
    ROOT_PATH=$(grep -n "root" /etc/nginx/sites-available/1337community.com | head -1 || echo "")
    if [[ -n "$ROOT_PATH" ]]; then
        echo "📂 Root path: $ROOT_PATH"
    else
        echo "❌ Root директория НЕ НАСТРОЕНА!"
    fi
    
    # Проверяем server_name
    SERVER_NAME=$(grep -n "server_name" /etc/nginx/sites-available/1337community.com | head -1 || echo "")
    if echo "$SERVER_NAME" | grep -q "1337community.com"; then
        echo "✅ Server name настроен: $SERVER_NAME"
    else
        echo "❌ Server name НЕ НАСТРОЕН для 1337community.com!"
    fi
    
else
    echo "❌ Файл конфигурации /etc/nginx/sites-available/1337community.com НЕ СУЩЕСТВУЕТ!"
fi

echo ""
echo "🔗 Символическая ссылка:"
if [[ -L "/etc/nginx/sites-enabled/1337community.com" ]]; then
    echo "✅ Символическая ссылка существует"
else
    echo "❌ Символическая ссылка НЕ СОЗДАНА!"
    echo "🔧 Создайте: ln -sf /etc/nginx/sites-available/1337community.com /etc/nginx/sites-enabled/"
fi

echo ""
echo "📝 nginx.conf include:"
if grep -q "include.*sites-enabled" /etc/nginx/nginx.conf; then
    echo "✅ Include sites-enabled найден в nginx.conf"
else
    echo "❌ Include sites-enabled ОТСУТСТВУЕТ в nginx.conf!"
    echo "🔧 Добавьте в http блок: include /etc/nginx/sites-enabled/*;"
fi

echo ""
echo "🧪 Тест конфигурации Nginx:"
if nginx -t &>/dev/null; then
    echo "✅ Конфигурация nginx корректна"
else
    echo "❌ ОШИБКИ в конфигурации nginx:"
    nginx -t 2>&1 | head -5
fi

echo ""
echo "🔧 3. ДИАГНОСТИКА FRONTEND"
echo "─────────────────────────"

echo "📁 Проверка папки frontend:"
if [[ -d "/var/www/1337community.com/frontend" ]]; then
    echo "✅ Папка frontend существует"
    
    # Проверяем папку build
    if [[ -d "/var/www/1337community.com/frontend/build" ]]; then
        echo "✅ Папка build существует"
        
        # Проверяем index.html
        if [[ -f "/var/www/1337community.com/frontend/build/index.html" ]]; then
            echo "✅ index.html существует"
            
            # Проверяем размер index.html
            INDEX_SIZE=$(stat -c%s "/var/www/1337community.com/frontend/build/index.html" 2>/dev/null || echo "0")
            if [[ "$INDEX_SIZE" -gt 100 ]]; then
                echo "✅ index.html не пустой ($INDEX_SIZE bytes)"
            else
                echo "⚠️ index.html слишком маленький ($INDEX_SIZE bytes) - возможно build неполный"
            fi
        else
            echo "❌ index.html НЕ СУЩЕСТВУЕТ!"
            echo "🔧 Соберите frontend: cd /var/www/1337community.com/frontend && npm run build"
        fi
        
        # Проверяем статические файлы
        STATIC_COUNT=$(find /var/www/1337community.com/frontend/build -name "*.js" -o -name "*.css" | wc -l)
        if [[ "$STATIC_COUNT" -gt 0 ]]; then
            echo "✅ Статические файлы найдены ($STATIC_COUNT файлов)"
        else
            echo "❌ Статические файлы (JS/CSS) НЕ НАЙДЕНЫ!"
        fi
        
    else
        echo "❌ Папка build НЕ СУЩЕСТВУЕТ!"
        echo "🔧 Соберите frontend: cd /var/www/1337community.com/frontend && npm run build"
    fi
    
    # Проверяем package.json
    if [[ -f "/var/www/1337community.com/frontend/package.json" ]]; then
        echo "✅ package.json существует"
        
        # Проверяем build script
        if grep -q '"build"' /var/www/1337community.com/frontend/package.json; then
            BUILD_SCRIPT=$(grep -A 1 '"build"' /var/www/1337community.com/frontend/package.json | tail -1)
            echo "📋 Build script: $BUILD_SCRIPT"
        else
            echo "❌ Build script НЕ НАЙДЕН в package.json!"
        fi
    else
        echo "❌ package.json НЕ СУЩЕСТВУЕТ!"
    fi
    
else
    echo "❌ Папка frontend НЕ СУЩЕСТВУЕТ!"
fi

echo ""
echo "🔒 Права доступа:"
if [[ -d "/var/www/1337community.com/frontend/build" ]]; then
    BUILD_OWNER=$(stat -c '%U:%G' /var/www/1337community.com/frontend/build)
    BUILD_PERMS=$(stat -c '%a' /var/www/1337community.com/frontend/build)
    echo "📂 build/ владелец: $BUILD_OWNER, права: $BUILD_PERMS"
    
    if [[ "$BUILD_OWNER" == "www-data:www-data" || "$BUILD_OWNER" == "nginx:nginx" ]]; then
        echo "✅ Права владельца корректные"
    else
        echo "⚠️ Возможны проблемы с правами владельца"
        echo "🔧 Исправьте: chown -R www-data:www-data /var/www/1337community.com/frontend/build/"
    fi
    
    if [[ "$BUILD_PERMS" =~ ^7[5-7][5-7]$ ]]; then
        echo "✅ Права доступа корректные"
    else
        echo "⚠️ Возможны проблемы с правами доступа"
        echo "🔧 Исправьте: chmod -R 755 /var/www/1337community.com/frontend/build/"
    fi
fi

echo ""
echo "🔧 4. ДИАГНОСТИКА BACKEND"
echo "───────────────────────"

echo "📊 Статус backend:"
BACKEND_STATUS=$(systemctl is-active 1337-backend 2>/dev/null || echo "inactive")
if [[ "$BACKEND_STATUS" == "active" ]]; then
    echo "✅ Backend активен"
else
    echo "❌ Backend НЕ АКТИВЕН!"
    echo "🔧 Запустите: systemctl start 1337-backend"
fi

echo ""
echo "🧪 5. ТЕСТИРОВАНИЕ ДОСТУПНОСТИ"
echo "─────────────────────────────"

echo "🌐 Тест главной страницы:"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/ 2>/dev/null || echo "ERROR")
case "$HTTP_STATUS" in
    "200")
        echo "✅ Главная страница доступна (200 OK)"
        ;;
    "403")
        echo "❌ 403 Forbidden - проблема с правами доступа или конфигурацией"
        ;;
    "404")
        echo "❌ 404 Not Found - проблема с конфигурацией nginx"
        ;;
    "502")
        echo "❌ 502 Bad Gateway - проблема с backend"
        ;;
    "ERROR")
        echo "❌ Ошибка подключения - проблема с DNS или nginx"
        ;;
    *)
        echo "⚠️ Неожиданный статус: $HTTP_STATUS"
        ;;
esac

echo ""
echo "🔌 Тест API backend:"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://1337community.com/api/users/me 2>/dev/null || echo "ERROR")
case "$API_STATUS" in
    "401")
        echo "✅ API backend работает (401 - нужна авторизация)"
        ;;
    "200")
        echo "✅ API backend работает (200 OK)"
        ;;
    "403")
        echo "❌ API недоступен (403 Forbidden)"
        ;;
    "502")
        echo "❌ Backend не отвечает (502 Bad Gateway)"
        ;;
    "ERROR")
        echo "❌ Ошибка подключения к API"
        ;;
    *)
        echo "⚠️ Неожиданный статус API: $API_STATUS"
        ;;
esac

echo ""
echo "📋 6. РЕКОМЕНДАЦИИ"
echo "─────────────────"

# Анализируем результаты и даем рекомендации
if [[ "$HTTP_STATUS" == "403" ]]; then
    echo "🎯 ГЛАВНАЯ ПРОБЛЕМА: 403 Forbidden"
    echo ""
    echo "🔧 ПОПРОБУЙТЕ В ПОРЯДКЕ ПРИОРИТЕТА:"
    echo ""
    
    if [[ ! -f "/var/www/1337community.com/frontend/build/index.html" ]]; then
        echo "1. 🥇 ПЕРЕСОБЕРИТЕ FRONTEND (наиболее вероятно):"
        echo "   cd /var/www/1337community.com/frontend"
        echo "   npm install"
        echo "   npm run build"
        echo ""
    fi
    
    if ! grep -q "root.*frontend/build" /etc/nginx/sites-available/1337community.com 2>/dev/null; then
        echo "2. 🥈 ИСПРАВЬТЕ КОНФИГУРАЦИЮ NGINX:"
        echo "   Убедитесь что root указывает на frontend/build"
        echo "   root /var/www/1337community.com/frontend/build;"
        echo ""
    fi
    
    if [[ -d "/var/www/1337community.com/frontend/build" ]]; then
        BUILD_OWNER=$(stat -c '%U:%G' /var/www/1337community.com/frontend/build)
        if [[ "$BUILD_OWNER" != "www-data:www-data" ]]; then
            echo "3. 🥉 ИСПРАВЬТЕ ПРАВА ДОСТУПА:"
            echo "   chown -R www-data:www-data /var/www/1337community.com/frontend/build/"
            echo "   chmod -R 755 /var/www/1337community.com/frontend/build/"
            echo ""
        fi
    fi
    
    if ! grep -q "include.*sites-enabled" /etc/nginx/nginx.conf; then
        echo "4. 🏅 ИСПРАВЬТЕ NGINX.CONF:"
        echo "   Добавьте в http блок: include /etc/nginx/sites-enabled/*;"
        echo ""
    fi
    
    echo "🚨 БЫСТРОЕ ИСПРАВЛЕНИЕ:"
    echo "   cd /var/www/1337community.com/frontend"
    echo "   npm run build"
    echo "   chown -R www-data:www-data build/"
    echo "   systemctl reload nginx"
    
elif [[ "$HTTP_STATUS" == "200" ]]; then
    echo "🎉 ВСЁ РАБОТАЕТ! Сайт доступен."
    
else
    echo "🔧 ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА ТРЕБУЕТСЯ:"
    echo "   Статус $HTTP_STATUS требует индивидуального анализа"
fi

echo ""
echo "📝 Подробное руководство: fix_403_forbidden_guide.md"
echo "🔧 === ДИАГНОСТИКА ЗАВЕРШЕНА ===" 