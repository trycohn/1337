# 🔗 Система инвайт-ссылок для закрытых турниров

## 📋 Описание функционала

Реализована система приглашений для закрытых турниров с полной поддержкой:

### ✨ Основные возможности:

1. **Инвайт-ссылки для турниров**
   - Генерация уникальных ссылок-приглашений
   - Настройка срока действия и лимита использований
   - Автоматическая авторизация/регистрация при переходе по ссылке
   - Редирект на страницу вступления в турнир после авторизации

2. **Вступление в командные турниры**
   - Создание новой разовой команды
   - Выбор своей существующей команды
   - Запрос на вступление в команду, уже добавленную в турнир

3. **Система запросов на вступление**
   - Отправка запроса капитану команды
   - Уведомления капитану в системный чат
   - Принятие/отклонение запросов капитаном
   - Автоматическое добавление игрока в команду при принятии

---

## 🗄️ Структура БД

### Новые таблицы:

#### `tournament_invites` - Инвайт-ссылки
```sql
- id (SERIAL PRIMARY KEY)
- tournament_id (INTEGER, FK to tournaments)
- created_by (INTEGER, FK to users)
- invite_code (VARCHAR(32), UNIQUE) - Уникальный код
- max_uses (INTEGER, NULL) - Макс. использований
- current_uses (INTEGER, DEFAULT 0)
- expires_at (TIMESTAMP, NULL) - Срок действия
- is_active (BOOLEAN, DEFAULT TRUE)
- created_at, updated_at (TIMESTAMP)
```

#### `tournament_invite_uses` - История использований
```sql
- id (SERIAL PRIMARY KEY)
- invite_id (INTEGER, FK to tournament_invites)
- user_id (INTEGER, FK to users)
- used_at (TIMESTAMP)
- ip_address (VARCHAR(45))
- UNIQUE(invite_id, user_id)
```

#### `team_join_requests` - Запросы на вступление
```sql
- id (SERIAL PRIMARY KEY)
- team_id (INTEGER, FK to tournament_teams)
- tournament_id (INTEGER, FK to tournaments)
- user_id (INTEGER, FK to users)
- status (VARCHAR(20): pending/accepted/rejected)
- message (TEXT) - Сообщение от игрока
- created_at, updated_at (TIMESTAMP)
- reviewed_by (INTEGER, FK to users)
- reviewed_at (TIMESTAMP)
- UNIQUE(team_id, user_id, tournament_id)
```

---

## 🚀 Деплой на VDS

### 1. Подключение к серверу
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
cd /var/www/1337community.com
```

### 2. Обновление кода
```bash
# Подтягиваем изменения из Git
git pull origin main

# Если есть конфликты - решаем их
git status
```

### 3. Применение миграции БД
```bash
# Подключаемся к PostgreSQL
sudo -u postgres psql -d 1337community.com

# Выполняем миграцию
\i database/migrations/tournament_invites_and_team_requests.sql

# Проверяем создание таблиц
\dt tournament_invites
\dt tournament_invite_uses
\dt team_join_requests

# Выходим
\q
```

### 4. Установка зависимостей и перезапуск backend
```bash
# Backend
cd backend
npm install
pm2 restart 1337-backend

# Проверяем статус
pm2 logs 1337-backend --lines 50

# Если нужен полный перезапуск
pm2 stop 1337-backend
pm2 start server.js --name 1337-backend
```

### 5. Сборка и деплой frontend
```bash
cd ../frontend
npm install
npm run build

