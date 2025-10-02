# 🏗️ АРХИТЕКТУРА ПРОЕКТА: 1337 Community Tournament System

**Версия**: 4.26.0  
**Дата обновления**: 2 октября 2025  
**Статус**: Продакшн

## 🎯 ОБЗОР ПРОЕКТА

1337 Community Tournament System - это полнофункциональная платформа для организации и проведения турниров по различным киберспортивным дисциплинам с поддержкой множественных форматов турниров, включая Single Elimination, Double Elimination, Swiss и микс-турниры. Платформа включает **🛡️ многоуровневую античит-систему с Steam Trust Factor**, **🎮 систему обратной связи между игроками (Match Feedback)**, **📊 репутационную систему для противодействия нечестной игре** и **💰 систему виртуальной валюты (Leet Coins)** для мотивации участия. Система включает в себя визуализацию прогресса турниров, улучшенную логику генерации турнирных сеток, **профессиональную раздельную отрисовку Double Elimination турниров**, **торжественное переименование финального матча в "Grand Final Triumph"**, **полнофункциональную систему приглашений администраторов с интерактивными сообщениями**, **расширенные права доступа администраторов к управлению турнирами**, **🆕 систему ручного редактирования сетки с Drag & Drop интерфейсом и двумя режимами работы**, **🆕 минималистичный UX дизайн с группировкой матчей в строки**, **🆕 исправленный прогресс-бар для Double Elimination турниров**, **🆕 интуитивную систему локальной нумерации матчей турниров**, **🤖 полностью автоматизированную систему обработки BYE матчей**, **🎯 интеллектуальное отображение счета карт в одноматчевых играх** и **🏆 специальные названия для ключевых матчей Double Elimination**.

## 🏗️ АРХИТЕКТУРА СИСТЕМЫ

### 📊 Технологический стек

**Backend:**
- **Node.js** - серверная платформа
- **Express.js** - веб-фреймворк
- **PostgreSQL** - основная база данных с расширенными типами bracket_type и JSONB metadata
- **Socket.io** - real-time коммуникация
- **JWT** - аутентификация
- **Multer** - загрузка файлов
- **sharp** - обработка и ресайз изображений (карты, логотипы)
- **bcryptjs** - хеширование паролей
- **🆕 steamapi** - интеграция со Steam Web API для Trust Factor
- **🆕 axios** - HTTP клиент для внешних API (Steam, FACEIT)

**Frontend:**
- **React** - пользовательский интерфейс с улучшенной системой состояний
- **React Router** - маршрутизация
- **Axios** - HTTP клиент
- **CSS3** - стилизация (монохромная тема с прогресс-барами)
- **SVG** - визуализация турнирных сеток
- **🆕 React DnD** - система Drag & Drop для ручного редактирования
- **🆕 Font Awesome (free brands, free solid)** - бренды для шейринга (Telegram, VK, Discord) и solid-иконки (корона капитана)

**🆕 Drag & Drop зависимости:**
- **react-dnd**: ^16.0.1 - основная библиотека перетаскивания
- **react-dnd-html5-backend**: ^16.0.1 - поддержка мыши для десктопа
- **react-dnd-touch-backend**: ^16.0.1 - поддержка сенсорных устройств
- **react-device-detect**: ^2.2.3 - определение типа устройства

**Инфраструктура:**
- **VDS сервер** - Ubuntu/CentOS (80.87.200.23)
- **Nginx** - веб-сервер и reverse proxy
- **PM2** - менеджер процессов
- **Git** - система контроля версий

## ♻️ Последние изменения (v4.26.0)

- 📊 **Детальная статистика с MatchZy интеграцией (Вариант 2)**
  - MatchZy webhook endpoint для автоматического приема статистики с игровых серверов
  - 5 новых таблиц БД: `match_stats`, `player_match_stats`, `player_aggregated_stats`, `player_map_stats`, `player_stats_anomalies`
  - PostgreSQL функция `update_player_aggregated_stats_v2()` для автоматической агрегации всей статистики игрока
  - Детальные метрики: K/D, ADR, HS%, KAST, HLTV Rating 2.0, Impact rating
  - Clutch статистика (1v1, 1v2, 1v3, 1v4, 1v5) с success rates
  - Entry fragging: entry kills/deaths, opening duels, trade kills
  - Utility: flash assists, utility damage, enemies flashed
  - Weapon stats: детальная статистика по каждому оружию (kills, HS%, damage) в JSONB
  - Map stats: статистика по каждой карте отдельно с T/CT side разделением
  - Компонент DetailedStats: 4 подвкладки (Обзор, Карты, Оружие, История матчей)
  - Интеграция в Profile.js: расширенная вкладка "Статистика" с детальными данными
  - API endpoints: GET /player/:id, GET /player/:id/recent, GET /player/:id/maps, GET /leaderboard

- 🔍 **Behavioral Analytics v2.0 (Детекция читеров через статистику)**
  - AnomalyDetector сервис: автоматическая детекция 5 типов аномалий
  - High HS percentage (>75-85%) - детекция аимбота
  - Sudden improvement (резкое улучшение K/D в 2+ раза) - детекция новых читов
  - Low utility + high kills - индикатор wallhack (знает позиции без флешек)
  - Perfect clutches (100% success в нескольких clutches) - подозрительная удача
  - Prefiring patterns (>80% opening duel wins) - префайры = wallhack
  - Автоматическая корректировка Trust Score при обнаружении критических аномалий (-10 за каждую)
  - Сохранение всех аномалий в БД для ручной проверки модераторами
  - Вкладка "📊 Stats" в админ-панели: мониторинг аномалий, leaderboards (топ-20), действия (бан)
  - Интеграция с Trust Score и Reputation системами (трехуровневая защита)

- 🪙 **Переименование валюты**
  - "1337 Coins" → "Leet Coins" (более узнаваемое название)
  - Обновлено во всех компонентах, API responses, документации

- 🗑️ **Удаление устаревшей V4 аналитики**
  - Удалены компоненты: V4StatsDashboard, V4ProfileHooks, V4EnhancedProfile
  - Удален backend роут: v4-enhanced-stats.js
  - Удалена вкладка "Аналитика V4 ULTIMATE" из профиля админов
  - Заменена на современную систему детальной статистики с MatchZy

- 🚀 **Модульная архитектура для масштабирования**
  - БД схема готова к расширению до Варианта 3 (heatmaps, AI insights, training plans)
  - Поля position_data, round_by_round_stats, heatmap_data, ai_insights, training_plan зарезервированы
  - Микросервисная архитектура (легко добавить Python ML сервис в будущем)
  - API design позволяет добавлять новые endpoints без breaking changes

## ♻️ Последние изменения (v4.25.0)

- 🛡️ **Система Trust Scores (Античит MVP)**
  - Интеграция со Steam Web API для проверки аккаунтов
  - Автоматический расчет Trust Score (0-100) на основе: VAC/Game банов, возраста аккаунта, Steam Level, часов в CS2, публичности профиля, количества игр
  - Автоблокировка VAC-банов (<1 года) и Game-банов (<6 месяцев) при регистрации и входе
  - Периодическая перепроверка (раз в 7 дней) при входе
  - Проверка во всех точках входа: Steam OAuth, Email/Password login, привязка Steam ID
  - Таблицы: `user_trust_scores`, `user_trust_history`
  - Админ-панель: вкладка "🛡️ Trust Scores" с фильтрацией, статистикой, перепроверкой и управлением банами
  - Weighted система: доверенные (80-100), обычные (60-79), на контроле (40-59), требуют проверки (20-39), заблокированы (0-19)

- 🎮 **Система обратной связи Match Feedback**
  - Двухэтапная модалка после завершения матча: запрос согласия → полная форма оценки
  - Оценка соперников: честность (clean/normal/suspicious/cheating), поведение (excellent/good/normal/toxic)
  - Оценка тиммейтов: командная игра (excellent/normal/poor), коммуникация (good/normal/silent/toxic)
  - Автоматическое начисление rewards: 10 coins за каждую оценку
  - Таблицы: `match_feedback`, `player_reputation`, `match_feedback_pending`, `user_coins`, `coin_transactions`
  - PostgreSQL функция `update_player_reputation()` для автоматического пересчета репутации
  - API endpoints: POST /feedback, GET /participants, GET /reputation, GET /check
  - Интеграция в MatchService: автоматическое создание pending запросов при завершении матча
  - Интеграция в MatchDetailsPage: показ модалок для участников завершенных матчей

- 📊 **Репутационная система игроков**
  - Reputation Index (0-100): агрегация всех feedback с весами (Fairness 70%, Behavior 20%, Teamplay 10%)
  - Детальные показатели: Fairness Score, Behavior Score, Teamplay Score, Communication Score
  - Breakdown по категориям: clean/suspicious/cheating reports, good/toxic behavior, teamplay ratings
  - Автоматическая флагировка при 3+ cheating reports для модерации
  - Компонент ProfileReputation: круговой индикатор, детальная статистика, предупреждения, советы по улучшению
  - Вкладка "📊 Репутация" в профиле игрока с полной статистикой

- 💰 **Система виртуальной валюты (Leet Coins)**
  - Таблицы: `user_coins` (баланс), `coin_transactions` (история)
  - Автоматическое начисление за Match Feedback (10 Leet Coins за оценку)
  - Отслеживание: balance (текущий), lifetime_earned, lifetime_spent
  - Транзакции с типами: earn (заработок), spend (трата)
  - Подготовка к будущей системе лояльности и Battle Pass

- 🛡️ **Админ-панель: Trust Scores & Feedbacks**
  - Вкладка "🛡️ Trust Scores": список всех Trust Scores с фильтрацией по действию (TRUSTED/NORMAL/WATCH_LIST/SOFT_BAN/HARD_BAN), сортировкой, статистикой (8 карточек), действиями (перепроверка, бан/разбан)
  - Вкладка "🎮 Feedbacks": suspicious players (3+ cheating reports ИЛИ reputation ≤50), статистика feedbacks (8 карточек), фильтры (мин. жалоб, макс. репутация), детальный просмотр отзывов, действия (бан/разбан)
  - API endpoints: `/api/admin/trust-scores`, `/api/admin/trust-scores/stats`, `/api/admin/suspicious-players`, `/api/admin/feedback-stats`
  - Кнопки перепроверки Trust Score, просмотра деталей игрока, управления банами

- 🔒 **Исправления безопасности**
  - Закрыта уязвимость: Trust Score теперь проверяется при входе через email/password (если Steam ID привязан)
  - Закрыта уязвимость: Trust Score проверяется ПЕРЕД привязкой Steam ID к аккаунту
  - Проверка флага `is_banned` во всех точках входа
  - Невозможность обхода античит-системы через email/password регистрацию

- 📖 **Документация и анализ**
  - Конкурентный анализ платформы vs FACEIT, FastCup, PRACC, GoodGame (80 стр)
  - Стратегия развития на 12 месяцев с бюджетом $350k (80 стр)
  - Детальный план античит-системы (90 стр)
  - Руководства по Trust Scores (3 документа, 150 стр)
  - Концепция Captain's Council & Tournament Integrity Score (50 стр)
  - Предложение систем обратной связи (3 варианта, 100 стр)
  - Инструкции по деплою (3 документа, 60 стр)

## ♻️ Последние изменения (v4.24.4)

- Кастомные матчи (Admin Match / «МАТЧ»)
  - Завершение BAN/PICK сразу создаёт запись в `matches` с `source_type='custom'`, сохраняет `maps_data`, составы (`team1_players`, `team2_players`), имена команд, `connect_url`, `gotv_url` и связывает с лобби через `admin_match_lobbies.match_id`.
  - Вето‑шаги сохраняются в новой таблице `match_veto_steps` с порядком действий.
  - Лобби возвращает активную сессию (анти‑дубликат), присутствуют статусы и готовность игроков/команд, инвайты и «Очистить лобби» для создателя.
  - При смене формата обнуляются готовности и состояние лобби (перезапуск BAN/PICK по подтверждению).

- База данных / миграции (2025‑10‑01)
  - Расширен `matches`: `source_type`, `custom_lobby_id`, `game`, `connect_url`, `gotv_url`, `maps_data JSONB`, `team1_players JSONB`, `team2_players JSONB`, `result JSONB`, `team1_name`, `team2_name`, `created_at`.
  - Создана `match_veto_steps (match_id, action_order, action_type, team_id, map_name, created_at)` + индексы.
  - В `admin_match_lobbies` добавлено `match_id` (FK → `matches.id`).
  - Создана `admin_lobby_admins` для ролей админов лобби (создатель = owner).
  - Для обратной совместимости в кастомных матчах устанавливается `round=1`, `match_number=1`, `tournament_match_number=1`.

- Backend API
  - `POST /api/admin/match-lobby/:lobbyId/presence` — онлайн/ready пользователя (только сам пользователь).
  - `POST /api/admin/match-lobby/:lobbyId/select-map` — разрешения: админ/создатель/капитан текущей команды; по завершении отдаёт `connect`/`gotv` и `match_id` без дополнительного подтверждения «Создать матч? ».
  - `POST /api/admin/match-lobby/:lobbyId/complete` — завершение кастомного матча (счёт/победитель), переводит лобби в `completed`.
  - `GET /api/matches/:id` — детали матча (турнир/кастом) с `veto_steps`.
  - `GET /api/admin/users/:userId/matches` — объединённая история матчей пользователя (турнирные + кастомные), сортировка `created_at DESC`.

- Frontend
  - Admin Match Page: табы формата (BO1/BO3/BO5) по центру, модал подтверждения на смену формата; готовность игроков (кликабельные индикаторы), готовность команд — без 5‑секундного таймера, активность кнопки «Начать BAN/PICK» только при готовности обеих команд; drag‑and‑drop ростеров; правая панель приглашений (друзья + поиск), индикаторы статусов унифицированы; показ `connect`/`GOTV` сразу после окончания BAN/PICK.
  - Профиль → «История матчей»: добавлена вкладка и список; классы переименованы с префиксом `match-history-`; иконка игры отображается как в списке турниров.
  - Страница кастомного матча `/matches/custom/:id`: детали матча, карты, `veto_steps`, ссылки подключения.

- Реал‑тайм / инфраструктура
  - В прод стабилизирован fallback на polling (Socket.IO); исправлен прокси Nginx для корректного Origin (`proxy_set_header Origin $http_origin;`).

- Деплой (VDS `/var/www/1337community.com/`)
  - Применить миграции (PostgreSQL): расширение `matches`, создание `match_veto_steps`, добавление `match_id` в `admin_match_lobbies`, `created_at` дефолт.
  - Перезапустить `1337-backend` (PM2) и пересобрать frontend.

## ♻️ Последние изменения (v4.24.3)

