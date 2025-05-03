# Инструкции по исправлению ошибок в файле TournamentDetails.js

В файле `src/components/TournamentDetails.js` были обнаружены следующие проблемы:

1. Ошибка "Identifier 'gameHasMaps' has already been declared" означает, что функция `gameHasMaps` объявлена дважды.
2. Также дублируются объявления функций `getGameMaps` и `getDefaultMap`.

## Шаг 1: Откройте файл TournamentDetails.js

Откройте файл `src/components/TournamentDetails.js` в любом текстовом редакторе.

## Шаг 2: Проверьте импорты в начале файла

Убедитесь, что в начале файла есть импорт функций из mapHelpers.js:

```javascript
// Импортируем вспомогательные функции для работы с картами
import { isCounterStrike2, gameHasMaps, getGameMaps as getGameMapsHelper, getDefaultMap as getDefaultMapHelper, getDefaultCS2Maps } from '../utils/mapHelpers';
```

## Шаг 3: Найдите и удалите дублирующееся объявление gameHasMaps

Примерно на строке 84 найдите следующий код:

```javascript
// Функция для проверки, поддерживает ли игра карты
const gameHasMaps = (game) => {
    if (isCounterStrike2(game)) {
        return true;
    }
    
    // Добавлять проверки для других игр по мере необходимости
    // if (isValorant(game)) return true;
    
    return false;
};
```

Удалите этот блок кода полностью, так как он дублирует функцию, которая уже импортирована из `mapHelpers.js`.

## Шаг 4: Проверьте наличие и удалите дублирующиеся объявления getGameMaps

Найдите все объявления функции `getGameMaps`. В файле должно быть только одно объявление:

```javascript
// Функция для получения карт для конкретной игры с использованием хелпера
const getGameMaps = useCallback((game) => {
    return getGameMapsHelper(game, availableMaps);
}, [availableMaps]);
```

Если таких объявлений несколько, оставьте только одно (первое), удалите все остальные.

## Шаг 5: Проверьте наличие и удалите дублирующиеся объявления getDefaultMap

Найдите все объявления функции `getDefaultMap`. В файле должно быть только одно объявление:

```javascript
// Функция для получения одной карты по умолчанию для данной игры
const getDefaultMap = useCallback((game) => {
    return getDefaultMapHelper(game, availableMaps);
}, [availableMaps]);
```

Если таких объявлений несколько, оставьте только одно (первое), удалите все остальные.

## Шаг 6: Сохраните файл и запустите компиляцию

После внесения изменений сохраните файл и запустите компиляцию проекта:

```bash
npm run build
```

## Дополнительная проверка

После успешной компиляции убедитесь, что функциональность проекта работает корректно.

## Примечание

Если после внесения изменений возникают новые ошибки, вы можете восстановить резервную копию файла из `src/components/TournamentDetails.js.bak` и повторить процесс более аккуратно.

## Расширенное решение

Если у вас продолжают возникать проблемы, рассмотрите возможность создания нового файла TournamentDetails.js с нуля, используя следующие шаги:

1. Создайте новый пустой файл TournamentDetails.js
2. Скопируйте содержимое из TournamentDetails.js.bak
3. Внесите указанные выше изменения
4. Запустите компиляцию для проверки 