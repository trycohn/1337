# 🏆 CAPTAIN'S COUNCIL & TOURNAMENT INTEGRITY SCORE
## Турнирно-ориентированная система peer review

**Версия:** 1.0  
**Дата:** 2 октября 2025  
**Статус:** КОНЦЕПЦИЯ

---

## 🎯 ГЛАВНАЯ ИДЕЯ

**Проблема традиционных систем репортов:**
- Оптимизированы под PUG/matchmaking (ежедневные игры)
- Требуют большую базу данных (100+ матчей на игрока)
- Не учитывают турнирную специфику

**Наше решение:**
Используем **структуру турнира** и **роли участников** для создания надежной системы обратной связи, которая работает с малым количеством матчей.

### Ключевые компоненты:

```
┌─────────────────────────────────────────────────────┐
│  1️⃣ CAPTAIN'S COUNCIL                              │
│  Капитаны команд = доверенные эксперты             │
│  Повышенный вес голоса, коллективные решения       │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│  2️⃣ TOURNAMENT INTEGRITY SCORE                     │
│  Оценка честности турнира (0-100)                  │
│  Агрегация всех репортов, публичный badge          │
└─────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────┐
│  3️⃣ CONTEXTUAL REVIEW                              │
│  Фидбек в ключевые моменты турнира                 │
│  С контекстом (статистика, раунды, результат)      │
└─────────────────────────────────────────────────────┘
```

---

## 👑 CAPTAIN'S COUNCIL (Совет капитанов)

### Концепция:

**Капитаны команд** в турнире получают особый статус "доверенных экспертов" с:
- **Повышенным весом голоса** (2x-3x обычного игрока)
- **Доступом к Captain's Council** (приватный чат)
- **Специальными инструментами** для оценки честности
- **Наградами за активность** (coins, badges, престиж)

### Почему капитаны?

1. **Опыт:** Обычно более опытные игроки (выбраны командой)
2. **Ответственность:** Отвечают за команду, заинтересованы в честности
3. **Авторитет:** Уважаемы в комьюнити
4. **Контекст:** Видят всю картину турнира (не только свои матчи)
5. **Мотивация:** Престиж роли = мотивация честно оценивать

### Роль в турнире:

```javascript
const captainRole = {
  // Назначение
  assignment: {
    auto: 'При создании команды (поле is_captain)',
    manual: 'Создатель турнира может назначить',
    election: 'В mix-турнирах выбирается автоматически (по рейтингу)'
  },
  
  // Права в турнире
  permissions: {
    view_all_teams: true,           // Видит составы всех команд
    access_council_chat: true,      // Доступ к приватному чату капитанов
    enhanced_reporting: true,       // Расширенная форма репорта
    view_tournament_stats: true,    // Статистика турнира в реальном времени
    vote_on_disputes: true          // Голосование по спорным случаям
  },
  
  // Обязанности
  responsibilities: {
    post_tournament_review: 'Обязательная оценка после турнира',
    report_suspicious: 'Репортить подозрительных игроков',
    vote_on_flags: 'Голосовать по флагам от других капитанов',
    maintain_integrity: 'Поддерживать честность турнира'
  },
  
  // Rewards
  rewards: {
    per_tournament: 100,         // coins за участие в Captain's Council
    accurate_report_bonus: 200,  // За подтвержденный репорт
    council_vote_bonus: 50,      // За голосование
    monthly_top_captain: 5000,   // Лучшему капитану месяца
    badge: 'Captain's Badge'     // Визуальный статус
  }
}
```

### Captain's Council Chat:

**Приватный чат для капитанов турнира:**

```
┌──────────────────────────────────────────────────┐
│  👑 Captain's Council - CS2 Cup #42              │
│  8 капитанов онлайн                              │
├──────────────────────────────────────────────────┤
│                                                   │
│  [SYSTEM] Турнир начался. Следите за честностью │
│           игры и репортите подозрительных.      │
│                                                   │
│  Captain_Team1: Кто играл против Team Bravo?    │
│  Captain_Team5: Я. Что случилось?               │
│                                                   │
│  Captain_Team1: У их PlayerX подозрительная игра│
│                 Прекпики каждый угол, 78% HS     │
│                                                   │
│  Captain_Team5: Согласен, и у меня были моменты │
│                 Раунды 5, 12, 18 особенно        │
│                                                   │
│  Captain_Team3: Тоже играл против них. Норм все │
│                 Просто скилловые ребята          │
│                                                   │
│  [SYSTEM] 🗳️ ГОЛОСОВАНИЕ: Флаг на PlayerX?     │
│           За: 2 капитана (Team1, Team5)         │
│           Против: 1 капитан (Team3)             │
│                                                   │
│           [👍 За флаг] [👎 Против] [⏭️ Пропустить]│
│                                                   │
│  [6 капитанов еще не проголосовали]             │
└──────────────────────────────────────────────────┘
```

### Система голосования:

```javascript
const captainsVoting = {
  // Инициация голосования
  trigger: {
    captain_report: 'Любой капитан может инициировать',
    multiple_reports: 'Автоматически при 2+ репортах на одного игрока',
    system_detection: 'Если система детектировала аномалии'
  },
  
  // Процесс голосования
  voting: {
    duration: '24 hours',          // Время на голосование
    quorum: 0.6,                   // 60% капитанов должны проголосовать
    threshold_ban: 0.7,            // 70% "за" для временного бана
    threshold_flag: 0.5,           // 50% "за" для флага модерации
    
    // Вес голосов
    weights: {
      tournament_winner_captain: 3.0,    // Капитан победителя
      top3_captain: 2.5,                 // Капитаны призеров
      eliminated_captain: 2.0,           // Остальные капитаны
      played_vs_suspect: +0.5,           // Играл против подозреваемого
      high_reputation: +0.3              // Репутация >80
    }
  },
  
  // Результат голосования
  outcomes: {
    ban_consensus: {
      threshold: '70% weighted votes',
      action: 'TEMPORARY_BAN (7 days) + priority demo review',
      notify: 'Suspect, admins, tournament organizer'
    },
    
    flag_consensus: {
      threshold: '50% weighted votes',
      action: 'FLAG_FOR_REVIEW + watch for future tournaments',
      notify: 'Admins only'
    },
    
    no_consensus: {
      threshold: '<50%',
      action: 'DISMISSED + note in history',
      notify: 'Reporter only'
    }
  }
}
```

### UI для капитанов:

**Расширенная форма репорта:**

