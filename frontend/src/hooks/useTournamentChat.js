import { useState } from 'react';
import api from '../axios';

export const useTournamentChat = () => {
    const [participants, setParticipants] = useState([]);
    const [chatInfo, setChatInfo] = useState(null);
    const [loadingParticipants, setLoadingParticipants] = useState(false);

    // Определяем является ли чат турнирным
    const isTournamentChat = (activeChat) => {
        return activeChat?.type === 'group' && 
               activeChat?.name && 
               activeChat.name.startsWith('Турнир: ');
    };

    // Получаем ID турнира из имени чата
    const getTournamentIdFromChat = (activeChat) => {
        if (!isTournamentChat(activeChat)) return null;
        
        // Можно попробовать найти турнир по имени
        // Пока возвращаем null, нужно будет добавить поле tournament_id в чаты или найти другой способ
        return null;
    };

    // Загружаем участников турнирного чата
    const loadTournamentParticipants = async (activeChat) => {
        if (!isTournamentChat(activeChat)) return;

        setLoadingParticipants(true);
        try {
            const token = localStorage.getItem('token');
            
            // Нужно найти турнир по названию чата или добавить tournament_id в чаты
            // Пока попробуем найти по названию
            const tournamentName = activeChat.name.replace('Турнир: ', '');
            
            // Получаем список турниров и ищем нужный
            const tournamentsResponse = await api.get('/api/tournaments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const tournament = tournamentsResponse.data.find(t => t.name === tournamentName);
            
            if (!tournament) {
                console.error('Турнир не найден');
                return;
            }
            
            const response = await api.get(`/api/tournaments/${tournament.id}/chat/participants`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setParticipants(response.data.participants);
            setChatInfo({
                name: response.data.chat_name,
                creator: response.data.tournament_creator,
                totalCount: response.data.total_count
            });
        } catch (error) {
            console.error('Ошибка загрузки участников чата:', error);
        } finally {
            setLoadingParticipants(false);
        }
    };

    return {
        participants,
        chatInfo,
        loadingParticipants,
        isTournamentChat,
        getTournamentIdFromChat,
        loadTournamentParticipants
    };
}; 