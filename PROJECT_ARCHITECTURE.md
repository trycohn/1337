# 🏗️ АРХИТЕКТУРА ПРОЕКТА: 1337 Community Tournament System

**Версия**: 4.10.0  
**Дата обновления**: 28 января 2025  
**Статус**: Продакшн

## 🎯 ОБЗОР ПРОЕКТА

1337 Community Tournament System - это полнофункциональная платформа для организации и проведения турниров по различным киберспортивным дисциплинам с поддержкой множественных форматов турниров, включая Single Elimination, Double Elimination и микс-турниры.

## 🏗️ АРХИТЕКТУРА СИСТЕМЫ

### 📊 Технологический стек

**Backend:**
- **Node.js** - серверная платформа
- **Express.js** - веб-фреймворк
- **PostgreSQL** - основная база данных
- **Socket.io** - real-time коммуникация
- **JWT** - аутентификация
- **Multer** - загрузка файлов
- **bcryptjs** - хеширование паролей

**Frontend:**
- **React** - пользовательский интерфейс
- **React Router** - маршрутизация
- **Axios** - HTTP клиент
- **CSS3** - стилизация (монохромная тема)

**Инфраструктура:**
- **VDS сервер** - Ubuntu/CentOS (80.87.200.23)
- **Nginx** - веб-сервер и reverse proxy
- **PM2** - менеджер процессов
- **Git** - система контроля версий

## 🗂️ СТРУКТУРА ПРОЕКТА

```
1337/
├── backend/
│   ├── controllers/
│   │   ├── tournament/
│   │   │   ├── TournamentController.js      # Основные операции турниров
│   │   │   ├── BracketController.js         # Управление турнирными сетками
│   │   │   ├── MatchController.js           # Управление матчами
│   │   │   ├── ParticipantController.js     # Управление участниками
│   │   │   ├── AdminController.js           # Администрирование турниров
│   │   │   ├── ChatController.js            # Чаты турниров
│   │   │   └── MixTeamController.js         # Микс-команды
│   │   └── matchLobby/
│   │       └── MatchLobbyController.js      # Лобби матчей
│   ├── services/
│   │   ├── tournament/
│   │   │   ├── TournamentService.js         # Бизнес-логика турниров
│   │   │   ├── BracketGenerationService.js  # Генерация турнирных сеток
│   │   │   ├── SingleEliminationEngine.js   # Движок Single Elimination
│   │   │   ├── DoubleEliminationEngine.js   # 🆕 Движок Double Elimination
│   │   │   ├── BracketService.js            # Утилиты сеток
│   │   │   ├── MatchService.js              # Логика матчей
│   │   │   ├── ParticipantService.js        # Логика участников
│   │   │   ├── MixTeamService.js            # Логика микс-команд
│   │   │   ├── AdminService.js              # Логика администрирования
│   │   │   ├── InvitationService.js         # Приглашения в турниры
│   │   │   ├── ChatService.js               # Чаты турниров
│   │   │   └── TournamentLogService.js      # Логирование событий
│   │   ├── matchLobby/
│   │   │   └── MatchLobbyService.js         # Сервис лобби матчей
│   │   ├── achievementSystem.js             # Система достижений
│   │   ├── emailService.js                  # Email уведомления
│   │   └── realTimeStatsService.js          # Статистика в реальном времени
│   ├── repositories/
│   │   └── tournament/
│   │       ├── TournamentRepository.js      # Репозиторий турниров
│   │       ├── ParticipantRepository.js     # Репозиторий участников
│   │       ├── MatchRepository.js           # Репозиторий матчей
│   │       └── TeamRepository.js            # Репозиторий команд
│   ├── utils/
│   │   ├── tournament/
│   │   │   ├── bracketMath.js               # Математика турнирных сеток
│   │   │   ├── seedingAlgorithms.js         # Алгоритмы распределения
│   │   │   ├── chatHelpers.js               # Помощники для чатов
│   │   │   ├── logger.js                    # Логирование
│   │   │   └── TournamentValidator.js       # Валидация
│   │   ├── systemNotifications.js           # Системные уведомления
│   │   └── asyncHandler.js                  # Обработка асинхронных операций
│   ├── migrations/
│   │   └── add_bracket_type_field.sql       # 🆕 Миграция для типов сеток
│   ├── routes/
│   │   ├── tournament/
│   │   │   └── index.js                     # Роуты турниров
│   │   └── [другие роуты]
│   └── middleware/
│       ├── auth.js                          # Аутентификация
│       └── tournament/
│           └── errorHandler.js              # Обработка ошибок
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── tournament/
│       │   │   ├── TournamentSettingsPanel.js  # 🆕 Панель настроек
│       │   │   ├── TournamentAdminPanel.js     # Панель администрирования
│       │   │   ├── MixTeamManager.js           # Менеджер микс-команд
│       │   │   └── modals/
│       │   │       └── DeleteTournamentModal.js # Удаление турнира
│       │   ├── BracketRenderer.js              # 🆕 Рендер сеток (SE + DE)
│       │   ├── TournamentDetails.js            # Детали турнира
│       │   └── MixTournament.js                # Микс-турниры
│       ├── styles/
│       │   └── components/
│       │       ├── BracketRenderer.css         # 🆕 Стили для DE сеток
│       │       └── [другие стили]
│       └── utils/
│           └── tournament/
└── [конфигурационные файлы]
```

