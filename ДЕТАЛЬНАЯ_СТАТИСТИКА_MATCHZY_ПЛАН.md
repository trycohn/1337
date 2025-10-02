# 📊 ДЕТАЛЬНАЯ СТАТИСТИКА С MATCHZY ИНТЕГРАЦИЕЙ

**Дата:** 2 октября 2025  
**Версия:** 1.0 (Концепция)  
**Инфраструктура:** Pterodactyl + MatchZy plugin

---

## 🎯 ОБЗОР

### Что у вас есть:

✅ **Pterodactyl Panel** - управление игровыми серверами  
✅ **MatchZy** - CS2 плагин для турнирных матчей  
✅ **Платформа 1337** - турнирная система

### Что можно получить:

**MatchZy предоставляет:**
- 📊 Детальную статистику игроков (K/D, ADR, HS%, KAST, etc)
- 🎬 Автоматическую запись demo
- 📡 Webhook для отправки данных после матча
- 📝 JSON файлы со статистикой
- ⚙️ Get5-совместимый формат

### Цель:

**Интегрировать MatchZy статистику в платформу** для:
- Детальных профилей игроков (как Leetify/FACEIT)
- Аналитики по картам, оружию, позициям
- Автоматического обновления Trust Score/Reputation на основе статистики
- Детекции читеров через аномалии

---

## 🏗️ АРХИТЕКТУРА ИНТЕГРАЦИИ

### Поток данных:

```
┌─────────────────────────────────────────────────┐
│  1. ИГРОВОЙ СЕРВЕР (Pterodactyl + MatchZy)     │
│  Матч завершается → MatchZy генерирует JSON     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼ (Webhook)
┌─────────────────────────────────────────────────┐
│  2. BACKEND API (1337 Platform)                 │
│  POST /api/matchzy/stats                        │
│  • Валидация данных                             │
│  • Парсинг JSON                                 │
│  • Сохранение в БД                              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  3. БАЗА ДАННЫХ (PostgreSQL)                    │
│  • match_stats (общая статистика матча)         │
│  • player_match_stats (статистика игрока)       │
│  • player_aggregated_stats (агрегация)          │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  4. FRONTEND (React)                            │
│  • Детальный профиль игрока                     │
│  • Графики и heatmaps                           │
│  • Сравнение с другими                          │
└─────────────────────────────────────────────────┘
```

---

## 📊 ДАННЫЕ ОТ MATCHZY

### Что предоставляет MatchZy в JSON:

```json
{
  "matchId": "match_123",
  "mapName": "de_dust2",
  "team1": {
    "name": "Team Alpha",
    "score": 16,
    "players": [
      {
        "steamId": "76561198012345678",
        "name": "PlayerName",
        "stats": {
          "kills": 24,
          "deaths": 18,
          "assists": 7,
          "headshots": 18,
          "damage": 2450,
          "adr": 98.0,
          "kast": 75.5,
          "rating": 1.25,
          "clutch_won": 2,
          "clutch_total": 5,
          "flash_assists": 8,
          "utility_damage": 350,
          "enemies_flashed": 15,
          "entry_kills": 6,
          "entry_deaths": 4,
          "trade_kills": 3,
          "mvp": 7,
          "rounds_played": 30,
          "opening_kills": 8,
          "opening_deaths": 5
        },
        "weapons": {
          "ak47": {"kills": 12, "headshots": 9, "damage": 1200},
          "m4a1": {"kills": 8, "headshots": 6, "damage": 850},
          "awp": {"kills": 4, "headshots": 3, "damage": 400}
        },
        "economy": {
          "money_spent": 45000,
          "equipment_value": 38000,
          "kills_per_dollar": 0.00053
        }
      }
    ]
  },
  "team2": { /* аналогично */ },
  "rounds": [
    {
      "round": 1,
      "winner": "team1",
      "reason": "elimination",
      "bomb_planted": true,
      "bomb_defused": false
    }
  ],
  "demo_url": "https://your-server.com/demos/match_123.dem",
  "timestamp": "2025-10-02T15:30:00Z"
}
```

---

