# 🔧 Диагностика и принудительное обновление сервера

## Проблема
V4 endpoints по-прежнему возвращают 404, что означает, что код на сервере не обновился.

## Срочные действия на сервере

### 1. Подключение к серверу
```bash
ssh root@1337community.com
```

### 2. Проверка текущего статуса
```bash
cd /var/www/1337community.com
git status
git log --oneline -5
```

### 3. Принудительное обновление
```bash
# Сбросить все локальные изменения
git reset --hard HEAD
git clean -fd

# Принудительно обновить с GitHub
git fetch origin main
git reset --hard origin/main

# Проверить что обновилось
git log --oneline -3
```

### 4. Проверка роутера V4
```bash
# Проверить существование файла
ls -la backend/routes/v4-enhanced-stats.js

# Проверить содержимое (должны быть новые endpoints)
grep -n "enhanced-stats" backend/routes/v4-enhanced-stats.js
grep -n "user-achievements" backend/routes/v4-enhanced-stats.js
grep -n "leaderboards" backend/routes/v4-enhanced-stats.js
```

### 5. Перезапуск с очисткой
```bash
# Остановить backend
pm2 stop 1337-backend

# Очистить логи
pm2 flush 1337-backend

# Запустить заново
pm2 start 1337-backend

# Проверить статус
pm2 status
pm2 logs 1337-backend --lines 20
```

### 6. Тестирование endpoints
```bash
# Тест V4 endpoints
curl -i https://1337community.com/api/v4/achievements
curl -i https://1337community.com/api/v4/leaderboards

# Должны вернуть 200 вместо 404
```

## Если проблема продолжается

### Альтернативный способ - пересборка
```bash
cd /var/www/1337community.com/backend

# Переустановить зависимости
rm -rf node_modules package-lock.json
npm install

# Перезапустить
pm2 restart 1337-backend
```

### Проверка Nginx конфигурации
```bash
# Проверить конфигурацию Nginx
nginx -t

# Перезагрузить Nginx
systemctl reload nginx
```

## Ожидаемый результат

После выполнения этих команд:
- `curl https://1337community.com/api/v4/achievements` должен вернуть JSON с достижениями
- `curl https://1337community.com/api/v4/leaderboards` должен вернуть JSON с лидербордом  
- `curl https://1337community.com/api/v4/enhanced-stats/2` (с токеном) должен вернуть статистику
- Больше никаких 404 ошибок в браузере

## Для проверки в браузере
Откройте https://1337community.com/api/v4/achievements - должен показать JSON вместо 404. 