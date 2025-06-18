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
            // 🎯 ПЕРЕДАЕМ ВСЕ ПОЛЯ УЧАСТНИКА ВКЛЮЧАЯ РЕЙТИНГИ
            const requestData = {
                participantName: participantData.display_name,
                userId: null // Для незарегистрированных участников
            };

            // Добавляем поля рейтинга если они заполнены
            if (participantData.email && participantData.email.trim()) {
                requestData.email = participantData.email.trim();
            }

            if (participantData.faceit_elo && participantData.faceit_elo.toString().trim()) {
                requestData.faceit_elo = parseInt(participantData.faceit_elo);
            }

            if (participantData.cs2_premier_rank && participantData.cs2_premier_rank.toString().trim()) {
                requestData.cs2_premier_rank = parseInt(participantData.cs2_premier_rank);
            }

            console.log('🔍 Отправляем данные участника на сервер:', requestData);

            const response = await axios.post(`/api/tournaments/${tournamentId}/add-participant`, requestData, {
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
            // 🔧 КРИТИЧЕСКАЯ ПРОВЕРКА: убеждаемся что matchId валиден
            if (!matchId && matchId !== 0) {
                console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: matchId не передан или равен undefined/null!', {
                    matchId,
                    resultData,
                    typeOfMatchId: typeof matchId
                });
                throw new Error('ID матча не указан');
            }

            // Конвертируем в число
            const validMatchId = parseInt(matchId);
            if (isNaN(validMatchId)) {
                console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: matchId не является числом!', {
                    matchId,
                    validMatchId,
                    resultData
                });
                throw new Error('Некорректный ID матча');
            }

            console.log('🔍 Sending request to saveMatchResult:', {
                tournamentId,
                matchId: validMatchId,
                resultData
            });
            
            const requestData = {
                matchId: validMatchId,
                winner_team_id: null, // Определим ниже
                score1: parseInt(resultData.score1) || 0,
                score2: parseInt(resultData.score2) || 0,
                maps: resultData.maps_data && resultData.maps_data.length > 0 ? resultData.maps_data : null
            };
            
            // 🔧 УЛУЧШЕННОЕ ОПРЕДЕЛЕНИЕ WINNER_TEAM_ID
            if (resultData.winner) {
                try {
                    // Пытаемся найти матч в кэше турнира
                    const tournamentData = localStorage.getItem('currentTournament');
                    if (tournamentData) {
                        const tournament = JSON.parse(tournamentData);
                        const match = tournament.matches?.find(m => parseInt(m.id) === validMatchId);
                        
                        if (match) {
                            if (resultData.winner === 'team1') {
                                requestData.winner_team_id = parseInt(match.team1_id);
                                console.log('✅ Определен winner_team_id для team1:', requestData.winner_team_id);
                            } else if (resultData.winner === 'team2') {
                                requestData.winner_team_id = parseInt(match.team2_id);
                                console.log('✅ Определен winner_team_id для team2:', requestData.winner_team_id);
                            }
                        } else {
                            console.warn('⚠️ Матч не найден в кэше турнира, winner_team_id останется null');
                        }
                    } else {
                        console.warn('⚠️ Данные турнира не найдены в localStorage, winner_team_id останется null');
                    }
                } catch (error) {
                    console.warn('⚠️ Ошибка при определении winner_team_id:', error);
                }
            }
            
            console.log('🔍 Отправляем данные на сервер:', requestData);
            
            const response = await axios.post(`/api/tournaments/${tournamentId}/update-match`, requestData, {
                headers: getAuthHeaders()
            });

            console.log('✅ Результат матча успешно сохранен:', response.data);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Ошибка при сохранении результата матча:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Неизвестная ошибка';
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

    // 🆕 ПРИГЛАШЕНИЕ АДМИНИСТРАТОРА
    const inviteAdmin = useCallback(async (userId) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log('👑 Отправка приглашения администратора:', {
                tournamentId,
                userId
            });

            const response = await axios.post(`/api/tournaments/${tournamentId}/invite-admin`, {
                inviteeId: userId
            }, {
                headers: getAuthHeaders()
            });

            console.log('👑 Ответ сервера на приглашение администратора:', response.data);

            // Backend возвращает объект с message, но без success флага
            return {
                success: true,
                message: response.data.message || 'Приглашение отправлено',
                data: response.data
            };
        } catch (error) {
            console.error('👑 Ошибка при приглашении администратора:', error);
            const errorMessage = error.response?.data?.message || 'Ошибка при отправке приглашения';
            setError(errorMessage);
            
            return {
                success: false,
                message: errorMessage
            };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, getAuthHeaders]);

    // 🆕 УДАЛЕНИЕ АДМИНИСТРАТОРА
    const removeAdmin = useCallback(async (userId) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log('🗑️ Удаление администратора:', {
                tournamentId,
                userId
            });

            const response = await axios.delete(`/api/tournaments/${tournamentId}/admins/${userId}`, {
                headers: getAuthHeaders()
            });

            console.log('🗑️ Ответ сервера на удаление администратора:', response.data);

            if (response.data.success) {
                return {
                    success: true,
                    message: response.data.message || 'Администратор удален',
                    data: response.data.data
                };
            } else {
                return {
                    success: false,
                    message: response.data.message || 'Ошибка при удалении администратора'
                };
            }
        } catch (error) {
            console.error('🗑️ Ошибка при удалении администратора:', error);
            const errorMessage = error.response?.data?.message || 'Ошибка при удалении администратора';
            setError(errorMessage);
            
            return {
                success: false,
                message: errorMessage
            };
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, getAuthHeaders]);

    // 🆕 ПРИНЯТИЕ ПРИГЛАШЕНИЯ АДМИНИСТРАТОРА (для системы чата)
    const acceptAdminInvitation = useCallback(async (invitationId) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log('✅ Принятие приглашения администратора:', {
                invitationId
            });

            const response = await axios.post(`/api/admin-invitations/${invitationId}/accept`);

            console.log('✅ Ответ сервера на принятие приглашения:', response.data);

            if (response.data.success) {
                return {
                    success: true,
                    message: response.data.message || 'Приглашение принято',
                    data: response.data.data
                };
            } else {
                return {
                    success: false,
                    message: response.data.message || 'Ошибка при принятии приглашения'
                };
            }
        } catch (error) {
            console.error('✅ Ошибка при принятии приглашения:', error);
            const errorMessage = error.response?.data?.message || 'Ошибка при принятии приглашения';
            setError(errorMessage);
            
            return {
                success: false,
                message: errorMessage
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 🆕 ОТКЛОНЕНИЕ ПРИГЛАШЕНИЯ АДМИНИСТРАТОРА (для системы чата)
    const declineAdminInvitation = useCallback(async (invitationId) => {
        setIsLoading(true);
        setError(null);

        try {
            console.log('❌ Отклонение приглашения администратора:', {
                invitationId
            });

            const response = await axios.post(`/api/admin-invitations/${invitationId}/decline`);

            console.log('❌ Ответ сервера на отклонение приглашения:', response.data);

            if (response.data.success) {
                return {
                    success: true,
                    message: response.data.message || 'Приглашение отклонено',
                    data: response.data.data
                };
            } else {
                return {
                    success: false,
                    message: response.data.message || 'Ошибка при отклонении приглашения'
                };
            }
        } catch (error) {
            console.error('❌ Ошибка при отклонении приглашения:', error);
            const errorMessage = error.response?.data?.message || 'Ошибка при отклонении приглашения';
            setError(errorMessage);
            
            return {
                success: false,
                message: errorMessage
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

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
        clearError,
        
        // 🆕 НОВЫЕ МЕТОДЫ ДЛЯ УПРАВЛЕНИЯ АДМИНИСТРАТОРАМИ
        inviteAdmin,
        removeAdmin,
        acceptAdminInvitation,
        declineAdminInvitation
    };
};

export default useTournamentManagement; 