```
┌──────────────────────────────────────────────────┐
│  👑 CAPTAIN'S REPORT                             │
│  Ваш статус: Капитан команды в турнире #42      │
│  Вес голоса: 2.5x (топ-3 турнира)               │
├──────────────────────────────────────────────────┤
│                                                   │
│  Подозреваемый: PlayerX (Team Bravo)            │
│                                                   │
│  📊 Статистика игрока в турнире:                │
│  • Матчи: 5 (5W-0L)                             │
│  • K/D: 2.8 (Высокий)                           │
│  • HS%: 72% (Подозрительно высокий)             │
│  • ADR: 98                                       │
│                                                   │
│  🎯 Ваша оценка:                                │
│  ○ Чистая игра (просто сильный игрок)          │
│  ● Подозрительно (требуется проверка)           │
│  ○ Явный чит (высокая уверенность)              │
│                                                   │
│  Если подозрительно/чит:                         │
│  ☑️ Aimbot                                       │
│  ☑️ Wallhack                                     │
│  ☐ Triggerbot                                    │
│                                                   │
│  Подозрительные раунды (кликните для пометки):  │
│  [R1] [R2] [R3] [R4] ●[R5] [R6] ...  ●[R12]    │
│                                                   │
│  Детали (обязательно для капитанов):            │
│  ┌────────────────────────────────────────────┐  │
│  │ Round 5: Prefiring все позиции на B site, │  │
│  │ знал где мы стоим через смоук.            │  │
│  │                                            │  │
│  │ Round 12: Flick headshot через стену на   │  │
│  │ short A, не мог знать позицию.            │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ⚠️ Ваш репорт будет отправлен в Captain's     │
│     Council на голосование (8 капитанов)        │
│                                                   │
│  Награда при подтверждении: +500 🪙             │
│  Penalty за false report: -200 🪙               │
│                                                   │
│  [Отмена]              [Отправить на голосование]│
└──────────────────────────────────────────────────┘
```

---

## 📊 TOURNAMENT INTEGRITY SCORE

### Концепция:

**Оценка честности турнира** (0-100) на основе всех собранных данных: репорты, статистика, поведение участников, решения Captain's Council.

### Формула расчета:

```javascript
function calculateTournamentIntegrity(tournamentId) {
  // 1. Собрать данные
  const data = await pool.query(`
    SELECT 
      t.id,
      t.total_participants,
      COUNT(DISTINCT mf.reviewer_id) as feedbacks_count,
      COUNT(CASE WHEN mf.fairness_rating = 'cheating' THEN 1 END) as cheating_reports,
      COUNT(CASE WHEN mf.fairness_rating = 'suspicious' THEN 1 END) as suspicious_reports,
      COUNT(CASE WHEN mf.behavior_rating = 'toxic' THEN 1 END) as toxic_reports,
      COUNT(DISTINCT mf.reviewed_id) as flagged_players_count
    FROM tournaments t
    LEFT JOIN tournament_feedback mf ON mf.tournament_id = t.id
    WHERE t.id = $1
    GROUP BY t.id
  `, [tournamentId]);
  
  const stats = data.rows[0];
  
  // 2. Базовый счет (начинаем со 100)
  let score = 100;
  
  // 3. Снижение за проблемы
  
  // 3.1. Cheating reports (самое критичное)
  const cheatingRate = stats.cheating_reports / stats.total_participants;
  score -= cheatingRate * 100; // -100 если все репортнуты
  score -= Math.min(30, stats.cheating_reports * 5); // -5 за каждый репорт (макс -30)
  
  // 3.2. Suspicious reports
  const suspiciousRate = stats.suspicious_reports / stats.total_participants;
  score -= suspiciousRate * 50;
  
  // 3.3. Toxic behavior
  const toxicRate = stats.toxic_reports / stats.total_participants;
  score -= toxicRate * 30;
  
  // 3.4. Low feedback participation
  const participationRate = stats.feedbacks_count / stats.total_participants;
  if (participationRate < 0.3) {
    score -= 10; // Низкая активность = меньше данных = меньше доверия
  }
  
  // 4. Бонусы
  
  // 4.1. Высокое участие в feedback
  if (participationRate > 0.7) {
    score += 5; // Активное комьюнити
  }
  
  // 4.2. Captain's Council active
  const councilActivity = await getCouncilActivity(tournamentId);
  if (councilActivity.votes_cast > councilActivity.total_captains * 0.8) {
    score += 5; // Капитаны активны
  }
  
  // 5. Нормализация (0-100)
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  // 6. Определить badge
  let badge, color;
  if (score >= 90) {
    badge = '✅ Честный турнир';
    color = '#00aa00';
  } else if (score >= 70) {
    badge = '🟡 Требует внимания';
    color = '#ffaa00';
  } else if (score >= 50) {
    badge = '🟠 Проблемы обнаружены';
    color = '#ff6600';
  } else {
    badge = '🔴 Критические проблемы';
    color = '#ff0000';
  }
  
  return {
    score,
    badge,
    color,
    details: {
      participation_rate: participationRate,
      cheating_reports: stats.cheating_reports,
      flagged_players: stats.flagged_players_count,
      toxic_reports: stats.toxic_reports
    }
  };
}
```

### Отображение в интерфейсе:

**На странице турнира (после завершения):**

```
┌──────────────────────────────────────────────────┐
│  🏆 CS2 Weekly Cup #42                           │
│  Статус: Завершен                                │
│  Победитель: Team Alpha                          │
├──────────────────────────────────────────────────┤
│                                                   │
│  📊 TOURNAMENT INTEGRITY SCORE                   │
│  ┌────────────────────────────────────────────┐  │
│  │         ✅ Честный турнир                  │  │
│  │                                            │  │
│  │            92/100                          │  │
│  │    ████████████████████░░                 │  │
│  │                                            │  │
│  │  • Участников: 32                         │  │
│  │  • Оценок получено: 24 (75%)              │  │
│  │  • Жалоб на читинг: 1 (проверен, отклонен)│  │
│  │  • Токсичных инцидентов: 2                │  │
│  │  • Captain's Council: 7/8 активны         │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  💬 "Один из самых честных турниров на платформе"│
└──────────────────────────────────────────────────┘
```

**В списке турниров (публично):**

```
┌─────────────────────────────────────┐
│  CS2 Weekly Cup #42                 │
│  16/16  •  BO3  •  Single Elim      │
│  ✅ Integrity: 92/100                │  ← Badge
│  Приз: 5000₽                        │
│  [Подробнее →]                      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  FastCup Clone #13                  │
│  32/32  •  BO1  •  Swiss            │
│  🟠 Integrity: 58/100                │  ← Badge
│  Приз: 1000₽                        │
│  [Подробнее →]                      │
└─────────────────────────────────────┘
```

---

## 🔄 WORKFLOW (как это работает)