- Стабилизация реального времени без изменения функционала
  - Backend (Engine.IO / Socket.IO):
    - Канонический путь `path: '/socket.io'` (без хвостового слэша).
    - Временный режим только polling: `transports: ['polling']`, `allowUpgrades: false` — отключён upgrade до WebSocket, чтобы устранить циклические ошибки `websocket error` в прод.
    - Добавлено расширенное логирование handshake/transport в серверных логах (HTTP запросы к `/socket.io`, события Engine.IO `connection/upgrade/close/connection_error`).
  - Nginx:
    - Обновлён прокси для Socket.IO — единый `location ^~ /socket.io` с `proxy_pass http://localhost:3000;` (без повторного суффикса `/socket.io/`).
    - Включены заголовки Upgrade/Connection, HTTP/1.1, отключена буферизация, увеличен `proxy_read_timeout`.
  - Frontend:
    - Удалены прямые подключения `socket.io-client` с принудительным WebSocket в обход общего клиента.
      - Файлы: `frontend/src/pages/AdminMatchPage.js`, `frontend/src/components/tournament/MatchLobby/MatchLobbyPage.js` — заменены на короткий polling (обновления ~1.5s) через REST API.
    - Общий клиент `frontend/src/services/socket.js` переведён в режим `polling` (без апгрейда) и `path: '/socket.io'`.
  - PM2:
    - Запуск в `fork` (1 процесс) подтверждён; sticky не требуется для polling.
  - Redis (опционально для real‑time статистики):
    - При недоступности — работает «без кэширования», это штатно.

- Ожидаемый эффект
  - Ошибки WebSocket в консоли браузера устранены, соединения стабильны.
  - Live‑действия (чаты/лобби/уведомления) работают через надёжный polling.

### Быстрая проверка (QA)
- DevTools → Network: нет запросов `transport=websocket`; только `/socket.io/?EIO=4&transport=polling` (200/иногда 499 на закрытие long‑polling).
- Nginx access.log: отсутствуют 400 на `transport=websocket`.
- Лобби/чат: обновления видны в течение ≤1.5 секунды.

---

## ♻️ Последние изменения (v4.24.2)

- Frontend: добавлен формат Swiss
  - Плагин `SwissFormat` (унифицированные названия раундов: Round N / Semifinal / Final)
  - Регистрация формата в общем реестре (`utils/tournament/index.js`), автоматический выбор по `bracket_type` содержащему `swiss`
  - Удалены локальные оверрайды заголовков Swiss в `BracketRenderer.js`
  - Обратная совместимость: full mix Swiss турниры с историческими значениями `bracket_type` корректно определяются
  - Нумерация матчей Swiss: сортировка по `display_sequence | tournament_match_number | match_number | id`

- Backend: расширен список полей `/api/tournaments/:id/matches`
  - В ответе присутствуют `bracket_type`, `loser_next_match_id`, `next_match_id`, `tournament_match_number`, `round_name`, `match_title`, `is_third_place_match`, `is_preliminary_round`, `bye_match`, `target_slot`, `position_in_round`, `source_match1_id`, `source_match2_id`
  - Исправляет некорректную группировку DE и улучшает рендер всех форматов

- Backend: лёгкое приватное кеширование и метрики времени ответа
  - `GET /api/users/me` — `Cache-Control: private, max-age=30, stale-while-revalidate=60`, `Vary: Authorization`, `ETag`, `X-Response-Time`.
  - `GET /api/tournaments/my` — `Cache-Control: private, max-age=30, stale-while-revalidate=60`, `Vary: Authorization`, `X-Response-Time`.
  - `GET /api/tournaments/lobbies/active` — `Cache-Control: private, max-age=15, stale-while-revalidate=30`, `Vary: Authorization`, `X-Response-Time`.
  - `GET /api/tournaments/:id/admin-request-status` — `Cache-Control: private, max-age=15, stale-while-revalidate=30`, `Vary: Authorization`, `X-Response-Time`.
  - `GET /api/teams/my-teams` — `Cache-Control: private, max-age=30, stale-while-revalidate=60`, `Vary: Authorization`, `X-Response-Time`.

- Frontend: снижение нагрузки при авторизованной загрузке
  - Ленивая загрузка `GET /api/tournaments/my` в `Layout` (после первого рендера/idle; без блокировки FCP/LCP).
  - Отложенный `GET /api/tournaments/:id/admin-request-status` в `useTournamentAuth` — вызывается только если пользователь связан с турниром (создатель/админ/участник), с небольшой задержкой.

- Socket.IO: ускорение соединения и стабильность в продакшене
  - Сервер (`backend/socketio-server.js`): в проде `transports: ['websocket']`, `allowEIO3: false`, `pingInterval: 20000`, `pingTimeout: 30000`, включён `perMessageDeflate`.
  - Клиент (`frontend/src/services/socketClient_v5.js`, `frontend/src/components/tournament/MatchLobby/MatchLobbyPage.js`): в проде `transports: ['websocket']`, отключён `tryAllTransports`. В dev сохраняется fallback `['websocket','polling']`.
  - Live‑функциональность лобби сохранена (комнаты/события без изменений), уменьшены накладные расходы на старт/поддержание соединения.

- Ожидаемый эффект
  - Быстрее «первая волна» загрузки под авторизацией, меньше конкуренция за сеть/CPU.
  - Стабильный WebSocket без HTTP‑polling, меньше лог‑шума и TTFB повторных запросов.

### Быстрая проверка (QA)
- DevTools → Network: одна линия WebSocket, нет `transport=polling`.
- В Headers приватных эндпоинтов видны `Cache-Control`, `Vary: Authorization`, `X-Response-Time` (и `ETag` для `/users/me`).
 - Swiss турниры: заголовки раундов отображаются как “Round N / Semifinal / Final”.

---

## ♻️ Последние изменения (v4.24.0)

- Full Mix: отдельная страница Черновика для админов (`/tournaments/:id/fullmix/draft`)
  - Двухколоночный интерфейс: слева составы, справа пары матчей
  - Двухэтапное утверждение: `approved_teams` → `approved_matches`
  - Превью-механизм: `full_mix_previews` c режимами `mode: 'teams' | 'matches'`, эфемерная генерация без записи в БД
  - Защиты: запрет переформирования после утверждения/завершения раунда
  - Восстановление удалённых ранее участников как «исключённых»: `POST /:id/fullmix/eliminated/recover`

- Full Mix Standings/раунды (публично):
  - `GET /:id/fullmix/standings`, `GET /:id/fullmix/snapshots`, `GET /:id/fullmix/rounds/:round`
  - Кэш‑заголовки: `no-store`, `Vary: Authorization`, ETag на выдаче
  - Столбец G (сыграно), авто‑сортировка по победам

- Full Mix meta и текущий раунд:
  - Хранение `current_round` в `tournament_full_mix_settings` (миграция 20250912)
  - В снапшотах: `snapshot.meta.finalists | eliminated | extra_round | final_round`

- Управление выбывшими (админ):
  - `GET/POST/DELETE /:id/fullmix/eliminated`, сокет `fullmix_eliminated_updated`
  - В Черновике: таблица участников с поиском по нику, статусом (играет/исключен/финалист), действиями «Исключить»/«Вернуть», кнопкой «Восстановить удалённых»

- Live‑обновления Full Mix:
  - `fullmix_preview_updated`, `fullmix_match_updated`, `fullmix_round_completed`, `fullmix_eliminated_updated`

- UI правки:
  - На вкладке «Участники» для MIX оставлен только `TeamGenerator`; дублирующий список участников убран
  - В Standings зачёркивание исключённых, аватары пользователей, монохромные стили

## ♻️ Последние изменения (v4.23.2)

- UI/UX: фон-подложка турнира (hero layer) перенесена в общий layout и сделана прокручиваемой
  - Элемент `div.tournament-hero-layer` теперь рендерится в самом начале контейнера `home-container` (до `<header>`)
  - Позиционирование: `position: absolute; top: 0; left: 50%; transform: translateX(-50%); z-index: 0; pointer-events: none`
  - Высота: 400px (десктоп), 240px (мобайл); ширина: 100vw
  - Десктоп: `background-size: cover` (допускается обрезка краёв); мобайл: `background-size: contain` (без обрезки)
  - Изображение задаётся в `frontend/src/components/Layout.js` инлайн-стилем на маршрутах `/tournaments/...`
  - Обновлены стили в `frontend/src/components/TournamentDetails.css`; основной контент имеет `z-index: 1`

- Create Tournament: переработан заголовок и форма
  - Двухколоночный заголовок: слева `contentEditable` заголовок (`.editable-title`) + загрузка логотипа; справа инфоблок (приз, старт, статус, формат, участники, размер команды) и прогресс‑бар 0%
  - Форма разбита на 3 секции: «Основная информация», «Настройки MIX турнира» (условно), «Дополнительные настройки»
  - Фон у `select`: `#373737`; контейнер формы тянется на 100% ширины; основная кнопка «Создать турнир» под формой
  - Удалён чекбокс «Включить Full Double Elimination?»
  - Файлы: `frontend/src/components/CreateTournament.js`, `frontend/src/components/CreateTournament.css`

- Стандартизация кнопок
  - По всему проекту используются `btn`, `btn-primary`, `btn-secondary`; локальные конфликты стилей убраны

- Хедер и мобильное меню
  - Мобильное меню скрыто по умолчанию, полноширинное (100vw), фон `rgba(0,0,0,0.9)`, корректные переходы
  - Исправлено дублирование пункта «Мои турниры»; добавлена страница и переход

- Регламент турнира
  - Кнопка «Регламент» открывает `/tournaments/:id/rules` в новой вкладке
  - Сохранение с явным `Authorization` и последующим `GET` для актуализации; простой редактор включён принудительно

- Страницы CS2 турниров
  - Скрыта вкладка «Главная», по умолчанию открывается «Участники»

- Чат и инвайты лобби
  - Улучшён рендер Markdown‑ссылок; корректные ссылки на лобби‑приглашения
  - Файл: `frontend/src/components/Message.js`

- Участники микс‑турниров
  - Вкладка «Участники» отделена от «MIX команды»; к классам добавлены постфиксы `-participants2.0` и `-mixteams`
  - «MIX команды»: карточки с хедером (аватар команды, название, аватары участников с перекрытием ~20%, ранг), список участников построчно
  - В «Участники»: правый столбец со списком команд — заголовок из 2 колонок, строки‑команды, статусы справа («Участвует», «Выбыла», «Победитель»)
  - Реал‑тайм обновление статусов команд (Socket.IO); дефолтный аватар команды = аватар капитана
  - Под списком команд — блок приглашения друга (реферальный)
- MIX‑турниры: добавлено поле `mix_type` (classic | full)
  - Backend: сохраняется в `tournaments.mix_type` при `format='mix'`
  - Frontend: при создании турнира передаётся `mix_type`; UI для Full Mix опирается на `tournament.mix_type === 'full'`
  - Отрисовка и тексты кнопок (например, «Сформировать команды для 1 раунда») зависят от `mix_type='full'`

- Прочее
  - Прелоадер заменён на SVG‑логотип с анимацией
  - Общий axios‑инстанс с интерсептором `Authorization: Bearer <token>`
  - Исправлены предупреждения линтера: порядок импортов, порядок вызова `useMemo`

Ключевые файлы:
- Frontend: `frontend/src/components/Layout.js`, `frontend/src/components/TournamentDetails.css`, `frontend/src/components/TournamentDetails.js`
- Frontend: `frontend/src/components/CreateTournament.js`, `frontend/src/components/CreateTournament.css`
- Frontend: `frontend/src/components/Message.js`, `frontend/src/components/tournament/TournamentParticipants.js`, `frontend/src/components/tournament/TeamGenerator.js`

## ♻️ Последние изменения (v4.22.2)

- UI/UX: обновлён хедер и глобальные стили в соответствии с Figma
  - Хедер: монохром, `backdrop-filter: blur(8px)`, SVG‑логотип `1337 white logo.svg`.
  - Кнопки: единая система `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost` в `frontend/src/styles/components.css`; удалены анимации/transition/transform по проекту.
  - Мобильное меню (гамбургер): полноэкранное выезжающее меню с фоном `rgba(0,0,0,0.9)`; каждый пункт тянется на всю ширину, центрируется, зона тапа ≥56px.
  - Кнопка «Создать турнир»: на мобильных перенесена внутрь меню; в шапке скрыта.
  - Прелоадер: SVG‑логотип + три точки (вместо полосы прогресса и текста).
  - Главная: скрыт анимированный индикатор скролла на мобильных (`@media (max-width: 768px)` → `.scroll-indicator { display: none; }`).
  - Чистка локальных стилей кнопок в компонентах/модалях; централизация в `components.css`.

Затронутые файлы (ключевые):
- `frontend/src/components/Layout.js`, `frontend/src/components/Layout.css`
- `frontend/src/styles/components.css`, `frontend/src/styles/HomePage.css`
- Ряд CSS модалей и панелей — вычищены дубли стилей кнопок
 
## ♻️ Последние изменения (v4.22.3)

- Главная страница
  - Заменён `hero-section` на карусель турниров в стиле Steam: окно 4 карточки, шаг пролистывания 1 элемент, циклично. Монохромные круглые стрелки и точки навигации; у неактивных на ховере появляется внутренняя точка.
  - Карточки турниров с flip-анимацией только для турниров; карточки чемпионов без flip. Фон `#1d1d1d`, изображение 100px, под изображением статусная плашка. Для изоляции стилей добавлены классы с постфиксом `-carousel`: `steam-card-carousel`, `tournament-card-carousel`, `tournament-card-inner-carousel`, `winner-card-carousel`.
  - Секция `about-section` поднята над каруселями, разбита на 2/3 (текст) + 1/3 (автокарусель фото каждые 4с) из `frontend/public/images/home photos tournament`. Затемнение 20%, высота фото-блока 360px.
  - Удалены секции `features-section`, `cta-section`, `community-section`.

- Поведение клика по матчам
  - Для турниров со статусом "completed" клик по карточке матча ведёт на страницу матча (для всех, кроме создателя/админов; на мобильных — всегда переход). Обновлены `frontend/src/components/BracketRenderer.js` и `frontend/src/components/TournamentDetails.js`.

- Дефолтные аватары пользователей
  - На backend предзагружается SVG `circle-user` (FontAwesome) в `/uploads/avatars/preloaded/circle-user.svg` и устанавливается как дефолт для `users.avatar_url`. Выполняется автозамена пустых/некорректных значений при старте сервера.

- Дефолтный мап‑пул
  - Добавлена idempot‑инициализация таблицы `default_map_pool` с уникальным ключом `(game, map_name)` и индексом `(game, display_order)`, заполнение CS2 по умолчанию. Исправлен 500 на `GET /api/admin/default-map-pool`.
  - `GET /default-map-pool` принимает `?game=...` (по умолчанию `Counter-Strike 2`). `PUT /default-map-pool` принимает `{ maps: string[], game?: string }` и перезаписывает порядок.

- Изоляция карусельных стилей
  - Разделены стили турниров и чемпионов; flip применяется только к `tournament-card-carousel`, у победителей выключен. Переработаны стрелки и точки под монохромную тему.

Ключевые файлы:
- Frontend: `frontend/src/pages/HomePage.js`, `frontend/src/styles/HomePage.css`
- Backend: `backend/routes/admin.js`, `backend/server.js`

## ♻️ Последние изменения (v4.23.0)

- Многоступенчатые турниры (финал ↔ отборочные)
  - БД: `tournaments` расширена полями `is_series_final`, `access_type` (open/closed)
  - БД: добавлены `tournament_qualifiers`, `tournament_promotions` (уникальность по финалу/отборочному/команде/месту)
  - API: `PUT /:id/qualifiers`, `GET /:id/qualifiers`, `POST /:id/qualifiers/sync`, `PUT /:id/series-final-flag`, `GET /search/live`
  - События: автосинхронизация победителей при завершении отборочного
  - Frontend admin: выбор отборочных из списка, live‑поиск (3+ символа), фильтры

