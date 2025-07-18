# 🎯 МОДУЛЬНАЯ СИСТЕМА ОТРИСОВКИ ТУРНИРНЫХ СЕТОК V2.0

## 📋 Обзор

Новая масштабируемая система для визуализации турнирных сеток различных форматов с поддержкой анимированных соединений и специальных типов матчей.

## 🏗️ Архитектура

### Основные компоненты

1. **FormatManager** (`bracketFormats.js`)
   - Централизованное управление форматами турниров
   - Регистрация и получение плагинов форматов
   - Базовый класс `TournamentFormat`

2. **BracketRenderer** (`BracketRenderer.js`)
   - Универсальный компонент отрисовки
   - Автоматический выбор формата на основе `tournament.bracket_type`
   - Поддержка абсолютного позиционирования

3. **BracketConnections** (`BracketConnections.js`)
   - SVG слой для визуальных соединений
   - Анимированные пути между матчами
   - Поддержка различных типов соединений

## 🔌 Система плагинов

### Базовый класс TournamentFormat

```javascript
export class TournamentFormat {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  // Группировка матчей по раундам
  groupMatches(matches) { }
  
  // Получение названия раунда
  getRoundName(round, context) { }
  
  // Расчет позиций матчей
  calculatePositions(groupedMatches) { }
  
  // Расчет соединений между матчами
  calculateConnections(matches, positions) { }
  
  // Кастомизация отображения
  getMatchLabel(match, context) { }
  getVisualizationConfig() { }
}
```

## 📦 Поддерживаемые форматы

### 1. Single Elimination
- Классический формат с одиночным выбыванием
- Поддержка предварительных раундов
- Матч за 3-е место
- Автоматическое именование раундов

### 2. Double Elimination
- Двойное выбывание с Winners и Losers Bracket
- Grand Final с возможным reset матчем
- Переходы проигравших в Losers Bracket
- Раздельные заголовки для каждого bracket

## 🎨 Визуальные особенности

### Single Elimination
- Золотая рамка для финала (#ffcc00)
- Бронзовая рамка для матча за 3-е место (#cd7f32)
- Плавные кривые соединения между раундами
- Специальные индикаторы для особых матчей

### Double Elimination
- Зеленые заголовки для Winners Bracket (#00ff00)
- Красные заголовки для Losers Bracket (#ff6b6b)
- Золотые заголовки для Grand Final (#ffcc00)
- Пунктирные линии для переходов в Losers
- Анимированные соединения между bracket'ами

## 🔧 Интеграция нового формата

### Шаг 1: Создание класса формата

```javascript
import { TournamentFormat } from '../bracketFormats';

export class MyCustomFormat extends TournamentFormat {
  constructor() {
    super('my_custom_format', {
      // Конфигурация формата
    });
  }
  
  groupMatches(matches) {
    // Логика группировки матчей
  }
  
  calculatePositions(groupedMatches) {
    // Расчет позиций
  }
  
  // ... остальные методы
}
```

### Шаг 2: Регистрация формата

```javascript
// В utils/tournament/index.js
import { MyCustomFormat } from './formats/MyCustomFormat';
formatManager.register(new MyCustomFormat());
```

### Шаг 3: Использование в backend

```javascript
// В BracketGenerationService
case 'my_custom_format':
  return await MyCustomEngine.generateBracket(
    tournament.id,
    participants,
    seedingOptions
  );
```

## 📊 Структура данных

### Формат матча
```javascript
{
  id: number,
  round: number,
  match_number: number,
  bracket_type: 'winner' | 'loser' | 'grand_final' | 'placement',
  team1_id: number,
  team2_id: number,
  next_match_id: number,
  loser_next_match_id: number,  // Для Double Elimination
  status: string,
  score1: number,
  score2: number
}
```

### Позиция матча
```javascript
{
  x: number,
  y: number,
  width: number,
  height: number,
  matchType: string,
  bracketType: string
}
```

### Соединение
```javascript
{
  from: { matchId, x, y },
  to: { matchId, x, y },
  type: 'winner' | 'loser' | 'third-place' | 'to-losers',
  curved: boolean,
  style: 'solid' | 'dashed'
}
```

## 🎯 Преимущества системы

1. **Масштабируемость**: Легко добавлять новые форматы
2. **Модульность**: Каждый формат изолирован
3. **Переиспользование**: Общие компоненты для всех форматов
4. **Производительность**: Оптимизированный рендеринг через React
5. **Анимации**: Плавные переходы и интерактивность

## 🚀 Будущие форматы

- **Swiss System**: Швейцарская система
- **Round Robin**: Круговая система
- **GSL Groups**: Групповой этап в стиле GSL
- **Custom Brackets**: Пользовательские форматы

## 🛠️ Разработка

### Тестирование нового формата
```bash
# Frontend
npm test -- --testNamePattern="MyCustomFormat"

# Backend
npm test -- --testPathPattern="MyCustomEngine"
```

### Debug режим
```javascript
// В BracketRenderer
const DEBUG_MODE = process.env.NODE_ENV === 'development';
if (DEBUG_MODE) {
  console.log('Grouped matches:', groupedMatches);
  console.log('Positions:', matchPositions);
  console.log('Connections:', connections);
}
```

## 📝 Примеры использования

### Базовый пример
```jsx
<BracketRenderer
  games={matches}
  tournament={tournament}
  onEditMatch={handleEditMatch}
  canEditMatches={isAdmin}
  onMatchClick={handleMatchClick}
/>
```

### С кастомной конфигурацией
```jsx
const customFormat = formatManager.getFormat('my_custom_format');
customFormat.config.matchSpacing = 150;
customFormat.config.roundSpacing = 350;
```

---

**Версия**: 2.0  
**Дата**: Январь 2025  
**Автор**: 1337 Community Development Team 