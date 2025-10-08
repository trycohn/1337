import { useEffect, useState } from 'react';
import api from '../../../axios';

export function useMatchStats(matchId, mode) { // mode: 'custom' | 'tournament'
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoading(true);
                setError('');
                const url = mode === 'tournament'
                    ? `/api/matches/tournament/${matchId}/stats`
                    : `/api/matches/custom/${matchId}/stats`;
                const r = await api.get(url);
                if (!mounted) return;
                if (r?.data?.success) setData(r.data); else setError('Статистика недоступна');
            } catch (e) {
                if (!mounted) return;
                setError('Ошибка загрузки статистики');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [matchId, mode]);

    return { data, loading, error };
}


