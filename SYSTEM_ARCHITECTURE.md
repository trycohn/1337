# 🏗️ АРХИТЕКТУРА СИСТЕМЫ: 1337 Community Tournament Platform

## 🎯 Обзор проекта

**1337 Community** - современная платформа для организации киберспортивных турниров с real-time функциональностью, системой достижений и интеграцией с игровыми API.

### Ключевые особенности:
- 🏆 **Турнирная система** - создание, управление и проведение турниров
- 👥 **Управление участниками** - регистрация, команды, mix-турниры
- 📊 **Интеграция с игровыми API** - статистика Dota 2 (STRATZ), CS2
- 🏅 **Система достижений** - V4 ULTIMATE с AI анализом
- 💬 **Real-time коммуникация** - WebSocket чаты, обновления
- 📈 **Аналитика** - лидерборды, статистика, профили

---

## 🏗️ Общая архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Browser   │ │   Mobile    │ │   Desktop   │           │
│  │   React.js  │ │    Apps     │ │    Apps     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS/WSS
┌─────────────────────────┼───────────────────────────────────┐
│                    API GATEWAY                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Nginx     │ │   SSL/TLS   │ │ Rate Limit  │           │
│  │   Proxy     │ │   Termina-  │ │   & Auth    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                 APPLICATION LAYER                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Node.js   │ │  Socket.io  │ │   Express   │           │
│  │   Backend   │ │  WebSocket  │ │   Server    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                   DATA LAYER                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ PostgreSQL  │ │    Redis    │ │ File System │           │
│  │  Database   │ │   Cache     │ │   Storage   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│               EXTERNAL SERVICES                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   STRATZ    │ │   Steam     │ │   Discord   │           │
│  │  Dota2 API  │ │    API      │ │     Bot     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend архитектура

### Технологический стек:
- **Framework**: React.js ^18.0.0
- **Routing**: React Router ^6.0.0
- **State Management**: useState + Custom Hooks
- **Real-time**: Socket.io-client ^4.0.0
- **HTTP Client**: Axios (через custom api util)
- **Styling**: CSS Modules + CSS Variables
- **Build Tool**: Create React App (Webpack)

### Модульная архитектура (после рефакторинга):

```
frontend/src/
├── 🎣 hooks/                     # Custom Hooks (Business Logic)
│   ├── tournament/               # Турнирная логика
│   │   ├── useTournamentData.js  # Данные турнира + кеш
│   │   ├── useWebSocket.js       # Real-time обновления
│   │   ├── useTournamentAuth.js  # Авторизация + права
│   │   └── useMapsManagement.js  # Карты игр
│   ├── profile/                  # Профильная логика
│   └── common/                   # Общие хуки
│
├── 🧩 components/                # UI Components
│   ├── tournament/               # Турнирные компоненты
│   │   ├── TournamentDetails/    # Главный компонент (240 строк)
│   │   ├── tabs/                 # Вкладки (7 компонентов)
│   │   ├── modals/               # Модальные окна (6 компонентов)
│   │   ├── ui/                   # UI элементы
│   │   └── forms/                # Формы
│   ├── profile/                  # Профильные компоненты
│   ├── common/                   # Переиспользуемые
│   └── layout/                   # Лейаут компоненты
│
├── 🛠️ services/                  # API Services
│   ├── tournament/               # Турнирные API
│   ├── profile/                  # Профильные API
│   ├── auth/                     # Авторизация
│   └── external/                 # Внешние API
│
├── 🔧 utils/                     # Utilities
│   ├── api.js                    # HTTP клиент с retry
│   ├── mapHelpers.js             # Работа с картами
│   ├── userHelpers.js            # Пользовательские утилиты
│   └── constants.js              # Константы
│
├── 🔗 context/                   # React Context
│   ├── AuthContext.js            # Глобальная авторизация
│   └── ThemeContext.js           # Темы
│
└── 📱 pages/                     # Страницы-контейнеры
    ├── Home.js                   # Главная
    ├── Profile.js                # Профиль
    ├── TournamentList.js         # Список турниров
    └── TournamentDetails.js      # Детали турнира
```