### Полный цикл турнира:

```
┌─────────────────────────────────────────────────────┐
│  ЭТАП 1: ПОДГОТОВКА ТУРНИРА                        │
└─────────────────────────────────────────────────────┘
    ↓
1️⃣ Создатель турнира создает турнир
2️⃣ Команды регистрируются, назначаются капитаны
3️⃣ Система создает Captain's Council chat
4️⃣ Капитаны получают welcome message с инструкциями

┌─────────────────────────────────────────────────────┐
│  ЭТАП 2: ВО ВРЕМЯ ТУРНИРА                          │
└─────────────────────────────────────────────────────┘
    ↓
5️⃣ Матчи проходят, система собирает статистику
6️⃣ При аномалиях (HS% >75%, K/D >4) → уведомление капитанам
7️⃣ Капитаны могут в любой момент зарепортить игрока
8️⃣ Другие капитаны голосуют (за 24 часа)
9️⃣ При консенсусе (70%) → автоматический временный бан

┌─────────────────────────────────────────────────────┐
│  ЭТАП 3: ПОСЛЕ ТУРНИРА                             │
└─────────────────────────────────────────────────────┘
    ↓
🔟 Всем участникам: базовый post-match feedback
1️⃣1️⃣ Капитанам: обязательный Captain's Review
1️⃣2️⃣ Топ-3 игрокам: Highlight review (опционально)
1️⃣3️⃣ Система вычисляет Tournament Integrity Score
1️⃣4️⃣ Badge публикуется на странице турнира
1️⃣5️⃣ Создатель турнира получает детальный отчет
```

### Временные рамки:

```
T+0h:   Турнир начинается
        Captain's Council активируется
        
T+2h:   Первые матчи завершены
        Капитаны могут начать репортить
        
T+4h:   Система детектирует аномалию у PlayerX
        Уведомление капитанам Team A и Team B
        
T+4.5h: Captain Team A репортит PlayerX
        Инициировано голосование
        
T+28h:  Голосование завершено (70% "за")
        PlayerX временно забанен
        Админы получили demo для проверки
        
T+48h:  Турнир завершен
        Post-tournament feedback собирается
        
T+72h:  All feedback collected
        Tournament Integrity Score = 88/100
        Badge "🟡 Требует внимания" установлен
        Отчет отправлен организатору
```

---

## 🎯 CAPTAIN'S REVIEW (обязательный для капитанов)

### После завершения турнира:

```
┌──────────────────────────────────────────────────┐
│  👑 CAPTAIN'S REVIEW - Обязательный опрос        │
│  Турнир: CS2 Weekly Cup #42 (ваше место: 3-4)  │
│  Награда: +200 🪙 + Captain Performance Score   │
├──────────────────────────────────────────────────┤
│                                                   │
│  Как капитан команды, вы играли против 3 команд │
│  Оцените честность игры в турнире в целом:      │
│                                                   │
│  1️⃣ Общая оценка честности:                     │
│  ○ Отлично - все играли честно                  │
│  ○ Хорошо - были вопросы, но не критично        │
│  ● Плохо - серьезные подозрения на читинг       │
│  ○ Критично - явные читеры                      │
│                                                   │
│  2️⃣ Если были подозрения, укажите игроков:     │
│  [Поиск...]  [PlayerX ×] [PlayerY ×]            │
│                                                   │
│  3️⃣ Самые подозрительные моменты:              │
│  ┌────────────────────────────────────────────┐  │
│  │ Матч vs Team Bravo, раунд 12:             │  │
│  │ PlayerX wallbang headshot через double    │  │
│  │ doors на dust2, не мог знать позицию      │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  4️⃣ Оцените качество турнира (организация):    │
│  ⭐⭐⭐⭐☆ (4/5)                                   │
│                                                   │
│  5️⃣ Рекомендации организатору (опционально):   │
│  ┌────────────────────────────────────────────┐  │
│  │ Отличный турнир, но сервера лагали.      │  │
│  │ Рекомендую проверить PlayerX.             │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ⚠️ Как капитан, ваша оценка имеет повышенный   │
│     вес и влияет на Tournament Integrity Score  │
│                                                   │
│  Ваш Captain Performance Score: 87/100 ✅        │
│  (Точность прошлых репортов: 85%)               │
│                                                   │
│  [Отправить и получить +200 🪙]                  │
└──────────────────────────────────────────────────┘
```

### Captain Performance Score:

```javascript
// Репутация капитана (отдельно от игрока)
const captainPerformance = {
  // Метрики
  metrics: {
    tournaments_as_captain: 15,
    reports_submitted: 8,
    reports_confirmed: 7,      // Модераторы подтвердили
    reports_dismissed: 1,      // Ошибочные
    council_votes_cast: 23,
    council_votes_accuracy: 21, // Совпали с финальным решением
    
    // Вычисляемые
    report_accuracy: 7/8,       // 87.5%
    voting_accuracy: 21/23,     // 91%
    activity_rate: 23/25        // 92% (голосовал в 23 из 25 случаев)
  },
  
  // Расчет Performance Score
  calculate: function() {
    const accuracyScore = (this.metrics.report_accuracy * 0.5 + 
                          this.metrics.voting_accuracy * 0.3 +
                          this.metrics.activity_rate * 0.2) * 100;
    
    return Math.round(accuracyScore);
  },
  
  // Влияние на вес голоса
  weight_modifier: function() {
    const performance = this.calculate();
    
    if (performance > 90) return 1.5;      // +50% к весу
    if (performance > 80) return 1.2;      // +20%
    if (performance > 70) return 1.0;      // Нормальный
    if (performance < 50) return 0.5;      // -50% (ненадежный капитан)
    
    return 1.0;
  }
}
```

---

## 📊 БАЗА ДАННЫХ

### Полная схема:

