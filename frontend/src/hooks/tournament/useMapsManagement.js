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
            const norm = gameName.toString().toLowerCase().replace(/[^a-z0-9]+/g, '');
            const key = ['counterstrike2','cs2','counterstrikeii'].includes(norm) ? 'cs2' : gameName;
            
            // Если карты для этой игры уже загружены в состоянии, не делаем повторный запрос
            if (availableMaps[key] && availableMaps[key].length > 0) {
                return;
            }

            // Проверяем debounce
            if (!shouldLoadMaps(key)) {
                return;
            }
            
            // Устанавливаем флаг, что мы начали загружать карты для этой игры
            setAvailableMaps(prev => ({
                ...prev,
                [key]: prev[key] || [],
                [`${key}_loading`]: true
            }));
            
            // Проверяем, есть ли карты в localStorage
            const cacheKey = `maps_cache_${key}`;
            const cachedMaps = localStorage.getItem(cacheKey);
            const cacheTimestampKey = `maps_cache_timestamp_${key}`;
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
                            console.log(`Используем кешированные карты для игры ${key}`);
                            setAvailableMaps(prev => ({
                                ...prev,
                                [key]: parsedMaps,
                                [`${key}_loading`]: false
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
            console.log(`Загружаем карты для игры ${key} с сервера...`);
            
            // Добавляем задержку между повторными запросами
            await new Promise(resolve => setTimeout(resolve, 300));
            
            try {
                const response = await api.get(`/api/maps?game=${encodeURIComponent(key)}`);
                
                if (response.data && Array.isArray(response.data)) {
                    // Сохраняем карты в кеш
                    localStorage.setItem(cacheKey, JSON.stringify(response.data));
                    localStorage.setItem(cacheTimestampKey, new Date().getTime().toString());
                    
                    // Обновляем состояние
                    setAvailableMaps(prev => ({
                        ...prev,
                        [key]: response.data,
                        [`${key}_loading`]: false
                    }));
                    console.log(`Загружены карты для игры ${key}:`, response.data);
                }
            } catch (apiError) {
                console.error(`Ошибка при загрузке карт для игры ${key}:`, apiError);
                
                // В случае ошибки, используем запасной вариант со стандартными картами для CS2
                if (isCounterStrike2(key)) {
                    console.log(`Используем стандартные карты для игры ${key}`);
                    
                    const defaultMaps = getDefaultCS2Maps();
                    
                    localStorage.setItem(`maps_cache_${key}`, JSON.stringify(defaultMaps));
                    localStorage.setItem(`maps_cache_timestamp_${key}`, new Date().getTime().toString());
                    
                    setAvailableMaps(prev => ({
                        ...prev,
                        [key]: defaultMaps,
                        [`${key}_loading`]: false
                    }));
                } else {
                    setAvailableMaps(prev => ({
                        ...prev,
                        [key]: [],
                        [`${key}_loading`]: false
                    }));
                }
            }
        } catch (error) {
            console.error(`Ошибка при получении карт для игры ${key}:`, error);
            
            setAvailableMaps(prev => ({
                ...prev,
                [key]: [],
                [`${key}_loading`]: false
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