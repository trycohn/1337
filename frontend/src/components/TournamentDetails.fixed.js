/**
 * РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ ФАЙЛА TournamentDetails.js
 * 
 * В файле TournamentDetails.js обнаружены дублирующиеся объявления следующих переменных:
 * 
 * 1. getGameMaps (строки 483 и 663)
 * 2. getDefaultMap (строки 503 и 682)
 * 3. addMap (строки 241 и 687)
 * 4. removeMap (строки 246 и 692)
 * 5. updateMapScore (строки 252 и 698)
 * 6. updateMapSelection (строки 258 и 704)
 * 7. toast (строки 171 и 710)
 * 8. fetchTournamentData (строки 265 и 714)
 * 
 * Для исправления проблемы, сделайте следующее:
 * 
 * 1. В начале файла добавьте импорт вспомогательных функций для работы с картами:
 *    import { isCounterStrike2, gameHasMaps, getGameMaps as getGameMapsHelper, getDefaultMap as getDefaultMapHelper, getDefaultCS2Maps } from '../utils/mapHelpers';
 * 
 * 2. Удалите дублирующиеся объявления isCounterStrike2 и gameHasMaps в коде компонента (примерно строки 89-106)
 * 
 * 3. Замените обе функции getGameMaps (примерно строки 483-501 и 663-681) на следующую реализацию:
 *    // Функция для получения карт для конкретной игры с использованием хелпера
 *    const getGameMaps = useCallback((game) => {
 *        return getGameMapsHelper(game, availableMaps);
 *    }, [availableMaps]);
 * 
 * 4. Замените обе функции getDefaultMap (примерно строки 503-506 и 682-685) на:
 *    // Функция для получения одной карты по умолчанию для данной игры
 *    const getDefaultMap = useCallback((game) => {
 *        return getDefaultMapHelper(game, availableMaps);
 *    }, [getGameMaps, availableMaps]);
 * 
 * 5. Удалите одно из объявлений функций addMap, removeMap, updateMapScore, updateMapSelection
 *    (строки 687-707), оставив только первые определения (строки 241-261)
 * 
 * 6. Удалите второе объявление toast (строка 710) и второе объявление fetchTournamentData (строка 714)
 * 
 * 7. Замените использование defaultMaps в функции fetchMapsForGame (примерно строка 350) на:
 *    const defaultMaps = getDefaultCS2Maps();
 * 
 * После этих изменений ошибки компиляции должны быть устранены, и код должен работать корректно.
 */ 