```sql
-- ============================================================================
-- CAPTAIN'S COUNCIL
-- ============================================================================

-- Статус капитана в турнире
CREATE TABLE tournament_captains (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id),
  user_id INTEGER REFERENCES users(id),
  team_id INTEGER REFERENCES tournament_teams(id),
  
  -- Назначение
  appointed_at TIMESTAMP DEFAULT NOW(),
  appointed_by INTEGER REFERENCES users(id), -- Кто назначил (создатель/система)
  
  -- Активность
  council_reports_submitted INTEGER DEFAULT 0,
  council_votes_cast INTEGER DEFAULT 0,
  council_chat_messages INTEGER DEFAULT 0,
  
  -- Performance
  captain_performance_score INTEGER,
  
  UNIQUE(tournament_id, user_id)
);

-- Чат Captain's Council
CREATE TABLE captain_council_chats (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id) UNIQUE,
  chat_id INTEGER REFERENCES chats(id),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Голосования в Council
CREATE TABLE captain_council_votes (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id),
  suspect_user_id INTEGER REFERENCES users(id),
  
  -- Инициатор
  initiated_by INTEGER REFERENCES users(id),
  initiated_at TIMESTAMP DEFAULT NOW(),
  
  -- Детали подозрения
  suspected_behavior VARCHAR(50), -- 'cheating', 'griefing', 'toxic'
  suspected_cheat_types VARCHAR(50)[],
  evidence_description TEXT,
  suspicious_rounds INTEGER[],
  
  -- Статус
  status VARCHAR(20) DEFAULT 'VOTING' CHECK (
    status IN ('VOTING', 'CONCLUDED', 'CANCELLED')
  ),
  
  -- Дедлайн
  deadline TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
  
  -- Результаты
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  votes_abstain INTEGER DEFAULT 0,
  weighted_votes_for DECIMAL(5,2) DEFAULT 0,
  weighted_votes_against DECIMAL(5,2) DEFAULT 0,
  
  final_decision VARCHAR(20) CHECK (
    final_decision IN ('BAN', 'FLAG', 'DISMISSED', NULL)
  ),
  concluded_at TIMESTAMP
);

-- Голоса капитанов
CREATE TABLE captain_votes (
  id SERIAL PRIMARY KEY,
  vote_id INTEGER REFERENCES captain_council_votes(id),
  captain_id INTEGER REFERENCES users(id),
  
  vote VARCHAR(20) CHECK (vote IN ('FOR', 'AGAINST', 'ABSTAIN')),
  vote_weight DECIMAL(3,2),
  
  comment TEXT,
  voted_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(vote_id, captain_id)
);

-- ============================================================================
-- TOURNAMENT INTEGRITY
-- ============================================================================

CREATE TABLE tournament_integrity_stats (
  tournament_id INTEGER PRIMARY KEY REFERENCES tournaments(id),
  
  -- Participation
  total_participants INTEGER,
  feedbacks_received INTEGER,
  completion_rate DECIMAL(5,2),
  
  -- Cheating
  cheating_reports_count INTEGER DEFAULT 0,
  cheating_weighted_score DECIMAL(5,2) DEFAULT 0,
  flagged_players INTEGER DEFAULT 0,
  confirmed_cheaters INTEGER DEFAULT 0,
  
  -- Behavior
  toxic_reports_count INTEGER DEFAULT 0,
  excellent_behavior_count INTEGER DEFAULT 0,
  
  -- Captain's Council
  council_votes_count INTEGER DEFAULT 0,
  council_bans_issued INTEGER DEFAULT 0,
  council_flags_issued INTEGER DEFAULT 0,
  
  -- Scores
  integrity_score INTEGER CHECK (integrity_score BETWEEN 0 AND 100),
  integrity_badge VARCHAR(50),
  badge_color VARCHAR(10),
  
  -- Details
  details JSONB,
  
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- История Integrity Scores (для трендов)
CREATE TABLE tournament_integrity_history (
  tournament_id INTEGER REFERENCES tournaments(id),
  integrity_score INTEGER,
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- FEEDBACK РАСШИРЕННЫЙ
-- ============================================================================

CREATE TABLE tournament_feedback (
  id SERIAL PRIMARY KEY,
  tournament_id INTEGER REFERENCES tournaments(id),
  match_id INTEGER REFERENCES matches(id),
  reviewer_id INTEGER REFERENCES users(id),
  reviewed_id INTEGER REFERENCES users(id),
  
  -- Контекст
  review_type VARCHAR(30) CHECK (
    review_type IN (
      'post_match',           -- После матча (все)
      'post_elimination',     -- После выбывания
      'post_tournament',      -- После завершения
      'captain_review',       -- Обязательный от капитана
      'top_player_review',    -- От топ-игроков
      'highlight_review'      -- Просмотр highlights
    )
  ),
  
  feedback_source VARCHAR(20) CHECK (
    feedback_source IN ('opponent', 'teammate')
  ),
  
  -- Оценки
  fairness_rating VARCHAR(20) CHECK (
    fairness_rating IN ('clean', 'normal', 'suspicious', 'cheating', NULL)
  ),
  behavior_rating VARCHAR(20) CHECK (
    behavior_rating IN ('excellent', 'good', 'normal', 'toxic', NULL)
  ),
  teamplay_rating VARCHAR(20) CHECK (
    teamplay_rating IN ('excellent', 'normal', 'poor', NULL)
  ),
  communication_rating VARCHAR(20) CHECK (
    communication_rating IN ('good', 'normal', 'silent', 'toxic', NULL)
  ),
  
  -- Детали (для cheating/suspicious)
  suspected_cheat_types VARCHAR(50)[],
  suspicious_rounds INTEGER[],
  evidence_description TEXT,
  
  -- Вес (calculated)
  calculated_weight DECIMAL(3,2),
  weight_factors JSONB,
  
  -- Rewards
  coins_rewarded INTEGER DEFAULT 0,
  
  -- Meta
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tournament_id, match_id, reviewer_id, reviewed_id)
);

CREATE INDEX idx_tournament_feedback_reviewed ON tournament_feedback(reviewed_id);
CREATE INDEX idx_tournament_feedback_tournament ON tournament_feedback(tournament_id);
CREATE INDEX idx_tournament_feedback_fairness ON tournament_feedback(fairness_rating);
```

---

## 🎮 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ

### Пример 1: Капитан репортит подозрительного игрока

```javascript
// 1. Капитан отправляет репорт через Captain's Panel
POST /api/tournaments/:id/captain-report
{
  "suspect_user_id": 456,
  "suspected_behavior": "cheating",
  "suspected_cheat_types": ["aimbot", "wallhack"],
  "suspicious_rounds": [5, 12, 18, 23],
  "evidence_description": "Prefiring positions, wallbang headshots, 85% HS rate",
  "severity": "HIGH"
}

// 2. Система создает голосование в Captain's Council
const voting = await createCouncilVote({
  tournament_id: tournamentId,
  suspect_user_id: 456,
  initiated_by: captainId,
  ...reportData
});

// 3. Уведомить всех капитанов
for (const captain of tournamentCaptains) {
  await sendNotification(captain.user_id, {
    type: 'council_vote',
    message: `Новое голосование в Captain's Council: PlayerX подозревается в читинге`,
    vote_id: voting.id,
    deadline: voting.deadline
  });
}

