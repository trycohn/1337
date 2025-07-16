# 🎮 ФУНКЦИОНАЛЬНОСТЬ ЛОББИ МАТЧА CS2 - ДОКУМЕНТАЦИЯ

> **📦 VDS Deployment Update**: 2025-01-27  
> **🎯 Версия**: v1.0.0 (Реализация лобби матча для CS2)  
> **🔄 Статус**: Готов к развертыванию  
> **📋 Цель**: Добавлена система лобби для выбора карт перед матчами CS2  

## 📋 Оглавление
- [🎯 Обзор функциональности](#обзор-функциональности)
- [🏗️ Архитектура решения](#архитектура-решения)
- [📁 Новые и измененные файлы](#новые-и-измененные-файлы)
- [🗄️ База данных](#база-данных)
- [🚀 Развертывание](#развертывание)
- [🧪 Тестирование](#тестирование)
- [📊 API Endpoints](#api-endpoints)

---

## 🎯 Обзор функциональности

### 🎮 Что добавлено:

1. **Настройки лобби при создании турнира**
   - Опция включения лобби для CS2 турниров
   - Выбор формата матчей по умолчанию (Bo1/Bo3/Bo5)
   - Выбор 7 карт из пула CS2

2. **Управление лобби в админ-панели**
   - Включение/выключение лобби для активных турниров
   - Создание лобби для готовых матчей
   - Автоматическая отправка приглашений

3. **Интерфейс лобби матча**
   - Пульсирующая плашка приглашения
   - Страница лобби с выбором карт
   - Real-time синхронизация через WebSocket
   - Поддержка всех форматов (Bo1/Bo3/Bo5)

4. **Процесс выбора карт**
   - Система готовности участников
   - Назначение первого выбирающего администратором
   - Пошаговый выбор/бан карт согласно формату
   - Автоматическое сохранение выбранных карт

---

## 🏗️ Архитектура решения

### Backend архитектура:
```
backend/
├── services/matchLobby/
│   └── MatchLobbyService.js         # Бизнес-логика лобби
├── controllers/matchLobby/
│   └── MatchLobbyController.js      # HTTP контроллеры
├── routes/tournament/index.js       # Обновлен с новыми роутами
├── socketio-server.js              # Обновлен с WebSocket обработчиками
└── services/tournament/
    └── TournamentService.js        # Обновлен для поддержки лобби
```

### Frontend архитектура:
```
frontend/src/
├── components/tournament/MatchLobby/
│   ├── MatchLobbyPage.js           # Главная страница лобби
│   ├── MatchLobbyNotification.js   # Пульсирующее уведомление
│   ├── MapSelectionBoard.js        # Доска выбора карт
│   ├── ParticipantStatus.js        # Статусы готовности
│   └── *.css                       # Стили компонентов
├── components/
│   ├── CreateTournament.js         # Обновлен с настройками лобби
│   ├── TournamentDetails.js        # Обновлен с управлением лобби
│   └── Layout.js                   # Обновлен с уведомлениями
└── App.js                          # Добавлен роут лобби
```

---

## 📁 Новые и измененные файлы

### 🆕 Новые файлы:
- `database/migrations/create_match_lobby_tables.sql`
- `backend/services/matchLobby/MatchLobbyService.js`
- `backend/controllers/matchLobby/MatchLobbyController.js`
- `frontend/src/components/tournament/MatchLobby/MatchLobbyPage.js`
- `frontend/src/components/tournament/MatchLobby/MatchLobbyNotification.js`
- `frontend/src/components/tournament/MatchLobby/MapSelectionBoard.js`
- `frontend/src/components/tournament/MatchLobby/ParticipantStatus.js`
- `frontend/src/components/tournament/MatchLobby/*.css`

### 📝 Измененные файлы:
- `backend/routes/tournament/index.js`
- `backend/socketio-server.js`
- `backend/services/tournament/TournamentService.js`
- `backend/controllers/tournament/TournamentController.js`
- `frontend/src/App.js`
- `frontend/src/components/Layout.js`
- `frontend/src/components/CreateTournament.js`
- `frontend/src/components/TournamentDetails.js`
- `frontend/src/components/tournament/TournamentAdminPanel.js`
- `frontend/src/components/tournament/TournamentSettingsPanel.js`

---

## 🗄️ База данных

### Новые таблицы:
1. **tournament_lobby_settings** - Настройки лобби для турниров
2. **tournament_maps** - Карты турнира
3. **match_lobbies** - Активные лобби матчей
4. **map_selections** - История выбора карт
5. **lobby_invitations** - Приглашения в лобби

### Изменения в существующих таблицах:
- **tournaments** - Добавлено поле `lobby_enabled`

---

## 🚀 Развертывание

### 1. Подключение к серверу:
```bash
ssh root@80.87.200.23
cd /var/www/1337community.com/
```

### 2. Обновление кода:
```bash
git pull origin main
```

### 3. Применение миграций БД:
```bash
psql -U postgres -d community_1337 -f database/migrations/create_match_lobby_tables.sql
```

### 4. Установка зависимостей (если есть новые):
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 5. Сборка frontend:
```bash
cd frontend && npm run build
```

### 6. Перезапуск backend:
```bash
pm2 restart 1337-backend
```

### 7. Проверка:
```bash
pm2 status
pm2 logs 1337-backend --lines 50
```

---

## 🧪 Тестирование

### Тестовый сценарий:

1. **Создание турнира с лобби:**
   - Создать CS2 турнир
   - Включить опцию "Лобби матча"
   - Выбрать 7 карт
   - Проверить что турнир создан с `lobby_enabled = true`

2. **Управление в админ-панели:**
   - Проверить настройку лобби в разделе "Настройки турнира"
   - Запустить турнир
   - Создать лобби для матча

3. **Процесс в лобби:**
   - Участники должны увидеть пульсирующее уведомление
   - Клик открывает страницу лобби
   - Установить готовность
   - Админ назначает первого выбирающего
   - Выполнить процесс выбора карт

4. **Проверка результата:**
   - Выбранные карты сохранены в матче
   - Лобби помечено как завершенное

---

## 📊 API Endpoints

### Настройки лобби:
- `PUT /api/tournaments/:id/lobby-settings` - Обновление настроек лобби
- `PUT /api/tournaments/:id/lobby-enabled` - Включение/выключение лобби

### Управление лобби:
- `POST /api/tournaments/:tournamentId/matches/:matchId/create-lobby` - Создание лобби
- `GET /api/tournaments/lobby/:lobbyId` - Информация о лобби
- `POST /api/tournaments/lobby/:lobbyId/ready` - Установка готовности
- `POST /api/tournaments/lobby/:lobbyId/set-first-picker` - Назначение первого выбирающего
- `POST /api/tournaments/lobby/:lobbyId/select-map` - Выбор/бан карты

### WebSocket события:
- `join_lobby` - Подключение к лобби
- `leave_lobby` - Отключение от лобби
- `match_lobby_invite` - Приглашение в лобби
- `lobby_state` - Состояние лобби
- `lobby_update` - Обновление лобби
- `lobby_completed` - Завершение выбора карт

---

## 🎯 Особенности реализации

1. **Гибридный подход**: Основная логика на backend, real-time через WebSocket
2. **Progressive Enhancement**: Базовый функционал работает без WebSocket
3. **Масштабируемость**: Готово для расширения на другие игры
4. **Безопасность**: Проверка прав на всех уровнях
5. **UX**: Интуитивный интерфейс с визуальной обратной связью

---

## 🔧 Конфигурация

### Карты CS2 по умолчанию:
```javascript
const CS2_MAPS = [
  'de_mirage',
  'de_inferno', 
  'de_dust2',
  'de_nuke',
  'de_ancient',
  'de_vertigo',
  'de_anubis'
];
```

### Последовательности выбора:
- **Bo1**: 6 банов, 1 оставшаяся карта
- **Bo3**: Ban-Ban-Pick-Pick-Ban-Ban-Pick
- **Bo5**: Pick-Pick-Ban-Ban-Pick-Pick-Pick

---

## 📞 Поддержка

При возникновении проблем проверьте:
1. Логи backend: `pm2 logs 1337-backend`
2. WebSocket соединения в Network DevTools
3. Права пользователей в БД
4. Настройки лобби турнира

**Контакты для поддержки**: [Указать контакты команды]

---

**🎉 Функциональность лобби матча успешно реализована и готова к использованию!** 