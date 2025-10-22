import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../utils/api';

export function useMixTeams(tournamentId, isEnabled = false) {
    const [teams, setTeams] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const cacheRef = useRef({ data: null, ts: 0 });

    const fetchTeams = useCallback(async (force = false) => {
        if (!isEnabled || !tournamentId) return;
        const now = Date.now();
        if (!force && cacheRef.current.data && (now - cacheRef.current.ts) < 30000) {
            setTeams(cacheRef.current.data);
            return;
        }
        try {
            setIsLoading(true);
            setError('');
            const token = localStorage.getItem('token');
            const res = await api.get(`/api/tournaments/${tournamentId}/teams`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            const list = Array.isArray(res.data) ? res.data : [];
            cacheRef.current = { data: list, ts: now };
            setTeams(list);
        } catch (e) {
            console.error('useMixTeams: ошибка загрузки команд', e);
            setError(e?.response?.data?.error || 'Ошибка загрузки команд');
            setTeams([]);
        } finally {
            setIsLoading(false);
        }
    }, [tournamentId, isEnabled]);

    useEffect(() => {
        if (isEnabled) fetchTeams(false);
    }, [isEnabled, fetchTeams]);
    
    // 🆕 WebSocket подписка на обновления команд
    useEffect(() => {
        if (!isEnabled || !tournamentId) return;
        
        let socket;
        try {
            const { getSocketInstance } = require('../../services/socketClient_v5_simplified');
            socket = getSocketInstance && getSocketInstance();
        } catch (_) {
            return;
        }
        
        if (!socket) return;
        
        const handleTeamsUpdate = (payload) => {
            try {
                const tid = Number(payload?.tournamentId || payload?.id);
                if (tid === Number(tournamentId)) {
                    console.log(`🔄 [useMixTeams] Получено обновление команд для турнира ${tournamentId}, обновляем...`);
                    fetchTeams(true); // Принудительное обновление (игнорируем кеш)
                }
            } catch (_) {}
        };
        
        const handleRostersConfirmed = (payload) => {
            try {
                const tid = Number(payload?.tournamentId);
                if (tid === Number(tournamentId)) {
                    console.log(`✅ [useMixTeams] Составы подтверждены для турнира ${tournamentId}, обновляем...`);
                    fetchTeams(true);
                }
            } catch (_) {}
        };
        
        socket.on && socket.on('tournament_update', handleTeamsUpdate);
        socket.on && socket.on('fullmix_rosters_confirmed', handleRostersConfirmed);
        
        return () => {
            socket.off && socket.off('tournament_update', handleTeamsUpdate);
            socket.off && socket.off('fullmix_rosters_confirmed', handleRostersConfirmed);
        };
    }, [isEnabled, tournamentId, fetchTeams]);

    return {
        teams,
        isLoading,
        error,
        refetch: () => fetchTeams(true)
    };
}

export default useMixTeams;