- Типы доступа турниров
  - `access_type` = open/closed; Closed скрывает кнопку «Участвовать» и показывает «Invite only»
  - «Тип турнира»: Open / Closed / Series Final; Series Final включает `is_series_final`

- Участники/Команды (UI)
  - Капитаны отмечены иконкой короны (FA Solid)
  - Имена участников кликабельны (`/user/:id`), названия команд кликабельны (`/teams/:id`)

- Зависимости
  - Добавлен `@fortawesome/free-solid-svg-icons`

Ключевые файлы:
- Backend: `TournamentService.js`, `TournamentRepository.js`, `TournamentController.js`, `routes/tournament/index.js`
- Frontend: `CreateTournament.js`, `tournament/TournamentAdminPanel.js`, `TournamentInfoSection.js`, `tournament/TournamentParticipants.js`, CSS

## ♻️ Последние изменения (v4.23.1)

- Страница шеринга сетки в отдельной вкладке исправлена (не пустая):
  - `frontend/src/pages/BracketSharePage.js` теперь восстанавливает имена соперников из `tournament.participants`/`tournament.teams`, если у матчей отсутствуют `team1_name`/`team2_name`.
  - Сетка корректно показывает соперников и результат без авторизации (роут публичный: `GET /api/tournaments/:id`).
  - Поддержаны параметры: `?match=<id>` (фокус карточки) и `?view=compact|classic`.
- Кнопка в `BracketRenderer` («Открыть в новой вкладке») формирует URL `/tournaments/:id/bracket` и прокидывает `?match` при наличии.
- Бэкенд без изменений: `MatchRepository.getByTournamentId` по‑прежнему возвращает чистые матчи; сопоставление имен выполняется на фронтенде.

### ♻️ Обновления лобби и отображения матчей (v4.22.4)

- Лобби CS2
  - Нативный выбор формата при создании лобби (BO1/BO3/BO5) из карточки матча. Без ввода текста.
  - Backend принимает `matchFormat` в `POST /api/tournaments/:tournamentId/matches/:matchId/(create|recreate)-lobby` и валидирует (`bo1|bo3|bo5`).
  - Приглашения отправляются всем участникам обеих команд с валидным `user_id` (ручные участники без `user_id` не приглашаются).
  - Права: только капитаны могут «Готов» и пик/бан; остальные — наблюдатели. Проверка прав в `setReadyStatus` и `selectMap`.
  - Назначение первого хода: внешний админ вручную; при его отсутствии и готовности обеих команд — случайно.
  - Последовательности пик/бан (чёткая очередность 1,2,1,2,...):
    - BO1: `ban, ban, ban, ban, ban, ban, pick`.
    - BO3: `ban, ban, pick, pick, ban, ban, pick`.
    - BO5: `pick, pick, ban, ban, pick, pick, pick`.

- Отображение и фиксация результата
  - Страница матча: модалка ввода счёта по клику на карту; кнопка «Завершить матч» для админов/создателя.
  - Итоговый счёт: 1 карта → реальный счёт карты; несколько карт → количество выигранных карт. Применено на странице матча, в сетке и во вкладке «Результаты».
  - Backend `saveMatchResult`: принимает `score1/score2/maps_data/winner_team_id`; фронтенд агрегирует счёт по правилам выше.

— Стабильность
  - Исключена ошибка `NULL` при приглашениях: вставляются только члены с `user_id`.

## ♻️ Последние изменения (v4.22.1)

- Email-верификация: единый сервис писем и отправка 6-значного кода
  - Backend:
    - `backend/services/emailService.js`: `sendEmailVerificationCode(email, username, code)`; SMTP на env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
    - Роуты (требуется JWT):
      - `POST /api/users/verify-email` — генерирует код, сохраняет `users.verification_token` и `token_expiry`, отправляет письмо.
      - `POST /api/users/confirm-email` — валидирует код, устанавливает `users.is_verified = true`.
    - БД: у таблицы `users` должны существовать поля: `verification_token VARCHAR(6)`, `token_expiry TIMESTAMP`, `is_verified BOOLEAN DEFAULT FALSE`.
  - Frontend:
    - `frontend/src/components/Profile.js`: показ сообщения об успехе на 3 секунды и затем перезагрузка страницы профиля.

- Команды (Teams API): устранён 400 (Bad Request) из-за перехвата динамическим маршрутом
  - `backend/routes/teams.js`: статические маршруты (`/my-teams`, `/invitations`, и др.) объявлены до параметрических `/:id`, `/:id/matches`.

- Единый HTTP-клиент на фронтенде
  - `frontend/src/components/MyTeams.js`: использование единого axios-инстанса `frontend/src/axios.js`.

- Видимость информационных тултипов в авторизации/регистрации
  - `frontend/src/styles/components/Auth.css`: `overflow: visible` для контейнеров форм; `z-index` у `.auth-tooltip` повышен (поверх модальных окон).

## 🗂️ СТРУКТУРА ПРОЕКТА

```
1337/
├── backend/
│   ├── services/
│   │   ├── antiCheat/
│   │   │   ├── index.js                         # 🆕 Главный модуль античит-системы
│   │   │   ├── steamTrustFactor.js              # 🆕 Steam API интеграция
│   │   │   └── trustScoreCalculator.js          # 🆕 Алгоритм расчета Trust Score
│   │   ├── stats/
│   │   │   ├── StatsProcessor.js                # 🆕 Парсинг данных от MatchZy
│   │   │   └── AnomalyDetector.js               # 🆕 Детекция читеров через статистику
│   ├── controllers/
│   │   ├── tournament/
│   │   │   ├── TournamentController.js      # Основные операции турниров + ручное редактирование
│   │   │   ├── BracketController.js         # Управление турнирными сетками
│   │   │   ├── MatchController.js           # Управление матчами
│   │   │   ├── ParticipantController.js     # Управление участниками
│   │   │   ├── AdminController.js           # 🆕 Администрирование + приглашения
│   │   │   ├── ChatController.js            # Чаты турниров
│   │   │   └── MixTeamController.js         # Микс-команды
│   │   └── matchLobby/
│   │       └── MatchLobbyController.js      # Лобби матчей
│   ├── services/
│   │   ├── tournament/
│   │   │   ├── TournamentService.js         # Бизнес-логика турниров + ручное редактирование
│   │   │   ├── BracketGenerationService.js  # Генерация турнирных сеток
│   │   │   ├── SingleEliminationEngine.js   # 🔧 Улучшенный движок Single Elimination
│   │   │   ├── DoubleEliminationEngine.js   # Движок Double Elimination
│   │   │   ├── BracketService.js            # Утилиты сеток
│   │   │   ├── MatchService.js              # Логика матчей
│   │   │   ├── ParticipantService.js        # Логика участников
│   │   │   ├── MixTeamService.js            # Логика микс-команд
│   │   │   ├── AdminService.js              # 🆕 Логика администрирования + приглашения
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
│   │   ├── systemNotifications.js           # 🆕 Системные уведомления с JSONB metadata
│   │   └── asyncHandler.js                  # Обработка асинхронных операций
│   ├── migrations/
│   │   ├── add_bracket_type_field.sql       # 🆕 Миграция для расширенных типов сеток
│   │   └── admin_invitations_migration.sql  # 🆕 Система приглашений администраторов
│   ├── routes/
│   │   ├── tournament/
│   │   │   └── index.js                     # 🆕 Роуты турниров + admin invitations API + manual bracket edit
│   │   ├── admin.js                         # 🆕 Trust Scores API + Feedbacks API + дефолтный маппул
│   │   ├── teams.js                         # 🆕 Публичные профили команд, история матчей, статистика по картам
│   │   ├── chats.js                         # 🆕 Исправленный API с поддержкой metadata
│   │   ├── matchFeedback.js                 # 🆕 Match Feedback API (POST /feedback, GET /participants, GET /reputation)
│   │   ├── matchzy.js                       # 🆕 MatchZy webhook (POST /stats, POST /demo)
│   │   └── stats.js                         # 🆕 Детальная статистика API (GET /player/:id, leaderboards, anomalies)
│   └── middleware/
│       ├── auth.js                          # Аутентификация
│       └── tournament/
│           └── errorHandler.js              # Обработка ошибок
├── frontend/
│   └── src/
│       ├── components/
│   │   │   ├── feedback/
│   │   │   │   ├── FeedbackPromptModal.js           # 🆕 Модалка запроса оценки
│   │   │   │   ├── FeedbackPromptModal.css          # 🆕 Стили первой модалки
│   │   │   │   ├── PostMatchFeedbackModal.js        # 🆕 Форма оценки игроков
│   │   │   │   ├── PostMatchFeedbackModal.css       # 🆕 Стили формы
│   │   │   │   ├── MatchFeedbackManager.js          # 🆕 Менеджер модалок
│   │   │   │   └── index.js                         # 🆕 Экспорт компонентов
│   │   │   ├── stats/
│   │   │   │   ├── DetailedStats.js                 # 🆕 Компонент детальной статистики (MatchZy)
│   │   │   │   └── DetailedStats.css                # 🆕 Стили детальной статистики
│   │   │   ├── ProfileReputation.js                 # 🆕 Компонент репутации игрока
│   │   │   ├── ProfileReputation.css                # 🆕 Стили репутации
│   │   │   ├── Profile.js                           # 🔧 ОБНОВЛЕН (вкладки: Репутация + Статистика MatchZy)
│   │   │   ├── AdminPanel.js                        # 🔧 ОБНОВЛЕН (4 вкладки: Trust Scores, Feedbacks, Stats, остальные)
│   │   │   ├── AdminPanel.css                       # 🔧 ОБНОВЛЕН (стили для всех новых вкладок)
│   │   │   ├── tournament/
│   │   │   │   ├── TournamentSettingsPanel.js      # Панель настроек турнира
│   │   │   │   ├── TournamentAdminPanel.js         # 🆕 Панель администрирования + кнопка ручного редактирования
│   │   │   │   ├── BracketManagementPanel.js       # Панель управления сеткой
│   │   │   │   ├── BracketConnections.js           # SVG соединения для сеток
│   │   │   │   ├── TournamentProgressBar.js        # 🆕 Прогресс-бар с исправлениями для DE
│   │   │   │   ├── TournamentProgressBar.css       # 🆕 Стили прогресс-бара
│   │   │   │   ├── MixTeamManager.js               # Менеджер микс-команд
│   │   │   │   ├── 🆕 ManualBracketEditor.js       # 🆕 Основной компонент ручного редактирования
│   │   │   │   ├── 🆕 ManualBracketEditor.css      # 🆕 Стили системы редактирования
│   │   │   │   ├── TournamentParticipants.js       # Участники турнира
│   │   │   │   ├── UnifiedParticipantsPanel.js     # Унифицированная панель участников
│   │   │   │   ├── PodiumSection.js                # Секция подиума
│   │   │   │   ├── TournamentResults.css           # 🆕 Стили результатов (подоум, история) — используется и на Главной
│   │   │   │   ├── TournamentFloatingActionPanel.js # Плавающая панель действий
│   │   │   │   ├── TournamentContextualControls.js # Контекстные элементы управления
│   │   │   │   └── modals/
│   │   │   │       └── DeleteTournamentModal.js    # Удаление турнира
│   │   │   │   └── MatchLobby/                     # Компоненты лобби матчей
│   │   │   ├── BracketRenderer.js                  # Модульный рендер сеток v2.0
│   │   │   ├── TournamentDetails.js                # 🔧 Детали турнира; Главная использует общий PodiumSection из "Результатов"
│   │   │   ├── TournamentInfoSection.js            # 🔧 Упрощенная секция информации
│   │   │   ├── MixTournament.js                    # Микс-турниры
│   │   │   ├── Message.js                          # 🆕 Интерактивные сообщения с кнопками
│   │   │   ├── Messenger.js                        # 🆕 Чат с исправленным cooldown
│   │   │   └── InteractiveMessage.js               # 🆕 Компонент интерактивных сообщений
│       ├── public/
│       │   └── images/
│       │       └── maps/                           # 🆕 Локальные изображения карт (320x180)
│       ├── styles/
│       │   └── components/
│       │       ├── BracketRenderer.css             # Расширенные стили для всех форматов
│       │       └── Message.css                     # 🆕 Стили для интерактивных сообщений
│       └── utils/
│           └── tournament/
│               ├── index.js                        # Точка входа для турнирных утилит
│               ├── bracketFormats.js               # Система плагинов форматов
│               └── formats/                        # Плагины форматов турниров
│                   ├── SingleEliminationFormat.js
│                   └── DoubleEliminationFormat.js
├── test_admin_access.js                            # 🆕 Диагностический скрипт прав доступа
├── test_progress_bar_de.js                         # 🆕 Диагностический скрипт прогресс-бара DE
└── [конфигурационные файлы]
```

## 🆕 СИСТЕМА РУЧНОГО РЕДАКТИРОВАНИЯ СЕТКИ (v4.17.0)

### 🎯 Архитектура системы редактирования

**Полнофункциональная система ручного редактирования сетки** с двумя режимами работы и минималистичным UX дизайном:

#### 📊 Компоненты системы

**1. Frontend компоненты:**

**ManualBracketEditor.js** - Основной компонент:
- Переключение между режимами Drag & Drop и Table
- Инициализация позиций из первого раунда матчей  
- Валидация изменений и предварительный просмотр
- Сохранение изменений через API
- **🆕 Минималистичный дизайн с группировкой матчей в строки**

**DraggableParticipant** - Компонент перетаскивания:
- Drag & Drop логика с react-dnd
- Визуальная обратная связь (подсветка drop-зон)
- Поддержка мобильных устройств (TouchBackend)
- Swap-механика для обмена участниками местами

**TableBracketEditor** - Табличный редактор:
- Поиск участников по имени
- Выпадающие списки с валидацией
- Счетчик доступных участников
- Быстрая очистка позиций

**2. Backend API:**

**Роут**: `POST /api/tournaments/:id/manual-bracket-edit`
- Права доступа: только создатель турнира
- Параметры: `{ bracketData: Array<{matchId, team1_id, team2_id}> }`
- Ответ: `{ success: true, updatedMatches: number, clearedResults: number }`

#### 🎮 Режимы работы

**1. 🎯 Drag & Drop режим (основной):**
- **🆕 Компактный дизайн**: один матч = одна строка
- **Визуальное перетаскивание** участников между позициями
- **Swap-механика** - автоматический обмен участниками
- **Drop-зоны с подсветкой** - зеленая анимация для допустимых позиций
- **Превью режим** - открытие в новой вкладке для параллельного просмотра
- **Мобильная поддержка** - адаптация для сенсорных устройств

**Новая структура интерфейса:**
```javascript
// 🏆 Один матч = одна строка
<div className="match-row">
  <div className="match-title">Матч 1</div>
  <div className="match-participants">
    <DraggableParticipant participant={participant1} />
    <div className="vs-separator">VS</div>
    <DraggableParticipant participant={participant2} />
  </div>
</div>
```

