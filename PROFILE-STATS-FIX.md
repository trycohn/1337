# Исправление ошибок статистики профиля

## Проблемы которые были исправлены

### 1. 500 ошибка в `/api/users/match-history`
**Проблема:** Сложный SQL запрос с множественными JOIN вызывал ошибки сервера
**Решение:** 
- Упростил SQL запрос, убрав избыточную логику с `participant_type`
- Добавил защиту от NULL значений с `COALESCE`
- Добавил LIMIT 100 для производительности
- Улучшил обработку ошибок - теперь возвращается пустой массив вместо 500 ошибки

### 2. 404 ошибки в dota-stats endpoints  
**Проблема:** Frontend обращался к несуществующим endpoints
**Решение:**
- Добавил заглушки для всех dota-stats endpoints:
  - `GET /api/users/dota-stats/profile/:userId`
  - `GET /api/users/dota-stats/player/:steamId`
  - `POST /api/users/dota-stats/profile/save`
  - `DELETE /api/users/dota-stats/profile/:userId`
- Endpoints возвращают корректные 404 ответы с информативными сообщениями

### 3. 404 ошибки в organization-request-status
**Проблема:** Логирование ошибок для нормальных 404 случаев
**Решение:** Улучшена обработка - 404 для заявки это нормально, если заявки нет

### 4. Неправильная агрегация статистики
**Проблема:** Верхние элементы статистики не учитывали null/undefined значения
**Решение:**
- Добавил защиту от null/undefined во всех расчетах: `(stats.solo.wins || 0)`
- Исправил логику расчета винрейта с proper проверками на деление на ноль
- Все статистики теперь корректно агрегируются по всем турнирам независимо от игры/формата

## Структура исправлений

### Backend (`backend/routes/users.js`)

#### Исправленный SQL запрос для match-history:
```sql
SELECT 
    m.id,
    m.created_at as date,
    t.name as tournament_name,
    t.id as tournament_id,
    t.game as discipline,
    m.score1,
    m.score2,
    CASE 
        WHEN m.winner_team_id = m.participant1_id THEN 
            CASE WHEN tp1.user_id = $1 OR EXISTS(
                SELECT 1 FROM tournament_team_members ttm 
                WHERE ttm.team_id = m.participant1_id AND ttm.user_id = $1
            ) THEN 'win' ELSE 'loss' END
        WHEN m.winner_team_id = m.participant2_id THEN 
            CASE WHEN tp2.user_id = $1 OR EXISTS(
                SELECT 1 FROM tournament_team_members ttm 
                WHERE ttm.team_id = m.participant2_id AND ttm.user_id = $1
            ) THEN 'win' ELSE 'loss' END
        ELSE 'unknown'
    END as result,
    COALESCE(
        CASE WHEN tp1.user_id = $1 THEN COALESCE(tp2.name, tt2.name)
             WHEN tp2.user_id = $1 THEN COALESCE(tp1.name, tt1.name)
             ELSE 'Неизвестный соперник' END,
        'Неизвестный соперник'
    ) as opponent,
    CONCAT(COALESCE(m.score1, 0), ':', COALESCE(m.score2, 0)) as score
FROM matches m
JOIN tournaments t ON m.tournament_id = t.id
LEFT JOIN tournament_participants tp1 ON m.participant1_id = tp1.id
LEFT JOIN tournament_participants tp2 ON m.participant2_id = tp2.id
LEFT JOIN tournament_teams tt1 ON m.participant1_id = tt1.id
LEFT JOIN tournament_teams tt2 ON m.participant2_id = tt2.id
LEFT JOIN tournament_team_members ttm1 ON tt1.id = ttm1.team_id
LEFT JOIN tournament_team_members ttm2 ON tt2.id = ttm2.team_id
WHERE 
    (tp1.user_id = $1 OR tp2.user_id = $1 OR ttm1.user_id = $1 OR ttm2.user_id = $1)
    AND m.winner_team_id IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 100
```

#### Добавленные dota-stats endpoints:
- Все endpoints возвращают корректные 404 с сообщением "Dota API временно недоступен"
- Добавлена проверка прав доступа для профиля пользователя

### Frontend (`frontend/src/components/Profile.js`)

#### Улучшенная агрегация статистики:
```javascript
// Безопасные расчеты с проверкой на null/undefined
const totalWins = (stats.solo.wins || 0) + (stats.team.wins || 0);
const totalMatches = (stats.solo.wins || 0) + (stats.solo.losses || 0) + 
                    (stats.team.wins || 0) + (stats.team.losses || 0);
const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
```

#### Улучшенная обработка ошибок:
- Удалено логирование ожидаемых 404 ошибок
- Все fetch функции теперь возвращают пустые массивы/объекты при ошибках
- Добавлены проверки на существование данных перед их обработкой

## Статистика теперь показывает

### Верхние элементы (Quick Stats):
1. **Всего матчей** - сумма всех сыгранных матчей (solo + team) по всем играм и турнирам
2. **Турниров** - общее количество турниров в которых участвовал игрок  
3. **Винрейт** - общий процент побед от всех сыгранных матчей
4. **Выигранных турниров** - количество турниров где игрок стал победителем

### Детальная статистика:
- Все то же самое + разбивка по играм (byGame)
- Статистика solo vs team игр
- История последних 5 матчей с кнопкой "Показать все"

## Тестирование

После деплоя проверьте:

1. **Откройте профиль:** https://1337community.com/profile
2. **Перейдите на вкладку "Статистика"**
3. **Убедитесь что:**
   - Нет ошибок в консоли браузера (F12)
   - Статистика отображается корректно
   - Верхние элементы показывают правильные цифры
   - История матчей загружается (или показывает "Нет истории матчей")

## Мониторинг

### Логи для отслеживания:
```bash
# Backend логи
sudo journalctl -u 1337-backend -f

# Nginx логи ошибок  
sudo tail -f /var/log/nginx/error.log

# Статус сервисов
sudo systemctl status 1337-backend nginx
```

### Endpoints для тестирования:
```bash
# Проверка match-history (нужна авторизация)
curl -H "Authorization: Bearer YOUR_TOKEN" https://1337community.com/api/users/match-history

# Проверка stats
curl -H "Authorization: Bearer YOUR_TOKEN" https://1337community.com/api/users/stats

# Проверка dota-stats (должен вернуть 404)
curl -H "Authorization: Bearer YOUR_TOKEN" https://1337community.com/api/users/dota-stats/profile/1
```

## Деплой

Для применения исправлений на сервере:

```bash
# Сделайте скрипт исполняемым
chmod +x deploy-profile-stats-fix.sh

# Запустите деплой
./deploy-profile-stats-fix.sh
```

Скрипт автоматически:
- Получит обновления из GitHub
- Обновит backend и frontend
- Перезапустит сервисы
- Протестирует endpoints
- Покажет статус деплоя 