// 4. Captain's Council chat
await sendSystemMessage(councilChatId, {
  type: 'vote_initiated',
  content: `🗳️ ГОЛОСОВАНИЕ #${voting.id}\n\nКапитан ${initiator.username} подозревает игрока ${suspect.username} в читинге.\n\nДетали: ${evidence}\n\nГолосуйте в течение 24 часов.`,
  metadata: {
    vote_id: voting.id,
    actions: [
      { type: 'vote', label: '👍 За бан', value: 'FOR' },
      { type: 'vote', label: '👎 Против', value: 'AGAINST' },
      { type: 'vote', label: '🤷 Не знаю', value: 'ABSTAIN' }
    ]
  }
});
```

### Пример 2: Голосование и принятие решения

```javascript
// Капитан голосует
POST /api/tournaments/captain-votes/:voteId
{
  "vote": "FOR",
  "comment": "Играл против него в матче, подозрительные prefires"
}

// Система вычисляет вес голоса
const captain = await getCaptainData(captainId, tournamentId);
const weight = calculateVoteWeight({
  captain_performance: captain.performance_score,
  tournament_placement: captain.team_placement,
  played_vs_suspect: await didPlayVsSuspect(captainId, suspectId),
  reputation: captain.user.reputation_index,
  trust_score: captain.user.trust_score
});

// weight = 2.5 (топ-3 команда, высокая репутация, играл против)

// Сохранить голос
await saveVote(voteId, captainId, 'FOR', weight, comment);

// Обновить счетчики
await pool.query(`
  UPDATE captain_council_votes SET
    votes_for = votes_for + 1,
    weighted_votes_for = weighted_votes_for + $1
  WHERE id = $2
`, [weight, voteId]);

// ================================
// Через 24 часа (или все проголосовали):
// ================================

async function concludeVoting(voteId) {
  const vote = await getVoteData(voteId);
  
  // Проверить кворум (60% капитанов)
  const totalCaptains = await getTournamentCaptainsCount(vote.tournament_id);
  const votedCaptains = vote.votes_for + vote.votes_against + vote.votes_abstain;
  const quorum = votedCaptains / totalCaptains;
  
  if (quorum < 0.6) {
    // Недостаточно голосов
    await updateVote(voteId, {
      status: 'CONCLUDED',
      final_decision: 'DISMISSED',
      reason: 'Insufficient quorum'
    });
    return;
  }
  
  // Вычислить результат
  const totalWeighted = vote.weighted_votes_for + vote.weighted_votes_against;
  const forPercentage = vote.weighted_votes_for / totalWeighted;
  
  let decision, action;
  
  if (forPercentage >= 0.7) {
    // 70%+ "за" → временный бан
    decision = 'BAN';
    action = await executeTemporaryBan(vote.suspect_user_id, {
      duration: '7 days',
      reason: `Captain's Council decision (${(forPercentage * 100).toFixed(0)}% consensus)`,
      requires_demo_review: true,
      tournament_id: vote.tournament_id
    });
  } else if (forPercentage >= 0.5) {
    // 50-70% "за" → флаг для проверки
    decision = 'FLAG';
    action = await flagForReview(vote.suspect_user_id, {
      priority: 'HIGH',
      reason: 'Captain's Council suspicion',
      evidence: vote.evidence_description
    });
  } else {
    // <50% "за" → отклонить
    decision = 'DISMISSED';
  }
  
  // Обновить голосование
  await updateVote(voteId, {
    status: 'CONCLUDED',
    final_decision: decision,
    concluded_at: new Date()
  });
  
  // Уведомить всех
  await notifyVoteConclusion(voteId, decision, action);
  
  // Обновить Captain Performance для всех проголосовавших
  await updateCaptainPerformance(voteId, decision);
}
```

---

## 📈 TOURNAMENT INTEGRITY BADGE SYSTEM

### Уровни оценки:

```javascript
const integrityLevels = {
  diamond: {
    score: [95, 100],
    badge: '💎 Безупречный турнир',
    color: '#00ddff',
    benefits: {
      organizer: '+10% к репутации организатора',
      featured: 'Размещение на главной странице',
      participants: 'Все участники получают +25 coins бонус'
    }
  },
  
  platinum: {
    score: [90, 94],
    badge: '✅ Честный турнир',
    color: '#00aa00',
    benefits: {
      organizer: '+5% к репутации',
      featured: 'Рекомендации в списке турниров'
    }
  },
  
  gold: {
    score: [75, 89],
    badge: '🟢 Хороший турнир',
    color: '#88cc00',
    benefits: {
      organizer: 'Нормальная репутация'
    }
  },
  
  silver: {
    score: [60, 74],
    badge: '🟡 Требует внимания',
    color: '#ffaa00',
    warnings: {
      organizer: 'Предупреждение о проблемах',
      action: 'Модераторы проверяют репорты'
    }
  },
  
  bronze: {
    score: [40, 59],
    badge: '🟠 Проблемы обнаружены',
    color: '#ff6600',
    warnings: {
      organizer: 'Серьезное предупреждение',
      action: 'Обязательная проверка модераторами',
      restriction: 'Следующий турнир под наблюдением'
    }
  },
  
  failed: {
    score: [0, 39],
    badge: '🔴 Критические проблемы',
    color: '#ff0000',
    consequences: {
      organizer: 'Временная блокировка создания турниров (7 дней)',
      flagged_players: 'Все подозреваемые игроки банятся',
      investigation: 'Полное расследование турнира',
      refund: 'Возврат взносов участникам (если платный)'
    }
  }
};
```

### Визуализация в турнире:

**Вкладка "Честность турнира":**

```
┌──────────────────────────────────────────────────┐
│  📊 TOURNAMENT INTEGRITY                         │
│  CS2 Weekly Cup #42                              │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │         ✅ Честный турнир                  │  │
│  │                                            │  │
│  │              92/100                        │  │
│  │    ████████████████████░░                 │  │
│  │                                            │  │
│  │  "Высокий уровень честности.              │  │
│  │   Рекомендуем этого организатора!"        │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  📊 Детальная статистика:                       │
│  ┌────────────────────────────────────────────┐  │
│  │ Участие в feedback: 24/32 (75%) ✅        │  │
│  │ Жалобы на читинг: 2                       │  │
│  │ └─ Проверено модераторами: 2/2           │  │
│  │ └─ Подтверждено: 0                        │  │
│  │ └─ Отклонено: 2 (ложные тревоги)         │  │
│  │                                            │  │
│  │ Токсичные инциденты: 3                    │  │
│  │ └─ Предупреждения выданы: 3               │  │
│  │                                            │  │
│  │ Captain's Council:                        │  │
│  │ └─ Активность: 7/8 капитанов (87%)       │  │
│  │ └─ Голосований: 2                         │  │
│  │ └─ Решений принято: 2                     │  │
│  │    • 1 флаг для проверки                  │  │
│  │    • 1 отклонено (недостаточно доказательств)│
│  └────────────────────────────────────────────┘  │
│                                                   │
│  👥 Captain's Council (8 капитанов):             │
│  ┌────────────────────────────────────────────┐  │
│  │ • Captain_Alpha (Team Alpha) ⭐⭐⭐        │  │
│  │   Performance: 92/100                      │  │
│  │   Репортов: 1, Голосов: 2/2               │  │
│  │                                            │  │
│  │ • Captain_Bravo (Team Bravo) ⭐⭐         │  │
│  │   Performance: 85/100                      │  │
│  │   Репортов: 0, Голосов: 2/2               │  │
│  │ ...                                        │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  🏆 Рейтинг честности организатора:             │
│  OrganizerName: 15 турниров, средний Integrity 89│
└──────────────────────────────────────────────────┘
```

---

## 💡 УНИКАЛЬНЫЕ ПРЕИМУЩЕСТВА

### 1. Работает с малым количеством данных

**Традиционная система (FACEIT):**
```
Требуется: 100+ матчей на игрока
Данные: Статистика за месяцы
Проблема: Не работает в турнирах (3-7 матчей)
```

**Наша система:**
```
Требуется: 1 турнир (3-7 матчей)
Данные: Турнирный контекст + Captain's Council
Преимущество: Работает с первого турнира
```

### 2. Защита от revenge reports

**Проблема в обычных системах:**
```
Игрок проигрывает → репортит всех соперников как читеров
Результат: 80% ложных репортов
```

**Наше решение:**
```
Captain's Council голосование:
├─ Капитан проигравшей команды репортит (вес 2.0)
├─ Капитан ДРУГОЙ команды подтверждает (вес 2.0)
├─ Капитан третьей команды подтверждает (вес 2.0)
└─ Консенсус: 3 независимых источника