### Ключевые компоненты:

#### 🏆 TournamentDetails (Модульная архитектура)
- **Координатор**: TournamentDetails/index.js (240 строк)
- **7 вкладок**: Info, Participants, Bracket, Results, Logs, Streams, Admin
- **6 модальных окон**: Подтверждения, редактирование, детали
- **4 custom hooks**: данные, WebSocket, авторизация, карты

#### 👤 Profile System
- **Главная страница**: Profile.js с вкладками
- **Статистика Dota 2**: DotaStats.js с STRATZ API
- **Система достижений**: V4 ULTIMATE с AI анализом
- **Организаторский профиль**: OrganizerProfile.js

#### 🎮 Tournament System
- **Список турниров**: TournamentList.js с фильтрацией
- **Создание турнира**: CreateTournament.js
- **Сетка турнира**: BracketRenderer.js с drag&drop
- **Генератор команд**: TeamGenerator.js для mix-турниров

---

## ⚙️ Backend архитектура

### Технологический стек:
- **Runtime**: Node.js ^18.0.0
- **Framework**: Express.js ^4.18.0
- **Database**: PostgreSQL ^14.0
- **Cache**: Redis ^7.0
- **Real-time**: Socket.io ^4.0.0
- **Authentication**: JWT + bcrypt
- **File Upload**: Multer
- **Process Manager**: PM2

### Структура API:

```
backend/
├── 🚀 server.js                 # Главный сервер
├── 📊 routes/                   # API маршруты
│   ├── auth.js                  # Авторизация (/api/auth)
│   ├── users.js                 # Пользователи (/api/users)
│   ├── tournaments.js           # Турниры (/api/tournaments)
│   ├── teams.js                 # Команды (/api/teams)
│   ├── dotaStats.js             # Dota 2 (/api/dota-stats)
│   ├── achievements.js          # Достижения (/api/achievements)
│   ├── v4.js                    # V4 ULTIMATE (/api/v4)
│   └── maps.js                  # Карты (/api/maps)
│
├── 🛡️ middleware/               # Middleware
│   ├── auth.js                  # JWT проверка
│   ├── rateLimit.js             # Rate limiting
│   ├── upload.js                # File upload
│   └── validation.js            # Валидация
│
├── 🗄️ migrations/               # DB миграции
├── 🎲 bracketGenerators/        # Генераторы сетки
├── 🏅 services/                 # Бизнес-сервисы
│   ├── achievementSystem.js     # Система достижений
│   ├── tournamentLogic.js       # Турнирная логика
│   └── notificationService.js   # Уведомления
│
└── 📁 uploads/                  # Файловое хранилище
    ├── avatars/                 # Аватары пользователей
    └── tournament-images/       # Изображения турниров
```

### API Endpoints:

#### 🔐 Authentication (/api/auth)
- `POST /login` - Вход в систему
- `POST /register` - Регистрация
- `POST /refresh` - Обновление токена
- `POST /logout` - Выход

#### 👥 Users (/api/users)
- `GET /me` - Текущий пользователь
- `GET /profile/:id` - Профиль пользователя
- `PUT /profile` - Обновление профиля
- `POST /upload-avatar` - Загрузка аватара
- `GET /search` - Поиск пользователей

#### 🏆 Tournaments (/api/tournaments)
- `GET /` - Список турниров
- `POST /` - Создание турнира
- `GET /:id` - Детали турнира
- `PUT /:id` - Обновление турнира
- `POST /:id/participate` - Участие в турнире
- `POST /:id/generate-bracket` - Генерация сетки
- `POST /:id/start` - Старт турнира
- `POST /:id/end` - Завершение турнира
- `POST /:id/update-match` - Обновление матча

#### 📊 Dota Stats (/api/dota-stats)
- `GET /player/:steamid` - Статистика игрока
- `GET /heroes` - Статистика героев
- `GET /matches/:steamid` - Матчи игрока
- `GET /pro-matches` - Профессиональные матчи

