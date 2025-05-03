// Утилиты для работы с картами в турнирах

/**
 * Проверяет, является ли игра Counter-Strike 2
 * @param {string} game - Название игры
 * @returns {boolean} - true если это CS2, иначе false
 */
export const isCounterStrike2 = (game) => {
    if (!game) return false;
    const gameLower = game.toLowerCase();
    return gameLower === 'counter-strike 2' || 
           gameLower === 'cs2' || 
           gameLower === 'counter strike 2' || 
           gameLower === 'counter-strike2';
};

/**
 * Проверяет, поддерживает ли игра карты
 * @param {string} game - Название игры
 * @returns {boolean} - true если игра поддерживает карты, иначе false
 */
export const gameHasMaps = (game) => {
    if (isCounterStrike2(game)) {
        return true;
    }
    
    // Добавлять проверки для других игр по мере необходимости
    // if (isValorant(game)) return true;
    
    return false;
};

/**
 * Возвращает список карт для указанной игры
 * @param {string} game - Название игры
 * @param {Object} availableMaps - Объект с доступными картами по играм
 * @returns {Array} - Массив карт для игры
 */
export const getGameMaps = (game, availableMaps = {}) => {
    if (!game) return [];
    
    // Если у нас есть кэшированные карты для этой игры, используем их
    if (availableMaps[game] && Array.isArray(availableMaps[game]) && availableMaps[game].length > 0) {
        return availableMaps[game];
    }
    
    // Запасной вариант для CS2
    if (isCounterStrike2(game)) {
        return getDefaultCS2Maps();
    }
    
    return [];
};

/**
 * Возвращает карту по умолчанию для указанной игры
 * @param {string} game - Название игры
 * @param {Object} availableMaps - Объект с доступными картами по играм
 * @returns {string} - Название карты по умолчанию
 */
export const getDefaultMap = (game, availableMaps = {}) => {
    if (!game) return '';
    
    const maps = getGameMaps(game, availableMaps);
    if (maps.length > 0) {
        // Если это объект с name, возвращаем name
        if (typeof maps[0] === 'object' && maps[0].name) {
            return maps[0].name;
        }
        // Если это строка, возвращаем её
        if (typeof maps[0] === 'string') {
            return maps[0];
        }
    }
    
    // Запасной вариант для CS2
    if (isCounterStrike2(game)) {
        return 'de_dust2';
    }
    
    return '';
};

/**
 * Возвращает стандартный набор карт для CS2
 * @returns {Array} - Массив стандартных карт CS2
 */
export const getDefaultCS2Maps = () => {
    return [
        { name: 'de_dust2', displayName: 'Dust II' },
        { name: 'de_mirage', displayName: 'Mirage' },
        { name: 'de_inferno', displayName: 'Inferno' },
        { name: 'de_nuke', displayName: 'Nuke' },
        { name: 'de_vertigo', displayName: 'Vertigo' },
        { name: 'de_overpass', displayName: 'Overpass' },
        { name: 'de_ancient', displayName: 'Ancient' }
    ];
}; 