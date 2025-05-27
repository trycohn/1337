# Исправление проблемы с объявлением результатов матчей - Развертывание на VDS

## Проблема
При попытке объявить результат матча возникали ошибки:
- "Этот победитель уже установлен" - блокировала повторное обновление результатов с тем же победителем
- Невозможность изменить счет или добавить данные о картах для уже завершенного матча

## Корневая причина
В backend коде была жесткая проверка, которая блокировала любые обновления результатов матча, если победитель не изменился, даже если изменялись другие данные (счет, карты).

## Исправления

### Backend исправления (backend/routes/tournaments.js)

**Проблемный код (строки 1023 и 1442):**
```javascript
if (match.winner_team_id && match.winner_team_id === winner_team_id) {
    return res.status(400).json({ error: 'Этот победитель уже установлен' });
}
```

**Исправленный код:**
```javascript
// Проверяем, изменились ли данные матча (счет, карты)
const scoreChanged = match.score1 !== score1 || match.score2 !== score2;
const mapsChanged = maps && Array.isArray(maps) && maps.length > 0;

// Разрешаем обновление, если:
// 1. Победитель изменился
// 2. Изменился счет
// 3. Добавлены/изменены данные о картах
if (match.winner_team_id === winner_team_id && !scoreChanged && !mapsChanged) {
    return res.status(400).json({ error: 'Результат матча не изменился' });
}
```

**Что изменилось:**
- Убрана жесткая блокировка повторного обновления с тем же победителем
- Добавлена проверка изменения счета (`scoreChanged`)
- Добавлена проверка наличия данных о картах (`mapsChanged`)
- Теперь обновление разрешается, если изменился хотя бы один из параметров

## Инструкции по развертыванию на VDS сервере

### 1. Подключение к серверу
```bash
ssh username@your-server-ip
```

### 2. Переход в директорию проекта
```bash
cd /path/to/your/project
```

### 3. Создание резервной копии
```bash
cp backend/routes/tournaments.js backend/routes/tournaments.js.backup.$(date +%Y%m%d_%H%M%S)
```

### 4. Обновление кода из GitHub
```bash
git pull origin main
```

### 5. Перезапуск backend сервиса

#### Если используется PM2:
```bash
pm2 restart backend
# или
pm2 restart all
```

#### Если используется systemctl:
```bash
sudo systemctl restart your-backend-service
```

#### Если запускается вручную:
```bash
# Остановка текущего процесса
pkill -f "node server.js"

# Запуск нового процесса
cd backend
nohup node server.js > ../logs/backend.log 2>&1 &
```

### 6. Проверка работы сервера
```bash
# Проверка логов
tail -f logs/backend.log

# Проверка статуса процесса
ps aux | grep "node server.js"

# Проверка доступности API
curl -X GET http://localhost:3001/api/health
```

### 7. Перезапуск frontend (если необходимо)

#### Если используется PM2:
```bash
pm2 restart frontend
```

#### Если используется Nginx для статических файлов:
```bash
# Пересборка frontend
cd frontend
npm run build

# Копирование в директорию Nginx
sudo cp -r build/* /var/www/html/

# Перезагрузка Nginx
sudo systemctl reload nginx
```

## Проверка исправления

### 1. Проверка в браузере
1. Откройте турнир с начатыми матчами
2. Попробуйте объявить результат матча
3. Попробуйте изменить счет уже завершенного матча
4. Попробуйте добавить данные о картах

### 2. Проверка логов сервера
```bash
# Поиск ошибок в логах
grep -i "error" logs/backend.log | tail -20

# Поиск успешных обновлений матчей
grep "Match updated" logs/backend.log | tail -10
```

### 3. Проверка базы данных
```sql
-- Проверка последних обновлений матчей
SELECT id, tournament_id, winner_team_id, score1, score2, maps_data, 
       updated_at
FROM matches 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;
```

## Ожидаемые результаты

После применения исправлений:

1. **Объявление результатов матчей** должно работать без ошибок
2. **Изменение счета** уже завершенного матча должно быть возможным
3. **Добавление данных о картах** должно работать корректно
4. **Повторное обновление** с теми же данными должно выдавать сообщение "Результат матча не изменился"

## Откат изменений (если необходимо)

### 1. Восстановление из резервной копии
```bash
cp backend/routes/tournaments.js.backup.YYYYMMDD_HHMMSS backend/routes/tournaments.js
```

### 2. Перезапуск сервисов
```bash
pm2 restart backend
# или
sudo systemctl restart your-backend-service
```

## Дополнительные команды для диагностики

### Проверка процессов Node.js
```bash
ps aux | grep node
```

### Проверка портов
```bash
netstat -tlnp | grep :3001
```

### Проверка использования памяти
```bash
free -h
df -h
```

### Проверка логов Nginx (если используется)
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Контакты для поддержки

При возникновении проблем с развертыванием:
1. Проверьте логи сервера
2. Убедитесь, что все зависимости установлены
3. Проверьте права доступа к файлам
4. Убедитесь, что база данных доступна

---

**Дата создания:** $(date)
**Версия:** 1.0
**Автор:** AI Assistant 