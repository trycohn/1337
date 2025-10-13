# 🚀 Деплой системы MVP на продакшн сервер

## Краткая сводка

**Что реализовано:**
- ✅ Таблица `match_player_mvp` для хранения MVP данных
- ✅ Сервис `mvpCalculator.js` с формулой расчета MVP
- ✅ Автоматический расчет MVP после импорта статистики MatchZy
- ✅ API endpoint `GET /api/matches/:id/mvp`
- ✅ SQL скрипт для пересчета существующих матчей
- ✅ Node.js скрипт для пересчета через CLI

**Формула:**
```
MVP_Score = (1.8*K - 1.0*D + 0.6*A + DMG/25 + 1.5*EK + 3*C1 + 5*C2 + 0.5*MK2 + 1.2*MK3 + 2.5*MK4 + 4.0*MK5) / R
```

## Инструкция по деплою

### 1. Подключиться к серверу

```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

### 2. Перейти в директорию проекта

```bash
cd /var/www/1337community.com
```

### 3. Подтянуть изменения из GitHub

```bash
git pull origin main
```

### 4. Применить миграцию БД

**Вариант A: Через psql (рекомендуется)**

```bash
cd backend
psql -U postgres -d 1337community -f migrations/20251013_add_match_mvp_table.sql
```

**Вариант B: Через pgAdmin**
1. Открыть pgAdmin
2. Подключиться к БД `1337community`
3. Открыть Query Tool
4. Загрузить файл `backend/migrations/20251013_add_match_mvp_table.sql`
5. Выполнить (F5)

### 5. Установить зависимости (если требуется)

```bash
cd /var/www/1337community.com/backend
npm install
```

### 6. Перезапустить backend сервер

```bash
pm2 restart 1337-backend
pm2 logs 1337-backend --lines 50
```

**Проверить что сервер запустился:**
```bash
pm2 status
```

Должен быть статус `online`.

### 7. Пересчитать MVP для существующих матчей (опционально)

**Рекомендуется запустить в screen/tmux, т.к. может занять время:**

```bash
cd /var/www/1337community.com/backend
screen -S mvp-recalc
node recalculate_mvp.js
```

После завершения:
- Нажать `Ctrl+A`, затем `D` для detach
- Посмотреть логи: `screen -r mvp-recalc`

**Альтернативно через SQL (быстрее):**
```bash
psql -U postgres -d 1337community -f migrations/20251013_recalculate_existing_mvp.sql
```

## Проверка работы

### 1. Проверить что таблица создана

```bash
psql -U postgres -d 1337community -c "SELECT COUNT(*) FROM match_player_mvp;"
```

Должно вернуть количество записей (0 или больше).

### 2. Проверить API endpoint

```bash
curl http://localhost:5000/api/matches/123/mvp
```

Замените `123` на реальный ID сыгранного турнирного матча.

### 3. Проверить автоматический расчет

После завершения следующего турнирного матча проверить логи:

```bash
pm2 logs 1337-backend --lines 100 | grep MVP
```

Должна быть запись:
```
🏆 [MatchZy] MVP: PlayerName (45.23 очков)
```

### 4. Посмотреть топ MVP в БД

```bash
psql -U postgres -d 1337community -c "
SELECT 
    u.username,
    mp.name,
    ROUND(mvp.mvp_score::numeric, 2) as score,
    mvp.our_match_id
FROM match_player_mvp mvp
LEFT JOIN users u ON u.id = mvp.user_id
LEFT JOIN matchzy_players mp 
    ON mp.matchid = mvp.matchzy_matchid 
    AND mp.steamid64 = mvp.steamid64
