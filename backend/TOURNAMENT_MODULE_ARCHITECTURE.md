# 🏗️ Модульная архитектура турниров v2.0

## 📋 Обзор

Модуль турниров реорганизован по принципам **Clean Architecture** с четким разделением ответственности между слоями.

## 📁 Структура модулей

```
backend/
├── controllers/tournament/          # 🎯 HTTP-слой (обработка запросов)
│   ├── TournamentController.js      # Основные операции с турнирами
│   ├── ParticipantController.js     # Управление участниками
│   ├── MatchController.js           # Управление матчами
│   ├── AdminController.js           # Административные функции
│   └── ChatController.js            # Чат турниров
│
├── services/tournament/             # 🔧 Бизнес-логика
│   ├── TournamentService.js         # Основная логика турниров
│   ├── ParticipantService.js        # Логика участников
│   ├── BracketService.js            # Генерация сеток (в разработке)
│   ├── MatchService.js              # Логика матчей (в разработке)
│   ├── AdminService.js              # Административная логика (в разработке)
│   └── ChatService.js               # Логика чата
│
├── repositories/tournament/         # 🗄️ Слой данных (работа с БД)
│   ├── TournamentRepository.js      # Работа с таблицей tournaments
│   ├── ParticipantRepository.js     # Работа с участниками
│   ├── MatchRepository.js           # Работа с матчами
│   └── TeamRepository.js            # Работа с командами
│
├── validators/tournament/           # ✅ Валидация входящих данных
│   └── TournamentValidator.js       # Валидация турниров
│
├── utils/tournament/                # 🛠️ Вспомогательные утилиты
│   ├── logger.js                    # Логирование событий турниров
│   └── chatHelpers.js               # Помощники для чата
│
├── middleware/tournament/           # 🛡️ Специализированные middleware
│   └── errorHandler.js              # Обработка ошибок турниров
│
└── routes/tournament/               # 🌐 Роутинг
    └── index.js                     # Главный роутер турниров
```

## 🎯 Контроллеры (HTTP-слой)

### TournamentController
- `getAllTournaments()` - Получение всех турниров
- `getTournamentById()` - Получение турнира по ID
- `createTournament()` - Создание турнира
- `updateTournament()` - Обновление турнира
- `deleteTournament()` - Удаление турнира
- `startTournament()` - Начало турнира
- `resetMatchResults()` - Сброс результатов
- `getGames()` - Получение списка игр
- `getTeams()` - Получение команд
- `updateDescription()` - Обновление описания
- `updateFullDescription()` - Обновление полного описания
- `updateRules()` - Обновление регламента
- `updatePrizePool()` - Обновление призового фонда
- `updateTeamSize()` - Обновление размера команды

### ParticipantController
- `participateInTournament()` - Участие в турнире
- `cancelParticipation()` - Отмена участия
- `getParticipants()` - Получение участников
- `removeParticipant()` - Удаление участника (админ)

### MatchController
- `generateBracket()` - Генерация сетки
- `regenerateBracket()` - Регенерация сетки
- `updateMatchResult()` - Обновление результата
- `getMatches()` - Получение матчей

### AdminController
- `requestAdmin()` - Запрос админки
- `respondToAdminRequest()` - Ответ на запрос
- `removeAdmin()` - Удаление админа

### ChatController
- `getChatMessages()` - Получение сообщений
- `getChatParticipants()` - Получение участников чата

## 🔧 Сервисы (Бизнес-логика)

### TournamentService
Основная бизнес-логика турниров:
- Создание и управление турнирами
- Проверка прав доступа
- Логирование событий
- Отправка уведомлений

### ParticipantService
Логика участников:
- Обработка участия в разных типах турниров
- Создание команд для mix-турниров
- Проверка лимитов участников

### Статус других сервисов
- `BracketService` - 🚧 В разработке (пока заглушка)
- `MatchService` - 🚧 В разработке (пока заглушка)
- `AdminService` - 🚧 В разработке (пока заглушка)

## 🗄️ Репозитории (Слой данных)

