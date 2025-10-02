# 🖥️ Система управления CS2 серверами и RCON

## 📋 Описание

Реализована система хранения данных CS2 серверов и управления ими через RCON протокол. Позволяет:
- Хранить данные серверов (IP, порт, RCON пароль)
- Выполнять команды на сервере через RCON
- Привязывать сервер к матч-лобби
- Логировать все выполненные команды
- Проверять статус серверов

## 🗄️ Структура базы данных

### Таблица `cs2_servers`
Хранит информацию о CS2 серверах:
```sql
- id: уникальный идентификатор
- name: название сервера (уникальное)
- description: описание
- host: IP адрес сервера
- port: порт сервера (по умолчанию 27015)
- rcon_password: пароль RCON для управления
- server_password: пароль для подключения игроков
- gotv_host: IP для GOTV
- gotv_port: порт GOTV (по умолчанию 27020)
- gotv_password: пароль GOTV
- status: статус сервера (offline/online/in_use/maintenance)
- max_slots: максимум слотов
- location: локация сервера (EU/NA/RU)
- is_active: активен ли сервер
- metadata: дополнительные настройки в JSON
```

### Таблица `cs2_server_commands`
Логи выполненных RCON команд:
```sql
- id: уникальный идентификатор
- server_id: ID сервера
- lobby_id: ID лобби (если команда связана с лобби)
- command: выполненная команда
- response: ответ от сервера
- status: статус (pending/success/failed)
- error_message: сообщение об ошибке
- executed_by: ID пользователя, выполнившего команду
- executed_at: время выполнения
- duration_ms: длительность выполнения в мс
```

### Изменения в `admin_match_lobbies`
Добавлено поле `server_id` для привязки лобби к серверу.

## 🚀 Установка

### 1. Выполнить миграцию БД
```bash
# На сервере VDS
ssh root@80.87.200.23
cd /var/www/1337community.com/backend

# Выполнить миграцию через psql
psql -U postgres -d 1337community.com -f migrations/20251002_create_cs2_servers_table.sql
```

### 2. Установить npm пакет для RCON
```bash
cd /var/www/1337community.com/backend
npm install rcon-client@^4.2.3
```

### 3. Добавить переменные окружения
В файл `.env` добавить:
```env
CS2_RCON_PASSWORD=your_rcon_password_here
```

### 4. Добавить тестовый сервер
```bash
node add_test_server.js
```

### 5. Перезапустить бэкенд
```bash
pm2 restart 1337-backend
```

## 📡 API Endpoints

### Управление серверами

#### GET `/api/servers`
Получить список всех серверов (требует права админа)

**Query параметры:**
- `status` - фильтр по статусу (offline/online/in_use/maintenance)
- `location` - фильтр по локации (EU/NA/RU)
- `is_active` - фильтр по активности (true/false)

**Пример запроса:**
```javascript
const token = localStorage.getItem('token');
const response = await fetch('/api/servers?status=online', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { servers } = await response.json();
```

#### GET `/api/servers/:id`
Получить данные сервера по ID

#### POST `/api/servers`
Создать новый сервер

**Body:**
```json
{
  "name": "Main Server",
  "description": "Основной игровой сервер",
  "host": "80.87.200.23",
  "port": 27015,
  "rcon_password": "your_rcon_password",
  "server_password": "server_pass",
  "gotv_host": "80.87.200.23",
  "gotv_port": 27020,
  "gotv_password": "gotv_pass",
  "max_slots": 10,
  "location": "RU"
}
```

#### PUT `/api/servers/:id`
Обновить данные сервера

#### DELETE `/api/servers/:id`
Удалить сервер

### RCON команды

#### POST `/api/servers/:id/check`
Проверить статус сервера (отправляет команду `status`)

**Пример:**
```javascript
const response = await fetch('/api/servers/1/check', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const { status } = await response.json();
console.log('Server online:', status.online);
```

#### POST `/api/servers/:id/command`
Выполнить RCON команду на сервере

**Body:**
```json
{
  "command": "mp_warmuptime 60",
  "lobby_id": 123
}
```

**Примеры команд:**
```javascript
// Установить warmup time
await fetch('/api/servers/1/command', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    command: 'mp_warmuptime 60'
  })
});

// Загрузить конфиг матча (Get5/MatchZy)
await fetch('/api/servers/1/command', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    command: 'get5_loadmatch_url "https://1337community.com/lobby/123/match.json"',
    lobby_id: 123
  })
});

// Изменить карту
await fetch('/api/servers/1/command', {
  method: 'POST',
  body: JSON.stringify({
    command: 'changelevel de_dust2'
  })
});
```

#### GET `/api/servers/:id/commands`
Получить историю команд сервера

**Query параметры:**
- `limit` - количество записей (по умолчанию 50)
- `offset` - смещение для пагинации

## 🔧 Использование в коде

### RconService

