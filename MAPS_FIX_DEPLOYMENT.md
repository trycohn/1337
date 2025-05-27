# Исправление отображения статистики по картам - Развертывание на VDS

## Проблема
Статистика по картам не отображалась в модальном окне результатов матча из-за несоответствия названия игры в условии сохранения данных.

## Исправления

### 1. Backend исправления (backend/routes/tournaments.js)

**Проблема:** Условие `tournament.game === 'Counter-Strike 2'` не срабатывало для игры с названием `Counter Strike 2` (без дефиса).

**Исправление:** Добавлена гибкая проверка названия игры:

```javascript
// Проверяем, является ли игра Counter-Strike 2 (с учетом разных вариантов написания)
const isCS2Game = tournament.game && (
    tournament.game === 'Counter-Strike 2' ||
    tournament.game === 'Counter Strike 2' ||
    tournament.game.toLowerCase().includes('counter') && tournament.game.toLowerCase().includes('strike') ||
    tournament.game.toLowerCase().includes('cs2')
);

if (Array.isArray(maps) && maps.length > 0 && isCS2Game) {
    console.log(`Сохраняем данные о картах для игры: ${tournament.game}`);
    console.log(`Данные карт:`, maps);
    mapsData = JSON.stringify(maps);
    // ... остальная логика
}
```

### 2. Frontend исправления (frontend/src/components/TournamentDetails.js)

**Добавлена подробная отладка в функции `viewMatchDetails`:**
- Проверка типов данных `maps_data`
- Улучшенная обработка JSON данных
- Детальные логи для диагностики

### 3. Улучшения в mapHelpers.js

**Добавлена детальная отладка функции `gameHasMaps`** для лучшей диагностики проблем с определением игр.

## Развертывание на VDS сервере

### Шаг 1: Подключение к серверу
```bash
ssh username@your-vds-server
cd /path/to/your/project
```

### Шаг 2: Получение обновлений
```bash
git pull origin main
```

### Шаг 3: Перезапуск backend сервера
```bash
# Если используется PM2
pm2 restart backend

# Если используется systemctl
sudo systemctl restart your-backend-service

# Если запускается вручную
cd backend
npm install  # если были изменения в зависимостях
node server.js
```

### Шаг 4: Сборка и развертывание frontend
```bash
cd frontend
npm install  # если были изменения в зависимостях
npm run build

# Копирование в директорию веб-сервера (например, Nginx)
sudo cp -r build/* /var/www/html/
# или
sudo rsync -av build/ /var/www/html/
```

### Шаг 5: Перезапуск веб-сервера
```bash
sudo systemctl reload nginx
# или
sudo systemctl restart nginx
```

### Шаг 6: Проверка логов
```bash
# Проверка логов backend
pm2 logs backend
# или
journalctl -u your-backend-service -f

# Проверка логов Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Проверка исправления

### 1. Проверка в браузере
1. Откройте турнир с завершенными матчами
2. Кликните на завершенный матч
3. Откройте консоль браузера (F12)
4. Проверьте логи:
   - `gameHasMaps: результат для Counter Strike 2 : true`
   - `Данные карт из БД (maps_data): [данные]` (не должно быть null)

### 2. Создание нового матча с картами
1. Создайте новый матч в турнире CS2
2. Установите результаты с несколькими картами
3. Проверьте, что данные сохраняются в базе данных
4. Проверьте отображение в модальном окне

### 3. Проверка логов сервера
При обновлении матча с картами должны появиться логи:
```
Сохраняем данные о картах для игры: Counter Strike 2
Данные карт: [массив карт]
Обновляем матч 1532 с данными о картах: [JSON строка]
Матч 1532 успешно обновлен с данными о картах
```

## Откат изменений (если необходимо)

```bash
git log --oneline -5  # посмотреть последние коммиты
git revert <commit-hash>  # откатить конкретный коммит
git push origin main
# Затем повторить шаги развертывания
```

## Дополнительные проверки

### Проверка базы данных
```sql
-- Проверить наличие поля maps_data
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'matches' AND column_name = 'maps_data';

-- Проверить матчи с данными о картах
SELECT id, tournament_id, maps_data 
FROM matches 
WHERE maps_data IS NOT NULL 
LIMIT 5;
```

### Проверка файлов
```bash
# Проверить, что файлы обновились
ls -la backend/routes/tournaments.js
ls -la frontend/src/components/TournamentDetails.js
ls -la frontend/src/utils/mapHelpers.js

# Проверить содержимое ключевых изменений
grep -n "isCS2Game" backend/routes/tournaments.js
grep -n "=== НАЧАЛО ОТЛАДКИ viewMatchDetails ===" frontend/src/components/TournamentDetails.js
```

## Контакты для поддержки
При возникновении проблем проверьте:
1. Логи сервера
2. Консоль браузера
3. Статус сервисов: `systemctl status nginx`, `pm2 status`
4. Доступность базы данных

Версия исправления: 1.0.2
Дата: 27.05.2025 