Результат: 85%+ точность репортов
```

### 3. Турнирный контекст

**Обычная система:**
```
"PlayerX читер"
Без контекста: Когда? В каком матче? Что именно?
```

**Наша система:**
```
Контекст:
├─ Турнир: CS2 Cup #42
├─ Матч: Semifinal (Team Alpha vs Team Bravo)
├─ Раунд: 12 из 30
├─ Момент: 1v2 clutch, double wallbang headshot
├─ Статистика: 85% HS (аномалия для его уровня)
├─ Свидетели: 3 капитана играли против него
└─ Видео: Highlight с этого раунда

Модератор получает ПОЛНУЮ картину
```

---

## 🎯 СИНЕРГИЯ С СУЩЕСТВУЮЩИМИ СИСТЕМАМИ

### Интеграция с вашими фичами:

#### 1. Mix-турниры (уже есть):

```javascript
// После каждого раунда Full Mix
const mixRoundFeedback = {
  question: 'С кем НЕ хотите играть в следующем раунде?',
  options: [тиммейты из текущей команды],
  
  // Используется для формирования команд
  teamGeneration: {
    avoid_pairing: [
      { player1: 123, player2: 456, reason: 'toxic_behavior', votes: 3 },
      { player1: 789, player2: 456, reason: 'poor_communication', votes: 2 }
    ],
    
    // Алгоритм учитывает
    action: 'При генерации команд раунда 2 не ставить Player 456 с Player 123/789'
  },
  
  // Влияние на репутацию
  reputation_impact: {
    if_blacklisted_by_3_plus: 'Снижение teamplay_score на 10',
    if_blacklisted_by_5_plus: 'Флаг для модерации',
    reset: 'После каждого турнира (свежий старт)'
  }
}
```

#### 2. Лобби матчей (уже есть):

```javascript
// В лобби перед началом матча
const lobbyIntegrityCheck = {
  // Для капитанов показывается предупреждение
  warnings: [
    {
      player: 'PlayerX',
      team: 'opponent',
      reason: 'Flagged by Captain's Council in tournament #38',
      severity: 'HIGH',
      action: 'Captain может запросить проверку или продолжить'
    }
  ],
  
  // UI
  display: `
    ⚠️ ПРЕДУПРЕЖДЕНИЕ
    
    Игрок PlayerX (противник) имеет флаг от Captain's Council.
    Причина: Подозрение на wallhack (турнир #38)
    Статус: На проверке у модераторов
    
    [ℹ️ Подробнее] [✅ Продолжить] [🚫 Отменить матч]
  `
}
```

#### 3. Система достижений (уже есть):

```javascript
// Новые достижения
const captainAchievements = {
  'first_captain': {
    title: '👑 Первое капитанство',
    description: 'Стать капитаном команды в турнире',
    reward: 100
  },
  
  'council_guardian': {
    title: '🛡️ Хранитель совета',
    description: 'Участвовать в 10 Captain\'s Council голосованиях',
    reward: 500
  },
  
  'cheater_hunter': {
    title: '🎯 Охотник на читеров',
    description: '5 подтвержденных репортов на читеров',
    reward: 2000
  },
  
  'perfect_captain': {
    title: '⭐ Идеальный капитан',
    description: 'Captain Performance Score 95+ в 10 турнирах',
    reward: 5000,
    rarity: 'legendary'
  }
}
```

---

## 💰 ДЕТАЛЬНЫЙ БЮДЖЕТ

### Разработка (breakdown):

| Компонент | Часы | Ставка | Стоимость |
|-----------|------|--------|-----------|
| **Backend** | | | |
| Captain's Council система | 40h | $50/h | $2,000 |
| Voting механизм | 30h | $50/h | $1,500 |
| Tournament Integrity calc | 25h | $50/h | $1,250 |
| Weighted voting algorithm | 20h | $50/h | $1,000 |
| API endpoints (8 штук) | 30h | $50/h | $1,500 |
| **Frontend** | | | |
| Captain's Panel UI | 35h | $50/h | $1,750 |
| Council Chat interface | 25h | $50/h | $1,250 |
| Voting UI | 20h | $50/h | $1,000 |
| Integrity Score display | 15h | $50/h | $750 |
| Highlight review (basic) | 40h | $60/h | $2,400 |
| **Testing & QA** | 30h | $40/h | $1,200 |
| **Project Management** | 20h | $70/h | $1,400 |
| | | | |
| **ИТОГО** | **330h** | | **$16,000** |

### Операционные (monthly):

- Модерация Council flags: $800/мес
- Reward pool (captain rewards): $500/мес
- Highlight processing: $300/мес (если AI)
- **ИТОГО:** $1,600/мес

---

## 🚀 ПЛАН РЕАЛИЗАЦИИ (4 недели)

### Week 1: Captain's Council Foundation

```
Backend:
☐ Таблицы БД (captains, votes, council_chats)
☐ Captain assignment логика
☐ Council chat creation
☐ Basic voting API