```javascript
const rconService = require('./services/rconService');

// Выполнить команду
const result = await rconService.executeCommand(
  serverId,
  'status',
  {
    userId: req.user.id,
    lobbyId: 123,
    logToDb: true
  }
);

// Выполнить несколько команд
const results = await rconService.executeCommands(
  serverId,
  [
    'mp_warmuptime 60',
    'mp_freezetime 15',
    'mp_maxrounds 24'
  ],
  { userId: req.user.id }
);

// Загрузить конфиг матча
const result = await rconService.loadMatchConfig(
  serverId,
  'https://1337community.com/lobby/123/match.json',
  { userId: req.user.id, lobbyId: 123 }
);

// Проверить статус
const status = await rconService.checkServerStatus(serverId);
if (status.online) {
  console.log('Сервер онлайн!');
}
```

### Интеграция с admin_match_lobbies

```javascript
// При создании лобби - привязать сервер
await pool.query(
  `UPDATE admin_match_lobbies 
   SET server_id = $1 
   WHERE id = $2`,
  [serverId, lobbyId]
);

// При завершении пиков - загрузить конфиг на сервер
const lobby = await pool.query(
  'SELECT server_id FROM admin_match_lobbies WHERE id = $1',
  [lobbyId]
);

if (lobby.rows[0]?.server_id) {
  const configUrl = `https://1337community.com/lobby/${lobbyId}/match.json`;
  await rconService.loadMatchConfig(
    lobby.rows[0].server_id,
    configUrl,
    { userId: req.user.id, lobbyId }
  );
}
```

## 📊 SQL запросы для анализа

### Получить все активные серверы
```sql
SELECT * FROM cs2_servers 
WHERE is_active = true AND status = 'online'
ORDER BY name;
```

### Получить статистику команд по серверу
```sql
SELECT 
  s.name as server_name,
  COUNT(*) as total_commands,
  COUNT(CASE WHEN c.status = 'success' THEN 1 END) as successful,
  COUNT(CASE WHEN c.status = 'failed' THEN 1 END) as failed,
  AVG(c.duration_ms) as avg_duration_ms
FROM cs2_server_commands c
JOIN cs2_servers s ON s.id = c.server_id
WHERE c.executed_at > NOW() - INTERVAL '24 hours'
GROUP BY s.id, s.name
ORDER BY total_commands DESC;
```

### Получить последние 10 команд
```sql
SELECT 
  s.name as server_name,
  c.command,
  c.status,
  c.duration_ms,
  u.username as executed_by,
  c.executed_at
FROM cs2_server_commands c
JOIN cs2_servers s ON s.id = c.server_id
LEFT JOIN users u ON u.id = c.executed_by
ORDER BY c.executed_at DESC
LIMIT 10;
```

## 🔐 Безопасность

1. **Пароли RCON не возвращаются в API** - при GET запросах пароли заменяются на `***`
2. **Только администраторы** - все endpoints требуют права админа
3. **Логирование** - все команды логируются с информацией о пользователе
4. **Timeout** - команды имеют timeout 10 секунд

## ⚠️ Важные замечания

1. **RCON порт должен быть открыт** - убедитесь что firewall пропускает RCON порт (обычно тот же что и игровой)
2. **rcon_password в server.cfg** - на CS2 сервере должен быть установлен `rcon_password`
3. **Соединения кешируются** - RconService кеширует соединения для производительности
4. **Graceful shutdown** - при остановке сервера все RCON соединения закрываются

## 🔄 Обновление на VDS

```bash
# 1. Подключиться к серверу
ssh root@80.87.200.23

# 2. Перейти в директорию проекта
cd /var/www/1337community.com

# 3. Забрать изменения из GitHub
git pull origin main

# 4. Установить зависимости
cd backend
npm install

# 5. Выполнить миграцию
psql -U postgres -d 1337community.com -f migrations/20251002_create_cs2_servers_table.sql

# 6. Добавить тестовый сервер (если нужно)
node add_test_server.js

# 7. Перезапустить backend
pm2 restart 1337-backend

# 8. Проверить логи
pm2 logs 1337-backend --lines 50
```

## ✅ Статус реализации

- ✅ Таблица `cs2_servers` создана
- ✅ Таблица `cs2_server_commands` создана
- ✅ RconService реализован
- ✅ API endpoints для управления серверами
- ✅ API endpoints для RCON команд
- ✅ Логирование всех команд
- ✅ Проверка статуса серверов
- ✅ Интеграция с admin_match_lobbies
- ✅ Скрипт добавления тестового сервера
- ✅ Документация

## 🎯 Дальнейшее развитие

- [ ] Автоматическая загрузка конфига при завершении пиков
- [ ] Мониторинг серверов (периодическая проверка статуса)
- [ ] Webhook от сервера при завершении матча
- [ ] UI для управления серверами в админ-панели
- [ ] Автоматический выбор свободного сервера при создании лобби

