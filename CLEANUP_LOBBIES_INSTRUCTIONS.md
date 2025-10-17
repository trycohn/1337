# 🧹 Инструкция по очистке устаревших лобби

## 📋 Проблема
Плашка "Лобби матча" показывает устаревшие лобби (> 1 час), которые уже недоступны (410 Gone).

## ✅ Что исправлено

### Backend:
1. **MatchLobbyService.js** - метод `getActiveLobbiesForUser`:
   - Добавлен фильтр: `created_at > NOW() - INTERVAL '1 hour'`
   - Теперь API возвращает только свежие лобби (< 1 час)

### Frontend:
2. **MatchLobbyNotification.js**:
   - Добавлена фильтрация устаревших лобби на клиенте
   - Проверка возраста лобби перед показом плашки

### База данных:
3. **cleanup_expired_lobbies.sql** - SQL скрипт для очистки:
   - Удаляет выборы карт для устаревших лобби
   - Удаляет приглашения для устаревших лобби
   - Удаляет сами устаревшие лобби

## 🚀 Как запустить очистку

### 1. На сервере через SSH:

```bash
ssh root@80.87.200.23
cd /var/www/1337community.com/

# Запустить SQL скрипт очистки
psql -U postgres -d esports_platform -f database/cleanup_expired_lobbies.sql
```

### 2. Через PGAdmin:

1. Открыть PGAdmin
2. Подключиться к базе `esports_platform`
3. Открыть Query Tool
4. Скопировать содержимое файла `database/cleanup_expired_lobbies.sql`
5. Выполнить скрипт (F5)

## 📊 Результат

После выполнения скрипта:
- Удалятся все незавершенные лобби старше 1 часа
- API больше не будет возвращать устаревшие лобби
- Плашка "Лобби матча" будет показывать только актуальные лобби
- Пользователи больше не будут перебрасываться на устаревшие лобби

## 🔄 Автоматизация (опционально)

Можно настроить автоматическую очистку через cron:

```bash
# Добавить в crontab на сервере
crontab -e

# Очистка каждые 2 часа
0 */2 * * * psql -U postgres -d esports_platform -c "DELETE FROM map_selections WHERE lobby_id IN (SELECT id FROM match_lobbies WHERE created_at < NOW() - INTERVAL '1 hour' AND status IN ('waiting', 'ready', 'picking')); DELETE FROM lobby_invitations WHERE lobby_id IN (SELECT id FROM match_lobbies WHERE created_at < NOW() - INTERVAL '1 hour' AND status IN ('waiting', 'ready', 'picking')); DELETE FROM match_lobbies WHERE created_at < NOW() - INTERVAL '1 hour' AND status IN ('waiting', 'ready', 'picking');"
```

## ⚠️ Важно

- Скрипт **НЕ удаляет** завершенные лобби (status = 'completed')
- Скрипт **НЕ удаляет** лобби созданные менее 1 часа назад
- После очистки рекомендуется перезапустить backend: `pm2 restart 1337-backend`

## 🧪 Проверка

После деплоя проверьте:
1. Плашка "Лобби матча" не показывается для устаревших лобби
2. API `/api/tournaments/lobbies/active` возвращает только свежие лобби
3. При попытке зайти в устаревшее лобби показывается сообщение об ошибке