Frontend:
☐ Captain's Panel (базовый)
☐ Council chat UI
☐ Voting interface

Тестирование:
☐ Создание турнира с капитанами
☐ Council chat работает
☐ Базовое голосование
```

### Week 2: Voting & Decision Making

```
Backend:
☐ Weighted voting algorithm
☐ Vote conclusion автоматизация
☐ Temporary ban execution
☐ Captain Performance tracking

Frontend:
☐ Detailed voting UI
☐ Vote results display
☐ Captain Performance dashboard

Тестирование:
☐ Полный цикл голосования
☐ Weighted voting работает корректно
☐ Баны применяются
```

### Week 3: Tournament Integrity Score

```
Backend:
☐ Integrity Score calculation
☐ Badge система
☐ Organizer reputation impact
☐ Historical tracking

Frontend:
☐ Integrity Score display на странице турнира
☐ Badge в списке турниров
☐ Детальная статистика

Тестирование:
☐ Integrity Score вычисляется корректно
☐ Badges отображаются
☐ Влияние на репутацию работает
```

### Week 4: Contextual Review & Polish

```
Backend:
☐ Post-elimination feedback
☐ Top-player review
☐ Highlight extraction (basic)
☐ Notifications

Frontend:
☐ Contextual feedback forms
☐ Highlight review UI (если успеем)
☐ Mobile optimization
☐ Polish & bug fixes

Тестирование:
☐ End-to-end тестирование
☐ Полный турнир с Council
☐ UAT с реальными пользователями
☐ Performance testing
```

---

## 📊 МЕТРИКИ УСПЕХА

### Для Captain's Council:

| Метрика | Target | Измерение |
|---------|--------|-----------|
| **Captain participation** | >80% | Голосуют в Council votes |
| **Voting accuracy** | >85% | % решений совпавших с модерацией |
| **False positive rate** | <10% | % ошибочных банов |
| **Response time** | <12h | Среднее время голосования |
| **Captain satisfaction** | >8/10 | Опрос капитанов |

### Для Tournament Integrity:

| Метрика | Target | Измерение |
|---------|--------|-----------|
| **Average Integrity Score** | >85 | Средний по всем турнирам |
| **Diamond tournaments** | >20% | % турниров с 95+ score |
| **Failed tournaments** | <5% | % турниров с <40 score |
| **Organizer trust** | Рост +30% | Опрос участников |
| **Platform reputation** | Top 3 | "Самая честная платформа СНГ" |

---

## 🎮 ПРИМЕРЫ СЦЕНАРИЕВ

### Сценарий 1: Подозрение подтверждено

```
ДЕНЬ 1 (матч):
14:30 - Матч Semifinal: Team Alpha vs Team Bravo
14:45 - Captain Alpha замечает подозрительную игру у PlayerX (Team Bravo)
15:00 - Матч завершен, Team Bravo победила 16:12

15:15 - Captain Alpha открывает Captain's Panel
        Заполняет детальный репорт:
        • Подозрение: Wallhack
        • Раунды: 5, 8, 12, 15, 18
        • Описание: "Prefiring, wallbangs, знает позиции"
        
15:20 - Репорт отправлен в Captain's Council
        Создано голосование #CV-042-001
        Уведомления отправлены всем 8 капитанам

ДЕНЬ 1-2 (голосование):
16:00 - Captain Bravo голосует "AGAINST" (защищает своего игрока)
18:30 - Captain Charlie голосует "FOR" (тоже играл против PlayerX, были моменты)
20:00 - Captain Delta голосует "FOR" (смотрел стрим, подозрительно)
22:00 - Captain Echo голосует "ABSTAIN" (не играл против, не знает)

ДЕНЬ 2:
10:00 - Captain Foxtrot голосует "FOR"
12:00 - Еще 3 капитана проголосовали: 2 "FOR", 1 "AGAINST"

15:20 - 24 часа истекло, голосование завершено
        
        Результаты:
        • Проголосовали: 8/8 (100% quorum)
        • За бан: 5 капитанов (weighted: 11.5)
        • Против: 2 капитана (weighted: 4.0)
        • Воздержались: 1 (weighted: 2.0)
        
        Weighted percentage: 11.5 / 17.5 = 65.7%
        
        Решение: FLAG_FOR_REVIEW (недостаточно 70% для бана)

15:25 - PlayerX получил флаг HIGH priority
        Админы уведомлены
        Demo матчей добавлено в очередь на проверку

ДЕНЬ 3:
        Модератор проверяет demo
        Обнаружен wallhack
        PERMANENT BAN

ДЕНЬ 4:
        Captain Performance обновлен:
        • Captain Alpha: +200 coins (accurate report)
        • Captain Charlie: +50 coins (correct vote)
        • Captain Bravo: -50 coins (defended cheater)
```

### Сценарий 2: Ложная тревога

```
Captain George репортит PlayerY за "aimbot"
Council голосование: 2 "FOR", 5 "AGAINST", 1 "ABSTAIN"

Weighted: 25% "за"

Решение: DISMISSED