**2. 📊 Табличный режим (альтернативный):**
- **🆕 Компактные строки**: уменьшенные отступы (6px вместо 12px)
- **Поиск по имени** - динамическая фильтрация участников
- **Выпадающие списки** - точный выбор участника для каждой позиции
- **Валидация дубликатов** - предотвращение повторных назначений
- **Счетчик доступных** - отображение свободных участников
- **Быстрая очистка** - кнопка освобождения позиции

### 🎨 UX улучшения системы редактирования

**Ключевые изменения в дизайне:**

1. **Компактность элементов:**
   - Высота слотов участников: с 80px до 50px (экономия 37.5%)
   - Отступы слотов: с 12px до 8px (экономия 33%)
   - Размер шрифтов деталей: с 12px до 10px (экономия 16.7%)

2. **Группировка матчей:**
   - Четкая визуальная связь участников через разделитель "VS"
   - Заголовки матчей для лучшей навигации
   - Улучшенная читаемость благодаря лучшему контрасту

3. **Оптимизированное превью:**
   - Открытие в новой вкладке вместо переключения режима
   - Сохранение контекста редактирования
   - Возможность параллельного сравнения изменений

#### 🔄 Последствия редактирования

**Автоматические действия при сохранении:**
1. **🔄 Сброс всех результатов** - очистка winner_team_id, score1, score2
2. **📝 Установка состояния PENDING** - все матчи возвращаются в ожидание
3. **✏️ Обновление первого раунда** - новая расстановка участников  
4. **🎯 Смена статуса турнира** - с "in_progress" на "active" если необходимо
5. **📝 Логирование события** - запись в tournament_logs
6. **💬 Уведомление в чат** - автоматическое сообщение участникам
7. **📡 WebSocket обновление** - real-time уведомления всех пользователей

#### 🎨 Монохромный дизайн