ORDER BY mvp.mvp_score DESC
LIMIT 5;
"
```

## Rollback (откат изменений)

Если что-то пошло не так:

### 1. Откатить код

```bash
cd /var/www/1337community.com
git log --oneline -10  # Найти хеш коммита до изменений
git reset --hard <commit-hash>
pm2 restart 1337-backend
```

### 2. Удалить таблицу MVP

```bash
psql -U postgres -d 1337community -c "DROP TABLE IF EXISTS match_player_mvp CASCADE;"
```

### 3. Откатить файлы (если нужно)

```bash
cd /var/www/1337community.com/backend
rm -f services/mvpCalculator.js
rm -f recalculate_mvp.js
rm -f migrations/20251013_*.sql
# Откатить изменения в routes/matchzy.js и routes/matches.js вручную
```

## Устранение проблем

### Проблема: Сервер не запускается после перезапуска

**Решение:**
```bash
pm2 logs 1337-backend --lines 100
# Смотрим ошибку

# Если синтаксическая ошибка в JS:
cd /var/www/1337community.com/backend
node -c services/mvpCalculator.js  # Проверить синтаксис
```

### Проблема: Миграция не применяется

**Решение:**
```bash
# Проверить подключение к БД
psql -U postgres -d 1337community -c "SELECT version();"

# Проверить права
psql -U postgres -d 1337community -c "SELECT current_user;"

# Применить миграцию с verbose:
psql -U postgres -d 1337community -a -f migrations/20251013_add_match_mvp_table.sql
```

### Проблема: MVP не рассчитывается для новых матчей

**Решение:**
```bash
# 1. Проверить логи
pm2 logs 1337-backend --lines 200 | grep -i mvp

# 2. Проверить что матч турнирный/кастомный
psql -U postgres -d 1337community -c "
SELECT id, source_type, tournament_id, custom_lobby_id 
FROM matches 
WHERE id = 123;
"

# 3. Проверить что есть matchzy данные
psql -U postgres -d 1337community -c "
SELECT COUNT(*) FROM matchzy_players mp
JOIN matchzy_matches mm ON mm.matchid = mp.matchid
WHERE mm.our_match_id = 123;
"
```

### Проблема: Endpoint возвращает 404

**Решение:**
```bash
# Проверить что routes/matches.js обновлен
grep -n "mvp" /var/www/1337community.com/backend/routes/matches.js

# Перезапустить сервер
pm2 restart 1337-backend

# Проверить что endpoint зарегистрирован
curl -v http://localhost:5000/api/matches/123/mvp
```

## Мониторинг

### Логи сервера

```bash
# Все логи
pm2 logs 1337-backend

# Только ошибки
pm2 logs 1337-backend --err

# Следить в реальном времени
pm2 logs 1337-backend --lines 50 -f
```

### Метрики БД

```bash
# Количество MVP записей
psql -U postgres -d 1337community -c "SELECT COUNT(*) FROM match_player_mvp;"

# Средний MVP скор
psql -U postgres -d 1337community -c "SELECT ROUND(AVG(mvp_score)::numeric, 2) FROM match_player_mvp;"

# Матчи без MVP
psql -U postgres -d 1337community -c "
SELECT COUNT(*) FROM matches m
WHERE m.source_type IN ('tournament', 'custom')
  AND m.status = 'completed'
  AND NOT EXISTS (
      SELECT 1 FROM match_player_mvp mvp WHERE mvp.our_match_id = m.id
  );
"
```

## Дальнейшие шаги

После успешного деплоя:

1. ✅ Проверить работу на тестовом турнирном матче
2. ⬜ Внедрить отображение MVP на фронтенде
3. ⬜ Добавить страницу "Топ MVP турнира"
4. ⬜ Добавить значок MVP в профиль игрока
5. ⬜ Создать достижение "Первый MVP"

## Контакты поддержки

При возникновении проблем:
- Проверить логи: `pm2 logs 1337-backend`
- Проверить БД: SQL запросы выше
- Создать issue в GitHub репозитории

---

**Дата деплоя:** 13 октября 2025  
**Версия:** 1.0.0  
**Статус:** ✅ Готово к деплою

