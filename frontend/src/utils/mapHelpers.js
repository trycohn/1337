// Функция для проверки, является ли игра Counter-Strike 2
export const isCounterStrike2 = (game) => {
    // Проверяем разные варианты написания названия
    if (!game) return false;
    const gameName = String(game).toLowerCase();
    return (
        gameName === 'counter-strike 2' || 
        gameName === 'counter strike 2' || 
        gameName === 'cs2' || 
        game === 21 || game === '21'
    );
};

// Функция для проверки, поддерживает ли игра карты
export const gameHasMaps = (game) => {
    if (isCounterStrike2(game)) {
        return true;
    }
    
    // Добавлять проверки для других игр по мере необходимости
    // if (isValorant(game)) return true;
    
    return false;
};

// Функция для получения карт для конкретной игры из кеша
export const getGameMaps = (game, availableMaps) => {
    // Пробуем определить игру
    let gameName = '';
    
    if (isCounterStrike2(game)) {
        gameName = 'Counter-Strike 2';
    }
    // Добавить другие игры при необходимости
    
    // Если у нас есть карты для этой игры, возвращаем их
    if (gameName && availableMaps[gameName] && availableMaps[gameName].length > 0) {
        return availableMaps[gameName];
    }
    
    // Возвращаем пустой массив, если карты не найдены
    return [];
};

// Функция для получения одной карты по умолчанию для данной игры
export const getDefaultMap = (game, availableMaps) => {
    const maps = getGameMaps(game, availableMaps);
    return maps.length > 0 ? maps[0].name : '';
};

// Функция для получения стандартных карт для Counter-Strike 2
export const getDefaultCS2Maps = () => {
    return [
        { id: 1, name: 'de_dust2', game: 'Counter-Strike 2', display_name: 'Dust II' },
        { id: 2, name: 'de_mirage', game: 'Counter-Strike 2', display_name: 'Mirage' },
        { id: 3, name: 'de_nuke', game: 'Counter-Strike 2', display_name: 'Nuke' },
        { id: 4, name: 'de_train', game: 'Counter-Strike 2', display_name: 'Train' },
        { id: 5, name: 'de_anubis', game: 'Counter-Strike 2', display_name: 'Anubis' },
        { id: 6, name: 'de_ancient', game: 'Counter-Strike 2', display_name: 'Ancient' },
        { id: 7, name: 'de_inferno', game: 'Counter-Strike 2', display_name: 'Inferno' },
        { id: 8, name: 'de_vertigo', game: 'Counter-Strike 2', display_name: 'Vertigo' },
        { id: 9, name: 'de_overpass', game: 'Counter-Strike 2', display_name: 'Overpass' }
    ];
}; 