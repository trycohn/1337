// Утилиты для работы с картами в турнирах

/**
 * Проверяет, является ли указанная игра Counter-Strike 2
 * @param {string} game - название игры
 * @returns {boolean} - true, если игра CS2, иначе false
 */
export const isCounterStrike2 = (game) => {
    if (!game) return false;
    const gameLower = typeof game === 'string' ? game.toLowerCase() : '';
    return gameLower.includes('counter') && gameLower.includes('strike') && (gameLower.includes('2') || gameLower.includes('cs2'));
};

/**
 * Проверяет, поддерживает ли игра выбор карт
 * @param {string} game - название игры
 * @returns {boolean} - true, если игра поддерживает выбор карт
 */
export const gameHasMaps = (game) => {
    if (!game) {
        console.log('gameHasMaps: игра не указана');
        return false;
    }
    const gameLower = typeof game === 'string' ? game.toLowerCase() : '';
    
    console.log('gameHasMaps: проверяем игру:', game, '-> в нижнем регистре:', gameLower);
    
    // Список игр, которые поддерживают выбор карт
    const conditions = {
        counterStrike: gameLower.includes('counter') && gameLower.includes('strike'),
        cs2: gameLower.includes('cs2'),
        valorant: gameLower.includes('valorant'),
        overwatch: gameLower.includes('overwatch'),
        dota: gameLower.includes('dota'),
        lol: gameLower.includes('lol'),
        leagueOfLegends: gameLower.includes('league of legends')
    };
    
    console.log('gameHasMaps: условия проверки:', conditions);
    
    const result = (
        conditions.counterStrike ||
        conditions.cs2 ||
        conditions.valorant ||
        conditions.overwatch ||
        conditions.dota ||
        conditions.lol ||
        conditions.leagueOfLegends
    );
    
    console.log('gameHasMaps: результат для', game, ':', result);
    return result;
};

/**
 * Возвращает список карт для указанной игры
 * @param {string} game - название игры
 * @param {Object} availableMaps - объект с доступными картами по играм
 * @returns {Array} - массив карт для выбранной игры
 */
export const getGameMaps = (game, availableMaps = {}) => {
    if (!game) return [];
    
    // Проверяем, есть ли карты в кэше
    if (availableMaps && availableMaps[game] && availableMaps[game].length > 0) {
        return availableMaps[game];
    }
    
    // Запасные варианты карт для разных игр
    if (isCounterStrike2(game)) {
        return getDefaultCS2Maps();
    }
    
    // Для других игр возвращаем пустой массив - будет загружено с сервера
    return [];
};

/**
 * Возвращает список стандартных карт CS2
 * @returns {Array} - массив стандартных карт CS2 (строки)
 */
export const getDefaultCS2Maps = () => {
    // 🔧 ИСПРАВЛЕНО: возвращаем массив строк для совместимости с MatchResultModal
    return [
        'Dust II',
        'Mirage', 
        'Inferno',
        'Nuke',
        'Overpass',
        'Ancient',
        'Vertigo',
        'Anubis'
    ];
};

/**
 * Возвращает список стандартных карт CS2 с дополнительной информацией
 * @returns {Array} - массив объектов карт CS2
 */
export const getDefaultCS2MapsDetailed = () => {
    return [
        { name: 'de_dust2', displayName: 'Dust II' },
        { name: 'de_mirage', displayName: 'Mirage' },
        { name: 'de_inferno', displayName: 'Inferno' },
        { name: 'de_nuke', displayName: 'Nuke' },
        { name: 'de_overpass', displayName: 'Overpass' },
        { name: 'de_ancient', displayName: 'Ancient' },
        { name: 'de_vertigo', displayName: 'Vertigo' },
        { name: 'de_anubis', displayName: 'Anubis' }
    ];
};

/**
 * Возвращает карту по умолчанию для игры
 * @param {string} game - название игры
 * @param {Object} availableMaps - объект с доступными картами
 * @returns {string} - название карты по умолчанию
 */
export const getDefaultMap = (game, availableMaps = {}) => {
    if (!game) return 'Dust II'; // Значение по умолчанию
    
    const maps = getGameMaps(game, availableMaps);
    if (maps && maps.length > 0) {
        // 🔧 ИСПРАВЛЕНО: теперь maps - это массив строк
        return maps[0];
    }
    
    // Если никаких карт не найдено, используем стандартные для известных игр
    if (isCounterStrike2(game)) {
        return 'Dust II';
    }
    
    return '';
}; 