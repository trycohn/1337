/**
 * useTournamentData - Custom Hook для управления данными турнира
 * 
 * @version 1.1.0 
 * @created 2025-01-22
 * @updated 2025-01-22 (VDS deployment update)
 * 
 * Часть модульной архитектуры TournamentDetails v2.0
 * Извлечен из монолитного компонента для улучшения:
 * - Переиспользования логики
 * - Тестируемости 
 * - Разделения ответственности
 * - Performance оптимизации
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

/**
 * Custom hook для управления данными турнира
 * Извлечен из TournamentDetails.js для модульности
 */
export const useTournamentData = (tournamentId) => {
    // Состояния
    const [tournament, setTournament] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [creator, setCreator] = useState(null);

    // Функция для принудительной загрузки турнира с очисткой кеша
    const fetchTournamentDataForcefully = useCallback(async (clearCache = false) => {
        if (!tournamentId) return;

        try {
            setLoading(true);
            setError(null);

            // Очищаем кеш если запрошено
            if (clearCache) {
                const cacheKeys = ['tournament_', 'user_', 'teams_', 'matches_'];
                cacheKeys.forEach(prefix => {
                    Object.keys(localStorage).forEach(key => {
                        if (key.startsWith(prefix)) {
                            localStorage.removeItem(key);
                        }
                    });
                });
                console.log('🧹 Кеш турнира очищен для принудительного обновления');
            }

            console.log(`🔍 Загружаем данные турнира ID: ${tournamentId}`);
            
            const response = await api.get(`/api/tournaments/${tournamentId}`);
            
            if (response.data) {
                console.log('✅ Данные турнира успешно загружены:', response.data.name);
                setTournament(response.data);
                setMatches(response.data.matches || []);
                
                // Загружаем информацию о создателе если есть
                if (response.data.created_by) {
                    await fetchCreatorInfo(response.data.created_by);
                }
            }
        } catch (error) {
            console.error('❌ Ошибка при загрузке турнира:', error);
            setError(error.response?.data?.error || 'Не удалось загрузить турнир');
        } finally {
            setLoading(false);
        }
    }, [tournamentId]);

    // Обычная загрузка турнира (с кешем)
    const fetchTournamentData = useCallback(async () => {
        return fetchTournamentDataForcefully(false);
    }, [fetchTournamentDataForcefully]);

    // Функция для загрузки информации о создателе турнира
    const fetchCreatorInfo = useCallback(async (creatorId) => {
        if (!creatorId) return;
        
        try {
            console.log(`Загружаем информацию о создателе турнира (ID: ${creatorId})`);
            
            // Проверяем кеш
            const cacheKey = `user_${creatorId}`;
            const cachedCreator = localStorage.getItem(cacheKey);
            const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
            const cacheValidityPeriod = 10 * 60 * 1000; // 10 минут
            
            if (cachedCreator && cacheTimestamp) {
                const now = new Date().getTime();
                const timestamp = parseInt(cacheTimestamp, 10);
                
                if (!isNaN(timestamp) && (now - timestamp) < cacheValidityPeriod) {
                    try {
                        const parsedCreator = JSON.parse(cachedCreator);
                        console.log('✅ Используем кешированные данные создателя');
                        setCreator(parsedCreator);
                        return;
                    } catch (parseError) {
                        console.error('Ошибка при разборе кешированных данных создателя:', parseError);
                    }
                }
            }
            
            // Загружаем с сервера
            const response = await api.get(`/api/users/profile/${creatorId}`);
            
            if (response.data) {
                console.log('✅ Информация о создателе загружена:', response.data.username);
                setCreator(response.data);
                
                // Кешируем результат
                localStorage.setItem(cacheKey, JSON.stringify(response.data));
                localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
            }
        } catch (error) {
            console.error('❌ Ошибка при загрузке данных создателя:', error);
            
            // Fallback - ищем в участниках турнира
            if (tournament && tournament.participants) {
                const creatorFromParticipants = tournament.participants.find(
                    participant => participant.user_id === creatorId || participant.id === creatorId
                );
                
                if (creatorFromParticipants) {
                    const creatorInfo = {
                        id: creatorId,
                        username: creatorFromParticipants.name || `Участник #${creatorId}`,
                        avatar_url: creatorFromParticipants.avatar_url || null,
                        fromParticipants: true
                    };
                    setCreator(creatorInfo);
                }
            }
        }
    }, [tournament]);

    // Функция обновления турнира
    const updateTournament = useCallback((updatedData) => {
        setTournament(prev => ({ ...prev, ...updatedData }));
    }, []);

    // Функция обновления матчей  
    const updateMatches = useCallback((updatedMatches) => {
        setMatches(updatedMatches);
    }, []);

    // Загружаем данные при инициализации
    useEffect(() => {
        if (tournamentId) {
            fetchTournamentData();
        }
    }, [tournamentId, fetchTournamentData]);

    return {
        // Данные
        tournament,
        matches,
        creator,
        loading,
        error,
        
        // Функции
        fetchTournamentData,
        fetchTournamentDataForcefully,
        fetchCreatorInfo,
        updateTournament,
        updateMatches,
        
        // Установщики состояний
        setTournament,
        setMatches,
        setCreator,
        setLoading,
        setError
    };
}; 