**Цветовая схема системы редактирования:**
- **Основа**: черный фон (#000), белый текст (#fff), красные акценты (#ff0000)
- **Анимации**: пульсация индикаторов, эффекты перетаскивания, анимация drop-зон
- **Адаптивность**: поддержка десктопных и мобильных устройств

**Визуальные индикаторы:**
- **🔴 Красный пульсирующий индикатор** - есть несохраненные изменения
- **🟢 Зеленая анимация drop-зон** - допустимые позиции для перетаскивания
- **⚠️ Желтое предупреждение** - о сбросе результатов матчей
- **📊 Счетчики участников** - доступные/назначенные участники

## 🆕 ИСПРАВЛЕНИЯ ПРОГРЕСС-БАРА DOUBLE ELIMINATION (v4.15.3)

### 🔧 Проблема и решение

**Проблема**: Прогресс-бар некорректно отображал прогресс для Double Elimination турниров, показывая 0% даже при наличии завершенных матчей.

**Решение**: Реализована раздельная логика для DE и SE турниров в `TournamentProgressBar.js`:

```javascript
// ✅ Разная логика для DE и SE турниров
const bracketType = tournament?.bracket_type || 'single_elimination';
const isDoubleElimination = bracketType === 'double_elimination' || 
                           bracketType === 'doubleElimination' ||
                           bracketType === 'DOUBLE_ELIMINATION';

if (isDoubleElimination) {
    // 🏆 DE: все созданные матчи потенциально играбельны
    realMatches = matches.filter(match => 
        match.bracket_type && 
        ['winner', 'loser', 'grand_final', 'grand_final_reset'].includes(match.bracket_type)
    );
} else {
    // 🎯 SE: только матчи с участниками
    realMatches = matches.filter(match => 
        match.team1_id && match.team2_id
    );
}
```

**Результат:**
- ✅ Корректный подсчет всех матчей DE структуры
- ✅ Правильный расчет процента завершения  
- ✅ Специальная маркировка "(DE)" для DE турниров
- ✅ Улучшена проверка завершенных матчей (добавлен `hasWinner`)

### 📊 Математика Double Elimination

**Ожидаемое количество матчей:**

| Участников | Winners | Losers | Grand Final | **Всего** |
|------------|---------|--------|-------------|-----------|
| 4          | 3       | 2      | 2           | **7**     |
| 8          | 7       | 6      | 2           | **15**    |
| 16         | 15      | 14     | 2           | **31**    |
| 32         | 31      | 30     | 2           | **63**    |
| 64         | 63      | 62     | 2           | **127**   |

## 🆕 СИСТЕМА ЛОКАЛЬНОЙ НУМЕРАЦИИ МАТЧЕЙ (v4.18.0)

### 🎯 Архитектура локальной нумерации

**Полнофункциональная система локальной нумерации матчей** с автоматическим присвоением уникальных номеров в рамках каждого турнира:

#### 📊 Компоненты системы

**1. База данных:**
```sql
-- Добавлено новое поле для локальной нумерации
ALTER TABLE matches ADD COLUMN tournament_match_number INTEGER;
COMMENT ON COLUMN matches.tournament_match_number IS 'Номер матча внутри турнира (начинается с 1 для каждого турнира)';

-- Индекс для производительности
CREATE INDEX idx_matches_tournament_match_number 
ON matches(tournament_id, tournament_match_number);
```

**2. Backend движки:**
- **SingleEliminationEngine.js** - обновлен для использования локальной нумерации
- **DoubleEliminationEngine.js** - обновлен для использования локальной нумерации
- Автоматическое присвоение `tournament_match_number` при создании матчей

**3. Frontend компоненты:**
- **BracketRenderer.js** - приоритет локальной нумерации в отображении
- **TournamentDetails.js** - передача `tournament_match_number` в игровые объекты
- **ManualBracketEditor.js** - отображение локальных номеров в редакторе
- **MatchDetailsModal.js** - локальная нумерация в модальных окнах

#### 🎮 Принцип работы

**1. Создание матчей:**
- Каждый турнир начинает нумерацию с 1
- Глобальный номер (`match_number`) сохраняется для внутренних целей
- Локальный номер (`tournament_match_number`) используется для отображения

**2. Порядок нумерации:**
```javascript
// Приоритет типов матчей для корректного порядка
CASE bracket_type 
    WHEN 'winner' THEN 1          // Основные матчи
    WHEN 'semifinal' THEN 2       // Полуфиналы  
    WHEN 'final' THEN 3           // Финалы
    WHEN 'placement' THEN 4       // Матчи за места
    WHEN 'loser' THEN 5           // Losers Bracket
    WHEN 'grand_final' THEN 6     // Гранд Финал
    WHEN 'grand_final_reset' THEN 7 // Grand Final Triumph
    ELSE 8 
END
```

**3. Миграция существующих данных:**
```sql
-- Автоматическое заполнение для существующих турниров
UPDATE matches SET tournament_match_number = ROW_NUMBER() OVER (
    PARTITION BY tournament_id 
    ORDER BY bracket_type_priority, round, match_number, id
);
```

#### 🎨 Отображение в интерфейсе

**Приоритет отображения:**
1. `tournament_match_number` (локальный номер)
2. `match_number` (глобальный номер) - fallback
3. `id` (ID записи) - последний resort

**Примеры отображения:**
- **Турнир A**: Матч 1, Матч 2, Матч 3...
- **Турнир B**: Матч 1, Матч 2, Матч 3...
- **Вместо**: Матч 31, Матч 32, Матч 33...

#### 📈 Преимущества системы

**1. 🎯 Интуитивность:**
- Пользователи видят простые номера: 1, 2, 3...
- Легче навигировать по турниру
- Понятная прогрессия матчей

**2. 🔧 Техническая гибкость:**
- Сохранены глобальные номера для внутренней логики
- Индексы для быстрого поиска
- Совместимость с существующими турнирами

**3. 📊 Согласованность:**
- Одинаковая нумерация во всех компонентах
- Ручное редактирование и сетка показывают одинаковые номера
- Модальные окна используют локальную нумерацию

### 🚀 Результат внедрения

**✅ До внедрения (проблемы):**
- Матчи нумеровались глобально (31, 32, 33...)
- Разная нумерация в сетке и редакторе
- Сложность навигации для пользователей

**🎉 После внедрения (решение):**
- Каждый турнир начинается с Матча 1
- Единая нумерация во всех компонентах
- Интуитивная навигация по турниру

## 🆕 СИСТЕМА ПРИГЛАШЕНИЙ АДМИНИСТРАТОРОВ (v4.15.0)

### 🎯 Архитектура системы приглашений

**Полнофункциональная система приглашений** с автоматической доставкой интерактивных сообщений через системные чаты:

#### 📊 Компоненты системы

**1. База данных:**
```sql
-- Таблица приглашений администраторов
admin_invitations (
    id, tournament_id, inviter_id, invitee_id,
    status, permissions, expires_at, created_at
)

-- Сообщения с JSONB metadata для интерактивности
messages (
    id, chat_id, sender_id, content, message_type,
    metadata,      # 🆕 JSONB с actions для кнопок
    content_meta,
    created_at
)
```

**2. Автоматические триггеры PostgreSQL:**
```sql
-- Автоматическая отправка приглашений при создании
CREATE TRIGGER admin_invitation_notification_trigger
AFTER INSERT ON admin_invitations
FOR EACH ROW WHEN (NEW.status = 'pending')
EXECUTE FUNCTION send_admin_invitation_notification();
```

**3. API Endpoints:**
```
POST   /api/tournaments/:id/admin-invitations        # Отправка приглашения
GET    /api/tournaments/admin-invitations/my         # Мои приглашения  
POST   /api/tournaments/admin-invitations/:id/accept # Принятие
POST   /api/tournaments/admin-invitations/:id/decline # Отклонение
GET    /api/chats/:chatId/messages                   # 🔧 Исправлен - возвращает metadata
POST   /api/tournaments/:id/manual-bracket-edit      # 🆕 Ручное редактирование сетки
```

#### 🎮 Пользовательский процесс

**1. Отправка приглашения:**
- Создатель турнира приглашает пользователя через панель администрирования
- Система создает запись в `admin_invitations`
- **Триггер автоматически** отправляет интерактивное сообщение в системный чат "1337community"

**2. Получение приглашения:**
- Пользователь видит сообщение с кнопками "✅ Принять" и "❌ Отклонить"
- Сообщение содержит полную информацию о турнире и правах
- Приглашение действительно 7 дней

**3. Ответ на приглашение:**
- Нажатие кнопки вызывает соответствующий API endpoint
- Статус приглашения обновляется в БД
- Отправляются уведомления создателю турнира
- Интерфейс обновляется автоматически

## 🛡️ **ДОСТУП АДМИНИСТРАТОРОВ К УПРАВЛЕНИЮ ТУРНИРОМ (v4.15.1)**

### 🎯 Расширенные права администраторов

**Полная интеграция прав доступа** для приглашенных администраторов турниров с автоматическим обновлением интерфейса:

#### 📊 Система прав доступа

**Типы пользователей с правами управления:**
1. **Создатель турнира** (`user.id === tournament.created_by`) - полные права
2. **Приглашенные администраторы** (`tournament.admins.some(admin => admin.user_id === user.id)`) - расширенные права

**Доступ к системе ручного редактирования:**
- ✅ **Только создатель турнира** - кнопка "✏️ Изменить расстановку" видна только создателю
- ❌ **Администраторы турнира** - не имеют доступ к ручному редактированию для безопасности

**Вкладка "⚙️ Управление турниром" доступна если:**
```javascript
const isAdminOrCreator = (user.id === tournament.created_by) || 
                         (Array.isArray(tournament.admins) && 
                          tournament.admins.some(admin => admin.user_id === user.id));
```

## 🎮 ОСНОВНЫЕ МОДУЛИ

### 1. 🏆 Турнирная система

**Форматы турниров:**
- Single Elimination (с улучшенной модульной визуализацией v2.0)
- Double Elimination (с модульной визуализацией v2.0 + исправленный прогресс-бар)
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
- **🆕 Ручное редактирование** - Drag & Drop и табличный интерфейс

**Математика сеток:**
- Расчет количества раундов
- Предварительные матчи
- Связи между матчами с учетом типов
- Валидация структуры

**Визуализация сеток (v2.0 + прогресс-бар):**
- Модульная архитектура с плагинами
- SVG соединения с анимациями
- Адаптивное позиционирование
- Специальные стили для типов матчей
- **Прогресс-бар над сеткой** - визуализация состояния турнира с корректным подсчетом для DE

### 3. 🏅 Система прогресса и статистики

**Визуальные индикаторы:**
- **Процентный прогресс** - от 0% до 100%
- **Подсчет матчей** - завершенные/общие с корректной логикой для DE
- **Статусные сообщения** - понятные уведомления для пользователей
- **🆕 Специальная маркировка DE** - "(DE)" для Double Elimination турниров

**Алгоритм расчета:**
- **Single Elimination**: фильтрация по наличию участников (team1_id && team2_id)
- **🆕 Double Elimination**: фильтрация по bracket_type (winner, loser, grand_final, grand_final_reset)
- Проверка состояния матчей (DONE, SCORE_DONE)
- Проверка наличия счета и winner_team_id
- Математический расчет процента

### 4. ✏️ Система ручного редактирования сетки

**🆕 Новый модуль (v4.17.0):**

**Возможности:**
- **Drag & Drop редактор** - основной режим с визуальным интерфейсом
- **Табличный редактор** - альтернативный режим для точного контроля
- **Переключатель режимов** - тумблер между двумя интерфейсами
- **Минималистичный дизайн** - компактная группировка матчей в строки

**Алгоритмы:**
- Инициализация позиций из первого раунда матчей
- Swap-механика для обмена участниками
- Валидация изменений в реальном времени
- Транзакционное сохранение с откатом при ошибках

**Интеграция:**
- Размещение в `TournamentAdminPanel.js` в секции "Опасные действия"
- Автоматический сброс результатов при изменении расстановки
- WebSocket уведомления для всех участников
- Логирование всех операций редактирования

### 5. 👥 Система микс-команд

**Возможности:**
- Автоматическое формирование команд
- Балансировка по рейтингу (FACEIT/Premier)
- Назначение капитанов
- Оптимизация баланса команд

**Алгоритмы:**
- Оптимальное попарное распределение (2v2)
- Умная змейка (5v5)
- Математическая оптимизация баланса

### 6. 🤖 Система автозавершения BYE матчей

**🆕 Новый модуль (v4.19.0):**

**Автоматическое завершение при старте турнира:**
- **Одиночные BYE** (Участник vs BYE) - участник автоматически побеждает 1:0
- **Двойные BYE** (BYE vs BYE) - автоматическое завершение 0:0, BYE проходит дальше
- **Мгновенное продвижение** - автоматическое размещение в следующих матчах
- **Транзакционная безопасность** - полный откат при ошибках

**Ручное завершение (SQL скрипты):**
- **Диагностика** - анализ незавершенных BYE матчей
- **Быстрое завершение** - автоматическое завершение всех BYE матчей
- **Откат** - восстановление состояния до завершения
- **Безопасность** - проверка зависимостей перед откатом

**Интеграция:**
- **Backend**: `TournamentService._autoCompleteBYEMatches()`
- **Frontend**: Корректное отображение завершенных BYE матчей
- **База данных**: Поддержка символического счета 1:0 для улучшения отображения

### 7. 🎯 Система интеллектуального отображения счета

**🆕 Новый модуль (v4.19.0):**

**Отображение счета карт:**
- **Одноматчевые игры** - отображение счета карты (16:14) вместо общего счета (1:0)
- **Многоматчевые серии** - сохранение общего счета серии
- **Автоматическое определение** - система определяет количество карт из `maps_data`
- **Универсальность** - работает для всех игр и турниров

**Специальные названия матчей Double Elimination:**
- **Малый финал лузеров** (`loser_semifinal`) - предпоследний матч нижней сетки
- **Финал лузеров** (`loser_final`) - финальный матч нижней сетки  
- **Корректная группировка** - правильное отображение в нижней сетке
- **Специальная стилизация** - уникальное оформление ключевых матчей

**Техническая реализация:**
- **Frontend**: `BracketRenderer.getParticipantData()` с логикой карт
- **Backend**: Передача `maps_data` через API
- **База данных**: Использование JSONB для хранения данных карт

### 8. 🛡️ Система администрирования

**Роли:**
- Создатель турнира
- Администратор турнира
- Обычный участник

**Функции:**
- **🆕 Интерактивные приглашения администраторов** с автоматической доставкой
- Управление участниками
- Редактирование результатов
- Системные уведомления
- **🆕 Автоматические триггеры уведомлений**
- **🆕 Ручное редактирование сетки** (только для создателей)
- **🤖 Автозавершение BYE матчей** - доступ к SQL инструментам
- **🛡️ Trust Scores панель** - мониторинг всех проверок Steam аккаунтов
- **🎮 Feedbacks панель** - мониторинг suspicious players и статистики обратной связи

### 9. 🎮 Система лобби матчей

**Возможности:**
- Создание лобби для матчей
- Выбор карт (pick/ban)
- Назначение первого выбирающего
- Real-time обновления

### 10. 💬 Система чатов

**Типы чатов:**
- Чаты турниров
- Приватные сообщения
- **🆕 Системные уведомления с интерактивными кнопками**
- Групповые чаты

**🆕 Интерактивные сообщения:**
- **JSONB metadata** для хранения действий кнопок
- **React компоненты** для рендеринга интерактивных элементов
- **API endpoints** для обработки действий пользователей
- **Исправленный cooldown** для плавной работы интерфейса

### 11. 🛡️ Система Trust Scores (Античит)

**Возможности:**
- **Steam Trust Factor** - автоматическая проверка Steam аккаунтов через API
- **Расчет Trust Score** (0-100) на основе множественных параметров
- **Автоблокировка** VAC/Game банов при регистрации и входе
- **Периодическая перепроверка** раз в 7 дней для всех пользователей
- **Защита всех точек входа** - Steam OAuth, Email/Password, привязка Steam

**Параметры проверки:**
- VAC баны (блокировка если <1 года)
- Game баны (блокировка если <6 месяцев)
- Возраст аккаунта (от -30 до +25 баллов)
- Steam Level (от -15 до +20 баллов)
- Часы в CS2 (от -20 до +20 баллов)
- Публичность профиля (+15 / -25 баллов)
- Количество игр (+5 до +15 баллов)
- Trade/Community баны (-30/-40 баллов)

**Градация Trust Score:**
- 80-100: TRUSTED (✅ Доверенный)
- 60-79: NORMAL (Обычный)
- 40-59: WATCH_LIST (⚠️ На контроле)
- 20-39: SOFT_BAN (🔸 Требует проверки)
- 0-19: HARD_BAN (❌ Блокировка)

**Админ-панель:**
- Вкладка "🛡️ Trust Scores" с фильтрацией, статистикой, действиями
- 8 карточек статистики (всего проверено, доверенные, на контроле, в бане, средний score, VAC баны)
- Таблица всех пользователей с Trust Scores (11 колонок)
- Действия: перепроверка, бан, разбан
- Пагинация, сортировка, фильтры

### 12. 🎮 Система обратной связи Match Feedback

**Возможности:**
- **Двухэтапная модалка** после завершения матча (запрос → форма)
- **Оценка соперников** - честность игры и поведение
- **Оценка тиммейтов** - командная игра и коммуникация
- **Автоматические rewards** - 10 coins за каждую оценку
- **Защита от дубликатов** - один feedback на пару reviewer-reviewed за матч

**Собираемые данные:**
- Fairness rating: clean, normal, suspicious, cheating
- Behavior rating: excellent, good, normal, toxic
- Teamplay rating: excellent, normal, poor
- Communication rating: good, normal, silent, toxic

**Модалки:**
- FeedbackPromptModal - первый запрос (простая, ненавязчивая)
- PostMatchFeedbackModal - полная форма с эмоджи-кнопками
- MatchFeedbackManager - контейнер управления обеими модалками

**Интеграция:**
- Автоматический показ через 1.5 сек после открытия завершенного матча
- Проверка feedback_given для предотвращения повторного показа
- Создание pending записей в MatchService при сохранении результата

### 13. 📊 Репутационная система

**Reputation Index (0-100):**
- **Fairness Score** (вес 70%) - оценка честности игры
- **Behavior Score** (вес 20%) - оценка поведения
- **Teamplay Score** (вес 10%) - оценка командной игры
- **Communication Score** - оценка коммуникации

**Автоматический расчет:**
- PostgreSQL функция пересчитывает после каждого feedback
- Breakdown по всем категориям (clean, suspicious, cheating, toxic, etc)
- Счетчики для каждого типа оценки
- Timestamp последнего обновления

**Детекция проблем:**
- 3+ cheating reports → флаг для модерации
- 5+ toxic reports → предупреждение
- Reputation < 30 → ограничения (планируется)

**UI для игроков:**
- Вкладка "📊 Репутация" в профиле
- Круговой индикатор с анимацией
- Детальная разбивка по 3 показателям с прогресс-барами
- Предупреждения при проблемах
- Советы по улучшению

**UI для админов:**
- Вкладка "🎮 Feedbacks" в админ-панели
- Статистика: total feedbacks, completion rate, cheating/toxic reports, avg reputation, flagged players, coins earned
- Таблица Suspicious Players с фильтрами (мин. жалоб, макс. репутация)
- Детальный просмотр: последние 10 негативных отзывов для каждого игрока
- Сортировка: по жалобам, репутации, дате
- Действия: детали (alert), бан, разбан

### 14. 💰 Система виртуальной валюты (Leet Coins)

**Структура:**
- `user_coins` - баланс пользователя (balance, lifetime_earned, lifetime_spent)
- `coin_transactions` - история всех транзакций (type, source, amount, reference_id)

**Способы заработка:**
- Match Feedback: 10 Leet Coins за каждую оценку игрока
- (Планируется: турнирные награды, достижения, daily login, referrals)

**Использование:**
- (Планируется: премиум функции, tournament entries, косметика, marketplace)

### 15. 📊 Система детальной статистики (MatchZy интеграция)

**MatchZy webhook:**
- POST /api/matchzy/stats - автоматический прием JSON после матча
- Валидация токена (X-MatchZy-Token) для безопасности
- Автоматический парсинг и сохранение всех метрик
- Запуск детекции аномалий после обработки данных

**Собираемые метрики (30+ показателей):**
- Основные: Kills, Deaths, Assists, Headshots, Damage, Rounds
- Продвинутые: ADR, KAST, HLTV Rating 2.0, Impact rating, HS%
- Clutches: детально по типам (1v1, 1v2, 1v3, 1v4, 1v5) с won/total
- Entry fragging: entry kills/deaths, opening duels success rate
- Utility: flash assists, utility damage per round, enemies flashed
- Weapon stats: по каждому оружию (kills, HS%, damage) - JSONB
- Map stats: win rate, K/D, ADR, Rating по каждой карте
- Стороны: T-side vs CT-side разделение для карт

**Агрегация и визуализация:**
- Автоматическая агрегация после каждого матча (PostgreSQL функция)
- Хранение всей истории (player_match_stats)
- Суммарная статистика (player_aggregated_stats)
- Breakdown по картам (player_map_stats)
- DetailedStats компонент: 4 вкладки (Обзор, Карты, Оружие, История)

**Leaderboards (публичные топы):**
- По Rating, K/D, HS%, ADR, Clutch success
- Топ-20 игроков (минимум 5 матчей)
- Фильтрация, сортировка

**Behavioral Analytics v2.0:**
- AnomalyDetector: 5 типов детекции аномалий через статистику
- Автоматическая корректировка Trust Score при критических аномалиях
- Флагирование для ручной проверки модераторами
- Вкладка "📊 Stats" в админ-панели с таблицей аномалий

**Архитектура для масштабирования:**
- Поля для Варианта 3: position_data (heatmaps), ai_insights, training_plan
- JSONB для гибкости (легко добавлять новые метрики)
- Готовность к интеграции Python ML микросервиса
- API design позволяет расширение без breaking changes

## ♻️ Последние изменения (v4.25.0)

### Основные таблицы:

```sql
-- Турниры
tournaments (
    id, name, game, format, bracket_type, 
    status, created_by, max_participants,
    team_size, mix_rating_type, lobby_enabled,
    -- 🆕 v4.23.0
    is_series_final BOOLEAN DEFAULT FALSE,
    access_type VARCHAR(10) DEFAULT 'open'
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

-- Матчи (с расширенными типами)
matches (
    id, tournament_id, team1_id, team2_id,
    round, match_number, bracket_type,  -- 🆕 Поддержка 'semifinal'
    winner_team_id, score1, score2, 
    next_match_id, loser_next_match_id,
    state,  -- 🆕 Используется для расчета прогресса
    status
)

-- 🆕 Приглашения администраторов
admin_invitations (
    id, tournament_id, inviter_id, invitee_id,
    status, permissions, expires_at, 
    created_at, responded_at
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

-- 🆕 Сообщения с интерактивным metadata
messages (
    id, chat_id, sender_id, content,
    message_type, 
    metadata,     -- 🆕 JSONB для интерактивных действий
    content_meta,
    created_at
)

-- 🆕 Trust Scores (Античит)
user_trust_scores (
    id, user_id, steam_id,
    trust_score, trust_action,  -- Главные поля
    account_age_days, steam_level, cs2_hours,
    profile_public, games_count,
    vac_bans, game_bans, last_ban_days,
    checked_at, check_count, details
)

user_trust_history (
    id, user_id, old_score, new_score,
    old_action, new_action, reason, changed_at
)

-- 🆕 Match Feedback (Обратная связь)
match_feedback (
    id, match_id, tournament_id,
    reviewer_id, reviewed_id,  -- Кто → кого
    feedback_type,  -- opponent/teammate
    fairness_rating, behavior_rating,
    teamplay_rating, communication_rating,
    coins_rewarded, created_at
)

player_reputation (
    user_id, total_feedbacks,
    clean_reports, normal_reports, suspicious_reports, cheating_reports,
    good_behavior, toxic_behavior,
    excellent_teamplay, poor_teamplay,
    fairness_score, behavior_score, teamplay_score,
    reputation_index,  -- Главный показатель 0-100
    updated_at
)

match_feedback_pending (
    id, match_id, user_id,
    prompted_at, feedback_given, feedback_given_at
)

-- 🆕 Coins система
user_coins (
    user_id, balance, lifetime_earned, lifetime_spent
)

coin_transactions (
    id, user_id, amount, transaction_type,
    source, reference_id, description, created_at
)

-- 🆕 Детальная статистика MatchZy (v4.26.0)
match_stats (
    id, match_id, map_name, rounds_played,
    team1_score, team2_score,
    demo_url, raw_matchzy_data
)

player_match_stats (
    id, match_id, user_id, steam_id,
    kills, deaths, assists, headshots, damage_dealt,
    adr, kast, rating, impact, hs_percentage,
    clutch_1v1_won/total, clutch_1v2_won/total, ...
    flash_assists, utility_damage,
    entry_kills, entry_deaths, opening_kills/deaths,
    mvp, weapon_stats, position_data (для v3.0)
)

player_aggregated_stats (
    user_id, total_matches, total_wins, win_rate,
    total_kills, total_deaths, kd_ratio,
    avg_adr, avg_kast, avg_rating, avg_hs_percentage,
    clutch_success_rate, entry_success_rate,
    map_stats (JSONB), weapon_stats (JSONB),
    heatmap_data, ai_insights (для v3.0)
)

player_map_stats (
    user_id, map_name,
    matches_played, wins, losses, win_rate,
    kd_ratio, avg_adr, avg_rating,
    t_side_rounds/wins/kd, ct_side_rounds/wins/kd
)

player_stats_anomalies (
    id, user_id, match_id,
    anomaly_type, severity, value, expected_value,
    description, evidence (JSONB),
    reviewed, confirmed_cheat
)
```

### 🆕 Отборочные и промоушены (v4.23.0)

```sql
-- Связь финала с отборочными
tournament_qualifiers (
    id, final_tournament_id, qualifier_tournament_id,
    slots INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
)

-- Лог продвижений победителей в финал
tournament_promotions (
    id, final_tournament_id, qualifier_tournament_id,
    team_id, placed INTEGER,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (final_tournament_id, qualifier_tournament_id, team_id, placed)
)
```

## 🔧 API ENDPOINTS

### 🏆 Турниры
```
GET    /api/tournaments                    # Список турниров
POST   /api/tournaments                    # Создание турнира
GET    /api/tournaments/:id                # Получение турнира + данные для прогресс-бара
PUT    /api/tournaments/:id                # Обновление турнира
DELETE /api/tournaments/:id                # Удаление турнира
PUT    /api/tournaments/:id/bracket-type   # Изменение типа сетки
```

### 🛡️ Trust Scores (Античит) - НОВОЕ v4.25.0
```
GET    /api/admin/trust-scores                    # Список всех Trust Scores (админ)
GET    /api/admin/trust-scores/stats              # Статистика Trust Scores (админ)
POST   /api/admin/trust-scores/:userId/recheck    # Перепроверка Trust Score (админ)
POST   /api/admin/users/:userId/ban               # Ручной бан пользователя (админ)
POST   /api/admin/users/:userId/unban             # Разбан пользователя (админ)
```

### 🎮 Match Feedback - НОВОЕ v4.25.0
```
POST   /api/matches/:matchId/feedback              # Отправка feedback по матчу
GET    /api/matches/:matchId/feedback/participants # Список участников для оценки
GET    /api/matches/:matchId/feedback/check       # Проверка статуса feedback
GET    /api/matches/users/:userId/reputation      # Публичная репутация игрока
GET    /api/admin/suspicious-players              # Список подозрительных (админ)
GET    /api/admin/feedback-stats                  # Статистика feedbacks (админ)
```

### 📊 MatchZy & Detailed Stats - НОВОЕ v4.26.0
```
POST   /api/matchzy/stats                         # Webhook для приема данных от MatchZy
POST   /api/matchzy/demo                          # Upload demo файла (опционально)
GET    /api/player-stats/player/:userId           # Агрегированная статистика игрока
GET    /api/player-stats/player/:userId/recent    # Последние N матчей
GET    /api/player-stats/player/:userId/maps      # Статистика по картам
GET    /api/player-stats/leaderboard              # Топ игроков (rating, kd, hs, adr, clutch)
GET    /api/player-stats/admin/stats-anomalies    # Список аномалий (админ)
```

### 🛡️ Администрирование (v4.15.0)
```
POST   /api/tournaments/:id/admin-invitations        # Отправка приглашения
GET    /api/tournaments/admin-invitations/my         # Мои приглашения
POST   /api/tournaments/admin-invitations/:id/accept # Принятие приглашения
POST   /api/tournaments/admin-invitations/:id/decline # Отклонение приглашения
GET    /api/tournaments/:id/admins                   # Список администраторов
DELETE /api/tournaments/:id/admins/:userId           # Удаление администратора
```

### ✏️ Ручное редактирование сетки (НОВОЕ v4.17.0)
```
POST   /api/tournaments/:id/manual-bracket-edit      # 🆕 Ручное изменение расстановки участников
```

### 💬 Чаты (ОБНОВЛЕНО v4.15.0)
```
GET    /api/chats                          # Список чатов
POST   /api/chats                          # Создание чата
GET    /api/chats/:chatId/messages         # 🔧 ИСПРАВЛЕН - возвращает metadata
GET    /api/chats/:chatId/info             # 🆕 Информация о чате
POST   /api/chats/:chatId/read             # Пометка как прочитанного
```

### 🔗 Реферальные приглашения (ОБНОВЛЕНО v4.22.1)
```
POST   /api/referrals/generate-link               # Создание реферальной ссылки (только авторизованные)
GET    /api/referrals/info/:referralCode          # Публичная информация по реф‑ссылке для лендинга
GET    /api/referrals/validate/:referralCode      # Валидация ссылки (актуальность, лимиты)
GET    /api/referrals/stats                       # Статистика приглашений пользователя
POST   /api/referrals/register-referral           # Фиксация регистрации по ссылке
POST   /api/referrals/cleanup-expired             # Очистка просроченных ссылок (admin)

# Связанное действие участия
POST   /api/tournaments/:id/participate           # Принятие участия авторизованным пользователем
```

### 🎯 Турнирные сетки
```
POST   /api/tournaments/:id/generate-bracket      # Генерация сетки с правильными типами матчей
POST   /api/tournaments/:id/regenerate-bracket    # Регенерация сетки
GET    /api/tournaments/:id/bracket-statistics    # Статистика сетки + данные прогресса с корректным подсчетом DE
GET    /api/tournaments/seeding-types             # Типы распределения
```

## 🆕 СИСТЕМА РЕФЕРАЛЬНЫХ ПРИГЛАШЕНИЙ (v4.21.1)

### 🎯 Обзор
Полноценная реферальная система для приглашения друзей в конкретный турнир с публичным лендингом приглашения и быстрым вступлением.

### 🔌 Backend
- Таблицы: `referral_links`, `referral_registrations` (и/или `referral_uses`).
- Ограничения: срок действия (7 дней), лимит использований (32) на ссылку.
- Основные endpoint’ы см. выше в разделе API.

### 🖥️ Frontend
- Маршрут: `/invite/:referralCode` → страница `ReferralLanding`.
- Поведение:
  - Неавторизованному пользователю показываются кнопки “Зарегистрироваться и участвовать” и “У меня уже есть аккаунт”. При переходе параметр `?referral` сохраняется (редирект через `/auth?register=true&referral=...`).
  - Авторизованному пользователю показывается только одна кнопка: “✅ Принять приглашение на участие в турнире”. Нажатие вызывает `POST /api/tournaments/:id/participate` и переводит на страницу турнира.
- Упрощение UI лендинга приглашения:
  - Убран блок преимуществ (“Что вас ждет в 1337 Community”).
  - Убран блок “Действует до/Осталось использований” — не перегружаем приглашенного избыточной информацией.

### 🔄 Поток
1) Приглашающий генерирует ссылку: `POST /api/referrals/generate-link` → получает `full_url` вида `https://1337community.com/invite/ABCDEFG123`.
2) Приглашенный переходит по ссылке → открывается `ReferralLanding`, запрашивает `GET /api/referrals/info/:code`.
3) Авторизованный пользователь может сразу принять участие → `POST /api/tournaments/:id/participate` → редирект на `/tournaments/:id`.
4) Неавторизованный — переходит на `/auth?register=true&referral=:code`, после регистрации бэкенд фиксирует привязку `POST /api/referrals/register-referral`.