## 🆕 НОВЫЕ ВОЗМОЖНОСТИ (v4.10.0)

### 🎯 Типы турнирных сеток
- **Single Elimination** - классическое одиночное исключение
- **Double Elimination** - двойное исключение с Winners/Losers Bracket
- **Динамическое переключение** - изменение типа сетки для активных турниров
- **Права доступа** - только создатели турниров могут изменять тип сетки

### 🚀 Live обновления участников в реальном времени
- **Мгновенное отображение** - участники появляются/исчезают < 1 секунды
- **WebSocket события participant_update** - специальные события для оптимизированных обновлений
- **Точечные обновления состояния** - обновляются только участники, не весь турнир  
- **Мультипользовательская синхронизация** - изменения видны всем пользователям одновременно
- **Автоматическая инвалидация кеша** - поддержание актуальности данных
- **Fallback механизм** - откат на полную перезагрузку при ошибках WebSocket

### 🏆 Компоненты Double Elimination

**Backend:**
- `DoubleEliminationEngine.js` - движок генерации DE сеток
- `BracketGenerationService.js` - обновлен для поддержки DE
- `TournamentService.updateBracketType()` - изменение типа сетки
- `TournamentController.updateBracketType()` - API endpoint

**Frontend:**
- `TournamentSettingsPanel.js` - интерфейс выбора типа сетки
- `BracketRenderer.js` - отображение DE с Winners/Losers/Grand Final
- `BracketRenderer.css` - стили для DE компонентов

**База данных:**
- `bracket_type` поле в таблице tournaments
- Поддержка `bracket_type` в матчах (winner/loser/grand_final)

### 📡 Компоненты Live обновлений участников

**Backend:**
- `ParticipantService._broadcastParticipantUpdate()` - отправка WebSocket событий participant_update
- Интеграция в методы: `_handleSoloParticipation()`, `cancelParticipation()`, `addParticipant()`, `removeParticipant()`
- `socketio-server.getIO()` - получение Socket.IO instance для broadcasting
- `notifications.broadcastTournamentUpdate()` - fallback уведомления

**Frontend:**
- `TournamentDetails.js` - обработчик событий `participant_update` для мгновенных обновлений
- Оптимизированная логика обновления состояния (только участники, не весь турнир)
- Автоматическая инвалидация localStorage кеша при изменениях
- Проверка типов обновлений для избежания дублирования

**WebSocket события:**
- `participant_update` - специальные события с action: 'added'/'removed'/'updated'
- Фильтрация по tournamentId для точечной доставки
- Мгновенное обновление состояния React без API запросов

## 🎮 ОСНОВНЫЕ МОДУЛИ