### TournamentRepository
- Операции CRUD для турниров
- Получение связанных данных (команды, админы)
- Специализированные запросы (сброс результатов)

### ParticipantRepository
- Управление участниками турниров
- Поиск и статистика участников
- Проверка возможности участия

### MatchRepository & TeamRepository
- Основные операции с матчами и командами
- Пока содержат базовую функциональность

## ✅ Валидация

### TournamentValidator
- `validateCreateTournament()` - Валидация создания
- `validateUpdateTournament()` - Валидация обновления
- `validateParticipation()` - Валидация участия
- `validateMatchResult()` - Валидация результатов
- Вспомогательные методы валидации

## 🛠️ Утилиты

### logger.js
- `logTournamentEvent()` - Логирование событий
- `getTournamentLogs()` - Получение логов
- `cleanupOldLogs()` - Очистка старых логов

### chatHelpers.js
- `sendTournamentChatAnnouncement()` - Системные сообщения
- `getTournamentChatMessages()` - Получение сообщений
- `getTournamentChatParticipants()` - Получение участников
- `checkTournamentParticipation()` - Проверка участия
- `sendTournamentEventNotification()` - Уведомления о событиях

## 🛡️ Обработка ошибок

### errorHandler.js
- `tournamentErrorHandler()` - Специализированный обработчик ошибок
- `asyncErrorHandler()` - Wrapper для асинхронных функций
- Маппинг ошибок на HTTP статус коды

## 🌐 API Endpoints

### Основные операции
- `GET /api/tournaments` - Список турниров
- `GET /api/tournaments/:id` - Детали турнира
- `POST /api/tournaments` - Создание турнира
- `PUT /api/tournaments/:id` - Обновление турнира
- `DELETE /api/tournaments/:id` - Удаление турнира

### Управление участниками
- `POST /api/tournaments/:id/participate` - Участие
- `DELETE /api/tournaments/:id/participate` - Отмена участия
- `GET /api/tournaments/:id/participants` - Список участников

### Управление матчами
- `POST /api/tournaments/:id/generate-bracket` - Генерация сетки
- `PUT /api/tournaments/:id/matches/:matchId/result` - Результат матча

### Административные функции
- `POST /api/tournaments/:id/request-admin` - Запрос админки
- `POST /api/tournaments/:id/respond-admin-request` - Ответ на запрос

### Чат турнира
- `GET /api/tournaments/:id/chat/messages` - Сообщения
- `GET /api/tournaments/:id/chat/participants` - Участники чата

## ✨ Преимущества новой архитектуры

1. **Разделение ответственности** - Каждый слой отвечает за свою область
2. **Тестируемость** - Легко тестировать отдельные компоненты
3. **Масштабируемость** - Простое добавление новой функциональности
4. **Поддерживаемость** - Четкая структура и логика
5. **Переиспользование** - Сервисы можно использовать в разных контроллерах
6. **Централизованная валидация** - Единые правила валидации
7. **Обработка ошибок** - Специализированная обработка ошибок

## 🔄 Миграция

- Старый файл `tournaments.js` сохранен как `tournaments.js.legacy.backup`
- Новый роутер подключен в `server.js`
- Обратная совместимость сохранена через `routes/tournaments-fix.js`

## 🚀 Развитие

### Следующие шаги:
1. ✅ Завершить реализацию `BracketService`
2. ✅ Завершить реализацию `MatchService`  
3. ✅ Завершить реализацию `AdminService`
4. ✅ Добавить unit-тесты для всех слоев
5. ✅ Реализовать caching для часто запрашиваемых данных
6. ✅ Добавить метрики и мониторинг

### Возможные улучшения:
- Добавление событийной архитектуры (Event Sourcing)
- Реализация CQRS для разделения чтения и записи
- Добавление GraphQL API для гибких запросов
- Интеграция с внешними сервисами (Steam, Discord)

## 📞 Поддержка

При возникновении проблем проверьте:
1. Логи сервера на предмет ошибок
2. Корректность подключения к базе данных
3. Наличие всех необходимых таблиц
4. Правильность настройки middleware 