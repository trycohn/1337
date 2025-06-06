import { useState, useCallback, useContext } from 'react';
import axios from '../../axios';
import AuthContext from '../../context/AuthContext';

const useTournamentManagement = (tournamentId) => {
    const { user } = useContext(AuthContext);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Получение токена авторизации
    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, []);

    // Очистка ошибок
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Добавление незарегистрированного участника (гостя)
    const addGuestParticipant = useCallback(async (participantData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post(`/api/tournaments/${tournamentId}/add-participant`, {
                participantName: participantData.display_name,
                userId: null // Для незарегистрированных участников
            }, {
                headers: getAuthHeaders()
            });

            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Ошибка при добавлении участника';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, getAuthHeaders]);

    // Поиск пользователей
    const searchUsers = useCallback(async (query) => {
        console.log('🔍 [useTournamentManagement] НАЧАЛО ПОИСКА');
        console.log('🔍 [useTournamentManagement] Запрос:', query);
        
        if (!query || query.trim().length < 2) {
            console.log('🔍 [useTournamentManagement] Запрос слишком короткий');
            return { success: true, data: [] };
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log('🔍 [useTournamentManagement] Отправляем запрос к API...');
            const headers = getAuthHeaders();
            console.log('🔍 [useTournamentManagement] Заголовки авторизации:', headers);
            
            const response = await axios.get(`/api/users/search`, {
                params: { query: query.trim() },
                headers: headers
            });

            console.log('🔍 [useTournamentManagement] Ответ API получен:', response.data);
            console.log('🔍 [useTournamentManagement] Количество найденных пользователей:', response.data.length);

            return { success: true, data: response.data };
        } catch (error) {
            console.error('🔍 [useTournamentManagement] Ошибка API:', error);
            console.error('🔍 [useTournamentManagement] Статус ошибки:', error.response?.status);
            console.error('🔍 [useTournamentManagement] Данные ошибки:', error.response?.data);
            console.error('🔍 [useTournamentManagement] Заголовки запроса:', error.config?.headers);
            
            const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Ошибка при поиске пользователей';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
            console.log('🔍 [useTournamentManagement] КОНЕЦ ПОИСКА');
        }
    }, [getAuthHeaders]);

    // Добавление зарегистрированного участника
    const addRegisteredParticipant = useCallback(async (userId, userName) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post(`/api/tournaments/${tournamentId}/add-participant`, {
                participantName: userName || `User ${userId}`,
                userId: userId
            }, {
                headers: getAuthHeaders()
            });

            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Ошибка при добавлении участника';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, getAuthHeaders]);

    // Удаление участника
    const removeParticipant = useCallback(async (participantId) => {
        setIsLoading(true);
        setError(null);

        try {
            await axios.delete(`/api/tournaments/${tournamentId}/participants/${participantId}`, {
                headers: getAuthHeaders()
            });
            return { success: true };
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Ошибка при удалении участника';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, getAuthHeaders]);

    // Запуск турнира
    const startTournament = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post(`/api/tournaments/${tournamentId}/start`, {}, {
                headers: getAuthHeaders()
            });
            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Ошибка при запуске турнира';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, getAuthHeaders]);

    // Завершение турнира
    const endTournament = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post(`/api/tournaments/${tournamentId}/end`, {}, {
                headers: getAuthHeaders()
            });
            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Ошибка при завершении турнира';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, getAuthHeaders]);

    // Перегенерация сетки
    const regenerateBracket = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post(`/api/tournaments/${tournamentId}/regenerate-bracket`, {}, {
                headers: getAuthHeaders()
            });
            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Ошибка при перегенерации сетки';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, getAuthHeaders]);

    // Сохранение результата матча
    const saveMatchResult = useCallback(async (matchId, resultData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.put(`/api/tournaments/${tournamentId}/matches/${matchId}/result`, {
                score1: resultData.score1,
                score2: resultData.score2,
                maps_data: resultData.maps_data || null
            }, {
                headers: getAuthHeaders()
            });

            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Ошибка при сохранении результата';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, getAuthHeaders]);

    // Проверка прав доступа
    const checkAccess = useCallback((tournament) => {
        if (!user || !tournament) return false;
        
        // Проверяем, является ли пользователь создателем турнира
        const isCreator = tournament.created_by === user.id;
        
        // Проверяем, является ли пользователь администратором
        const isAdmin = user.role === 'admin';
        
        return isCreator || isAdmin;
    }, [user]);

    return {
        // Состояние
        isLoading,
        error,
        
        // Методы управления
        addGuestParticipant,
        searchUsers,
        addRegisteredParticipant,
        removeParticipant,
        startTournament,
        endTournament,
        regenerateBracket,
        saveMatchResult,
        
        // Утилиты
        checkAccess,
        clearError
    };
};

export default useTournamentManagement; 