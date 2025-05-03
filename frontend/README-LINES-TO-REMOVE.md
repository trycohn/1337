# Конкретные блоки кода для удаления из TournamentDetails.js

## Блок 1: Дублирующееся объявление функции gameHasMaps (строки 83-93)

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

## Блок 2: Дублирующиеся объявления функций getGameMaps и getDefaultMap (строки около 619-626)

```javascript
// Функция для получения карт для конкретной игры с использованием хелпера
const getGameMaps = useCallback((game) => {
    return getGameMapsHelper(game, availableMaps);
}, [availableMaps]);
    
// Функция для получения одной карты по умолчанию для данной игры
const getDefaultMap = useCallback((game) => {
    return getDefaultMapHelper(game, availableMaps);
}, [availableMaps]);
```

## Заменить на:

После удаления этих блоков проверьте компиляцию. Если возникнут ошибки, может потребоваться аккуратное редактирование переходов между участками кода.

## Примечание о резервной копии

Резервная копия оригинального файла создана в `src/components/TournamentDetails.js.bak`. Если в процессе редактирования возникнут проблемы, восстановите файл из бэкапа и повторите процесс редактирования с большей точностью. 