# 🏆 Алгоритм Double Elimination Tournament

## Концепция и принципы

**Double Elimination** - это турнирная система, где каждый участник должен проиграть **два раза**, чтобы быть исключенным из турнира. Система обеспечивает более справедливое определение победителя, поскольку дает второй шанс участникам, проигравшим один раз.

### Структура турнира

```
┌─────────────────────────────────────────────────────────────────┐
│                     DOUBLE ELIMINATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │   WINNERS       │    │   LOSERS        │    │   GRAND     │  │
│  │   BRACKET       │    │   BRACKET       │    │   FINAL     │  │
│  │  (верхняя       │    │  (нижняя        │    │             │  │
│  │   сетка)        │    │   сетка)        │    │             │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Математические расчеты

### Базовые параметры

```javascript
// Для n участников
const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(n)));
const winnersRounds = Math.log2(powerOfTwo);
const losersRounds = (winnersRounds - 1) * 2;
```

### Количество матчей

```javascript
const winnersMatches = powerOfTwo - 1;           // Например: 8 участников = 7 матчей
const losersMatches = powerOfTwo - 2;            // Например: 8 участников = 6 матчей  
const grandFinalMatches = 2;                     // Максимум 2 матча (основной + reset)
const totalMatches = winnersMatches + losersMatches + grandFinalMatches;
```

### Примеры расчетов

| Участники | Степень 2 | Winners Матчи | Losers Матчи | Grand Final | Всего |
|-----------|-----------|---------------|--------------|-------------|-------|
| 4         | 4         | 3             | 2            | 2           | 7     |
| 8         | 8         | 7             | 6            | 2           | 15    |
| 16        | 16        | 15            | 14           | 2           | 31    |
| 32        | 32        | 31            | 30           | 2           | 63    |

## Логика продвижения участников

### 1. Winners Bracket (Верхняя сетка)

```javascript
// Стандартная логика Single Elimination
// Каждые 2 матча текущего раунда → 1 матч следующего раунда
for (let j = 0; j < currentMatches.length; j++) {
    const nextMatchIndex = Math.floor(j / 2);
    if (nextMatches[nextMatchIndex]) {
        // Победитель идет в следующий раунд Winners Bracket
        await linkWinnerToNextMatch(currentMatches[j], nextMatches[nextMatchIndex]);
    }
}
```

### 2. Losers Bracket (Нижняя сетка)

Losers Bracket имеет **сложную структуру** с чередующимися раундами:

#### Нечетные раунды (1, 3, 5...)
- Принимают **только проигравших** из Winners Bracket
- Количество матчей = количество проигравших из определенного раунда Winners

#### Четные раунды (2, 4, 6...)
- Принимают **победителей** предыдущего раунда Losers Bracket
- Количество матчей = половина от предыдущего раунда

```javascript
static _calculateLosersRoundMatches(round, totalRounds) {
    const winnersRounds = Math.log2(Math.pow(2, Math.ceil(totalRounds / 2)));
    
    if (round % 2 === 1) {
        // Нечетные раунды: проигравшие из Winners Bracket
        const winnersRoundFeeding = Math.floor((round + 1) / 2) + 1;
        return Math.pow(2, winnersRounds - winnersRoundFeeding);
    } else {
        // Четные раунды: смешанный
        const winnersRoundFeeding = Math.floor(round / 2) + 1;
        return Math.pow(2, winnersRounds - winnersRoundFeeding);
    }
}
```

### 3. Связывание Winners → Losers

```javascript
static _calculateTargetLosersRound(winnersRound, bracketMath) {
    // Проигравшие из раунда 1 Winners → раунд 1 Losers
    // Проигравшие из раунда 2 Winners → раунд 3 Losers
    // Проигравшие из раунда 3 Winners → раунд 5 Losers
    
    if (winnersRound === 1) {
        return 1;
    } else {
        return (winnersRound - 1) * 2 + 1;
    }
}
```

### 4. Grand Final

Grand Final может состоять из **1 или 2 матчей**:

1. **Основной Grand Final**: Финалист Winners vs Финалист Losers
2. **Grand Final Reset**: Если побеждает финалист Losers, играется второй матч

```javascript
// Условие для Grand Final Reset
if (grandFinalWinner === losersFinalist) {
    // Играется второй матч, где участники "на равных"
    // Финалист Winners теряет преимущество в 1 жизнь
    scheduleGrandFinalReset();
}
```

## Пример структуры для 8 участников

### Winners Bracket
```
Раунд 1: 4 матча (8 участников → 4 победителя)
Раунд 2: 2 матча (4 участника → 2 победителя)  
Раунд 3: 1 матч  (2 участника → 1 финалист)
```

### Losers Bracket
```
Раунд 1: 2 матча (4 проигравших из Winners R1 → 2 победителя)
Раунд 2: 2 матча (2 из L1 + 2 из Winners R2 → 2 победителя)
Раунд 3: 1 матч  (2 из L2 → 1 победитель)
Раунд 4: 1 матч  (1 из L3 + 1 из Winners R3 → 1 финалист)
```

### Grand Final
```
Grand Final: Финалист Winners vs Финалист Losers
Grand Final Reset: (если необходимо)
```

## Реализация продвижения

### Обработка завершенного матча

```javascript
static async advanceParticipant(matchId, winnerId, loserId) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Получаем информацию о матче
        const match = await getMatchById(matchId);
        
        // Обновляем результат
        await updateMatchResult(matchId, winnerId);
        
        // Продвигаем победителя
        if (match.next_match_id) {
            await this._advanceWinner(client, winnerId, match.next_match_id);
        }
        
        // Продвигаем проигравшего в Losers Bracket
        if (match.loser_next_match_id) {
            await this._advanceLoser(client, loserId, match.loser_next_match_id);
        }
        
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}
```

### Размещение в следующем матче

```javascript
static async _advanceWinner(client, winnerId, nextMatchId) {
    const nextMatch = await getMatchById(nextMatchId);
    
    // Размещаем в свободной позиции
    if (!nextMatch.team1_id) {
        await updateMatch(nextMatchId, { team1_id: winnerId });
    } else if (!nextMatch.team2_id) {
        await updateMatch(nextMatchId, { team2_id: winnerId });
    } else {
        throw new Error('Следующий матч уже заполнен');
    }
}
```

## Преимущества Double Elimination

### 1. **Справедливость**
- Каждый участник получает второй шанс
- Исключение происходит только после 2-х поражений

### 2. **Качество финала**
- Два лучших участника с высокой вероятностью встретятся в финале
- Grand Final Reset обеспечивает равные условия

### 3. **Больше матчей**
- Участники играют больше игр
- Больше возможностей для зрителей

### 4. **Устойчивость к случайностям**
- Случайное поражение не исключает сильного участника
- Более точное определение рейтинга

## Недостатки

### 1. **Сложность**
- Трудно объяснить зрителям
- Сложная логика продвижения

### 2. **Время**
- Почти в 2 раза больше матчей чем Single Elimination
- Длительность турнира

### 3. **Неравные условия**
- Финалист Winners имеет преимущество в Grand Final
- Финалист Losers должен выиграть 2 матча подряд

## Пример полного турнира на 8 участников

```
Участники: A, B, C, D, E, F, G, H