### ⚙️ Реализация (ключевые файлы)
- Backend: `backend/routes/referrals.js` (генерация, info, stats, validate, register-referral, cleanup), подключено в `backend/server.js` под `/api/referrals`.
- Frontend:
  - `frontend/src/App.js` — добавлен маршрут `/invite/:referralCode`, редирект регистрации сохраняет `?referral`.
  - `frontend/src/pages/ReferralLanding.js` — UI и логика лендинга (кнопки зависят от авторизации, вызов participate).
  - `frontend/src/components/tournament/modals/ReferralInviteModal.js` — генерация ссылки из турнира.

## 🆕 МОБИЛЬНЫЕ УЛУЧШЕНИЯ UI/UX (v4.22.0)

### Профиль → «Турниры» (мобайл)
- Оставлен только табличный вид, без фильтров и переключателей.
- Компактная таблица (иконка игры‑бейдж, название, дата) — без переполнений.
- Файлы: `frontend/src/components/Profile.js`, `frontend/src/components/Profile.css`.

### Профиль → мобильное меню
- Левый сайдбар заменён выезжающим листом (`MobileProfileSheet`).
- Кнопка‑стрелка открывает лист; контент вкладок адаптирован под ширину устройства.

### Турнир → «Главная» (мобайл)
- Рендер сетки унифицирован с «Сетка»: `bracket-stage-wrapper bracket-full-bleed`, `readOnly`.
- Файл: `frontend/src/components/TournamentDetails.js`.

### 🔍 QA‑чек‑лист
- Переход по действительной ссылке открывает лендинг (не пустая страница, маршрут совпадает).
- Неавторизованный видит только кнопки регистрации/входа; авторизованный — только “Принять приглашение…”.
- “Принять приглашение” добавляет пользователя в турнир и переводит на страницу турнира.
- Информационные блоки (преимущества/сроки) — скрыты.

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
GET    /api/tournaments/:id/matches               # Матчи турнира + состояния для прогресса
POST   /api/matches/:id/result                    # Результат матча (обновляет прогресс)
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
- **🆕 Система приглашений с проверкой прав**
- **🆕 Ограниченный доступ к ручному редактированию** (только создатели)

### Валидация
- Входные данные
- Структура турнирных сеток с новыми типами матчей
- Целостность результатов
- **🆕 Валидация JSONB metadata в сообщениях**
- **🆕 Валидация данных ручного редактирования**

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

# 🆕 Установка новых зависимостей Drag & Drop
cd frontend && npm install

# 🆕 Миграция для расширенных типов матчей
sudo -u postgres psql -d tournament_db -c "
    ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_bracket_type_check;
    ALTER TABLE matches ADD CONSTRAINT matches_bracket_type_check 
        CHECK (bracket_type IN ('winner', 'loser', 'grand_final', 'grand_final_reset', 'placement', 'final', 'semifinal'));
"

# 🆕 Применение миграции admin_invitations (если не применена)
sudo -u postgres psql -d tournament_db -f admin_invitations_migration.sql

# Сборка фронтенда
cd frontend && npm run build