Captain George:
• Performance Score снижен на 5 пунктов
• Предупреждение о false reports
• Следующий репорт будет проверен строже
```

---

## 🎨 UI/UX ДЕТАЛИ

### Captain's Panel (новая секция):

Добавляется в интерфейс турнира для капитанов:

```
Вкладки турнира (для капитана):
[📋 Главная] [🏆 Сетка] [👥 Участники] [👑 Captain's Panel] ← НОВОЕ
```

**Содержимое Captain's Panel:**

```
┌──────────────────────────────────────────────────┐
│  👑 CAPTAIN'S PANEL                              │
│  Турнир: CS2 Weekly Cup #42                     │
│  Ваша команда: Team Alpha (3-4 место)          │
├──────────────────────────────────────────────────┤
│                                                   │
│  💬 Captain's Council Chat                       │
│  [Открыть чат →]  8 капитанов онлайн           │
│                                                   │
│  🗳️ Активные голосования (2):                   │
│  ┌────────────────────────────────────────────┐  │
│  │ #CV-042-001: PlayerX (cheating suspicion) │  │
│  │ Инициатор: Captain_Team1                  │  │
│  │ Голосов: 6/8                               │  │
│  │ Осталось: 8 часов                         │  │
│  │ [Просмотреть детали →]                    │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  📊 Ваша Captain Performance:                   │
│  ┌────────────────────────────────────────────┐  │
│  │ Репортов подано: 3                        │  │
│  │ Репортов подтверждено: 2 (67% accuracy)   │  │
│  │ Голосований: 12/15 (80% participation)    │  │
│  │ Точность голосов: 11/12 (92%)             │  │
│  │                                            │  │
│  │ Performance Score: 87/100 ✅              │  │
│  │ Ранг: Top 15% капитанов платформы         │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  🚨 Сообщить о проблеме:                        │
│  [+ Репортить игрока]  [+ Сообщить о баге]      │
│                                                   │
│  🏆 Rewards заработано: 1,250 🪙                │
└──────────────────────────────────────────────────┘
```

---

## 🔥 КОНКУРЕНТНЫЕ ПРЕИМУЩЕСТВА

### Почему это уникально:

| Платформа | Система репортов | Наше преимущество |
|-----------|------------------|-------------------|
| **FACEIT** | Overwatch (post-factum) | ✅ Real-time Captain's Council |
| **FastCup** | Ручная модерация | ✅ Краудсорсинг + автоматизация |
| **PRACC** | Нет системы | ✅ Полная система |
| **GoodGame** | Базовые репорты | ✅ Tournament context |

### Маркетинговые фишки:

**Messaging:**
```
"Первая платформа с Captain's Council"
→ Капитаны следят за честностью турниров

"Tournament Integrity Score"
→ Прозрачность для всех участников

"Powered by community, not just algorithms"
→ Живые люди принимают решения

"Zero tolerance for cheaters"
→ Консенсус капитанов = немедленный бан
```

### PR-кампания:

```markdown
1. Анонс: "Революция в борьбе с читерами"
   - Пресс-релиз на cybersport.ru
   - Интервью с первыми капитанами
   
2. Case study: "Как Captain's Council поймал 10 читеров"
   - Реальные истории
   - Статистика эффективности
   
3. Captain of the Month:
   - Публичное признание
   - Интервью
   - Награды
```

---

## ⚠️ РИСКИ И МИТИГАЦИЯ

### Риск 1: Низкая активность капитанов

**Проблема:** Капитаны не голосуют в Council

**Митигация:**
- ✅ Обязательность Captain's Review (требование)
- ✅ Высокие rewards (200-500 coins)
- ✅ Престиж роли (badges, leaderboard)
- ✅ Gamification (Captain Performance Score)
- ✅ Напоминания (push, email, Telegram)

### Риск 2: Сговор капитанов

**Проблема:** Капитаны могут сговориться забанить невиновного

**Митигация:**
- ✅ Требуется 70% консенсус (сложно сговориться)
- ✅ Weighted voting (разный вес голосов)
- ✅ Модератор проверяет все баны
- ✅ Appeal система для suspect
- ✅ Penalty за ложные обвинения (если вскрыт сговор)

### Риск 3: Капитан защищает своего читера

**Проблема:** Капитан голосует "против" чтобы защитить тиммейта

**Митигация:**
- ✅ Голоса капитанов ДРУГИХ команд важнее
- ✅ Если играл В КОМАНДЕ с suspect → вес голоса 0.5x (снижен)
- ✅ Система детектирует паттерн защиты (снижение Performance)
- ✅ Публичная история голосов (прозрачность)

### Риск 4: Недостаточно данных для Integrity Score

**Проблема:** Малые турниры (8 участников) = мало feedback

**Митигация:**
- ✅ Минимальный порог участников (16+) для Integrity Score
- ✅ Для малых турниров: "Integrity Score не применим"
- ✅ Альтернатива: "Organizer Trust Score" (история организатора)

---

## 📖 ФИНАЛЬНАЯ РЕКОМЕНДАЦИЯ

### 🎯 Когда внедрять:

**НЕ СЕЙЧАС:**
- Слишком сложно для MVP
- Требует большую базу пользователей
- Дорого ($16k)

**ОПТИМАЛЬНО:**
```
Месяц 1-3:   Вариант 1 (Basic Feedback) + Trust Score
             Накопить 1000+ пользователей
             Провести 50+ турниров
             
Месяц 4-6:   Вариант 2 (Smart Reputation)
             Weighted voting
             Reputation Index
             
Месяц 7-10:  Вариант 3 (Captain's Council) ← СЕЙЧАС
             Когда есть:
             • 5000+ MAU
             • 100+ турниров/месяц
             • Стабильная база капитанов (50+)
             • Бюджет $16k
```

### Почему не сейчас:

1. **Нужна критическая масса:**
   - Минимум 20-30 активных капитанов
   - Сейчас: неизвестно сколько

2. **Сложность vs ценность:**
   - При 10 турнирах/месяц → мало данных
   - При 100 турнирах/месяц → система окупается

3. **Стоимость:**
   - $16k можно лучше потратить на:
     * PUG-систему ($20k)
     * Мобильное приложение ($15k)
     * Маркетинг ($16k = 500+ новых пользователей)

### Что делать СЕЙЧАС:

**Рекомендую комбо:**
```
1. Trust Score (DONE ✅)
   - Блокирует VAC-баны
   - Базовая защита
   
2. Basic Post-Match Feedback (Вариант 1)
   - $3-5k, 1-2 недели
   - Начать собирать данные
   - Обучить пользователей

3. Пометка капитанов (легко!)
   - Показывать icon 👑 у капитанов
   - Давать им +0.5 вес в feedback
   - Подготовка к Captain's Council
```

**Затраты:** $3-5k (vs $16k сразу)  
**Результат:** 80% пользы за 20% цены

---

## ✅ ЗАКЛЮЧЕНИЕ

### Captain's Council & Tournament Integrity Score:

**🏆 ИДЕАЛЬНАЯ система для турнирной платформы:**
- ✅ Использует турнирную структуру
- ✅ Работает с малым количеством матчей
- ✅ Уникальная фича (нет у конкурентов)
- ✅ Маркетинговая бомба

**⚠️ НО рано для внедрения:**
- Нужна большая база (5000+ MAU)
- Дорого ($16k)
- Окупится только при 100+ турниров/месяц

**🎯 РЕКОМЕНДАЦИЯ:**
Внедрять через 6-12 месяцев после:
1. Trust Score (DONE)
2. Basic Feedback (Month 1-2)
3. Smart Reputation (Month 4-6)
4. Накоплен опыт и аудитория
5. **ТОГДА** Captain's Council (Month 7-10)

**Сейчас:**  
Начать с Варианта 1 ($3-5k) и готовить базу для Captain's Council.

---

**Документ:** 2 октября 2025  
**Статус:** ✅ ДЕТАЛЬНЫЙ ПЛАН ГОТОВ  
**Для внедрения:** Через 6-12 месяцев

Хотите начать с Варианта 1 (Basic) сейчас? 🚀