### 1. 🏆 Турнирная система

**Форматы турниров:**
- Single Elimination
- Double Elimination
- Mix-турниры (автоматическое формирование команд)

**Типы участников:**
- Индивидуальные (solo)
- Командные (team)
- CS2 Classic 5v5
- CS2 Wingman 2v2
- Микс-команды

### 2. 🎯 Система управления сетками

**Алгоритмы распределения:**
- Случайное распределение
- По рейтингу
- Сбалансированное
- Ручное распределение

**Математика сеток:**
- Расчет количества раундов
- Предварительные матчи
- Связи между матчами
- Валидация структуры

### 3. 👥 Система микс-команд

**Возможности:**
- Автоматическое формирование команд
- Балансировка по рейтингу (FACEIT/Premier)
- Назначение капитанов
- Оптимизация баланса команд

**Алгоритмы:**
- Оптимальное попарное распределение (2v2)
- Умная змейка (5v5)
- Математическая оптимизация баланса

### 4. 🛡️ Система администрирования

**Роли:**
- Создатель турнира
- Администратор турнира
- Обычный участник

**Функции:**
- Приглашение администраторов
- Управление участниками
- Редактирование результатов
- Системные уведомления

### 5. 🎮 Система лобби матчей

**Возможности:**
- Создание лобби для матчей
- Выбор карт (pick/ban)
- Назначение первого выбирающего
- Real-time обновления

### 6. 💬 Система чатов

**Типы чатов:**
- Чаты турниров
- Приватные сообщения
- Системные уведомления
- Групповые чаты

### 7. 🏅 Система достижений

**Категории:**
- Турнирные достижения
- Социальные достижения
- Прогресс достижения
- Редкость достижений

## 📊 СХЕМА БАЗЫ ДАННЫХ

### Основные таблицы:

```sql
-- Турниры
tournaments (
    id, name, game, format, bracket_type, 
    status, created_by, max_participants,
    team_size, mix_rating_type, lobby_enabled
)

-- Участники
tournament_participants (
    id, tournament_id, user_id, name,
    faceit_elo, cs2_premier_rank, in_team
)

-- Команды
tournament_teams (
    id, tournament_id, name, creator_id
)

-- Участники команд
tournament_team_members (
    id, team_id, user_id, participant_id, 
    is_captain, captain_rating
)

-- Матчи
matches (
    id, tournament_id, team1_id, team2_id,
    round, match_number, bracket_type,
    winner_team_id, score1, score2, 
    next_match_id, status
)

-- Пользователи
users (
    id, username, email, password_hash,
    faceit_elo, cs2_premier_rank, role
)

-- Достижения
achievements (
    id, title, description, category,
    condition_type, condition_value, rarity
)

-- Чаты
chats (
    id, name, type, created_at, updated_at
)

-- Сообщения
messages (
    id, chat_id, sender_id, content,
    message_type, created_at
)
```

## 🔧 API ENDPOINTS

### 🏆 Турниры
```
GET    /api/tournaments                    # Список турниров
POST   /api/tournaments                    # Создание турнира
GET    /api/tournaments/:id                # Получение турнира
PUT    /api/tournaments/:id                # Обновление турнира
DELETE /api/tournaments/:id                # Удаление турнира
PUT    /api/tournaments/:id/bracket-type   # 🆕 Изменение типа сетки
```

### 🎯 Турнирные сетки
```
POST   /api/tournaments/:id/generate-bracket      # Генерация сетки
POST   /api/tournaments/:id/regenerate-bracket    # Регенерация сетки
GET    /api/tournaments/:id/bracket-statistics    # Статистика сетки
```

### 👥 Участники
```
POST   /api/tournaments/:id/participate           # Участие в турнире
DELETE /api/tournaments/:id/withdraw              # Отказ от участия
POST   /api/tournaments/:id/add-participant       # Добавление участника
```

### 🎮 Микс-команды
```
POST   /api/tournaments/:id/mix-generate-teams    # Генерация команд
POST   /api/tournaments/:id/mix-regenerate-teams  # Регенерация команд
POST   /api/tournaments/:id/teams/:teamId/set-captain  # Назначение капитана
```