=== WINNERS BRACKET ===
Раунд 1:
  Матч 1: A vs B → A побеждает (B → Losers)
  Матч 2: C vs D → C побеждает (D → Losers)  
  Матч 3: E vs F → E побеждает (F → Losers)
  Матч 4: G vs H → G побеждает (H → Losers)

Раунд 2:
  Матч 5: A vs C → A побеждает (C → Losers)
  Матч 6: E vs G → E побеждает (G → Losers)

Раунд 3 (Winners Final):
  Матч 7: A vs E → A побеждает (E → Losers)

=== LOSERS BRACKET ===
Раунд 1:
  Матч 8: B vs D → B побеждает
  Матч 9: F vs H → F побеждает

Раунд 2:
  Матч 10: B vs C → B побеждает
  Матч 11: F vs G → F побеждает

Раунд 3:
  Матч 12: B vs F → B побеждает

Раунд 4 (Losers Final):
  Матч 13: B vs E → B побеждает

=== GRAND FINAL ===
Grand Final: A vs B → B побеждает
Grand Final Reset: A vs B → A побеждает

ИТОГ: A - чемпион, B - 2 место
```

## Код для интеграции

```javascript
// Использование в контроллере
const { DoubleEliminationEngine } = require('./DoubleEliminationEngine');

// Генерация турнира
const result = await DoubleEliminationEngine.generateBracket(
    tournamentId, 
    participants, 
    {
        seedingType: 'ranking',
        seedingOptions: { ratingField: 'faceit_elo' }
    }
);

// Обработка результата матча
await DoubleEliminationEngine.advanceParticipant(
    matchId, 
    winnerId, 
    loserId
);
```

## Заключение

Double Elimination - это продвинутая турнирная система, которая обеспечивает справедливое определение победителя за счет предоставления второго шанса всем участникам. Несмотря на сложность реализации, она идеально подходит для серьезных соревнований, где важна точность результатов.

Наш алгоритм обеспечивает:
- ✅ Математически точные расчеты
- ✅ Профессиональную логику продвижения
- ✅ Поддержку bye-проходов
- ✅ Валидацию на каждом этапе
- ✅ Транзакционную безопасность

Алгоритм готов к использованию в продакшене и соответствует международным стандартам турнирных систем. 