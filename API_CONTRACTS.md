# 📋 API CONTRACTS - Документация по структурам ответов

## 🎯 Цель документа

Этот документ описывает структуры ответов API для турнирной системы, чтобы предотвратить ошибки при работе с данными на frontend.

## 🔧 Исправленная критическая ошибка

**Проблема**: В CreateTournament.js использовался `response.data.id` вместо `response.data.tournament.id`, что приводило к ошибке `GET /api/tournaments/undefined`.

**Решение**: Создана система валидации API контрактов и безопасных утилит для работы с ответами.

## 📝 Структуры ответов API

### 1. Создание турнира (POST /api/tournaments)
```javascript
{
  "message": "Турнир успешно создан",
  "tournament": {
    "id": 123,
    "name": "Название турнира",
    "status": "active",
    // ... другие поля турнира
  }
}
```
**Frontend**: `response.data.tournament.id`

### 2. Получение списка турниров (GET /api/tournaments)
```javascript
[
  {
    "id": 1,
    "name": "Турнир 1",
    "status": "active"
  },
  {
    "id": 2,
    "name": "Турнир 2",
    "status": "completed"
  }
]
```
**Frontend**: `response.data[0].id`

### 3. Получение турнира (GET /api/tournaments/:id)
```javascript
{
  "id": 123,
  "name": "Название турнира",
  "participants": [...],
  "matches": [...],
  "teams": [...]
}
```
**Frontend**: `response.data.id`

### 4. Обновление турнира (PUT /api/tournaments/:id)
```javascript
{
  "message": "Турнир успешно обновлен",
  "tournament": {
    "id": 123,
    "name": "Обновленное название",
    // ... обновленные поля
  }
}
```
**Frontend**: `response.data.tournament.id`

## 🛠️ Безопасные утилиты

### extractTournamentId()
```javascript
import { extractTournamentId } from '../utils/apiUtils';

const tournamentId = extractTournamentId(response, 'CREATE_TOURNAMENT');
// Безопасно извлекает ID или возвращает null
```

### safeNavigateToTournament()
```javascript
import { safeNavigateToTournament } from '../utils/apiUtils';

const success = safeNavigateToTournament(navigate, response, 'CREATE_TOURNAMENT');
// Безопасно навигирует к турниру или обрабатывает ошибку
```

### validateApiResponse()
```javascript
import { validateApiResponse } from '../utils/apiUtils';

const validation = validateApiResponse(response, 'CREATE_TOURNAMENT');
if (!validation.isValid) {
  console.error('Ошибки валидации:', validation.errors);
}
```

## ⚠️ Частые ошибки и как их избежать

### ❌ Неправильно:
```javascript
// Это приводит к undefined для создания турнира
const tournamentId = response.data.id;
navigate(`/tournaments/${tournamentId}`); // /tournaments/undefined
```

### ✅ Правильно:
```javascript
// Используем безопасные утилиты
const success = safeNavigateToTournament(navigate, response, 'CREATE_TOURNAMENT');
```

## 🔍 Проверка в DevTools

1. **Проверяйте структуру ответа**:
   ```javascript
   console.log('Структура ответа:', response.data);
   ```

2. **Валидируйте перед использованием**:
   ```javascript
   if (response.data.tournament?.id) {
     // Безопасно используем ID
   }
   ```

## 📊 Типы операций и их контракты

| Операция | Endpoint | Структура ответа | Путь к ID |
|----------|----------|------------------|-----------|
| Создание | POST /api/tournaments | `{message, tournament}` | `tournament.id` |
| Список | GET /api/tournaments | `[{id, name, ...}]` | `[i].id` |
| Детали | GET /api/tournaments/:id | `{id, name, ...}` | `id` |
| Обновление | PUT /api/tournaments/:id | `{message, tournament}` | `tournament.id` |

## 🚨 Критические места для проверки

1. **Навигация после создания** - всегда использовать `safeNavigateToTournament()`
2. **Обработка массивов** - проверять `Array.isArray(response.data)`
3. **Извлечение ID** - использовать `extractTournamentId()`
4. **Валидация ответов** - использовать `validateApiResponse()`

## 🔧 Инструкция по развертыванию исправлений

1. Проверить все места использования `response.data` на наличие подобных проблем
2. Добавить валидацию API контрактов
3. Использовать безопасные утилиты для критических операций
4. Тестировать навигацию после создания/обновления данных

## 📞 Обратная связь

При обнаружении несоответствий API контрактов:
1. Зафиксировать в логах детали ошибки
2. Обновить структуру в `API_RESPONSE_STRUCTURES`
3. Добавить тесты для нового контракта
4. Обновить документацию 