# Обновление Nginx
sudo cp -r frontend/build/* /var/www/html/1337community/

# Перезапуск сервисов
sudo systemctl restart 1337-backend
sudo systemctl restart nginx

# 🆕 Тестирование системы ручного редактирования
# 1. Проверка API endpoint:
curl -X POST "http://1337community.com/api/tournaments/66/manual-bracket-edit" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"bracketData": [{"matchId": 123, "team1_id": 1, "team2_id": 2}]}'

# 2. Проверка в браузере:
# - Создать турнир как создатель
# - Сгенерировать сетку
# - Открыть вкладку "Управление турниром"
# - Найти кнопку "✏️ Изменить расстановку" в секции "Опасные действия"
# - Протестировать оба режима: Drag & Drop и Table

# 🆕 Тестирование прогресс-бара DE
# В консоли браузера на странице DE турнира выполнить:
# Содержимое файла test_progress_bar_de.js

# 🆕 Тестирование приглашений администраторов
# 1. Проверка API endpoints:
curl -X GET "http://1337community.com/api/tournaments/admin-invitations/my" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 2. Проверка интерактивных сообщений в браузере:
# - Откройте чат "1337community"
# - Проверьте наличие кнопок в admin_invitation сообщениях
# - Тестируйте функциональность кнопок "Принять"/"Отклонить"

# 🆕 Тестирование прогресс-бара и исправлений Single Elimination
pm2 logs 1337-backend | grep -E "(TournamentProgressBar|SingleEliminationEngine|bracket_type)"

# Проверка работы новых типов матчей
curl -w "@curl-format.txt" -s -o /dev/null http://1337community.com/api/tournaments/[ID]

# 🆕 Тестирование Double Elimination отрисовки (v4.14.2+)
# Проверка в браузерной консоли при открытии DE турнира:
# - Должно быть: 🎯 RENDERING DOUBLE ELIMINATION
# - Классы: .bracket-render-upper-section, .bracket-render-lower-section

# 🆕 Тестирование Grand Final Triumph (v4.14.3)
# Проверка в браузере:
# - Заголовок раунда: "Grand Final Triumph" (вместо "Reset")
# - CSS класс: data-match-type="grand-final-triumph"
# - Цвет: #1a0d00 (темно-золотистый)
# - Анимация: bracket-final-glow 4s infinite

# 🆕 Тестирование доступа администраторов к управлению (v4.15.1)
# 1. Тестирование API прав доступа:
curl -X GET "http://1337community.com/api/tournaments/66" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" | \
     jq '.admins[] | {user_id, username}'

# 2. Диагностический скрипт в браузере:
# - Откройте страницу турнира в браузере
# - Откройте консоль разработчика (F12)
# - Скопируйте и выполните содержимое файла test_admin_access.js
# - Проверьте результат диагностики прав доступа

# 3. Тестирование автоматического обновления прав:
# - Отправьте приглашение администратора другому пользователю
# - Пусть получатель примет приглашение в системном чате
# - Проверьте автоматическое обновление страницы через 1.5 сек
# - Убедитесь что вкладка "⚙️ Управление" появилась без ручной перезагрузки

# 4. Проверка корректности данных администраторов:
# В консоли браузера на странице турнира:
# > const tournament = await fetch('/api/tournaments/66', {headers: {Authorization: 'Bearer ' + localStorage.getItem('token')}}).then(r => r.json())
# > console.log('Администраторы:', tournament.admins.map(a => ({id: a.user_id, name: a.username})))
```

## 🎨 ДИЗАЙН-СИСТЕМА

### Цветовая схема
- **Основной фон**: #000 (черный)
- **Основной текст**: #fff (белый)
- **Акценты**: #ff0000 (красный) - используется в прогресс-баре и кнопках
- **Hover эффекты**: #111 (темно-серый)
- **Дополнительный фон**: #111

### 🆕 Специальные цвета для прогресс-бара
- **Фон прогресс-бара**: #111111 с границей #333333
- **Заполненная область**: #ff0000 (красный)
- **Текст прогресса**: #ffffff (белый)
- **Процентный индикатор**: #ff0000 (красный) при 100%

### 🆕 Цвета интерактивных элементов (v4.15.0)
- **Кнопка "Принять"**: #ff0000 (красный) с hover #cc0000
- **Кнопка "Отклонить"**: #111111 (серый) с красной границей
- **Интерактивные сообщения**: рамка #ff0000 с анимацией
- **Уведомления**: фон #111111 с акцентами #ff0000

### 🆕 Цвета системы ручного редактирования (v4.17.0)
- **Drop-зоны**: зеленая подсветка (#00ff00) при перетаскивании
- **Индикатор изменений**: красная пульсирующая анимация (#ff0000)
- **Кнопка редактирования**: красная (danger-btn) для подчеркивания важности
- **Разделитель "VS"**: белый текст с тенью для лучшей видимости

### Специальные цвета для турнирных сеток (v4.14.3)
- **Финал**: #ffcc00 (золотой)
- **Полуфинал**: #ff6666 (светло-красный) - 🆕 добавлен явный стиль
- **Матч за 3-е место**: #cd7f32 (бронзовый)
- **Winners Bracket**: #00ff00 (зеленый)
- **Losers Bracket**: #ff6b6b (светло-красный)
- **Grand Final**: #ffcc00 (золотой с анимацией)
- **🆕 Grand Final Triumph**: #1a0d00 (темно-золотистый) - переименовано из "Reset"

### 🆕 CSS классы Double Elimination (v4.14.3)
- **`.bracket-render-upper-section`** - зеленая верхняя сетка Winners Bracket
- **`.bracket-render-horizontal-divider`** - красный анимированный разделитель
- **`.bracket-render-lower-section`** - красная нижняя сетка Losers Bracket  
- **`.bracket-grand-final-section`** - золотая секция Grand Final
- **`.bracket-match-container[data-match-type="grand-final-triumph"]`** - стили для Triumph матча

### Компоненты
- Монохромная тема с красными акцентами
- Прогресс-бары с плавными анимациями
- **🆕 Интерактивные сообщения** с кнопками и анимациями
- **🆕 Drag & Drop элементы** с визуальной обратной связью
- Responsive дизайн
- SVG визуализация для турнирных сеток
- Упрощенный интерфейс без дублирования

## 📈 МЕТРИКИ И МОНИТОРИНГ

### Производительность
- Время отклика API
- Загрузка базы данных
- Использование памяти
- Скорость рендеринга турнирных сеток и прогресс-баров
- **🆕 Производительность интерактивных сообщений**
- **🆕 Производительность Drag & Drop операций**

### Пользовательские метрики
- Количество активных турниров
- Количество участников
- Популярные игры
- Использование форматов турниров (SE/DE)
- **🆕 Статистика приглашений администраторов** - отправлено/принято/отклонено
- **🆕 Использование ручного редактирования** - частота использования режимов

### 🆕 Метрики системы приглашений (v4.15.0)
- **Скорость доставки приглашений**: мониторинг времени от создания до отображения
- **Интерактивность кнопок**: отслеживание кликов и обработки действий  
- **Надежность триггеров**: успешность автоматической отправки сообщений
- **Cooldown эффективность**: анализ блокировок запросов и их влияния на UX
- **API производительность**: время ответа endpoints приглашений

### 🆕 Метрики системы ручного редактирования (v4.17.0)
- **Время инициализации редактора**: < 500ms для сеток до 64 участников
- **Отзывчивость Drag & Drop**: мгновенная реакция на перетаскивание
- **Валидация в реальном времени**: проверка дубликатов при каждом изменении
- **Время сохранения**: < 2 секунды для обновления расстановки
- **Использование режимов**: статистика предпочтений пользователей (Drag & Drop vs Table)
- **Частота редактирования**: количество операций редактирования на турнир

### Live обновления участников (v4.10.0+)
- **Время отображения участника**: улучшено с 30-120 секунд до < 1 секунды
- **Сетевой трафик**: сокращен на 95% (только данные участника вместо полного турнира)
- **WebSocket события participant_update**: мониторинг отправки и получения
- **Точность синхронизации**: отслеживание успешных/неудачных обновлений состояния
- **Fallback активации**: статистика использования полной перезагрузки при ошибках

### 🆕 Метрики прогресса турниров (v4.15.3)
- **Точность расчета прогресса DE**: мониторинг корректности подсчета матчей DE турниров
- **Точность расчета прогресса SE**: мониторинг корректности подсчета матчей SE турниров
- **Производительность прогресс-бара**: время рендеринга компонента
- **Отладочные данные**: логирование расхождений в подсчете матчей
- **Пользовательская активность**: отслеживание взаимодействий с прогресс-баром

### Модульная система отрисовки (v4.11.0+)
- **Время рендеринга сетки**: оптимизировано с React memo
- **Поддержка форматов**: Single Elimination, Double Elimination
- **Производительность SVG**: анимации на GPU
- **Адаптивность**: поддержка мобильных устройств

### 🔧 Качество Single Elimination сеток (v4.12.0)
- **Корректность связей матчей**: мониторинг правильности next_match_id и loser_next_match_id
- **Типы матчей**: отслеживание правильного назначения bracket_type
- **Валидация сеток**: проверка целостности созданных турнирных структур
- **Обработка ошибок**: количество и типы ошибок при генерации сеток

### Логирование
- События турниров
- Ошибки системы
- Действия пользователей
- WebSocket подключения и отключения
- Операции с участниками (добавление/удаление/обновление)
- Генерация и изменение турнирных сеток
- **🆕 Расчеты прогресса турниров** - отладочная информация в консоли с разделением DE/SE логики
- **🆕 Исправления в Single Elimination** - логирование типов матчей и связей
- **🆕 Система приглашений** - отправка, получение, ответы на приглашения
- **🆕 Интерактивные сообщения** - клики по кнопкам, обработка действий
- **🆕 Операции ручного редактирования** - все действия по изменению расстановки
- **🆕 Drag & Drop операции** - перетаскивания, обмены, валидация

## 🆕 КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ (v4.17.0)

### 🧩 Обновления v4.20.0

1) Публичные страницы и кликабельность:
- Страница матча (HLTV‑стиль): никнеймы игроков кликабельны (публичный `/user/:userId`), названия и логотипы команд кликабельны (`/teams/:id`).
- Публичный матч‑роут: `/api/tournaments/:id/match/:matchId` возвращает `available_map_details` и fallback из `default_map_pool`.

2) Командные профили:
- `/api/teams/:id`: публичный профиль команды (турнирная/постоянная), менеджер, ростер, общая статистика, достижения, турниры.
- `/api/teams/:id/matches`: краткая история (с соперником).
- `/api/teams/:id/maps-stats`: агрегированная статистика по картам (из `maps_data`).

3) Дефолтный маппул и изображения:
- Админ‑панель: вкладка “Карт‑пул (дефолт)” — редактирование порядка/набора карт.
- Загрузка изображений: карты (320x180) и логотипы (1000x1000) через `sharp`.

4) Подиум и результаты:
- Единый компонент `PodiumSection` (база — реализация “Результаты”) используется и на “Главной”.
- Третье место: SE — победитель `placement`, DE — проигравший `loser_final` (fallback по последнему раунду лузеров).
- Полный состав команд в карточках призёров, без дублирования номеров мест (только медали).

5) Шеринг:
- Модалка шейринга использует Font Awesome (бесплатные бренды) для иконок Telegram/VK/Discord.

### 🔧 Исправление API metadata для интерактивных сообщений

**Проблема**: API endpoint `/api/chats/:chatId/messages` не возвращал поле `metadata`, из-за чего кнопки в admin_invitation сообщениях не отображались.

**Диагностика**: 
- БД содержала правильные данные с `metadata` и `actions`
- API возвращал `metadata: undefined` для всех сообщений
- React компонент не мог отрендерить интерактивные кнопки

**Решение**: Добавлено `m.metadata` в SQL запрос в `backend/routes/chats.js`:
```sql
-- ДО исправления (строка 306):
SELECT 
    m.id, m.chat_id, m.sender_id, m.content, 
    m.message_type, m.content_meta,
    -- m.metadata,  ❌ ОТСУТСТВОВАЛО
    m.is_pinned, m.created_at

-- ПОСЛЕ исправления (строка 307):  
SELECT 
    m.id, m.chat_id, m.sender_id, m.content, 
    m.message_type, m.content_meta,
    m.metadata,  ✅ ДОБАВЛЕНО
    m.is_pinned, m.created_at
```

**Результат**: 
- ✅ **API возвращает полный metadata** с actions массивом
- ✅ **React корректно рендерит кнопки** "✅ Принять" и "❌ Отклонить"  
- ✅ **Интерактивность работает** - пользователи могут отвечать на приглашения
- ✅ **Система полностью функциональна** без временных костылей

### 🚀 Исправление Messenger cooldown блокировок

**Проблема**: Агрессивные cooldown тайм-ауты блокировали обновления чата, препятствуя получению новых сообщений.

**Решение в `frontend/src/components/Messenger.js`**:
1. **Снижены тайм-ауты**:
   ```javascript
   const REQUEST_COOLDOWNS = {
       fetchMessages: 300,       // было 1000ms
       markChatAsRead: 200,      // было 500ms  
       fetchChats: 1000,         // было 2000ms
   };
   ```

2. **Добавлено исключение для смены чата**:
   ```javascript
   // При смене активного чата разрешаем запросы без cooldown
   if (chatId && chatId !== lastActiveChatId.current) {
       console.log(`✅ [Messenger] ${requestType} разрешен для нового чата: ${chatId}`);
       return true;
   }
   ```

**Результат**: 
- ✅ **Плавное переключение между чатами** без блокировок
- ✅ **Быстрые обновления сообщений** с сохранением защиты от спама
- ✅ **Улучшенный UX** - пользователи не видят "заблокировано cooldown" сообщения

### 🔧 Исправление проверки прав администраторов турнира

**Проблема**: Frontend проверял неправильное поле при определении прав администратора, что блокировало доступ к вкладке "Управление турниром" для приглашенных администраторов.

**Диагностика**: 
- Backend возвращает администраторов с полем `user_id` (ID пользователя-администратора)
- Frontend проверял поле `admin.id` (ID записи в таблице администраторов)
- Результат: `false` для всех проверок администраторов

**Решение**: Исправлена проверка во всех компонентах:
```javascript
// ДО исправления:
const isAdmin = tournament.admins?.some(admin => admin.id === user.id);

// ПОСЛЕ исправления:  
const isAdmin = tournament.admins?.some(admin => admin.user_id === user.id);
```

**Изменены файлы**:
- `frontend/src/components/TournamentDetails.js` (строка 1600)
- `frontend/src/hooks/tournament/useTournamentAuth.js` (строка 56)

**Результат**: 
- ✅ **Приглашенные администраторы получили доступ** к вкладке "⚙️ Управление турниром"
- ✅ **Корректная проверка прав** на основе правильного поля `user_id`
- ✅ **Соответствие frontend и backend** в логике прав доступа

### 🔄 Автоматическое обновление прав после принятия приглашения

**Проблема**: После принятия приглашения администратора пользователь не видел вкладку управления без ручной перезагрузки страницы.

**Причина**: React состояние не обновлялось автоматически после изменения данных в БД.

**Решение**: Добавлено автоматическое обновление страницы после успешного принятия приглашения:
```javascript
// frontend/src/components/Message.js
if (message.message_type === 'admin_invitation' && actionType === 'accept') {
    setTimeout(() => {
        console.log('🔄 Обновляем страницу для применения прав администратора...');
        window.location.reload();
    }, 1500); // Даем время показать сообщение об успехе
}
```

**Результат**: 
- ✅ **Мгновенное обновление прав** - администратор видит вкладку управления сразу после принятия
- ✅ **Улучшенный UX** - нет необходимости в ручной перезагрузке страницы  
- ✅ **Плавный переход** - 1.5 секунды на показ сообщения об успехе

### 🎯 Исправление отрисовки Double Elimination турниров

**Проблема**: Double Elimination турниры отрисовывались как Single Elimination из-за отсутствия передачи пропса `tournament` в компонент `BracketRenderer`.

**Решение**: Исправлена передача `tournament={tournament}` в обоих вызовах `LazyBracketRenderer` в `TournamentDetails.js`.

**Результат**: 
- ✅ **Раздельная отрисовка DE турниров**: Winners Bracket сверху, Losers Bracket снизу
- ✅ **Горизонтальный разделитель**: Красная анимированная линия между сетками  
- ✅ **Цветовое кодирование**: Зеленый (Winners), Красный (Losers), Золотой (Grand Final)
- ✅ **Профессиональная архитектура**: Четкое визуальное разделение турнирных сеток

### 🏆 Переименование: Grand Final Reset → Grand Final Triumph

**Цель**: Повышение торжественности и драматургии финального матча Double Elimination турнира.

**Изменения**:
- **❌ Старое название**: "Grand Final Reset" 
- **✅ Новое название**: "Grand Final Triumph"

**Обоснование**:
- 🎭 **Более эпично**: "Triumph" звучит торжественнее чем "Reset"
- 👑 **Королевское звучание**: соответствует статусу финального матча  
- 🌟 **Позитивный фокус**: на победе, а не на "сбросе"
- 🎪 **Усиленная драматургия**: подчеркивает кульминацию турнира

**Технические изменения**:
```javascript
// BracketRenderer.js
const roundName = match.bracket_type === 'grand_final_reset' 
    ? 'Grand Final Triumph'  // ✅ Новое название
    : 'Grand Final';

// DoubleEliminationFormat.js
case 'grand_final_reset':
    return 'grand-final-triumph';  // ✅ Обновленный CSS класс

// CSS
.bracket-match-container[data-match-type="grand-final-triumph"] {
    animation: bracket-final-glow 4s infinite;
    transform: scale(1.05);
}
```

**Влияние на пользователя**:
- 🎯 **В интерфейсе**: "🔄 Grand Final Triumph" 
- 🎨 **Специальная анимация**: усиленная визуализация важности матча
- 🏆 **Психологический эффект**: подчеркнута торжественность момента

### 🔧 Исправление прогресс-бара для Double Elimination турниров

**Проблема**: Прогресс-бар турнира некорректно отображал общее количество матчей и количество завершенных матчей для **Double Elimination (DE)** турниров.

**Симптомы:**
- ❌ **Неправильный подсчет общих матчей**: показывал только матчи с заполненными участниками
- ❌ **Некорректный процент прогресса**: 0% даже при наличии завершенных матчей
- ❌ **Неточный статус**: не учитывал специфику DE структуры

**Решение**: Реализована раздельная логика для DE и SE турниров в `TournamentProgressBar.js`:

```javascript
// ✅ Разная логика для DE и SE турниров
const bracketType = tournament?.bracket_type || 'single_elimination';
const isDoubleElimination = bracketType === 'double_elimination' || 
                           bracketType === 'doubleElimination' ||
                           bracketType === 'DOUBLE_ELIMINATION';

if (isDoubleElimination) {
    // 🏆 DE: все созданные матчи потенциально играбельны
    realMatches = matches.filter(match => 
        match.bracket_type && 
        ['winner', 'loser', 'grand_final', 'grand_final_reset'].includes(match.bracket_type)
    );
} else {
    // 🎯 SE: только матчи с участниками
    realMatches = matches.filter(match => 
        match.team1_id && match.team2_id
    );
}
```

**Результат:**
- ✅ Прогресс-бар показывает корректное количество матчей для DE турниров
- ✅ Учитываются все матчи DE структуры по `bracket_type`
- ✅ Корректный расчет процента на основе полной структуры
- ✅ Специальная маркировка "(DE)" для DE турниров
- ✅ Улучшена проверка завершенных матчей (добавлен `hasWinner`)

## 📚 **ДОКУМЕНТАЦИЯ СИСТЕМЫ (v4.17.0)**

### **Ключевые документы архитектуры:**
```
1337/
├── PROJECT_ARCHITECTURE.md                           # 🏗️ Основная архитектура системы (v4.17.0)
├── 🆕 СИСТЕМА_РУЧНОГО_РЕДАКТИРОВАНИЯ_СЕТКИ.md        # ✅ Документация системы редактирования (v1.0.0)
├── 🆕 ОБНОВЛЕНИЕ_UX_СИСТЕМЫ_РЕДАКТИРОВАНИЯ.md       # ✅ UX улучшения редактирования (v4.16.1)
├── 🆕 ИСПРАВЛЕНИЕ_ПРОГРЕСС_БАРА_DOUBLE_ELIMINATION.md # ✅ Исправления прогресс-бара DE (v4.15.3)
├── ИСПРАВЛЕНИЕ_TOURNAMENT_PROPS_DOUBLE_ELIMINATION.md # ✅ Документация исправления пропсов (v4.14.2)
├── ПЕРЕИМЕНОВАНИЕ_GRAND_FINAL_TRIUMPH.md              # 🏆 Документация переименования (v4.14.3)
├── РАЗДЕЛЬНАЯ_ОТРИСОВКА_DOUBLE_ELIMINATION.md         # 🎨 CSS архитектура DE (v4.14.1)
├── DOUBLE_ELIMINATION_TABULAR_IMPLEMENTATION.md       # 📊 Табличная реализация DE
├── SINGLE_ELIMINATION_V2_DOCUMENTATION.md             # 📋 SE Engine v2.0
├── test_admin_access.js                               # 🧪 Диагностический скрипт прав доступа
├── 🆕 test_progress_bar_de.js                         # 🧪 Диагностический скрипт прогресс-бара DE
└── [другие технические документы]
```

### **Статус документации:**
- ✅ **Актуальность**: Все документы обновлены до версии 4.17.0
- ✅ **Полнота**: Покрывают все критические компоненты системы включая ручное редактирование  
- ✅ **Практичность**: Содержат готовые решения и код
- ✅ **Готовность**: Документация готова для продакшена

## 🆕 НОВЫЕ ВОЗМОЖНОСТИ (v4.18.0)

### 🔢 Система локальной нумерации матчей

**Основные компоненты:**
- **tournament_match_number** - новое поле в БД для локальной нумерации
- **SingleEliminationEngine.js** & **DoubleEliminationEngine.js** - автоматическое присвоение локальных номеров
- **BracketRenderer.js** - приоритетное отображение локальных номеров
- **TournamentDetails.js** - передача локальных номеров в компоненты визуализации

**Функциональность:**
- **Локальная нумерация** - каждый турнир начинается матчем №1
- **Унифицированное отображение** - одинаковые номера в сетке и редакторе
- **Автоматическая миграция** - обновление существующих турниров
- **Производительность** - индексирование для быстрого поиска
- **Совместимость** - сохранение глобальных номеров для внутренней логики

**Результат:**
- ✅ **Интуитивная навигация** - простые номера 1, 2, 3 вместо 31, 32, 33
- ✅ **Единообразие** - все компоненты показывают одинаковые номера
- ✅ **Пользовательский опыт** - понятная прогрессия матчей в турнире

### 🏆 Система визуализации прогресса турниров

**Основные компоненты:**
- **TournamentProgressBar.js** - универсальный компонент для отображения прогресса турнира с исправленной логикой для DE
- **TournamentProgressBar.css** - монохромные стили с красными акцентами
- **🆕 Раздельный расчет прогресса** - различные алгоритмы для SE и DE турниров

**Функциональность:**
- **Процентное отображение прогресса** - от 0% до 100%
- **🆕 Корректный подсчет завершенных матчей** - исправленная логика для DE турниров
- **Статусная строка** - "X из Y матчей" с понятными сообщениями и маркировкой "(DE)"
- **Поддержка разных статусов турнира** - registration, active, completed
- **Отладочное логирование** - для диагностики проблем с данными

**Размещение:**
- ✅ **Вкладка "📋 Главная"** - над турнирной сеткой
- ✅ **Вкладка "🏆 Сетка"** - над панелью управления сеткой
- ❌ **Секция информации** - удалено для упрощения интерфейса

**Логика расчета прогресса (исправленная для DE):**
```javascript
// 🆕 Раздельная фильтрация для DE и SE
if (isDoubleElimination) {
    // DE: все созданные матчи по bracket_type
    const realMatches = matches.filter(match => 
        match.bracket_type && 
        ['winner', 'loser', 'grand_final', 'grand_final_reset'].includes(match.bracket_type)
    );
} else {
    // SE: только матчи с участниками
    const realMatches = matches.filter(match => match.team1_id && match.team2_id);
}

// Определение завершенных матчей (улучшено)
const completedMatches = realMatches.filter(match => {
    const hasValidState = match.state === 'DONE' || match.state === 'SCORE_DONE';
    const hasScore = (match.score1 !== null && match.score1 !== undefined) || 
                    (match.score2 !== null && match.score2 !== undefined);
    const hasWinner = match.winner_team_id !== null && match.winner_team_id !== undefined; // 🆕 ДОБАВЛЕНО
    return hasValidState || hasScore || hasWinner;
});

// Расчет процента
const percentage = totalMatches > 0 ? Math.round((completed / totalMatches) * 100) : 0;
```

### 🔧 Улучшенный Single Elimination Engine

**Исправленная архитектура:**
- **Явные типы матчей** - `winner`, `semifinal`, `final`, `placement`
- **Правильные связи матчей** - исправлены связи с матчем за 3-е место
- **Адаптивная логика** - различная обработка для турниров разного размера
- **Улучшенная валидация** - проверка корректности созданных сеток

### 📊 Расширенная база данных

**Обновленные ограничения:**
```sql
-- Расширенная проверка типов матчей
ALTER TABLE matches ADD CONSTRAINT matches_bracket_type_check 
    CHECK (bracket_type IN ('winner', 'loser', 'grand_final', 'grand_final_reset', 'placement', 'final', 'semifinal'));
```

**Поддерживаемые типы матчей:**
- `winner` - обычные матчи на выбывание
- `loser` - матчи в нижней сетке (Double Elimination)
- `grand_final` - Гранд Финал (Double Elimination)
- **🆕 `grand_final_reset`** - Grand Final Triumph (решающий матч DE)
- `final` - финальный матч (Single Elimination)
- `semifinal` - полуфинальные матчи (только для турниров ≥8 участников)
- `placement` - матчи за места (например, за 3-е место)

### 🎨 Упрощенный пользовательский интерфейс

**Принципы упрощения:**
- **Убрана дублирующаяся информация** - прогресс-бар только над сеткой
- **Сосредоточенность на важном** - акцент на прогрессе и статусе турнира
- **Минималистичный дизайн** - следование монохромной теме проекта
- **🆕 Компактные элементы** - группировка матчей в строки в системе редактирования

**Компоненты:**
- **TournamentInfoSection.js** - упрощен, убран компактный прогресс-бар
- **TournamentDetails.js** - оптимизированный рендеринг с прогресс-баром и передачей tournament в ProgressBar
- **🆕 ManualBracketEditor.js** - минималистичный дизайн с группировкой элементов
- **Монохромные стили** - черный фон, белый текст, красные акценты

## 🔮 ПЛАНЫ РАЗВИТИЯ

### ✅ Завершенные функции v4.19.0
- **🤖 Автоматизация BYE матчей** - полностью реализована с автозавершением и SQL скриптами
- **🎯 Интеллектуальное отображение счета карт** - реализовано для одноматчевых игр  
- **🏆 Специальные названия матчей DE** - "Малый финал лузеров" и "Финал лузеров"
- **🔧 Исправленная логика статусов BYE** - корректное отображение во всех компонентах
- **📊 Символический счет BYE матчей** - поддержка 1:0 для улучшения отображения

### v5.0.0 (Планируется)
- Система рейтингов с интеграцией прогресса
- Интеграция с Discord с уведомлениями о прогрессе турниров
- Мобильное приложение с push-уведомлениями о матчах
- Система призов с tracking прогресса

### Улучшения системы приглашений (v4.18.0+)
- **🔔 Push-уведомления** - мгновенные уведомления о приглашениях
- **📊 Расширенная аналитика** - статистика принятий/отклонений по турнирам
- **⏰ Напоминания о приглашениях** - автоматические напоминания за 1 день до истечения
- **🎨 Кастомизация приглашений** - персонализированные сообщения от создателей
- **📱 Мобильная оптимизация** - адаптивные кнопки для мобильных устройств

### Улучшения системы ручного редактирования (v4.18.0+)
- **🔄 Undo/Redo функциональность** - отмена последних действий
- **💾 Автосохранение черновиков** - сохранение временных изменений
- **⚡ Виртуализация** - для турниров с большим количеством матчей (>64 участников)
- **⌨️ Горячие клавиши** - клавиатурные шорткаты для быстрого редактирования
- **📊 Быстрые фильтры** - поиск участников по рейтингу, команде, статусу
- **🎯 Drag & Drop превью** - показ траектории перетаскивания
- **📈 Аналитика изменений** - статистика редактирования и частота использования

### Улучшения прогресс-бара (v4.18.0+)
- **Детализированные фазы** - предварительные раунды, основная сетка, плей-офф
- **Анимации прогресса** - плавные переходы при завершении матчей
- **Прогнозы завершения** - оценка времени до окончания турнира
- **Экспорт статистики** - отчеты по прогрессу турнира
- **Real-time обновления** - WebSocket обновления прогресса без перезагрузки

### Новые форматы турниров (v4.18.0+)
- **Swiss System** - швейцарская система с прогресс-баром
- **Round Robin** - круговая система
- **GSL Groups** - групповой этап в стиле GSL
- **Ladder** - постоянные турниры с рейтингом

### Улучшения Single Elimination Engine (v4.18.0+)
- **Динамическое изменение структуры** - добавление участников в процессе
- **Альтернативные форматы финальной части** - Double Elimination финал в SE турнире
- **Расширенные типы матчей** - четвертьфинал, 1/8 финала
- **Улучшенная валидация** - проверка корректности всех связей

### Улучшения безопасности
- 2FA аутентификация
- Усиленная валидация данных матчей
- Audit логи для изменений в турнирах
- **🆕 Логирование операций ручного редактирования** - полный аудит всех изменений расстановки

### Real-time функциональность (v4.18.0+)
- **Прогресс-бар в реальном времени** - обновление без перезагрузки страницы
- **🆕 Real-time Drag & Drop** - синхронизация изменений между пользователями
- Оптимистичные обновления с автоматическим откатом
- Интеллигентное кеширование с инвалидацией в реальном времени
- Система состояний для микс-команд и матчей
- WebSocket события для всех компонентов турниров
- Конфликт-резолюция при одновременных изменениях

### Улучшения визуализации (v4.18.0+)
- **3D прогресс-бары** - объемная визуализация прогресса
- 3D визуализация турнирных сеток
- **🆕 Улучшенный Drag & Drop интерфейс** - плавные анимации, физика перетаскивания
- Экспорт сеток в PNG/SVG с прогресс-информацией
- Печать турнирных сеток с прогрессом
- Анимации переходов между раундами с обновлением прогресса

### Планы Double Elimination системы (v4.18.0+)
- **🆕 Расширение Triumph логики** - дополнительные матчи при сложных сценариях
- **🎨 Улучшенная анимация Grand Final Triumph** - эпичные визуальные эффекты
- **📊 Статистика Triumph матчей** - специальная аналитика для решающих матчей
- **🏆 Система наград за Triumph** - особые достижения для победителей
- **🎭 Персонализация финальных матчей** - кастомные темы и звуки

### UX улучшения интерфейса (v4.18.0+)
- **🎨 Темная/светлая тема** - с сохранением монохромного стиля
- **📱 Мобильная оптимизация DE сеток** - адаптивная отрисовка
- **🔄 Живые обновления сеток** - WebSocket для real-time отрисовки
- **⚡ Производительность рендера** - оптимизация больших турниров
- **🎪 Интерактивные элементы** - hover-эффекты и микроанимации
- **🆕 Улучшенная мобильная поддержка редактирования** - оптимизированный touch-интерфейс

---

**Документ обновлен**: 2 октября 2025  
**Версия архитектуры**: 4.26.0  
**Статус**: ✅ **ПРОДАКШН ГОТОВ**

## 🚀 **ИТОГОВЫЙ СТАТУС СИСТЕМЫ**

*Система **1337 Community Tournament System v4.26.0** представляет собой* **профессиональную турнирную платформу с трехуровневой системой борьбы с читерами и детальной аналитикой игроков** *и:*

### 🏆 **Ключевые достижения:**

**🆕 Трехуровневая защита от читеров (v4.25.0-4.26.0):**
- ✅ **🛡️ Уровень 1: Trust Scores** - Steam аккаунты (VAC баны, возраст, уровень, часы)
- ✅ **🎮 Уровень 2: Match Feedback** - краудсорсинг (жалобы игроков, репутация)
- ✅ **📊 Уровень 3: Stats Anomalies** - детекция через статистику (HS%, K/D, patterns)
- ✅ **🚫 Автоблокировка** - VAC/Game баны при входе и регистрации
- ✅ **🔄 Периодическая перепроверка** - раз в 7 дней автоматически
- ✅ **🔒 Защита всех точек входа** - невозможность обхода
- ✅ **💰 Мотивация Leet Coins** - награды за участие в модерации
- ✅ **🛡️ 4 админ-вкладки** - Trust Scores, Feedbacks, Stats, полный контроль

**🆕 Детальная статистика игроков (v4.26.0):**
- ✅ **📡 MatchZy webhook** - автоматический прием данных с серверов
- ✅ **📊 30+ метрик** - K/D, ADR, HS%, KAST, Rating, Clutches, Entry, Utility
- ✅ **🗺️ Статистика по картам** - win rate, K/D, T/CT sides для каждой карты
- ✅ **🔫 Статистика по оружию** - детальный breakdown по каждому оружию
- ✅ **🏆 Leaderboards** - публичные топы по Rating, K/D, HS%, ADR, Clutch
- ✅ **🔍 Behavioral Analytics v2.0** - детекция 5 типов аномалий
- ✅ **🎨 DetailedStats UI** - 4 вкладки (Обзор, Карты, Оружие, История)
- ✅ **🚀 Готовность к v3.0** - поля для heatmaps, AI insights, training plans

**Турнирная система:**
- ✅ **🆕 Интуитивная система локальной нумерации матчей** с автоматическим присвоением номеров от 1 в каждом турнире
- ✅ **🆕 Полнофункциональная система ручного редактирования сетки** с Drag & Drop и табличным интерфейсом
- ✅ **🆕 Минималистичный UX дизайн** с группировкой матчей в строки и компактными элементами
- ✅ **🆕 Исправленный прогресс-бар для Double Elimination** с корректным подсчетом всех матчей DE структуры
- ✅ **🤖 Полностью автоматизированная система BYE матчей** - автозавершение при старте турнира
- ✅ **🎯 Интеллектуальное отображение счета карт** - показ детального счета для одноматчевых игр
- ✅ **🏆 Специальные названия ключевых матчей** - "Малый финал лузеров" и "Финал лузеров"
- ✅ **Полнофункциональная Double Elimination система** с корректным созданием для всех форматов
- ✅ **Профессиональная раздельная отрисовка Double Elimination** с четким визуальным разделением
- ✅ **Эпичный "Grand Final Triumph"** - торжественное название решающего матча
- ✅ **Система лобби матчей** с pick/ban картами для CS2 турниров

**Администрирование:**
- ✅ **Полнофункциональная система приглашений администраторов** с интерактивными сообщениями
- ✅ **Исправленный API для поддержки JSONB metadata** в интерактивных элементах
- ✅ **Доступ администраторов к вкладке "Управление турниром"** с автоматическим обновлением прав
- ✅ **Полная техническая документация** со всеми решениями и кодом
- ✅ **Динамическая загрузка карт** из базы данных вместо хардкода

### 🎯 **Готовность к эксплуатации:**
- 🚀 **Система готова к развертыванию в продакшене**
- 📚 **Документация покрывает 100% критических компонентов**  
- 🔧 **Все известные проблемы исправлены и протестированы**
- 🎨 **Интерфейс соответствует современным UX стандартам**
- 🛡️ **🆕 Трехуровневая защита от читеров** - Trust Scores + Match Feedback + Stats Anomalies
- 🎮 **🆕 Краудсорсинг модерации** - игроки сами помогают выявлять нечестных игроков
- 💰 **🆕 Система виртуальной валюты Leet Coins** - мотивация через rewards и геймификация
- 📊 **🆕 Репутация игроков** - прозрачная система оценки честности и поведения
- 📊 **🆕 Детальная статистика MatchZy** - 30+ метрик, leaderboards, аномалии
- 🚀 **🆕 Модульная архитектура** - готовность к масштабированию до AI/Heatmaps (Вариант 3)
- 🛡️ **Система администрирования с автоматической доставкой приглашений**
- ⚙️ **Полный доступ администраторов к функциям управления турнирами**
- ✏️ **🆕 Интуитивная система ручного редактирования сетки** с визуальным Drag & Drop интерфейсом и минималистичным дизайном
- 📊 **🆕 Корректная система прогресса** с раздельной логикой для всех типов турниров
- 🔢 **🆕 Унифицированная нумерация матчей** с локальными номерами во всех компонентах системы
- 📱 **🆕 Оптимизированный мобильный интерфейс** с компактным дизайном для всех устройств
- 🤖 **🆕 Полная автоматизация BYE матчей** - нет необходимости в ручном управлении пустыми матчами
- 🎯 **🆕 Интеллектуальное отображение результатов** - автоматический показ детального счета карт
- 🏆 **🆕 Профессиональные названия ключевых матчей** - специальная терминология для Double Elimination
- 🔧 **🆕 Исправленная логика статусов** - корректное отображение всех типов матчей

*Турнирная система готова для проведения масштабных киберспортивных мероприятий с* **профессиональным уровнем визуализации, трехуровневой защитой от читеров (Trust Score + Feedback + Stats Anomalies), детальной статистикой игроков через MatchZy интеграцию, системой репутации, краудсорсинг модерацией, виртуальной валютой Leet Coins для мотивации, leaderboards и публичными топами, управления, интерактивного администрирования, гибкого редактирования турнирных сеток, интуитивной нумерации матчей, точного отображения прогресса для всех типов турниров, полной автоматизации BYE матчей, интеллектуального отображения результатов, специальными названиями ключевых матчей и модульной архитектурой готовой к масштабированию до AI-powered аналитики!* 🏆🛡️📊🎮✨