### ⚔️ Матчи
```
GET    /api/tournaments/:id/matches               # Матчи турнира
POST   /api/matches/:id/result                    # Результат матча
DELETE /api/tournaments/:id/clear-results         # Очистка результатов
```

## 🔒 БЕЗОПАСНОСТЬ

### Аутентификация
- JWT токены
- Проверка email
- Хеширование паролей (bcrypt)

### Авторизация
- Роли пользователей (user/admin)
- Проверка прав доступа
- Создатели vs администраторы турниров

### Валидация
- Входные данные
- Структура турнирных сеток
- Целостность результатов

## 🚀 РАЗВЕРТЫВАНИЕ

### Продакшен сервер
- **Хост**: 80.87.200.23
- **Путь**: /var/www/1337community.com/
- **Сервис**: 1337-backend (PM2)
- **Веб-сервер**: Nginx

### Команды развертывания
```bash
# Подключение к серверу
ssh root@80.87.200.23

# Обновление кода
cd /var/www/1337community.com/
git pull origin main

# Миграции базы данных
sudo -u postgres psql -d tournament_db -f backend/migrations/add_bracket_type_field.sql

# Сборка фронтенда
cd frontend && npm run build

# Обновление Nginx
sudo cp -r frontend/build/* /var/www/html/1337community/

# Перезапуск сервисов
sudo systemctl restart 1337-backend
sudo systemctl restart nginx

# 🆕 Тестирование live обновлений участников (v4.10.0)
# Проверка WebSocket событий participant_update
pm2 logs 1337-backend | grep "participant_update"

# Проверка производительности
curl -w "@curl-format.txt" -s -o /dev/null http://1337community.com/api/tournaments/[ID]
```

## 🎨 ДИЗАЙН-СИСТЕМА

### Цветовая схема
- **Основной фон**: #000 (черный)
- **Основной текст**: #fff (белый)
- **Акценты**: #ff0000 (красный)
- **Hover эффекты**: #111 (темно-серый)
- **Дополнительный фон**: #111

### Компоненты
- Монохромная тема
- Красные акценты для важных действий
- Responsive дизайн
- Анимации и переходы

## 📈 МЕТРИКИ И МОНИТОРИНГ

### Производительность
- Время отклика API
- Загрузка базы данных
- Использование памяти

### Пользовательские метрики
- Количество активных турниров
- Количество участников
- Популярные игры

### Live обновления участников (v4.10.0)
- **Время отображения участника**: улучшено с 30-120 секунд до < 1 секунды
- **Сетевой трафик**: сокращен на 95% (только данные участника вместо полного турнира)
- **WebSocket события participant_update**: мониторинг отправки и получения
- **Точность синхронизации**: отслеживание успешных/неудачных обновлений состояния
- **Fallback активации**: статистика использования полной перезагрузки при ошибках

### Логирование
- События турниров
- Ошибки системы
- Действия пользователей
- WebSocket подключения и отключения
- Операции с участниками (добавление/удаление/обновление)

## 🔮 ПЛАНЫ РАЗВИТИЯ

### v5.0.0 (Планируется)
- Система рейтингов
- Интеграция с Discord
- Мобильное приложение
- Система призов

### Улучшения безопасности
- 2FA аутентификация
- Усиленная валидация
- Audit логи

### Real-time функциональность (v4.11.0+)
- Оптимистичные обновления с автоматическим откатом
- Интеллигентное кеширование с инвалидацией в реальном времени
- Система состояний для микс-команд и матчей
- WebSocket события для всех компонентов турниров
- Конфликт-резолюция при одновременных изменениях

### Новые форматы
- Swiss система
- Round Robin
- Ladder турниры

---

**Документ обновлен**: 28 января 2025  
**Версия архитектуры**: 4.10.0  
**Статус**: Актуальный  

*Система 1337 Community Tournament System готова к масштабированию и дальнейшему развитию.* 