## 🗄️ СХЕМА БД ДЛЯ ДЕТАЛЬНОЙ СТАТИСТИКИ

### Таблицы:

```sql
-- ============================================================================
-- MATCHZY ИНТЕГРАЦИЯ: Детальная статистика
-- ============================================================================

-- Общая статистика матча
CREATE TABLE match_stats (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id) UNIQUE,
  
  -- Основные данные
  map_name VARCHAR(50),
  rounds_played INTEGER,
  duration_seconds INTEGER,
  
  -- Команды
  team1_score INTEGER,
  team2_score INTEGER,
  team1_name VARCHAR(100),
  team2_name VARCHAR(100),
  
  -- Demo
  demo_url VARCHAR(500),
  demo_file_path VARCHAR(500),
  
  -- Raw JSON от MatchZy
  raw_data JSONB,
  
  -- Мета
  created_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

-- Детальная статистика игрока в матче
CREATE TABLE player_match_stats (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id),
  user_id INTEGER REFERENCES users(id),
  steam_id VARCHAR(17),
  team_id INTEGER REFERENCES tournament_teams(id),
  
  -- Основная статистика
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  headshots INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  
  -- Продвинутая статистика
  adr DECIMAL(5,2),          -- Average Damage per Round
  kast DECIMAL(5,2),         -- Kill/Assist/Survive/Trade %
  rating DECIMAL(4,2),       -- HLTV-style rating
  impact DECIMAL(4,2),       -- Impact rating
  
  -- Headshot %
  hs_percentage DECIMAL(5,2),
  
  -- Clutches
  clutch_won INTEGER DEFAULT 0,
  clutch_total INTEGER DEFAULT 0,
  clutch_success_rate DECIMAL(5,2),
  
  -- Utility
  flash_assists INTEGER DEFAULT 0,
  utility_damage INTEGER DEFAULT 0,
  enemies_flashed INTEGER DEFAULT 0,
  
  -- Entry fragging
  entry_kills INTEGER DEFAULT 0,
  entry_deaths INTEGER DEFAULT 0,
  opening_kills INTEGER DEFAULT 0,
  opening_deaths INTEGER DEFAULT 0,
  
  -- Other
  mvp INTEGER DEFAULT 0,
  rounds_played INTEGER DEFAULT 0,
  trade_kills INTEGER DEFAULT 0,
  
  -- Weapon stats (JSONB)
  weapon_stats JSONB,
  
  -- Economy
  money_spent INTEGER DEFAULT 0,
  equipment_value INTEGER DEFAULT 0,
  
  -- Мета
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(match_id, user_id)
);

-- Агрегированная статистика игрока (все матчи)
CREATE TABLE player_aggregated_stats (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  
  -- Общие показатели
  total_matches INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),
  
  -- K/D/A
  total_kills INTEGER DEFAULT 0,
  total_deaths INTEGER DEFAULT 0,
  total_assists INTEGER DEFAULT 0,
  kd_ratio DECIMAL(4,2),
  kda_ratio DECIMAL(4,2),
  
  -- Средние показатели
  avg_kills_per_match DECIMAL(5,2),
  avg_deaths_per_match DECIMAL(5,2),
  avg_adr DECIMAL(5,2),
  avg_kast DECIMAL(5,2),
  avg_rating DECIMAL(4,2),
  avg_hs_percentage DECIMAL(5,2),
  
  -- Clutches
  total_clutch_won INTEGER DEFAULT 0,
  total_clutch_total INTEGER DEFAULT 0,
  clutch_success_rate DECIMAL(5,2),
  
  -- Entry fragging
  total_entry_kills INTEGER DEFAULT 0,
  total_entry_deaths INTEGER DEFAULT 0,
  entry_success_rate DECIMAL(5,2),
  
  -- MVP
  total_mvp INTEGER DEFAULT 0,
  mvp_rate DECIMAL(5,2),
  
  -- По картам (JSONB)
  map_stats JSONB,  -- {"dust2": {"wins": 10, "losses": 5, "kd": 1.2}, ...}
  
  -- По оружию (JSONB)
  weapon_stats JSONB,  -- {"ak47": {"kills": 500, "hs": 350, "hs%": 70}, ...}
  
  -- Последнее обновление
  updated_at TIMESTAMP DEFAULT NOW(),
  last_match_at TIMESTAMP
);

-- Индексы
CREATE INDEX idx_player_match_stats_user ON player_match_stats(user_id);
CREATE INDEX idx_player_match_stats_match ON player_match_stats(match_id);
CREATE INDEX idx_player_match_stats_kd ON player_match_stats((kills::DECIMAL / NULLIF(deaths, 1)));
CREATE INDEX idx_player_aggregated_kd ON player_aggregated_stats(kd_ratio);
CREATE INDEX idx_player_aggregated_rating ON player_aggregated_stats(avg_rating);

-- Функция агрегации
CREATE OR REPLACE FUNCTION update_player_aggregated_stats(p_user_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
BEGIN
  -- Агрегировать все матчи игрока
  SELECT 
    COUNT(DISTINCT pms.match_id) as total_matches,
    COUNT(DISTINCT CASE WHEN m.winner_team_id = pms.team_id THEN pms.match_id END) as wins,
    SUM(pms.kills) as kills,
    SUM(pms.deaths) as deaths,
    SUM(pms.assists) as assists,
    AVG(pms.adr) as avg_adr,
    AVG(pms.kast) as avg_kast,
    AVG(pms.rating) as avg_rating,
    AVG(pms.hs_percentage) as avg_hs,
    SUM(pms.clutch_won) as clutch_won,
    SUM(pms.clutch_total) as clutch_total,
    SUM(pms.entry_kills) as entry_kills,
    SUM(pms.entry_deaths) as entry_deaths,
    SUM(pms.mvp) as mvp
  INTO v_stats
  FROM player_match_stats pms
  LEFT JOIN matches m ON m.id = pms.match_id
  WHERE pms.user_id = p_user_id;
  
  -- Вычислить производные
  INSERT INTO player_aggregated_stats (
    user_id,
    total_matches,
    total_wins,
    total_losses,
    win_rate,
    total_kills,
    total_deaths,
    total_assists,
    kd_ratio,
    kda_ratio,
    avg_kills_per_match,
    avg_deaths_per_match,
    avg_adr,
    avg_kast,
    avg_rating,
    avg_hs_percentage,
    total_clutch_won,
    total_clutch_total,
    clutch_success_rate,
    total_entry_kills,
    total_entry_deaths,
    entry_success_rate,
    total_mvp,
    mvp_rate,
    updated_at
  ) VALUES (
    p_user_id,
    v_stats.total_matches,
    v_stats.wins,
    v_stats.total_matches - v_stats.wins,
    CASE WHEN v_stats.total_matches > 0 THEN (v_stats.wins::DECIMAL / v_stats.total_matches * 100) ELSE 0 END,
    v_stats.kills,
    v_stats.deaths,
    v_stats.assists,
    CASE WHEN v_stats.deaths > 0 THEN v_stats.kills::DECIMAL / v_stats.deaths ELSE v_stats.kills END,
    CASE WHEN v_stats.deaths > 0 THEN (v_stats.kills + v_stats.assists)::DECIMAL / v_stats.deaths ELSE v_stats.kills + v_stats.assists END,
    CASE WHEN v_stats.total_matches > 0 THEN v_stats.kills::DECIMAL / v_stats.total_matches ELSE 0 END,
    CASE WHEN v_stats.total_matches > 0 THEN v_stats.deaths::DECIMAL / v_stats.total_matches ELSE 0 END,
    v_stats.avg_adr,
    v_stats.avg_kast,
    v_stats.avg_rating,
    v_stats.avg_hs,
    v_stats.clutch_won,
    v_stats.clutch_total,
    CASE WHEN v_stats.clutch_total > 0 THEN (v_stats.clutch_won::DECIMAL / v_stats.clutch_total * 100) ELSE 0 END,
    v_stats.entry_kills,
    v_stats.entry_deaths,
    CASE WHEN (v_stats.entry_kills + v_stats.entry_deaths) > 0 THEN (v_stats.entry_kills::DECIMAL / (v_stats.entry_kills + v_stats.entry_deaths) * 100) ELSE 0 END,
    v_stats.mvp,
    CASE WHEN v_stats.total_matches > 0 THEN (v_stats.mvp::DECIMAL / v_stats.total_matches * 100) ELSE 0 END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_matches = EXCLUDED.total_matches,
    total_wins = EXCLUDED.total_wins,
    total_losses = EXCLUDED.total_losses,
    win_rate = EXCLUDED.win_rate,
    total_kills = EXCLUDED.total_kills,
    total_deaths = EXCLUDED.total_deaths,
    total_assists = EXCLUDED.total_assists,
    kd_ratio = EXCLUDED.kd_ratio,
    kda_ratio = EXCLUDED.kda_ratio,
    avg_kills_per_match = EXCLUDED.avg_kills_per_match,
    avg_deaths_per_match = EXCLUDED.avg_deaths_per_match,
    avg_adr = EXCLUDED.avg_adr,
    avg_kast = EXCLUDED.avg_kast,
    avg_rating = EXCLUDED.avg_rating,
    avg_hs_percentage = EXCLUDED.avg_hs_percentage,
    total_clutch_won = EXCLUDED.total_clutch_won,
    total_clutch_total = EXCLUDED.total_clutch_total,
    clutch_success_rate = EXCLUDED.clutch_success_rate,
    total_entry_kills = EXCLUDED.total_entry_kills,
    total_entry_deaths = EXCLUDED.total_entry_deaths,
    entry_success_rate = EXCLUDED.entry_success_rate,
    total_mvp = EXCLUDED.total_mvp,
    mvp_rate = EXCLUDED.mvp_rate,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## 🔌 ВАРИАНТЫ ИНТЕГРАЦИИ

### ВАРИАНТ 1: WEBHOOK (Рекомендуется)

**Как работает:**

```javascript
// 1. Настройка MatchZy на сервере
// server.cfg или matchzy.cfg
matchzy_remote_log_url "https://1337community.com/api/matchzy/stats"
matchzy_remote_log_header_key "Authorization"
matchzy_remote_log_header_value "Bearer SECRET_TOKEN"

