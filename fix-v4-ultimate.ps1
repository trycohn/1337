Write-Host "🚀 V4 ULTIMATE: Принудительное исправление сервера" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# SSH команды для выполнения на сервере
$sshCommands = @"
echo '🔧 Останавливаем backend...'
pm2 stop 1337-backend

echo '📂 Переходим в директорию проекта...'
cd /var/www/1337community.com

echo '📊 Текущий статус Git:'
git status
git log --oneline -3

echo '🔄 ПРИНУДИТЕЛЬНОЕ обновление кода...'
git fetch origin main
git reset --hard origin/main
git clean -fd

echo '✅ Результат обновления:'
git log --oneline -3

echo '🔍 Проверяем V4 роутер...'
ls -la backend/routes/v4-enhanced-stats.js
grep -n 'enhanced-stats.*get.*userId' backend/routes/v4-enhanced-stats.js | head -1
grep -n 'user-achievements.*get.*userId' backend/routes/v4-enhanced-stats.js | head -1
grep -n 'leaderboards.*get' backend/routes/v4-enhanced-stats.js | head -1

echo '🔗 Проверяем подключение в server.js:'
grep -n 'v4.*EnhancedStatsRouter' backend/server.js

echo '📦 Устанавливаем зависимости...'
cd backend
npm install redis@^4.6.0 ws@^8.18.0

echo '🧹 Очищаем логи PM2...'
pm2 flush 1337-backend

echo '🚀 ПЕРЕЗАПУСКАЕМ backend...'
pm2 start 1337-backend

echo '⏳ Ждем запуска (10 секунд)...'
sleep 10

echo '📊 Статус процессов:'
pm2 status

echo '📝 Логи backend:'
pm2 logs 1337-backend --lines 15

echo '🧪 ТЕСТИРУЕМ V4 ULTIMATE ENDPOINTS:'
echo '=================================='

echo 'GET /api/v4/achievements:'
curl -s -o /dev/null -w 'HTTP %{http_code}\n' https://1337community.com/api/v4/achievements

echo 'GET /api/v4/leaderboards:'
curl -s -o /dev/null -w 'HTTP %{http_code}\n' https://1337community.com/api/v4/leaderboards

echo 'GET /api/users/organization-request-status:'
curl -s -o /dev/null -w 'HTTP %{http_code}\n' https://1337community.com/api/users/organization-request-status

echo 'GET /api/dota-stats/profile/2:'
curl -s -o /dev/null -w 'HTTP %{http_code}\n' https://1337community.com/api/dota-stats/profile/2

echo ''
echo '🎉 V4 ULTIMATE: Принудительное обновление завершено!'
echo '📋 Все endpoints должны возвращать HTTP 200 вместо 404'
echo '🌐 Проверьте в браузере: https://1337community.com/api/v4/achievements'
"@

try {
    Write-Host "📡 Подключаемся к серверу 1337community.com..." -ForegroundColor Yellow
    
    # Выполняем SSH команды
    $result = $sshCommands | ssh root@1337community.com
    
    Write-Host $result -ForegroundColor Green
    
    Write-Host ""
    Write-Host "✅ ПРОВЕРКА ЗАВЕРШЕНА!" -ForegroundColor Green
    Write-Host "Теперь откройте браузер и проверьте:" -ForegroundColor Cyan
    Write-Host "🔗 https://1337community.com/api/v4/achievements" -ForegroundColor Blue
    Write-Host "🔗 https://1337community.com/api/v4/leaderboards" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Если видите JSON вместо 404 - проблема исправлена! 🎉" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Ошибка подключения к серверу: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Ручные команды для сервера:" -ForegroundColor Yellow
    Write-Host "ssh root@1337community.com" -ForegroundColor Gray
    Write-Host "cd /var/www/1337community.com" -ForegroundColor Gray
    Write-Host "git reset --hard origin/main" -ForegroundColor Gray
    Write-Host "pm2 restart 1337-backend" -ForegroundColor Gray
} 