import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../utils/api';
import { 
    isCounterStrike2, 
    gameHasMaps, 
    getGameMaps as getGameMapsHelper, 
    getDefaultMap as getDefaultMapHelper, 
    getDefaultCS2Maps 
} from '../../utils/mapHelpers';

/**
 * Custom hook для управления картами игр
 * Извлечен из TournamentDetails.js для модульности
 */
export const useMapsManagement = (tournament) => {
    const [availableMaps, setAvailableMaps] = useState({});
    const [maps, setMaps] = useState([{ map: 'de_dust2', score1: 0, score2: 0 }]);
    const [showMapSelection, setShowMapSelection] = useState(false);

    // Функция для проверки возможности делать запрос (debounce)
    const shouldLoadMaps = useCallback((gameName) => {
        const cacheKey = `maps_last_request_${gameName}`;
        const lastRequest = localStorage.getItem(cacheKey);
        const debounceInterval = 3000; // 3 секунды

        if (lastRequest) {
            const timeDiff = Date.now() - parseInt(lastRequest);
            if (timeDiff < debounceInterval) {
                console.log(`⏱️ Debounce: пропускаем загрузку карт для ${gameName}, последний запрос ${timeDiff}ms назад`);
                return false;
            }
        }

        localStorage.setItem(cacheKey, Date.now().toString());
        return true;
    }, []);

    // Функция для загрузки карт из БД
    const fetchMapsForGame = useCallback(async (gameName) => {
        try {
            if (!gameName) return;
            
            // Если карты для этой игры уже загружены в состоянии, не делаем повторный запрос
            if (availableMaps[gameName] && availableMaps[gameName].length > 0) {
                return;
            }

            // Проверяем debounce
            if (!shouldLoadMaps(gameName)) {
                return;
            }
            
            // Устанавливаем флаг, что мы начали загружать карты для этой игры
            setAvailableMaps(prev => ({
                ...prev,
                [gameName]: prev[gameName] || [],
                [`${gameName}_loading`]: true
            }));
            
            // Проверяем, есть ли карты в localStorage
            const cacheKey = `maps_cache_${gameName}`;
            const cachedMaps = localStorage.getItem(cacheKey);
            const cacheTimestampKey = `maps_cache_timestamp_${gameName}`;
            const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
            const cacheValidityPeriod = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
            
            // Если есть валидный кеш, используем его
            if (cachedMaps && cacheTimestamp) {
                const now = new Date().getTime();
                const timestamp = parseInt(cacheTimestamp, 10);
                
                if (!isNaN(timestamp) && (now - timestamp) < cacheValidityPeriod) {
                    try {
                        const parsedMaps = JSON.parse(cachedMaps);
                        if (Array.isArray(parsedMaps) && parsedMaps.length > 0) {
                            console.log(`Используем кешированные карты для игры ${gameName}`);
                            setAvailableMaps(prev => ({
                                ...prev,
                                [gameName]: parsedMaps,
                                [`${gameName}_loading`]: false
                            }));
                            return;
                        }
                    } catch (parseError) {
                        console.error('Ошибка при разборе кешированных карт:', parseError);
                        localStorage.removeItem(cacheKey);
                        localStorage.removeItem(cacheTimestampKey);
                    }
                } else {
                    // Кеш устарел, очищаем его
                    localStorage.removeItem(cacheKey);
                    localStorage.removeItem(cacheTimestampKey);
                }
            }
            
            // Если нет валидного кеша, делаем запрос к API
            console.log(`Загружаем карты для игры ${gameName} с сервера...`);
            
            // Добавляем задержку между повторными запросами
            await new Promise(resolve => setTimeout(resolve, 300));
            
            try {
                const response = await api.get(`/api/maps?game=${encodeURIComponent(gameName)}`);
                
                if (response.data && Array.isArray(response.data)) {
                    // Сохраняем карты в кеш
                    localStorage.setItem(cacheKey, JSON.stringify(response.data));
                    localStorage.setItem(cacheTimestampKey, new Date().getTime().toString());
                    
                    // Обновляем состояние
                    setAvailableMaps(prev => ({
                        ...prev,
                        [gameName]: response.data,
                        [`${gameName}_loading`]: false
                    }));
                    console.log(`Загружены карты для игры ${gameName}:`, response.data);
                }
            } catch (apiError) {
                console.error(`Ошибка при загрузке карт для игры ${gameName}:`, apiError);
                
                // В случае ошибки, используем запасной вариант со стандартными картами для CS2
                if (isCounterStrike2(gameName)) {
                    console.log(`Используем стандартные карты для игры ${gameName}`);
                    
                    const defaultMaps = getDefaultCS2Maps();
                    
                    localStorage.setItem(`maps_cache_${gameName}`, JSON.stringify(defaultMaps));
                    localStorage.setItem(`maps_cache_timestamp_${gameName}`, new Date().getTime().toString());
                    
                    setAvailableMaps(prev => ({
                        ...prev,
                        [gameName]: defaultMaps,
                        [`${gameName}_loading`]: false
                    }));
                } else {
                    setAvailableMaps(prev => ({
                        ...prev,
                        [gameName]: [],
                        [`${gameName}_loading`]: false
                    }));
                }
            }
        } catch (error) {
            console.error(`Ошибка при получении карт для игры ${gameName}:`, error);
            
            setAvailableMaps(prev => ({
                ...prev,
                [gameName]: [],
                [`${gameName}_loading`]: false
            }));
        }
    }, [availableMaps, shouldLoadMaps]);
    
    // Функция для получения карт для конкретной игры
    const getGameMaps = useCallback((game) => {
        return getGameMapsHelper(game, availableMaps);
    }, [availableMaps]);

    // Функция для получения одной карты по умолчанию для данной игры
    const getDefaultMap = useCallback((game) => {
        return getDefaultMapHelper(game, availableMaps);
    }, [availableMaps]);

    // Мемоизированные данные игры
    const memoizedGameData = useMemo(() => {
        return {
            tournamentGame: tournament?.game,
            gameSupportsMap: tournament?.game ? gameHasMaps(tournament.game) : false,
            availableMapsForGame: tournament?.game ? (availableMaps[tournament.game] || []) : [],
            isMapLoading: tournament?.game ? !!availableMaps[`${tournament.game}_loading`] : false
        };
    }, [tournament?.game, availableMaps]);
    
    // Загружаем карты для турнира
    useEffect(() => {
        const { tournamentGame, availableMapsForGame, isMapLoading } = memoizedGameData;
        
        if (tournamentGame && availableMapsForGame.length === 0 && !isMapLoading) {
            console.log(`Инициирую загрузку карт для ${tournamentGame}`);
            fetchMapsForGame(tournamentGame);
        }
    }, [memoizedGameData, fetchMapsForGame]);

    // Функции для работы с картами матча
    const addMap = useCallback(() => {
        const defaultMap = getDefaultMap(tournament?.game) || '';
        setMaps(prev => [...prev, { map: defaultMap, score1: 0, score2: 0 }]);
    }, [tournament?.game, getDefaultMap]);

    const removeMap = useCallback((index) => {
        setMaps(prev => {
            const newMaps = [...prev];
            newMaps.splice(index, 1);
            return newMaps;
        });
    }, []);

    const updateMapScore = useCallback((index, team, score) => {
        setMaps(prev => {
            const newMaps = [...prev];
            newMaps[index][`score${team}`] = score;
            return newMaps;
        });
    }, []);

    const updateMapSelection = useCallback((index, mapName) => {
        setMaps(prev => {
            const newMaps = [...prev];
            newMaps[index].map = mapName;
            return newMaps;
        });
    }, []);

    return {
        // Данные
        availableMaps,
        maps,
        showMapSelection,
        memoizedGameData,
        
        // Функции получения карт
        getGameMaps,
        getDefaultMap,
        fetchMapsForGame,
        
        // Функции управления картами матча
        addMap,
        removeMap,
        updateMapScore,
        updateMapSelection,
        
        // Установщики состояний
        setMaps,
        setShowMapSelection,
        setAvailableMaps
    };
}; 