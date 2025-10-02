# 🚀 Быстрый деплой системы CS2 серверов

## Команды для выполнения на VDS

```bash
# 1. Подключиться к серверу
ssh root@80.87.200.23

# 2. Перейти в проект
cd /var/www/1337community.com

# 3. Забрать изменения
git pull origin main

# 4. Перейти в backend и установить зависимости
cd backend
npm install

# 5. Выполнить миграцию БД
psql -U postgres -d 1337community.com -f migrations/20251002_create_cs2_servers_table.sql

# 6. Добавить в .env RCON пароль (если не добавлен)
echo "CS2_RCON_PASSWORD=ваш_rcon_пароль" >> .env

# 7. Перезапустить backend
pm2 restart 1337-backend

# 8. Проверить что все работает
pm2 logs 1337-backend --lines 30
```

## Добавление сервера через PGAdmin

1. Открыть PGAdmin
2. Подключиться к базе `1337community.com`
3. Выполнить Query Tool
4. Вставить и выполнить (заменить данные на реальные):

```sql
INSERT INTO cs2_servers (
    name, description, host, port, 
    rcon_password, server_password,
    gotv_host, gotv_port, gotv_password,
    max_slots, location, status
) VALUES (
    'Main Server',
    'Основной CS2 сервер',
    '80.87.200.23',
    27015,
    'your_rcon_password',
    'server_pass',
    '80.87.200.23',
    27020,
    'gotv_pass',
    10,
    'RU',
    'offline'
) RETURNING *;
```

## Проверка работы через API

```javascript
// В браузерной консоли на сайте 1337community.com

// 1. Получить список серверов
const token = localStorage.getItem('token');
const response = await fetch('/api/servers', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
console.log('Серверы:', data.servers);

// 2. Проверить статус сервера (ID 1)
const status = await fetch('/api/servers/1/check', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
console.log('Статус:', await status.json());

// 3. Выполнить тестовую команду
const cmd = await fetch('/api/servers/1/command', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ command: 'status' })
});
console.log('Результат:', await cmd.json());
```

## Что было добавлено

### Файлы БД:
- `backend/migrations/20251002_create_cs2_servers_table.sql` - миграция
- `backend/add_cs2_server_query.sql` - SQL запросы для PGAdmin

### Файлы кода:
- `backend/services/rconService.js` - сервис для RCON команд
- `backend/routes/servers.js` - API endpoints для серверов
- `backend/server.js` - добавлен роут `/api/servers`
- `backend/package.json` - добавлена зависимость `rcon-client`

### Скрипты:
- `backend/add_test_server.js` - скрипт добавления тестового сервера

### Документация:
- `ИНСТРУКЦИЯ_CS2_СЕРВЕРЫ_RCON.md` - полная документация
- `ДЕПЛОЙ_CS2_СЕРВЕРЫ.md` - эта инструкция

## API Endpoints

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/servers` | Список серверов |
| GET | `/api/servers/:id` | Данные сервера |
| POST | `/api/servers` | Создать сервер |
| PUT | `/api/servers/:id` | Обновить сервер |
| DELETE | `/api/servers/:id` | Удалить сервер |
| POST | `/api/servers/:id/check` | Проверить статус |
| POST | `/api/servers/:id/command` | Выполнить RCON команду |
| GET | `/api/servers/:id/commands` | История команд |

## Структура БД

### cs2_servers
```
- id (serial)
- name (varchar) - уникальное название
- host (varchar) - IP адрес
- port (int) - порт сервера
- rcon_password (varchar) - пароль RCON
- server_password (varchar) - пароль сервера
- gotv_host, gotv_port, gotv_password
- status (varchar) - offline/online/in_use/maintenance
- location (varchar) - RU/EU/NA/AS
- is_active (boolean)
- metadata (jsonb)
```

### cs2_server_commands (логи)
```
- id (serial)
- server_id (FK -> cs2_servers)
- lobby_id (FK -> admin_match_lobbies)
- command (text)
- response (text)
- status (varchar) - pending/success/failed
- executed_by (FK -> users)
- executed_at (timestamp)
- duration_ms (int)
```

## Использование в коде

```javascript
const rconService = require('./services/rconService');

// Выполнить команду
await rconService.executeCommand(serverId, 'mp_warmuptime 60');

// Загрузить конфиг матча
await rconService.loadMatchConfig(
  serverId, 
  'https://1337community.com/lobby/123/match.json'
);

// Проверить статус
const status = await rconService.checkServerStatus(serverId);
```

## ✅ Готово к использованию

После выполнения команд выше система готова:
- Хранить данные серверов в БД
- Выполнять RCON команды
- Логировать все действия
- Привязывать серверы к лобби

