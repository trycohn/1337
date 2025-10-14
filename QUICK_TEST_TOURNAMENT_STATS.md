# ⚡ Быстрый тест системы статистики турниров

**Версия:** 1.0  
**Время выполнения:** ~10 минут

---

## 🚀 Шаг 1: Деплой на VDS (5 минут)

```bash
# Подключение
ssh root@80.87.200.23
cd /var/www/1337community.com/

# Обновление кода
git pull origin main

# Применение миграции БД
sudo -u postgres psql -d tournament_db -f backend/migrations/20251013_add_tournament_stats.sql

# Проверка создания таблиц
sudo -u postgres psql -d tournament_db -c "\dt tournament_*"

# Ожидаемый вывод:
# tournament_player_stats
# tournament_achievements

# Сборка frontend
cd frontend
npm run build
sudo cp -r build/* /var/www/html/1337community/

# Перезапуск
sudo systemctl restart 1337-backend
sudo systemctl reload nginx
```

---

## ✅ Шаг 2: Проверка API (2 минуты)

```bash
# Проверка 1: Получение статистики турнира (должно вернуть hasStats: false если нет данных)
curl http://1337community.com/api/tournaments/1/stats

# Ожидаемый ответ (если нет статистики):
# {"success":true,"hasStats":false,"message":"Статистика пока недоступна..."}

# Проверка 2: Получение MVP (должно вернуть hasMVP: false если нет данных)
curl http://1337community.com/api/tournaments/1/stats/mvp

# Проверка 3: Лидерборд Most Kills
curl "http://1337community.com/api/tournaments/1/stats/leaderboard?category=most_kills&limit=10"
```

---

## 🎮 Шаг 3: Тест автообновления (3 минуты)

### Вариант A: Завершить существующий матч

```bash
# Найдите турнир с незавершенным матчем
# Завершите матч через админ-панель

# Проверьте логи
pm2 logs 1337-backend --lines 100 | grep "TournamentStats"

# Ожидаемый вывод:
# 📊 [MatchService] Запуск обновления статистики турнира X
# 📊 [TournamentStats] Обновление статистики турнира X после матча Y
# 📈 [TournamentStats] Найдено N игроков для обновления
# ✅ [TournamentStats] Статистика турнира X успешно обновлена
```

### Вариант B: Полный пересчет через API (для существующих турниров)

```bash
# Получите JWT токен админа
TOKEN="ваш_jwt_токен_здесь"

# Полный пересчет статистики турнира
curl -X POST http://1337community.com/api/tournaments/1/stats/recalculate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Ожидаемый ответ:
# {"success":true,"matchesProcessed":15,"message":"Tournament statistics recalculated successfully"}

# Финализация (определение MVP)
curl -X POST http://1337community.com/api/tournaments/1/stats/finalize \
  -H "Authorization: Bearer $TOKEN"

# Проверка статистики
curl http://1337community.com/api/tournaments/1/stats | jq .
```

---

## 📊 Шаг 4: Проверка Frontend (2 минуты)

1. Откройте в браузере завершенный CS2 турнир с лобби
2. Перейдите на вкладку **"Результаты"**
3. Прокрутите вниз после подиума

**Ожидаемый результат:**
- ✅ Появился большой блок "🏆 Статистика турнира"
- ✅ Слева: MVP карточка с анимированной короной 👑
- ✅ Справа: 6 карточек лидеров (Most Kills, ADR, HS%, Accuracy, Clutch, Money)
- ✅ Внизу: сводная статистика (средний K/D, ADR, HS%, Ace)

**Консоль браузера (F12):**
```javascript
📊 [TournamentStatsPanel] Загрузка статистики турнира 1
📊 [TournamentStatsPanel] Ответ: {hasStats: true, mvp: {...}, leaders: {...}}
```

---

## 🔍 Проверка данных в БД

```bash
# Проверка статистики игроков
sudo -u postgres psql -d tournament_db -c "
SELECT 
    user_id,
    username,
    total_kills,
    kd_ratio,
    avg_adr,
    hs_percentage,
    mvp_points,
    is_tournament_mvp,
    matches_played
FROM tournament_player_stats tps
LEFT JOIN users u ON tps.user_id = u.id
WHERE tournament_id = 1
ORDER BY mvp_points DESC
LIMIT 10;
"

# Проверка достижений
sudo -u postgres psql -d tournament_db -c "
SELECT 
    achievement_type,
    player_name,
    value,
    rank
FROM tournament_achievements
WHERE tournament_id = 1
ORDER BY achievement_type, rank;
"
```

---

## ⚠️ Troubleshooting

### Проблема 1: hasStats: false

**Причина:** Нет статистики в tournament_player_stats

**Решение:**
```bash
# Полный пересчет
curl -X POST http://1337community.com/api/tournaments/1/stats/recalculate \
  -H "Authorization: Bearer $TOKEN"
```

### Проблема 2: MVP не определен

**Причина:** Не вызвана финализация турнира

**Решение:**
```bash
# Финализация турнира
curl -X POST http://1337community.com/api/tournaments/1/stats/finalize \
  -H "Authorization: Bearer $TOKEN"
```

### Проблема 3: Компонент не отображается

**Причины:**
1. Турнир не завершен (`status !== 'completed'`)
2. Лобби отключено (`lobby_enabled = false`)
3. Игра не CS2 (`game !== 'Counter-Strike 2'`)

**Проверка:**
```bash
sudo -u postgres psql -d tournament_db -c "
SELECT id, name, status, lobby_enabled, game 
FROM tournaments 
WHERE id = 1;
"
```

### Проблема 4: 500 ошибка API

**Проверка логов:**
```bash
pm2 logs 1337-backend --lines 200 | grep -A 10 "TournamentStats"
```

---

## ✅ Успешный результат

**API:**
```json
{
  "success": true,
  "hasStats": true,
  "mvp": {
    "username": "Player123",
    "mvp_points": 5.14,
    "total_kills": 85,
    "kd_ratio": 1.5,
    "avg_adr": 85.2
  },
  "leaders": {
    "most_kills": {...},
    "highest_adr": {...},
    "best_hs": {...}
  }
}
```

**Frontend:**
- Блок статистики отображается
- MVP с анимированной короной
- 6 карточек лидеров
- Сводная статистика внизу

**Логи:**
```
✅ [TournamentStats] Статистика турнира 1 успешно обновлена
✅ [TournamentStats] Турнир 1 финализирован. MVP: Player123
```

---

## 📋 Чек-лист завершения теста

- [ ] Миграция применена на VDS
- [ ] API /stats возвращает корректный JSON
- [ ] Компонент отображается на странице результатов
- [ ] MVP корона анимируется
- [ ] Карточки лидеров показывают данные
- [ ] Hover эффекты работают
- [ ] Мобильная версия корректна
- [ ] Логи без ошибок

---

**Время выполнения полного теста:** ~10 минут  
**Готово к продакшену!** 🚀