// 2. Backend endpoint
// POST /api/matchzy/stats
router.post('/matchzy/stats', async (req, res) => {
  // Валидация токена
  const token = req.headers.authorization?.split(' ')[1];
  if (token !== process.env.MATCHZY_SECRET_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const matchData = req.body;
  
  // Парсинг и сохранение
  await saveMatchZyStats(matchData);
  
  res.json({ success: true, message: 'Stats received' });
});

// 3. Автоматическое обновление
// После сохранения статистики → обновить Trust Score/Reputation
```

**Плюсы:**
- ✅ Real-time (данные сразу после матча)
- ✅ Автоматизация (не нужно вручную)
- ✅ Надежность (retry механизм)
- ✅ Простая настройка

**Минусы:**
- ❌ Требует публичный endpoint
- ❌ Нужна защита от подделок (токен)
- ❌ Зависимость от стабильности сервера

---

### ВАРИАНТ 2: FILE UPLOAD

**Как работает:**

```javascript
// 1. MatchZy сохраняет JSON в файл
// server/csgo/matchzy_stats/match_123.json

// 2. Backend забирает файл через Pterodactyl API
const pterodactylAPI = axios.create({
  baseURL: 'https://panel.your-server.com/api',
  headers: {
    'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
    'Accept': 'application/json'
  }
});

const getMatchStats = async (matchId) => {
  const response = await pterodactylAPI.get(
    `/client/servers/${SERVER_ID}/files/contents`,
    { params: { file: `/matchzy_stats/match_${matchId}.json` }}
  );
  
  return response.data;
};

// 3. Периодическая проверка новых файлов
setInterval(async () => {
  const files = await listNewStatsFiles();
  for (const file of files) {
    const stats = await getMatchStats(file.matchId);
    await saveMatchZyStats(stats);
  }
}, 60000); // Каждую минуту
```

**Плюсы:**
- ✅ Не нужен публичный endpoint
- ✅ Можно забрать позже (не real-time)
- ✅ Доступ к demo файлам

**Минусы:**
- ❌ Задержка (не сразу)
- ❌ Сложнее настройка
- ❌ Нужен Pterodactyl API

---

### ВАРИАНТ 3: HYBRID (Лучшее из обоих)

**Концепция:**

```
1. Primary: Webhook (для real-time)
   ├─ Быстрые данные сразу после матча
   └─ Для live-обновления профилей

2. Fallback: File upload (backup)
   ├─ Если webhook failed
   ├─ Периодическая синхронизация (каждый час)
   └─ Для исторических данных

3. Demo storage:
   ├─ Pterodactyl API для доступа к demo
   ├─ Скачивание при необходимости
   └─ Хранение 30 дней
```

---

## 📊 ЧТО МОЖНО СДЕЛАТЬ СО СТАТИСТИКОЙ

### 1. Детальный профиль игрока (как Leetify/FACEIT)

```
┌──────────────────────────────────────────────┐
│  👤 PlayerName                               │
│  Trust Score: 85/100  |  Reputation: 87/100 │
├──────────────────────────────────────────────┤
│  📊 ОБЩАЯ СТАТИСТИКА                         │
│  ┌────────┬────────┬────────┬────────────┐  │
│  │ Матчи  │  W/L   │  K/D   │   Rating   │  │
│  │   45   │ 28-17  │  1.25  │   1.15     │  │
│  └────────┴────────┴────────┴────────────┘  │
│                                               │
│  📈 КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ                      │
│  • ADR: 98.5                                 │
│  • KAST: 75.2%                               │
│  • HS%: 68.5% (высокий)                      │
│  • Clutch Success: 42% (3v3, 1v2, 1v1)      │
│  • Entry Success: 62%                        │
│                                               │
│  🗺️ СТАТИСТИКА ПО КАРТАМ                    │
│  • Dust2:   15W-8L  (K/D 1.35)              │
│  • Mirage:  12W-9L  (K/D 1.18)              │
│  • Inferno: 8W-7L   (K/D 1.22)              │
│                                               │
│  🔫 ЛЮБИМОЕ ОРУЖИЕ                           │
│  • AK-47:   450 килов (HS% 72%)             │
│  • M4A1-S:  320 килов (HS% 65%)             │
│  • AWP:     180 килов                        │
│                                               │
│  📍 HEATMAP УБИЙСТВ (визуализация)           │
│  [Интерактивная карта позиций]              │
└──────────────────────────────────────────────┘
```

### 2. Аномалии для античита

```javascript
// Behavioral Analytics v2.0 (с MatchZy данными)
function detectAnomalies(playerStats) {
  const flags = [];
  
  // 1. Headshot % аномалия
  if (playerStats.avg_hs_percentage > 75 && playerStats.total_matches > 10) {
    flags.push({
      type: 'HIGH_HS_PERCENTAGE',
      value: playerStats.avg_hs_percentage,
      severity: 'HIGH',
      description: 'Подозрительно высокий HS%'
    });
  }
  
  // 2. K/D резкий рост
  const recentMatches = await getRecentMatches(playerId, 10);
  const recentKD = calculateKD(recentMatches);
  const historicalKD = playerStats.kd_ratio;
  
  if (recentKD > historicalKD * 2) {  // Удвоение K/D
    flags.push({
      type: 'SUDDEN_KD_IMPROVEMENT',
      old_value: historicalKD,
      new_value: recentKD,
      severity: 'CRITICAL'
    });
  }
  
  // 3. Wallbang аномалия
  const wallbangRate = playerStats.wallbang_kills / playerStats.total_kills;
  if (wallbangRate > 0.15) {  // >15% wallbangs
    flags.push({
      type: 'EXCESSIVE_WALLBANGS',
      value: wallbangRate * 100,
      severity: 'CRITICAL'
    });
  }
  
  // 4. Utility damage аномалия (низкая = wallhack?)
  if (playerStats.avg_utility_damage < 50 && playerStats.avg_kills > 20) {
    // Много киллов, мало utility = знает где враги без флешек
    flags.push({
      type: 'LOW_UTILITY_HIGH_KILLS',
      severity: 'MEDIUM'
    });
  }
  
  return flags;
}
```

### 3. Сравнение с другими игроками

```
Ваша статистика vs средняя по рангу:

          ВЫ      СРЕДНЯЯ    РАЗНИЦА
K/D:      1.25    0.95       +31% ✅
ADR:      98.5    82.0       +20% ✅
HS%:      68.5%   52.0%      +32% ✅
KAST:     75.2%   68.0%      +11% ✅
Rating:   1.15    1.00       +15% ✅

Вы играете лучше 78% игроков вашего ранга!
```

### 4. Прогресс и тренды

```javascript
// График последних 20 матчей
const progressData = {
  labels: ['Match 1', 'Match 2', ..., 'Match 20'],
  datasets: [{
    label: 'K/D Ratio',
    data: [1.1, 1.3, 0.9, 1.5, ...],
    trend: 'improving' // +15% за последние 10 матчей
  }, {
    label: 'ADR',
    data: [85, 92, 78, 105, ...],
    trend: 'stable'
  }]
};
```

---

## 🎯 ТРИ ВАРИАНТА РЕАЛИЗАЦИИ

### ВАРИАНТ 1: БАЗОВАЯ ИНТЕГРАЦИЯ (Quick Win)

**Что реализуем:**
- Webhook от MatchZy
- Сохранение основной статистики (K/D, ADR, HS%)
- Отображение в профиле
- Базовая детекция аномалий

**Таблицы:**
- player_match_stats (основная)
- player_aggregated_stats (агрегация)

**UI:**
- Вкладка "Статистика" в профиле (расширить существующую)
- Показ K/D, ADR, HS%, Rating
- Последние 10 матчей

**Бюджет:** $2,000-3,000  
**Срок:** 1 неделя  
**ROI:** ⭐⭐⭐⭐⭐

**Плюсы:**
- ✅ Быстро
- ✅ Дешево
- ✅ Сразу приносит пользу
- ✅ Основа для расширения

**Минусы:**
- ❌ Базовый функционал
- ❌ Нет продвинутой аналитики
- ❌ Нет heatmaps/графиков

---

### ВАРИАНТ 2: ПРОДВИНУТАЯ АНАЛИТИКА

**Что реализуем:**
- Всё из Варианта 1 +
- Детальная статистика (clutches, entry, utility)
- Статистика по картам и оружию
- Графики прогресса (Chart.js)
- Сравнение с другими игроками
- Behavioral Analytics v2.0 (детекция через статистику)

**Дополнительные таблицы:**
- player_weapon_stats (детально по оружию)
- player_map_stats (детально по картам)
- player_round_stats (поraundная статистика)

**UI:**
- Полноценная страница статистики
- Графики и визуализации
- Фильтры (по периоду, картам, оружию)
- Экспорт в PDF/PNG

**Бюджет:** $5,000-8,000  
**Срок:** 2-3 недели  
**ROI:** ⭐⭐⭐⭐⭐

**Плюсы:**
- ✅ Конкурентное преимущество (как Leetify)
- ✅ Вирусность (шеринг профилей)
- ✅ Точная детекция читеров
- ✅ Маркетинговая фишка

**Минусы:**
- ❌ Дороже
- ❌ Дольше
- ❌ Требует data scientist

---

### ВАРИАНТ 3: FULL ANALYTICS SUITE (Premium)

**Что реализуем:**
- Всё из Варианта 2 +
- Heatmaps (позиции убийств/смертей)
- VOD integration (highlights)
- AI-powered insights ("Вы слабы на B-сайте Mirage")
- Comparison с про-игроками
- Team analytics (синергия игроков)
- Predictive analytics (прогноз результата матча)

**Advanced features:**
- Demo viewer интеграция
- Round-by-round breakdown
- Economy tracking (подробно)
- Positioning analysis
- Crosshair placement heatmap
- Reaction time tracking

**Бюджет:** $15,000-25,000  
**Срок:** 2-3 месяца  
**ROI:** ⭐⭐⭐⭐

**Плюсы:**
- ✅ Топ-уровень (как Scope.gg Pro)
- ✅ Уникальные фичи
- ✅ Монетизация (premium подписка)
- ✅ Лидерство в сегменте

**Минусы:**
- ❌ Очень дорого
- ❌ Долго
- ❌ Требует большую команду
- ❌ Overkill для старта

---

## 🎯 МОЯ РЕКОМЕНДАЦИЯ

### Поэтапный подход:

**СЕЙЧАС (Month 1-2): Вариант 1 — $2-3k**
```
✅ Webhook интеграция
✅ Основная статистика (K/D, ADR, HS%, Rating)
✅ Базовая детекция аномалий
✅ Вкладка в профиле

Результат:
• Детальные профили игроков
• Улучшение Trust Score алгоритма
• Вирусность (шеринг статистики)
```

**ЧЕРЕЗ 3 МЕСЯЦА: + элементы Варианта 2 — +$3-5k**
```
✅ Графики прогресса
✅ Статистика по картам/оружию
✅ Behavioral Analytics v2.0
✅ Сравнение с другими

Результат:
• Конкурентное преимущество
• Точная детекция читеров
• Маркетинговая фишка
```

**ЧЕРЕЗ 6-12 МЕСЯЦЕВ: Вариант 3 (если успех)**
```
✅ Heatmaps
✅ AI insights
✅ Team analytics
✅ Premium подписка

Результат:
• Лидерство в сегменте
• Монетизация
```

---

## 💡 БЫСТРЫЙ СТАРТ (MVP)

### Что сделать В ПЕРВУЮ ОЧЕРЕДЬ:

**Week 1: Backend**
```
☐ Создать таблицы (match_stats, player_match_stats, player_aggregated_stats)
☐ Webhook endpoint POST /api/matchzy/stats
☐ Парсер JSON от MatchZy
☐ Функция update_player_aggregated_stats()
☐ Автоматическая детекция аномалий (базовая)
```

**Week 2: Frontend**
```
☐ Расширить вкладку "Статистика" в профиле
☐ Показ K/D, ADR, HS%, Rating, KAST
☐ Последние 10 матчей (таблица)
☐ Badge "Top 10% by rating"
```

**Week 3: Testing & Polish**
```
☐ Настроить MatchZy на тестовом сервере
☐ Протестировать webhook
☐ Проверить агрегацию
☐ Деплой
```

**Минимальный MVP (5 дней):**
- Webhook (1 день)
- БД схема (1 день)
- Парсинг данных (1 день)
- UI базовый (1 день)
- Тестирование (1 день)

**Бюджет MVP:** $1,500-2,000  
**Срок:** 5-7 дней

---

## 🔧 ТЕХНИЧЕСКАЯ РЕАЛИЗАЦИЯ

### Настройка MatchZy:

```cfg
// server.cfg
matchzy_remote_log_url "https://1337community.com/api/matchzy/stats"
matchzy_remote_log_header_key "X-MatchZy-Token"
matchzy_remote_log_header_value "YOUR_SECRET_TOKEN_HERE"
matchzy_demo_upload_url "https://1337community.com/api/matchzy/demo"
```

### Backend endpoint (MVP):

```javascript
// backend/routes/matchzy.js
router.post('/stats', async (req, res) => {
  try {
    // 1. Валидация
    const token = req.headers['x-matchzy-token'];
    if (token !== process.env.MATCHZY_SECRET_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const data = req.body;
    
    // 2. Найти матч по matchId (или другому идентификатору)
    const match = await findMatchByIdentifier(data.matchId);
    
    if (!match) {
      console.log('Match not found, storing for later');
      // Сохранить в pending
      await savePendingStats(data);
      return res.json({ success: true, status: 'pending' });
    }
    
    // 3. Сохранить статистику
    await saveMatchStats(match.id, data);
    
    // 4. Обновить агрегированную статистику игроков
    for (const team of [data.team1, data.team2]) {
      for (const player of team.players) {
        const userId = await findUserBySteamId(player.steamId);
        if (userId) {
          await pool.query('SELECT update_player_aggregated_stats($1)', [userId]);
        }
      }
    }
    
    // 5. Проверить аномалии (для Trust Score / Reputation)
    await detectStatsAnomalies(match.id);
    
    res.json({ success: true, message: 'Stats saved' });
    
  } catch (error) {
    console.error('MatchZy stats error:', error);
    res.status(500).json({ error: 'Failed to save stats' });
  }
});

async function saveMatchStats(matchId, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Сохранить общую статистику матча
    await client.query(`
      INSERT INTO match_stats (
        match_id, map_name, rounds_played,
        team1_score, team2_score,
        team1_name, team2_name,
        demo_url, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (match_id) DO UPDATE SET
        processed = true,
        raw_data = EXCLUDED.raw_data
    `, [
      matchId,
      data.mapName,
      data.rounds?.length || 0,
      data.team1.score,
      data.team2.score,
      data.team1.name,
      data.team2.name,
      data.demo_url,
      JSON.stringify(data)
    ]);
    
    // Сохранить статистику каждого игрока
    for (const team of [data.team1, data.team2]) {
      for (const player of team.players) {
        const userId = await findUserBySteamId(player.steamId);
        
        if (!userId) {
          console.log(`User not found for Steam ID ${player.steamId}, skipping`);
          continue;
        }
        
        await client.query(`
          INSERT INTO player_match_stats (
            match_id, user_id, steam_id, team_id,
            kills, deaths, assists, headshots, damage_dealt,
            adr, kast, rating,
            hs_percentage,
            clutch_won, clutch_total,
            flash_assists, utility_damage,
            entry_kills, entry_deaths,
            opening_kills, opening_deaths,
            mvp, rounds_played,
            weapon_stats
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24
          )
          ON CONFLICT (match_id, user_id) DO UPDATE SET
            kills = EXCLUDED.kills,
            deaths = EXCLUDED.deaths,
            -- ... все поля
        `, [
          matchId,
          userId,
          player.steamId,
          team.id,  // Нужно мапить
          player.stats.kills,
          player.stats.deaths,
          player.stats.assists,
          player.stats.headshots,
          player.stats.damage,
          player.stats.adr,
          player.stats.kast,
          player.stats.rating,
          (player.stats.headshots / player.stats.kills * 100),
          player.stats.clutch_won,
          player.stats.clutch_total,
          player.stats.flash_assists,
          player.stats.utility_damage,
          player.stats.entry_kills,
          player.stats.entry_deaths,
          player.stats.opening_kills,
          player.stats.opening_deaths,
          player.stats.mvp,
          player.stats.rounds_played,
          JSON.stringify(player.weapons)
        ]);
      }
    }
    
    await client.query('COMMIT');
    console.log(`✅ Saved stats for match ${matchId}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## 📋 ПЛАН ВНЕДРЕНИЯ (Week 1)

**День 1: БД Схема**
- Создать миграцию
- Таблицы match_stats, player_match_stats, player_aggregated_stats
- Функция агрегации
- Тестирование

**День 2-3: Backend**
- Webhook endpoint
- Парсер MatchZy JSON
- Сохранение данных
- Обновление агрегации
- Детекция аномалий (базовая)

**День 4-5: Frontend**
- Расширить Profile Statistics
- Карточки с показателями
- Таблица последних матчей
- Responsive дизайн

**День 6-7: Integration & Testing**
- Настроить MatchZy на сервере
- Протестировать webhook
- Проверить данные
- Деплой

---

## ❓ ВАШ ВЫБОР

**Хотите чтобы я реализовал:**

**A) Вариант 1 (Базовая интеграция)** — $2-3k, 1 неделя
- Основная статистика
- Простой UI
- Quick win

**B) Вариант 2 (Продвинутая)** — $5-8k, 2-3 недели
- Детальная статистика
- Графики
- Аномалии

**C) Пока только концепция**
- Обсуждаем
- Планируем
- Не реализуем

**D) Создай детальный план**
- Полная архитектура
- Все варианты
- Примеры кода

**Что выбираете?** 📊

