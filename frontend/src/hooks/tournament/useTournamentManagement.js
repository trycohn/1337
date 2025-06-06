import { useState, useCallback, useContext } from 'react';
import axios from '../../axios';
import AuthContext from '../../context/AuthContext';

const useTournamentManagement = (tournamentId) => {
    const { user } = useContext(AuthContext);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Очистка ошибок
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Добавление незарегистрированного участника (гостя)
    const addGuestParticipant = useCallback(async (participantData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post(`/tournaments/${tournamentId}/participants/guest`, {
                display_name: participantData.display_name,
                steam_id: participantData.steam_id || null,
                rating: participantData.rating || 0
            });

            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Ошибка при добавлении участника';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId]);

    // Поиск пользователей
    const searchUsers = useCallback(async (query) => {
        if (!query || query.trim().length < 2) {
            return { success: true, data: [] };
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.get(`/users/search`, {
                params: { query: query.trim() }
            });

            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Ошибка при поиске пользователей';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Добавление зарегистрированного участника
    const addRegisteredParticipant = useCallback(async (userId) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post(`/tournaments/${tournamentId}/participants`, {
                user_id: userId
            });

            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Ошибка при добавлении участника';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId]);

    // Удаление участника
    const removeParticipant = useCallback(async (participantId) => {
        setIsLoading(true);
        setError(null);

        try {
            await axios.delete(`/tournaments/${tournamentId}/participants/${participantId}`);
            return { success: true };
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Ошибка при удалении участника';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId]);

    // Запуск турнира
    const startTournament = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post(`/tournaments/${tournamentId}/start`);
            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Ошибка при запуске турнира';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId]);

    // Завершение турнира
    const endTournament = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post(`/tournaments/${tournamentId}/end`);
            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Ошибка при завершении турнира';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId]);

    // Перегенерация сетки
    const regenerateBracket = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.post(`/tournaments/${tournamentId}/regenerate-bracket`);
            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Ошибка при перегенерации сетки';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId]);

    // Сохранение результата матча
    const saveMatchResult = useCallback(async (matchId, resultData) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await axios.put(`/tournaments/${tournamentId}/matches/${matchId}/result`, {
                score1: resultData.score1,
                score2: resultData.score2,
                maps_data: resultData.maps_data || null
            });

            return { success: true, data: response.data };
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Ошибка при сохранении результата';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId]);

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