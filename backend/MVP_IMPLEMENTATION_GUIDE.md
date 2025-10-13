# 🏆 Руководство по внедрению системы MVP

## Описание

Система расчета MVP (Most Valuable Player) для турнирных и кастомных матчей CS2 на основе детальной статистики из MatchZy.

## Формула расчета

```
S_base = 1.8*K - 1.0*D + 0.6*A + DMG/25
S_impact = 1.5*EK + 1.0*TK + 3*C1 + 5*C2 + 0.5*MK2 + 1.2*MK3 + 2.5*MK4 + 4.0*MK5
S_obj = 2.0*MV

MVP_Score = (S_base + S_impact + S_obj) / max(1, R)
```

### Легенда:
- **K, D, A** — киллы, смерти, ассисты
- **DMG** — суммарный урон
- **R** — сыгранные раунды
- **EK** — entry-kills (первое убийство в раунде)
- **TK** — trade-kills (размены) — *пока 0, нет в MatchZy*
- **C1, C2** — клатчи 1v1, 1v2 (выиграно)
- **MK2-5** — мультикиллы (2k, 3k, 4k, ace)
- **MV** — звёзды MVP за раунды — *пока 0, нет в MatchZy*

### Тай-брейки (при одинаковом MVP_Score):
1. Больше S_impact / R
2. Больше (3*C1 + 5*C2) / R
3. Больше ADR (DMG/R)
4. Меньше D/R

## Установка

### Шаг 1: Применить миграцию БД

```bash
cd /var/www/1337community.com/backend
psql -U postgres -d your_database -f migrations/20251013_add_match_mvp_table.sql
```

Или через pgAdmin:
- Открыть Query Tool
- Загрузить файл `migrations/20251013_add_match_mvp_table.sql`
- Выполнить

### Шаг 2: Перезапустить backend сервер

```bash
ssh root@80.87.200.23
cd /var/www/1337community.com/backend
pm2 restart 1337-backend
```

### Шаг 3: Пересчитать MVP для существующих матчей (опционально)

**Вариант A: Через Node.js скрипт (рекомендуется)**

```bash
cd /var/www/1337community.com/backend
node recalculate_mvp.js
```

**Вариант B: Через SQL (pgAdmin Query Tool)**

```bash
psql -U postgres -d your_database -f migrations/20251013_recalculate_existing_mvp.sql
```

## Использование

### Автоматический расчет

MVP автоматически рассчитывается для каждого нового турнирного/кастомного матча после импорта статистики от MatchZy.

Лог в консоли:
```
🏆 [MatchZy] MVP: PlayerName (45.23 очков)
```

### API Endpoint

**GET** `/api/matches/:matchId/mvp`

**Параметры:**
- `matchId` — ID матча в таблице `matches` (our_match_id)

**Ответ:**
```json
{
  "success": true,
  "mvp": {
    "steamid64": "76561198123456789",
    "user_id": 42,
    "username": "PlayerName",
    "avatar_url": "https://...",
    "name": "PlayerName",
    "team": "team1",
    "mvp_score": 45.2345,
    "s_base": 32.5,
    "s_impact": 12.3,
    "s_obj": 0
  },
  "all_players": [...],
  "by_map": {
    "map_1": [...],
    "map_2": [...]
  }
}
```

**Пример запроса:**
```bash
curl http://localhost:5000/api/matches/123/mvp
```

### Из JavaScript/Node.js

```javascript
const MVPCalculator = require('./services/mvpCalculator');

// Рассчитать MVP для matchzy matchid
const result = await MVPCalculator.calculateMatchMVP(12345);

console.log('MVP:', result.mvp.name, result.mvp.mvp_score);

// Получить топ игроков для матча (our_match_id)
const topPlayers = await MVPCalculator.getTopPlayers(123, 10);
```

## Структура данных

### Таблица `match_player_mvp`

| Поле | Тип | Описание |
|------|-----|----------|
| `matchzy_matchid` | INT | ID матча в MatchZy |
| `our_match_id` | INT | ID матча в нашей БД |
| `steamid64` | BIGINT | Steam ID игрока |
| `user_id` | INT | ID пользователя (nullable) |
| `mapnumber` | SMALLINT | Номер карты |
| `s_base` | DECIMAL | Базовый скор |
| `s_impact` | DECIMAL | Скор импакта |
| `s_obj` | DECIMAL | Скор объективов |
| `mvp_score` | DECIMAL | Итоговый MVP скор |
| `rounds_played` | INT | Кол-во раундов |
| `calculated_at` | TIMESTAMP | Время расчета |

## Ограничения

1. **MVP рассчитывается только для:**
   - Турнирных матчей (`source_type = 'tournament'`)
   - Кастомных матчей (`source_type = 'custom'`)

2. **Отсутствующие данные:**
   - Trade-kills (TK) — нет в MatchZy, считаются как 0
   - MVP stars (MV) — нет в MatchZy, считаются как 0
   - Клатчи 1v3/1v4/1v5 — нет в MatchZy, считаются как 0

3. **Формула может быть скорректирована:**
   - Весовые коэффициенты подобраны эмпирически
   - Можно настроить в `backend/services/mvpCalculator.js`

## Проверка работы

### 1. Проверить что таблица создана

```sql
SELECT COUNT(*) FROM match_player_mvp;
```

### 2. Посмотреть топ-5 MVP

```sql
SELECT 
    u.username,
    mp.name,
    mvp.mvp_score,
    mvp.our_match_id
FROM match_player_mvp mvp
LEFT JOIN users u ON u.id = mvp.user_id
LEFT JOIN matchzy_players mp 
    ON mp.matchid = mvp.matchzy_matchid 
    AND mp.steamid64 = mvp.steamid64
ORDER BY mvp.mvp_score DESC
LIMIT 5;
```

### 3. Проверить MVP конкретного матча

```sql
SELECT * FROM match_player_mvp 
WHERE our_match_id = 123 
ORDER BY mvp_score DESC;
```

## Troubleshooting

### Проблема: MVP не рассчитывается

**Проверить:**
1. Матч турнирный/кастомный?
   ```sql
   SELECT id, source_type FROM matches WHERE id = 123;
   ```

2. Есть ли данные в matchzy_players?
   ```sql
   SELECT COUNT(*) FROM matchzy_players mp
   JOIN matchzy_matches mm ON mm.matchid = mp.matchid
   WHERE mm.our_match_id = 123;
   ```

3. Логи сервера:
   ```bash
   pm2 logs 1337-backend --lines 100
   ```

### Проблема: Ошибка при пересчете

**Решение:**
```bash
# Очистить таблицу
psql -U postgres -d your_database -c "TRUNCATE match_player_mvp CASCADE;"

# Запустить пересчет снова
node recalculate_mvp.js
```

## Дальнейшее развитие

1. **Добавить визуализацию на фронтенде:**
   - Страница MVP матча
   - Топ MVP турнира
   - Личный кабинет с историей MVP

2. **Расширить формулу:**
   - Учет роли игрока (entry-fragger, support, AWPer)
   - Весовые коэффициенты по важности раундов
   - Machine Learning для оптимизации весов

3. **Достижения:**
   - "Серия MVP" (3+ подряд)
   - "Легенда турнира" (MVP финала)
   - Рейтинг игроков по средним MVP

## Поддержка

При возникновении проблем:
1. Проверить логи: `pm2 logs 1337-backend`
2. Проверить БД: запросы выше
3. Создать issue в репозитории

