import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';

/**
 * Custom hook для управления авторизацией и правами пользователя в турнире
 * Извлечен из TournamentDetails.js для модульности
 */
export const useTournamentAuth = (tournament, tournamentId) => {
    const [user, setUser] = useState(null);
    const [teams, setTeams] = useState([]);
    const [isCreator, setIsCreator] = useState(false);
    const [isAdminOrCreator, setIsAdminOrCreator] = useState(false);
    const [isParticipating, setIsParticipating] = useState(false);
    const [adminRequestStatus, setAdminRequestStatus] = useState(null);

    // Загружаем данные пользователя
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api
                .get('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
                .then((userResponse) => {
                    setUser(userResponse.data);
                    // Загружаем команды пользователя
                    api
                        .get('/api/teams/my-teams', { 
                            headers: { Authorization: `Bearer ${token}` } 
                        })
                        .then((res) => setTeams(res.data || []))
                        .catch((error) => console.error('Ошибка загрузки команд:', error));
                })
                .catch((error) => console.error('Ошибка загрузки пользователя:', error));
        } else {
            setUser(null);
            setTeams([]);
        }
    }, []);

    // Проверка участия пользователя и прав администратора
    useEffect(() => {
        if (!user || !tournament) return;

        // Проверка участия
        const participants = tournament.participants || [];
        const isParticipant = participants.some(
            (p) =>
                (tournament.participant_type === 'solo' && p.user_id === user.id) ||
                (tournament.participant_type === 'team' && p.creator_id === user.id)
        );
        setIsParticipating(isParticipant);

        // Проверка прав администратора и создателя
        const isCreatorCheck = user.id === tournament.created_by;
        setIsCreator(isCreatorCheck);
        
        const isAdmin = tournament.admins?.some(admin => admin.id === user.id);
        setIsAdminOrCreator(isCreatorCheck || isAdmin);

        // Проверка статуса запроса на администрирование
        if (localStorage.getItem('token')) {
            api
                .get(`/api/tournaments/${tournamentId}/admin-request-status`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                })
                .then((statusResponse) => setAdminRequestStatus(statusResponse.data.status))
                .catch((error) => console.error('Ошибка загрузки статуса администратора:', error));
        }
    }, [user, tournament, tournamentId]);

    // Функция для запроса прав администратора
    const handleRequestAdmin = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            return { success: false, message: 'Пожалуйста, войдите, чтобы запросить права администратора' };
        }

        try {
            const requestAdminResponse = await api.post(
                `/api/tournaments/${tournamentId}/request-admin`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAdminRequestStatus('pending');
            return { success: true, message: requestAdminResponse.data.message };
        } catch (error) {
            const message = error.response?.data?.message || error.response?.data?.error || 'Ошибка при запросе прав администратора';
            return { success: false, message };
        }
    }, [tournamentId]);

    // Вычисляемые права доступа
    const permissions = {
        canRequestAdmin: user && !isCreator && !adminRequestStatus,
        canGenerateBracket: user && (isCreator || adminRequestStatus === 'accepted'),
        canEditMatches: user && (isCreator || adminRequestStatus === 'accepted'),
        canEndTournament: user && (isCreator || adminRequestStatus === 'accepted') && tournament?.status === 'in_progress',
        canManageParticipants: user && (isCreator || adminRequestStatus === 'accepted'),
        canEditTournament: user && (isCreator || adminRequestStatus === 'accepted'),
        canViewAdminTab: isAdminOrCreator
    };

    // Функция проверки участия пользователя
    const isUserParticipant = useCallback((userId) => {
        if (!tournament || !tournament.participants) return false;
        return tournament.participants.some(participant => 
            participant.user_id === userId || participant.creator_id === userId || participant.id === userId
        );
    }, [tournament]);

    return {
        // Данные пользователя
        user,
        teams,
        
        // Статусы
        isCreator,
        isAdminOrCreator, 
        isParticipating,
        adminRequestStatus,
        
        // Права доступа
        permissions,
        
        // Функции
        handleRequestAdmin,
        isUserParticipant,
        
        // Установщики состояний
        setUser,
        setTeams,
        setIsParticipating,
        setAdminRequestStatus
    };
}; 