#### 🚀 V4 ULTIMATE (/api/v4)
- `GET /achievements/:userId` - Достижения пользователя
- `GET /leaderboards` - Лидерборды
- `GET /ai-analysis/:userId` - AI анализ игрока
- `POST /achievements/progress` - Обновление прогресса

---

## 🗄️ База данных

### PostgreSQL Schema:

```sql
-- Основные таблицы
users                    # Пользователи системы
tournaments             # Турниры
tournament_participants # Участники турниров
teams                   # Команды
team_members            # Участники команд
matches                 # Матчи турниров
tournament_logs         # Журнал событий

-- Система достижений
achievements            # Определения достижений
user_achievements      # Прогресс пользователей
leaderboards          # Таблицы лидеров

-- Dota 2 интеграция
dota_profiles         # Профили Dota 2
dota_matches          # Матчи Dota 2
dota_heroes           # Статистика героев

-- Система карт
game_maps             # Карты для игр
match_maps            # Карты использованные в матчах

-- Уведомления и чаты
notifications         # Системные уведомления
chat_messages         # Сообщения чатов
```

### Ключевые связи:
- `users` ←→ `tournaments` (создатель)
- `tournaments` ←→ `tournament_participants` (участники)
- `teams` ←→ `team_members` (состав команд)
- `tournaments` ←→ `matches` (турнирные матчи)
- `users` ←→ `user_achievements` (достижения)

---

## 🔌 Real-time архитектура

### Socket.io Events:

```javascript
// Турнирные события
tournament_update       // Обновление данных турнира
tournament_message     // Сообщения чата турнира
match_update          // Обновление матча
bracket_update        // Обновление сетки

// Пользовательские события  
user_online           // Пользователь онлайн
user_offline          // Пользователь оффлайн
achievement_unlocked  // Разблокировка достижения
notification_new      // Новое уведомление

// Системные события
server_maintenance    // Техническое обслуживание
system_announcement   // Системные объявления
```

### WebSocket Flow:
1. **Подключение**: Авторизация через JWT токен
2. **Rooms**: Автоматическое присоединение к комнатам турниров
3. **Events**: Broadcast обновлений всем участникам
4. **Persistence**: Сохранение сообщений в PostgreSQL
5. **Fallback**: HTTP polling при проблемах с WebSocket

---

## 🌐 Внешние интеграции

### STRATZ API (Dota 2):
- **Endpoint**: `https://api.stratz.com/graphql`
- **Authentication**: Bearer Token
- **Data**: Профили игроков, матчи, статистика героев
- **Caching**: Redis кеш на 1 час
- **Rate Limits**: 1000 запросов/час

### Steam API:
- **Endpoint**: `https://api.steampowered.com`
- **Authentication**: API Key
- **Data**: Профили Steam, друзья, игры
- **Caching**: Redis кеш на 24 часа

### Discord Bot (планируется):
- **Integration**: Discord.js
- **Features**: Уведомления турниров, статистика
- **Commands**: /tournament, /profile, /stats

---

## 🚀 Deployment архитектура

### VDS Server (Production):
```
Domain: 1337community.com
Server: Ubuntu 20.04 LTS
Location: /var/www/1337community.com/

Services:
├── 1337-backend (systemd)     # Node.js приложение
├── nginx                      # Reverse proxy + static files  
├── postgresql                 # Основная БД
├── redis-server              # Кеш + сессии
└── pm2                       # Process manager (backup)
```

### Environment Variables:
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db_name
REDIS_URL=redis://localhost:6379

# Authentication  
JWT_SECRET=your_jwt_secret
BCRYPT_ROUNDS=12

# External APIs
STRATZ_API_TOKEN=your_stratz_token
STEAM_API_KEY=your_steam_key

# File Storage
UPLOAD_DIR=/var/www/1337community.com/backend/uploads
MAX_FILE_SIZE=5MB