# Копируем собранные файлы в директорию Nginx
sudo rm -rf /var/www/1337community.com/html/*
sudo cp -r build/* /var/www/1337community.com/html/

# Перезапускаем Nginx
sudo systemctl reload nginx
```

### 6. Проверка работоспособности
```bash
# Проверяем логи backend
pm2 logs 1337-backend --lines 100

# Проверяем логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Проверяем статус сервисов
pm2 status
sudo systemctl status nginx
```

---

## 📡 API Endpoints

### Инвайт-ссылки

#### Создание инвайта (Создатель/Админ)
```http
POST /api/tournaments/:id/invites
Authorization: Bearer {token}

Body:
{
  "max_uses": 10,           // опционально
  "expires_in_days": 7      // опционально
}

Response:
{
  "success": true,
  "invite": { ... },
  "invite_url": "https://1337community.com/tournaments/invite/{code}"
}
```

#### Получение инвайтов турнира
```http
GET /api/tournaments/:id/invites
Authorization: Bearer {token}
```

#### Проверка валидности инвайта (Публичный)
```http
GET /api/tournaments/invites/:code

Response:
{
  "valid": true,
  "tournament": {
    "id": 1,
    "name": "Tournament Name",
    "participant_type": "5x5"
  }
}
```

#### Использование инвайта
```http
POST /api/tournaments/invites/:code/use
Authorization: Bearer {token}
```

### Запросы на вступление в команды

#### Создание запроса
```http
POST /api/tournaments/:tournamentId/teams/:teamId/join-requests
Authorization: Bearer {token}

Body:
{
  "message": "Привет, хочу в вашу команду!" // опционально
}
```

#### Получение pending запросов (Капитан)
```http
GET /api/tournaments/:tournamentId/teams/:teamId/join-requests
Authorization: Bearer {token}
```

#### Принятие запроса (Капитан)
```http
POST /api/tournaments/:tournamentId/teams/:teamId/join-requests/:requestId/accept
Authorization: Bearer {token}
```

#### Отклонение запроса (Капитан)
```http
POST /api/tournaments/:tournamentId/teams/:teamId/join-requests/:requestId/reject
Authorization: Bearer {token}
```

---

## 🎨 Frontend компоненты

### 1. **TournamentInvites.js** - Управление инвайтами (для организаторов)
- **Местоположение**: Добавить в `TournamentDetails.js`
- **Условие отображения**: `isAdminOrCreator && tournament.access_type === 'closed'`
- Создание новых инвайт-ссылок
- Копирование ссылок в буфер обмена
- Деактивация/удаление ссылок
- Просмотр статистики использования

**Интеграция в TournamentDetails.js:**
```javascript
import TournamentInvites from './tournament/TournamentInvites';

// В JSX, в разделе для админов:
{isAdminOrCreator && tournament?.access_type === 'closed' && (
    <TournamentInvites 
        tournament={tournament} 
        token={localStorage.getItem('token')} 
    />
)}
```

### 2. **TournamentInvite.js** - Страница приглашения
- **Путь**: `/tournaments/invite/:inviteCode`
- Проверка валидности инвайта
- Форма авторизации/регистрации для неавторизованных
- Автоматическое использование инвайта после авторизации
- Редирект на страницу турнира

### 2. **JoinTournamentModal.js** - Модальное окно вступления
- Выбор способа участия:
  - Создание новой команды
  - Выбор своей команды
  - Вступление в существующую команду
- Отправка запроса на вступление

### 3. **TeamJoinRequests.js** - Управление запросами
- Список pending запросов для капитана
- Информация о игроках (аватар, рейтинги)
- Кнопки принятия/отклонения
- Автообновление после действия

---

## 🔔 Уведомления

### Уведомления капитану при новом запросе:
```javascript
{
  type: 'team_join_request',
  team_id: 123,
  requester_username: 'PlayerName',
  request_id: 456,
  actions: [
    {
      type: 'accept',
      label: '✅ Принять',
      endpoint: '/api/tournaments/.../accept'
    },
    {
      type: 'reject',
      label: '❌ Отклонить',
      endpoint: '/api/tournaments/.../reject'
    }
  ]
}
```

### Уведомления игроку:
- **При принятии**: "✅ Ваш запрос на вступление в команду был принят!"
- **При отклонении**: "❌ Ваш запрос на вступление в команду был отклонен."

---

## ✅ Тестирование

### 1. Создание инвайт-ссылки
```bash
# Через API
curl -X POST http://localhost:3000/api/tournaments/1/invites \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"max_uses": 5, "expires_in_days": 7}'
```

### 2. Проверка инвайта
```bash
curl http://localhost:3000/api/tournaments/invites/{code}
```

### 3. Сценарий использования
1. Создайте закрытый турнир
2. Сгенерируйте инвайт-ссылку
3. Откройте ссылку в режиме инкогнито (неавторизованный пользователь)
4. Зарегистрируйтесь/войдите
5. Должен произойти редирект на страницу турнира с параметром `?join=true`
6. Откройте модальное окно вступления
7. Создайте команду или отправьте запрос на вступление

---

## 🐛 Возможные проблемы и решения

### Проблема: "Приглашение не найдено"
**Решение**: Проверьте, что миграция БД применена и таблица `tournament_invites` создана

### Проблема: Запросы на вступление не отображаются
**Решение**: 
- Проверьте права доступа (только капитан/создатель команды)
- Убедитесь, что запросы в статусе `pending`

### Проблема: Уведомления не приходят капитану
**Решение**: 
- Проверьте работу системного чата
- Убедитесь, что у команды указан `creator_id`

---

## 📝 Примечания

- Инвайт-ссылки доступны только для **закрытых турниров** (`access_type = 'closed'`)
- Один пользователь не может использовать одну ссылку дважды
- При достижении `max_uses` или истечении `expires_at` инвайт становится недействительным
- Один пользователь может подать только один запрос в одну команду
- После принятия запроса другие запросы пользователя в этом турнире автоматически отменяются

---

## 🔄 Откат изменений (если потребуется)

```sql
-- Удаление таблиц
DROP TABLE IF EXISTS team_join_requests CASCADE;
DROP TABLE IF EXISTS tournament_invite_uses CASCADE;
DROP TABLE IF EXISTS tournament_invites CASCADE;

-- Удаление функций
DROP FUNCTION IF EXISTS update_tournament_invites_updated_at CASCADE;
```

---

## 📞 Поддержка

При возникновении проблем проверьте:
1. Логи backend: `pm2 logs 1337-backend`
2. Логи Nginx: `sudo tail -f /var/log/nginx/error.log`
3. Подключение к БД: `sudo -u postgres psql -d 1337community.com`
4. Статус сервисов: `pm2 status && sudo systemctl status nginx`

---

**Дата создания**: 30.10.2025  
**Версия**: 1.0.0  
**Статус**: ✅ Готово к деплою

