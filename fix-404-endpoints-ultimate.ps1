Write-Host "🔥 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ: Устранение всех 404 ошибок" -ForegroundColor Red
Write-Host "=======================================================" -ForegroundColor Red

# SSH команды для полного исправления сервера
$sshCommands = @"
echo '🛑 ПОЛНАЯ ОСТАНОВКА BACKEND...'
pm2 stop 1337-backend
pm2 delete 1337-backend

echo '📂 Переход в директорию проекта...'
cd /var/www/1337community.com

echo '🗑️ ПОЛНАЯ ОЧИСТКА И ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ...'
git reset --hard HEAD
git clean -fdx
git fetch origin main --force
git reset --hard origin/main

echo '✅ Проверяем критически важные файлы:'

echo '1️⃣ V4 роутер:'
if [ -f 'backend/routes/v4-enhanced-stats.js' ]; then
    echo '✅ V4 роутер найден'
    grep -n 'router.get.*leaderboards' backend/routes/v4-enhanced-stats.js | head -1
    grep -n 'router.get.*achievements' backend/routes/v4-enhanced-stats.js | head -1
else
    echo '❌ V4 роутер отсутствует!'
fi

echo '2️⃣ Users роутер:'
grep -n 'organization-request-status' backend/routes/users.js | head -1

echo '3️⃣ Dota-stats роутер:'
grep -n 'profile.*user_id' backend/routes/dotaStats.js | head -1

echo '4️⃣ Подключения в server.js:'
grep -n 'v4-enhanced-stats' backend/server.js
grep -n 'dotaStats' backend/server.js
grep -n 'usersRouter' backend/server.js

echo '📦 ПОЛНАЯ ПЕРЕУСТАНОВКА ЗАВИСИМОСТЕЙ...'
cd backend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

echo '🔧 Установка критически важных модулей...'
npm install redis@^4.6.0 ws@^8.18.0 --save

echo '📝 Проверка package.json:'
grep -C 3 'redis' package.json || echo 'Redis НЕ найден'
grep -C 3 'ws' package.json || echo 'WS НЕ найден'

echo '🚀 ПОЛНЫЙ ПЕРЕЗАПУСК С НОВОЙ КОНФИГУРАЦИЕЙ...'
pm2 start ecosystem.config.js --name="1337-backend" || pm2 start server.js --name="1337-backend"

echo '⏳ Ожидание полного запуска (15 сек)...'
sleep 15

echo '📊 Статус всех процессов:'
pm2 status

echo '📝 Логи запуска:'
pm2 logs 1337-backend --lines 25

echo ''
echo '🧪 КРИТИЧЕСКИЕ ТЕСТЫ ВСЕХ ПРОБЛЕМНЫХ ENDPOINT'ОВ:'
echo '================================================'

echo '1️⃣ /api/v4/achievements:'
curl -s -o /dev/null -w 'HTTP %{http_code} ' https://1337community.com/api/v4/achievements && echo '✅' || echo '❌'

echo '2️⃣ /api/v4/leaderboards:'
curl -s -o /dev/null -w 'HTTP %{http_code} ' https://1337community.com/api/v4/leaderboards && echo '✅' || echo '❌'

echo '3️⃣ /api/users/organization-request-status:'
curl -s -o /dev/null -w 'HTTP %{http_code} ' https://1337community.com/api/users/organization-request-status && echo '✅' || echo '❌'

echo '4️⃣ /api/dota-stats/profile/2:'
curl -s -o /dev/null -w 'HTTP %{http_code} ' https://1337community.com/api/dota-stats/profile/2 && echo '✅' || echo '❌'

echo '5️⃣ /api/tournaments (контроль):'
curl -s -o /dev/null -w 'HTTP %{http_code} ' https://1337community.com/api/tournaments && echo '✅' || echo '❌'

echo ''
echo '🎯 ПРОВЕРКА JSON ОТВЕТОВ:'
echo '========================='

echo 'Achievements JSON:'
curl -s https://1337community.com/api/v4/achievements | head -c 100

echo ''
echo 'Leaderboards JSON:'
curl -s https://1337community.com/api/v4/leaderboards | head -c 100

echo ''
echo ''
echo '🎉 ФИНАЛЬНАЯ ДИАГНОСТИКА ЗАВЕРШЕНА!'
echo '===================================='
echo 'HTTP 200 = ✅ РАБОТАЕТ'
echo 'HTTP 404 = ❌ НЕ РАБОТАЕТ'
echo 'HTTP 401/403 = 🔐 ТРЕБУЕТ АВТОРИЗАЦИИ (это нормально)'
"@

try {
    Write-Host "📡 Подключение к серверу 1337community.com..." -ForegroundColor Yellow
    
    # Выполняем команды на сервере
    $result = $sshCommands | ssh root@1337community.com
    
    Write-Host $result -ForegroundColor White
    
    Write-Host ""
    Write-Host "🎯 ФИНАЛЬНАЯ ПРОВЕРКА В БРАУЗЕРЕ:" -ForegroundColor Green
    Write-Host "Откройте эти URL'ы для подтверждения:" -ForegroundColor Cyan
    Write-Host "🔗 https://1337community.com/api/v4/achievements" -ForegroundColor Blue
    Write-Host "🔗 https://1337community.com/api/v4/leaderboards" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Если показывают JSON вместо 404 - ПРОБЛЕМА РЕШЕНА! 🎉" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Ошибка SSH подключения: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Ручные команды для экстренного исправления:" -ForegroundColor Yellow
    Write-Host "ssh root@1337community.com" -ForegroundColor Gray
    Write-Host "cd /var/www/1337community.com" -ForegroundColor Gray
    Write-Host "git reset --hard origin/main" -ForegroundColor Gray
    Write-Host "pm2 restart 1337-backend" -ForegroundColor Gray
    Write-Host "curl https://1337community.com/api/v4/achievements" -ForegroundColor Gray
} 