# Server Config
PORT=3000
NODE_ENV=production
```

### Nginx Configuration:
```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name 1337community.com;
    
    # Frontend (React build)
    location / {
        root /var/www/1337community.com/frontend/build;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Static files (uploads)
    location /uploads/ {
        root /var/www/1337community.com/backend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 🔧 Development архитектура

### Local Development:
```bash
# Frontend (http://localhost:3001)
cd frontend && npm start

# Backend (http://localhost:3000)  
cd backend && npm run dev

# Database
postgresql://localhost:5432/tournament_db_dev

# Redis
redis://localhost:6379/0
```

### Build Process:
```bash
# Frontend build
cd frontend && npm run build
# Output: frontend/build/

# Backend (no build needed)
# Direct deployment to VDS

# Database migrations
cd backend && npm run migrate
```

### Git Workflow:
```
main branch (production)
├── develop (integration)
├── feature/* (новые функции)
├── bugfix/* (исправления)
└── hotfix/* (критические исправления)
```

---

## 📊 Мониторинг и аналитика

### Health Checks:
- **API Health**: `GET /api/health`
- **Database**: Connection pool monitoring
- **Redis**: Cache hit rate
- **WebSocket**: Active connections count

### Logging:
- **Application**: Console + File logs
- **Access**: Nginx access logs
- **Error**: Centralized error tracking
- **Performance**: Response time monitoring

### Metrics:
- **Users**: Daily/Monthly active users
- **Tournaments**: Created/Completed count
- **Matches**: Total matches played
- **Performance**: API response times

---

## 🛡️ Безопасность

### Authentication & Authorization:
- **JWT Tokens**: Stateless authentication
- **Role-based Access**: User/Admin/Creator roles
- **Password Security**: bcrypt hashing
- **Session Management**: Redis-based sessions

### API Security:
- **Rate Limiting**: 1000 req/hour per IP
- **CORS**: Configured origins
- **Input Validation**: Joi/express-validator
- **SQL Injection**: Parameterized queries
- **XSS Protection**: Sanitization

### Infrastructure Security:
- **SSL/TLS**: Let's Encrypt certificates
- **Firewall**: UFW configured
- **SSH**: Key-based authentication
- **Regular Updates**: Automated security patches

---

## 📈 Производительность

### Frontend Optimizations:
- **Code Splitting**: Route-based chunks
- **Lazy Loading**: Dynamic imports
- **Memoization**: React.memo, useMemo, useCallback
- **Bundle Size**: Webpack optimization
- **Caching**: Browser cache headers

### Backend Optimizations:
- **Database**: Indexed queries, connection pooling
- **Caching**: Redis for frequent data
- **Compression**: Gzip/Brotli
- **Static Files**: CDN delivery (nginx)
- **Async Processing**: Non-blocking operations

### Database Optimizations:
- **Indexes**: On frequently queried columns
- **Query Optimization**: EXPLAIN ANALYZE
- **Connection Pooling**: Limited connections
- **Partitioning**: For large tables (future)

---

## 🔮 Roadmap и масштабирование

### Phase 2 (Q2 2025):
- **TypeScript Migration**: Полная типизация
- **Microservices**: Разделение на сервисы
- **CDN Integration**: Static files delivery
- **Mobile App**: React Native приложение

### Phase 3 (Q3 2025):
- **Kubernetes**: Container orchestration
- **Event Sourcing**: CQRS pattern
- **Elasticsearch**: Advanced search
- **Machine Learning**: AI recommendations

### Phase 4 (Q4 2025):
- **Multi-region**: Global deployment
- **Real-time Analytics**: Stream processing
- **Blockchain Integration**: NFT rewards
- **VR/AR Support**: Immersive experiences

---

## 🎯 Заключение

1337 Community представляет собой современную, масштабируемую платформу для киберспортивных турниров, построенную на принципах:

- **Модульности**: Каждый компонент независим и переиспользуем
- **Производительности**: Оптимизированная архитектура для высоких нагрузок  
- **Безопасности**: Многоуровневая защита данных и API
- **Масштабируемости**: Готовность к росту пользователей и функций
- **Современности**: Использование актуальных технологий и практик

Архитектура готова к enterprise-уровню нагрузок и дальнейшему развитию платформы. 